/* eslint-env browser */
import { WebGPUContext } from './context'
import {
  FillWorkflow,
  GlyphWorkflow,
  HeatmapWorkflow,
  HillshadeWorkflow,
  LineWorkflow,
  PointWorkflow,
  RasterWorkflow,
  ShadeWorkflow,
  SkyboxWorkflow,
  WallpaperWorkflow
} from './workflows'

import type { MapOptions } from 'ui/s2mapUI'
import type {
  FeatureBase,
  GlyphFeature,
  HeatmapFeature,
  Workflow,
  WorkflowImports,
  WorkflowType,
  Workflows
} from './workflows/workflow.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { TileGPU as Tile } from 'source/tile.spec'
import type Projector from 'ui/camera/projector'
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec'
import type TimeCache from 'ui/camera/timeCache'
import type { ColorMode } from 's2Map'

export default class Painter {
  context: WebGPUContext
  workflows: Workflows = {}
  dirty = true
  constructor (context: GPUCanvasContext, options: MapOptions) {
    this.context = new WebGPUContext(context, options, this)
  }

  // called once to properly prepare the context
  async prepare (): Promise<void> {
    await this.context.connectGPU()
  }

  buildFeatureData (tile: Tile, data: PainterData): void {
    // TODO: fix typescript
    const workflow = this.workflows[data.type] as { buildSource: (data: PainterData, tile: Tile) => void } | undefined
    workflow?.buildSource(data, tile)
  }

  async buildWorkflows (buildSet: Set<WorkflowType>): Promise<void> {
    const { workflows, context } = this
    const programCases: WorkflowImports = {
      fill: () => new FillWorkflow(context),
      raster: () => new RasterWorkflow(context),
      // sensor: () => new SensorWorkflow(context),
      line: () => new LineWorkflow(context),
      point: () => new PointWorkflow(context),
      heatmap: () => new HeatmapWorkflow(context),
      hillshade: () => new HillshadeWorkflow(context),
      shade: () => new ShadeWorkflow(context),
      glyph: () => new GlyphWorkflow(context),
      wallpaper: () => new WallpaperWorkflow(context),
      skybox: () => new SkyboxWorkflow(context)
    }
    const promises: Array<Promise<void>> = []
    for (const set of buildSet) {
      // @ts-expect-error - typescript can't handle matching the workflow to the module
      const workflow: Workflow = workflows[set] = programCases[set]()
      if (set === 'wallpaper' || set === 'skybox') workflows.background = workflows[set]
      promises.push(workflow.setup())
    }
    await Promise.allSettled(promises)
  }

  async getScreen (): Promise<Uint8ClampedArray> {
    return await this.context.getRenderData()
  }

  setColorMode (mode: ColorMode): void {
    this.dirty = true
    this.context.setColorBlindMode(mode)
  }

  injectGlyphImages (maxHeight: number, images: GlyphImages, tiles: Tile[]): void {
    const textureResized = this.context.injectImages(maxHeight, images)
    if (textureResized) {
      for (const feature of tiles.flatMap(tile => tile.featureGuides)) feature.updateSharedTexture?.()
    }
  }

  injectSpriteImage (data: SpriteImageMessage, tiles: Tile[]): void {
    const textureResized = this.context.injectSpriteImage(data)
    if (textureResized) {
      for (const feature of tiles.flatMap(tile => tile.featureGuides)) feature.updateSharedTexture?.()
    }
  }

  injectTimeCache (timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache)
  }

  resize (width: number, height: number): void {
    this.context.resize((): void => {
      // If any workflows are using the resize method, call it
      for (const workflow of Object.values(this.workflows) as Workflow[]) workflow.resize?.(width, height)
    })
    // notify that the painter is dirty
    this.dirty = true
  }

  paint (projector: Projector, tiles: Tile[]): void {
    const { context, workflows } = this
    // setup for the next frame
    context.newScene(projector.view, projector.getMatrix('m'))
    // prep mask id's
    tiles.forEach((tile, index) => { tile.tmpMaskID = index + 1 })

    const allFeatures = tiles.flatMap(tile => tile.featureGuides)
    // Mercator: the tile needs to update it's matrix at all zooms.
    // S2: all features tiles past zoom 12 must set screen positions
    let featureTiles = allFeatures
      .flatMap(({ parent, tile }) => parent !== undefined ? [parent, tile] : [tile])
    // remove all duplicates of tiles by their id
    featureTiles = featureTiles.filter((tile, index) => featureTiles.findIndex(t => t.id === tile.id) === index)
    for (const tile of featureTiles) tile.setScreenPositions(projector)

    // prep all tile's features to draw
    const features = allFeatures.filter(f => f.type !== 'heatmap')
    // draw heatmap data if applicable, and a singular feature for the main render thread to draw the texture to the screen
    const heatmapFeatures = allFeatures.filter((f): f is HeatmapFeature => f.type === 'heatmap')

    // compute heatmap data
    const heatmapFeature = workflows.heatmap?.textureDraw(heatmapFeatures)
    if (heatmapFeature !== undefined) features.push(...heatmapFeature)
    // sort features
    features.sort(featureSort)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter((f): f is GlyphFeature => f.type === 'glyph')
    workflows.glyph?.computeFilters(glyphFeatures)

    // DRAW PHASE
    // draw masks
    for (const { mask } of tiles) mask.draw()
    // draw the wallpaper
    workflows.background?.draw(projector)
    // paint opaque fills
    const opaqueFillFeatures = features.filter(f => f.opaque).reverse()
    for (const feature of opaqueFillFeatures) feature.draw()
    // paint features that are potentially transparent
    const residualFeatures = features.filter(f => !(f.opaque ?? false))
    for (const feature of residualFeatures) feature.draw()

    // finish
    context.finish()
  }

  computeInteractive (tiles: Tile[]): void {
    const interactiveFeatures = tiles
      .flatMap(tile => tile.featureGuides)
      .filter(feature => feature.interactive === true)
      .sort(featureSort)
      .reverse()
    if (interactiveFeatures.length > 0) {
      // prepare & compute
      this.context.clearInteractBuffer()
      this.#computeInteractive(interactiveFeatures)
    }
  }

  #computeInteractive (features: FeatureBase[]): void {
    const { device, frameBufferBindGroup } = this.context
    // prepare
    const commandEncoder = device.createCommandEncoder()
    const computePass = this.context.computePass = commandEncoder.beginComputePass()
    computePass.setBindGroup(0, frameBufferBindGroup)
    // compute
    for (const feature of features) feature.compute?.()
    // finish
    computePass.end()
    device.queue.submit([commandEncoder.finish()])
  }

  delete (): void {
    const { context, workflows } = this
    for (const workflow of Object.values(workflows) as Workflow[]) workflow.destroy()
    context.destroy()
  }
}

function featureSort (a: FeatureBase, b: FeatureBase): number {
  // first check if the layer is the same
  let diff = a.layerGuide.layerIndex - b.layerGuide.layerIndex
  if (diff !== 0) return diff
  // check for zoom difference
  const zoomDiff = ((a.parent !== undefined) ? 1 : 0) - ((b.parent !== undefined) ? 1 : 0)
  if (zoomDiff !== 0) return zoomDiff
  // lastlye try to sort by feature code
  let index = 0
  const maxSize = Math.min(a.featureCode.length, b.featureCode.length)
  while (diff === 0 && index < maxSize) {
    diff = a.featureCode[index] - b.featureCode[index]
    index++
  }
  return diff
}

/** CONTEXTS */
import { WebGL2Context, WebGLContext } from './context'
/** WORKFLOWS */
import {
  FillWorkflow,
  GlyphFilterWorkflow,
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
import type { Painter as PainterSpec } from './painter.spec'
import type { TileGL as Tile } from 'source/tile.spec'

import type { MapOptions } from 'ui/s2mapUI'
import type Projector from 'ui/camera/projector'
import type TimeCache from 'ui/camera/timeCache'
import type {
  Features,
  GlyphFeature,
  HeatmapFeature,
  // SensorWorkflow,
  Workflow,
  WorkflowImports,
  WorkflowKey,
  WorkflowType,
  Workflows
} from './workflows/workflow.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { ColorMode } from 's2Map'
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec'
import type { Point } from 'geometry'

export default class Painter implements PainterSpec {
  context: WebGL2Context | WebGLContext
  workflows: Workflows = {}
  curWorkflow?: WorkflowKey
  dirty = true
  constructor (
    context: WebGL2RenderingContext | WebGLRenderingContext,
    type: 1 | 2,
    options: MapOptions
  ) {
    // build a context API
    if (type === 2) this.context = new WebGL2Context(context as WebGL2RenderingContext, options, this)
    else this.context = new WebGLContext(context as WebGLRenderingContext, options, this)
  }

  async prepare (): Promise<void> {}

  delete (): void {
    const { context, workflows } = this
    for (const workflow of Object.values(workflows)) workflow.delete()
    context.delete()
  }

  buildFeatureData (tile: Tile, data: PainterData): void {
    const workflow = this.workflows[data.type] as { buildSource: (data: PainterData, tile: Tile) => void } | undefined
    workflow?.buildSource(data, tile)
  }

  async buildWorkflows (buildSet: Set<WorkflowType>): Promise<void> {
    const { workflows, context } = this
    const promises: Array<Promise<void>> = []
    const workflowImports: WorkflowImports = {
      fill: async () => { return new FillWorkflow(context) },
      glyphFilter: async () => { return new GlyphFilterWorkflow(context) },
      glyph: async () => { return new GlyphWorkflow(context) },
      heatmap: async () => { return new HeatmapWorkflow(context) },
      hillshade: async () => { return new HillshadeWorkflow(context) },
      line: async () => { return new LineWorkflow(context) },
      point: async () => { return new PointWorkflow(context) },
      raster: async () => { return new RasterWorkflow(context) },
      sensor: async () => { return await import('./workflows/sensorWorkflow') },
      shade: async () => { return new ShadeWorkflow(context) },
      skybox: async () => { return new SkyboxWorkflow(context) },
      wallpaper: async () => { return new WallpaperWorkflow(context) }
    }
    const workflowKeys: Array<keyof Omit<Workflows, 'background'>> = []
    for (const workflow of buildSet) {
      if (workflow in workflows) continue
      if (workflow === 'glyph') workflowKeys.push('glyphFilter')
      workflowKeys.push(workflow)
    }
    // actually import the workflows
    for (const key of workflowKeys) {
      promises.push(workflowImports[key]?.()
        .then(async (res): Promise<void> => {
          if ('default' in res) {
            const { default: pModule } = res
            workflows[key as 'sensor'] = await pModule(context)
          } else {
            workflows[key] = res
          }
          if (key === 'wallpaper' || key === 'skybox') workflows.background = workflows[key]
        })
        .catch((err) => {
          console.error(`FAILED to import painter workflow ${key}`, err)
        })
      )
    }
    await Promise.allSettled(promises)
    if (workflows.glyphFilter !== undefined && workflows.glyph !== undefined) {
      const glyph = workflows.glyph
      glyph.injectFilter(workflows.glyphFilter)
    }
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Point): void {
    const { workflows } = this
    for (const workflowName in workflows) {
      workflows[workflowName as keyof Workflows]?.injectFrameUniforms(matrix, view, aspect)
    }
  }

  injectTimeCache (timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache)
  }

  resize (_width: number, _height: number): void {
    const { context } = this
    // If we are using the text workflow, update the text workflow's framebuffer component's sizes
    const glyphFilter = this.workflows.glyphFilter
    const heatmap = this.workflows.heatmap
    if (glyphFilter !== undefined) glyphFilter.resize()
    if (heatmap !== undefined) heatmap.resize()
    // ensure interaction buffer is accurate
    context.resize()
    // ensure our default viewport is accurate
    context.resetViewport()
    // notify that the painter is dirty
    this.dirty = true
  }

  paint (projector: Projector, tiles: Tile[]): void {
    const { context, workflows } = this
    // reset the current workflow as undefined to ensure a new flush happens
    context.resetWorkflow()
    // prep frame uniforms
    const { view, aspect } = projector
    const matrix = projector.getMatrix('m')
    this.injectFrameUniforms(matrix, view, aspect)
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
    const hfs = workflows.heatmap?.textureDraw(heatmapFeatures)
    if (hfs !== undefined) features.push(...hfs)
    // sort features
    features.sort(featureSort)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter((f): f is GlyphFeature => f.type === 'glyph')
    workflows.glyph?.computeFilters(glyphFeatures)

    // DRAW PHASE
    // setup for the next frame
    context.newScene()
    // draw masks
    context.enableMaskTest()
    for (const { mask } of tiles) mask.draw()
    context.flushMask()
    // draw the wallpaper
    workflows.background?.draw(projector)
    // paint opaque fills
    const opaqueFillFeatures = features.filter(f => f.layerGuide.opaque).reverse()
    for (const feature of opaqueFillFeatures) feature.draw()
    // paint features that are potentially transparent
    const residualFeatures = features.filter(f => !(f.layerGuide.opaque ?? false))
    for (const feature of residualFeatures) feature.draw()

    // finish
    context.finish()
  }

  computeInteractive (tiles: Tile[]): void {
    const interactiveFeatures = tiles
      .flatMap(tile => tile.featureGuides)
      .filter(feature => feature.layerGuide.interactive)
      .sort(featureSort)
      .reverse()
    if (interactiveFeatures.length > 0) {
      // prepare & compute
      this.context.clearInteractBuffer()
      for (const f of interactiveFeatures) f.draw(true)
    }
  }

  async getScreen (): Promise<Uint8ClampedArray> {
    const { gl } = this.context
    const { canvas, RGBA, UNSIGNED_BYTE } = gl
    const { width, height } = canvas
    const pixels = new Uint8ClampedArray(width * height * 4)
    gl.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels)

    return pixels
  }

  injectGlyphImages (maxHeight: number, images: GlyphImages): void {
    this.context.injectImages(maxHeight, images)
  }

  injectSpriteImage (data: SpriteImageMessage): void {
    this.context.injectSpriteImage(data)
  }

  setColorMode (mode: ColorMode): void {
    this.dirty = true
    // tell all the workflows
    const { workflows } = this
    for (const workflowName in workflows) {
      const workflow = workflows[workflowName as WorkflowKey] as unknown as Workflow
      workflow.updateColorBlindMode = mode
    }
  }
}

function featureSort (a: Features, b: Features): number {
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

/** CONTEXTS */
import { WebGL2Context, WebGLContext } from './contexts'
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
  FeatureGuide,
  GlyphFeature,
  HeatmapFeature,
  SensorWorkflow,
  Workflow,
  WorkflowImports,
  WorkflowKey,
  WorkflowType,
  Workflows
} from './workflows/workflow.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { ColorMode } from 's2Map'
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec'

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
    if (type === 2) this.context = new WebGL2Context(context as WebGL2RenderingContext, options)
    else this.context = new WebGLContext(context as WebGLRenderingContext, options)
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
        .then(async (res) => {
          if ('default' in res) {
            const { default: pModule } = res
            // TODO: Figure out why eslint and tsc don't see an error but vscode does:
            workflows[key] = await pModule(context)
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

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: [number, number]): void {
    const { workflows } = this
    for (const workflowName in workflows) {
      workflows[workflowName as keyof Workflows]?.injectFrameUniforms(matrix, view, aspect)
    }
  }

  injectTimeCache (timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache)
  }

  useWorkflow (workflowName: 'fill'): FillWorkflow
  useWorkflow (workflowName: 'glyph'): GlyphWorkflow | undefined
  useWorkflow (workflowName: 'heatmap'): HeatmapWorkflow | undefined
  useWorkflow (workflowName: 'line'): LineWorkflow | undefined
  useWorkflow (workflowName: 'point'): PointWorkflow | undefined
  useWorkflow (workflowName: 'raster'): RasterWorkflow | undefined
  useWorkflow (workflowName: 'hillshade'): HillshadeWorkflow | undefined
  useWorkflow (workflowName: 'sensor'): SensorWorkflow | undefined
  useWorkflow (workflowName: 'shade'): ShadeWorkflow | undefined
  useWorkflow (workflowName: 'glyphFilter'): GlyphFilterWorkflow | undefined
  useWorkflow (workflowName: 'background'): WallpaperWorkflow | SkyboxWorkflow | undefined
  useWorkflow (workflowName: WorkflowKey): Workflow | undefined
  useWorkflow (workflowName: WorkflowKey): Workflow | undefined {
    const workflow = this.workflows[workflowName]
    if (workflow === undefined && workflowName !== 'background') throw new Error(`Workflow ${workflowName} not found`)
    if (this.curWorkflow !== workflowName) {
      this.curWorkflow = workflowName
      workflow?.use()
    } else { workflow?.flush() }
    return workflow
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
    const { context } = this
    // PREPARE PHASE
    this.curWorkflow = undefined
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

    // draw heatmap data if applicable
    const heatmapFeatures = allFeatures.filter(f => f.type === 'heatmap') as HeatmapFeature[]
    if (heatmapFeatures.length > 0) features.push(this.paintHeatmap(heatmapFeatures))
    // sort features
    features.sort(featureSort)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter(feature => feature.type === 'glyph' && !feature.overdraw) as GlyphFeature[]
    // use text boxes to filter out overlap
    if (glyphFeatures.length > 0) this.paintGlyphFilter(glyphFeatures)
    // return to our default framebuffer
    context.bindMainBuffer()
    // clear main buffer
    context.newScene()

    // DRAW PHASE
    // prep masks
    this.paintMasks(tiles)
    // draw the wallpaper
    this.useWorkflow('background')?.draw(projector)
    // paint opaque fills
    const opaqueFillFeatures = features.filter(f => f.opaque).reverse()
    this.paintFeatures(opaqueFillFeatures)
    // paint features that are potentially transparent
    const residualFeatures = features.filter(f => !(f.layerGuide.opaque ?? false))
    this.paintFeatures(residualFeatures)
    // cleanup
    context.cleanup()
  }

  computeInteractive (tiles: Tile[]): void {
    const interactiveFeatures = tiles
      .flatMap(tile => tile.featureGuides)
      .filter(feature => feature.layerGuide.interactive)
      .sort(featureSort)
      .reverse()
    if (interactiveFeatures.length > 0) {
      // prepare
      this.context.clearInteractBuffer()
      // draw
      this.paintFeatures(interactiveFeatures, true)
    }
  }

  paintMasks (tiles: Tile[]): void {
    // get context
    const { context } = this
    // prep the fill workflow
    const fillWorkflow = this.useWorkflow('fill')
    // set proper states
    context.enableMaskTest()

    // create mask for each tile
    for (const tile of tiles) {
      const { type, tmpMaskID, mask } = tile
      // set culling
      if (type === 'S2') context.enableCullFace()
      else context.disableCullFace()
      // set tile uniforms
      fillWorkflow.setTileUniforms(tile)
      // set correct tile mask
      context.stencilFuncAlways(tmpMaskID)
      // draw mask
      fillWorkflow.drawMask(mask)
    }
    // lock in the stencil, draw colors again
    context.flushMask()
  }

  paintFeatures (features: FeatureGuide[], interactive = false): void {
    if (features.length === 0) return
    // setup context
    const { context } = this
    // setup variables
    let curLayer = -1
    let workflow: Workflow | undefined
    // run through the features, and upon tile, layer, or workflow change, adjust accordingly
    for (const feature of features) {
      const { tile, parent, layerGuide: { layerIndex, layerCode, lch }, type } = feature
      const { tmpMaskID } = tile
      // set workflow
      workflow = this.useWorkflow(type)
      if (workflow === undefined) throw new Error(`Workflow ${type} not found`)
      // set stencil
      context.stencilFuncEqual(tmpMaskID)
      // update layerCode if the current layer has changed
      if (curLayer !== layerIndex) {
        // now setup new layercode
        curLayer = layerIndex
        workflow.setLayerCode(layerCode, lch)
        // set interactive if applicable
        workflow.setInteractive(interactive)
      }
      // adjust tile uniforms
      workflow.setTileUniforms(parent ?? tile)
      // draw (just ignore types... they are handled in the workflow)
      workflow.draw(feature as never, interactive)
    }
  }

  paintHeatmap (features: HeatmapFeature[]): HeatmapFeature {
    // grab heatmap workflow
    const heatmapWorkflow = this.useWorkflow('heatmap')
    if (heatmapWorkflow === undefined) throw new Error('Heatmap workflow not found')
    // setup texture draws
    heatmapWorkflow.setupTextureDraw()
    // draw all features
    for (const feature of features) {
      const { tile, parent, layerGuide: { layerCode, lch } } = feature
      // set tile uniforms & layercode, bind vao, and draw
      heatmapWorkflow.setTileUniforms(parent ?? tile)
      heatmapWorkflow.setLayerCode(layerCode, lch)
      heatmapWorkflow.drawTexture(feature)
    }
    // return a "featureGuide" to draw to the screen
    return features[0]
  }

  paintGlyphFilter (glyphFeatures: GlyphFeature[]): void {
    const glyphFilterWorkflow = this.useWorkflow('glyphFilter')
    if (glyphFilterWorkflow === undefined) throw new Error('GlyphFilter workflow not found')
    // Step 1: draw quads
    glyphFilterWorkflow.bindQuadFrameBuffer()
    this.#paintGlyphFilter(glyphFilterWorkflow, glyphFeatures, 1)
    // Step 2: draw result points
    glyphFilterWorkflow.bindResultFramebuffer()
    this.#paintGlyphFilter(glyphFilterWorkflow, glyphFeatures, 2)
  }

  async getScreen (): Promise<Uint8ClampedArray> {
    const { gl } = this.context
    const { canvas, RGBA, UNSIGNED_BYTE } = gl
    const { width, height } = canvas
    const pixels = new Uint8ClampedArray(width * height * 4)
    gl.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels)

    return pixels
  }

  #paintGlyphFilter (
    glyphFilterWorkflow: GlyphFilterWorkflow,
    glyphFeatures: GlyphFeature[],
    mode: 1 | 2
  ): void {
    const { context } = this
    const { gl } = context
    let curLayer = -1
    // set mode
    glyphFilterWorkflow.setMode(mode)
    // draw each feature
    for (const glyphFeature of glyphFeatures) {
      const { tile, parent, layerGuide: { layerIndex, layerCode, lch }, source } = glyphFeature
      // update layerIndex
      if (curLayer !== layerIndex) {
        curLayer = layerIndex
        glyphFilterWorkflow.setLayerCode(layerCode, lch)
      }
      glyphFilterWorkflow.setTileUniforms(parent ?? tile)
      gl.bindVertexArray(source.filterVAO)
      // draw
      glyphFilterWorkflow.draw(glyphFeature, false)
    }
  }

  injectGlyphImages (maxHeight: number, images: GlyphImages): void {
    this.context.injectImages(maxHeight, images)
  }

  injectSpriteImage (data: SpriteImageMessage): boolean {
    this.context.injectSpriteImage(data)
    return true
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

function featureSort (a: FeatureGuide, b: FeatureGuide): number {
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

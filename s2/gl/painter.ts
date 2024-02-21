/* eslint-env browser */
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** SOURCES **/
import type { Painter as PainterSpec } from './painter.spec'
import type { TileGL as Tile } from 'source/tile.spec'

import type { MapOptions } from 'ui/s2mapUI'
import type Projector from 'ui/camera/projector'
import type TimeCache from 'ui/camera/timeCache'
import type { FeatureGuide, GlyphFeatureGuide, HeatmapFeatureGuide } from './contexts/context.spec'
import type {
  FillProgram,
  GlyphFilterProgram,
  GlyphProgram,
  HeatmapProgram,
  HillshadeProgram,
  LineProgram,
  PointProgram,
  Program,
  RasterProgram,
  SensorProgram,
  ShadeProgram,
  SkyboxProgram,
  WallpaperProgram,
  WorkflowImports,
  WorkflowKey,
  WorkflowType,
  Workflows
} from './programs/program.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { ColorMode } from 's2Map'
import type { PainterData, SpriteImageMessage } from 'workers/worker.spec'

export default class Painter implements PainterSpec {
  context: WebGL2Context | WebGLContext
  workflows: Workflows = {}
  curProgram?: WorkflowKey
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
    for (const program of Object.values(workflows)) program.delete()
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
      fill: async () => { return await import('./programs/fillProgram') },
      raster: async () => { return await import('./programs/rasterProgram') },
      hillshade: async () => { return await import('./programs/hillshadeProgram') },
      sensor: async () => { return await import('./programs/sensorProgram') },
      line: async () => { return await import('./programs/lineProgram') },
      point: async () => { return await import('./programs/pointProgram') },
      heatmap: async () => { return await import('./programs/heatmapProgram') },
      shade: async () => { return await import('./programs/shadeProgram') },
      glyph: async () => { return await import('./programs/glyphProgram') },
      glyphFilter: async () => { return await import('./programs/glyphFilterProgram') },
      wallpaper: async () => { return await import('./programs/wallpaperProgram') },
      skybox: async () => { return await import('./programs/skyboxProgram') }
    }
    const programKeys: Array<keyof Omit<Workflows, 'background'>> = []
    for (const program of buildSet) {
      if (program in workflows) continue
      if (program === 'glyph') programKeys.push('glyphFilter')
      programKeys.push(program)
    }
    // actually import the programs
    for (const key of programKeys) {
      promises.push(workflowImports[key]?.()
        .then(async ({ default: pModule }) => {
          // @ts-expect-error - typescript can't handle matching the workflow to the module
          workflows[key] = await pModule(context)
          if (key === 'wallpaper' || key === 'skybox') workflows.background = workflows[key]
        })
        .catch((err) => {
          console.error(`FAILED to import painter program ${key}`, err)
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
    for (const programName in workflows) {
      workflows[programName as keyof Workflows]?.injectFrameUniforms(matrix, view, aspect)
    }
  }

  injectTimeCache (timeCache: TimeCache): void {
    this.workflows.sensor?.injectTimeCache(timeCache)
  }

  useWorkflow (programName: 'fill'): FillProgram
  useWorkflow (programName: 'glyph'): GlyphProgram | undefined
  useWorkflow (programName: 'heatmap'): HeatmapProgram | undefined
  useWorkflow (programName: 'line'): LineProgram | undefined
  useWorkflow (programName: 'point'): PointProgram | undefined
  useWorkflow (programName: 'raster'): RasterProgram | undefined
  useWorkflow (programName: 'hillshade'): HillshadeProgram | undefined
  useWorkflow (programName: 'sensor'): SensorProgram | undefined
  useWorkflow (programName: 'shade'): ShadeProgram | undefined
  useWorkflow (programName: 'glyphFilter'): GlyphFilterProgram | undefined
  useWorkflow (programName: 'background'): WallpaperProgram | SkyboxProgram | undefined
  useWorkflow (programName: WorkflowKey): Program | undefined
  useWorkflow (programName: WorkflowKey): Program | undefined {
    const program = this.workflows[programName]
    if (program === undefined && programName !== 'background') throw new Error(`Program ${programName} not found`)
    if (this.curProgram !== programName) {
      this.curProgram = programName
      program?.use()
    } else { program?.flush() }
    return program
  }

  resize (_width: number, _height: number): void {
    const { context } = this
    // If we are using the text program, update the text program's framebuffer component's sizes
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
    this.curProgram = undefined
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
    const heatmapFeatures = allFeatures.filter(f => f.type === 'heatmap') as HeatmapFeatureGuide[]
    if (heatmapFeatures.length > 0) features.push(this.paintHeatmap(heatmapFeatures))
    // sort features
    features.sort(featureSort)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter(feature => feature.type === 'glyph' && !feature.overdraw) as GlyphFeatureGuide[]
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
    const residualFeatures = features.filter(f => !(f.opaque ?? false))
    this.paintFeatures(residualFeatures)
    // cleanup
    context.cleanup()
  }

  computeInteractive (tiles: Tile[]): void {
    const interactiveFeatures = tiles
      .flatMap(tile => tile.featureGuides)
      .filter(feature => feature.interactive === true)
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
    // prep the fill program
    const fillProgram = this.useWorkflow('fill')
    // set proper states
    context.enableMaskTest()

    // create mask for each tile
    for (const tile of tiles) {
      const { type, tmpMaskID, mask } = tile
      // set culling
      if (type === 'S2') context.enableCullFace()
      else context.disableCullFace()
      // set tile uniforms
      fillProgram.setTileUniforms(tile)
      // set correct tile mask
      context.stencilFuncAlways(tmpMaskID)
      // draw mask
      fillProgram.drawMask(mask)
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
    let program: Program | undefined
    // run through the features, and upon tile, layer, or program change, adjust accordingly
    for (const feature of features) {
      const { tile, parent, layerGuide: { layerIndex }, type, layerCode, lch } = feature
      const { tmpMaskID } = tile
      // set program
      program = this.useWorkflow(type)
      if (program === undefined) throw new Error(`Program ${type} not found`)
      // set stencil
      context.stencilFuncEqual(tmpMaskID)
      // update layerCode if the current layer has changed
      if (curLayer !== layerIndex) {
        // now setup new layercode
        curLayer = layerIndex
        program.setLayerCode(layerCode, lch)
        // set interactive if applicable
        program.setInteractive(interactive)
      }
      // adjust tile uniforms
      program.setTileUniforms(parent ?? tile)
      // draw (just ignore types... they are handled in the program)
      program.draw(feature as any, interactive) // TODO: We could wisen this up
    }
  }

  paintHeatmap (features: HeatmapFeatureGuide[]): HeatmapFeatureGuide {
    // grab heatmap program
    const heatmapProgram = this.useWorkflow('heatmap')
    if (heatmapProgram === undefined) throw new Error('Heatmap program not found')
    // setup texture draws
    heatmapProgram.setupTextureDraw()
    // draw all features
    for (const feature of features) {
      const { tile, parent, layerCode, lch } = feature
      // set tile uniforms & layercode, bind vao, and draw
      heatmapProgram.setTileUniforms(parent ?? tile)
      heatmapProgram.setLayerCode(layerCode, lch)
      heatmapProgram.drawTexture(feature)
    }
    // return a "featureGuide" to draw to the screen
    return features[0]
  }

  paintGlyphFilter (glyphFeatures: GlyphFeatureGuide[]): void {
    const glyphFilterProgram = this.useWorkflow('glyphFilter')
    if (glyphFilterProgram === undefined) throw new Error('GlyphFilter program not found')
    // Step 1: draw quads
    glyphFilterProgram.bindQuadFrameBuffer()
    this.#paintGlyphFilter(glyphFilterProgram, glyphFeatures, 1)
    // Step 2: draw result points
    glyphFilterProgram.bindResultFramebuffer()
    this.#paintGlyphFilter(glyphFilterProgram, glyphFeatures, 2)
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
    glyphFilterProgram: GlyphFilterProgram,
    glyphFeatures: GlyphFeatureGuide[],
    mode: 1 | 2
  ): void {
    const { context } = this
    const { gl } = context
    let curLayer = -1
    // set mode
    glyphFilterProgram.setMode(mode)
    // draw each feature
    for (const glyphFeature of glyphFeatures) {
      const { lch, tile, parent, layerGuide: { layerIndex }, source, layerCode } = glyphFeature
      // update layerIndex
      if (curLayer !== layerIndex) {
        curLayer = layerIndex
        glyphFilterProgram.setLayerCode(layerCode, lch)
      }
      glyphFilterProgram.setTileUniforms(parent ?? tile)
      gl.bindVertexArray(source.filterVAO)
      // draw
      glyphFilterProgram.draw(glyphFeature, false)
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
    for (const programName in workflows) {
      const program = workflows[programName as WorkflowKey] as Program
      program.updateColorBlindMode = mode
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

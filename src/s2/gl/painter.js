// @flow
import Style from '../style'
/** CONTEXTS **/
// import { WebGL2Context, WebGLContext } from './contexts'
import WebGL2Context from './contexts/webGL2Context'
import WebGLContext from './contexts/webGLContext'
// import { WebGL2Context, WebGLContext, WebGPUContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  FillProgram,
  GlyphFilterProgram,
  GlyphProgram,
  HeatmapProgram,
  LineProgram,
  PointProgram,
  RasterProgram,
  ShadeProgram,
  SkyboxProgram,
  WallpaperProgram
} from './programs'
/** SOURCES **/
import { Tile } from '../source'

import type { MapOptions } from '../ui/map'
import type { Projection } from '../ui/camera/projections'
import type { FeatureGuide } from '../source/tile'
import type { ProgramType } from './programs/program'

export default class Painter {
  _canvas: HTMLCanvasElement
  context: WebGL2Context | WebGLContext
  programs: { [string]: Program } = {}
  currProgram: ProgramType
  dirty: boolean = true
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    // setup canvas
    this._canvas = canvas
    // create a webgl or webgl2 context
    this._createContext(options)
  }

  delete () {
    const { context, programs } = this
    for (const programName in programs) programs[programName].delete()
    context.delete()
  }

  _createContext (options: MapOptions) {
    // prep options
    const webglOptions = { powerPreference: 'high-performance', antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: true, stencil: true }
    let context
    // first try webGPU
    // if (navigator.gpu) {
    //   context = this._canvas.getContext('gpupresent')
    //   if (context && typeof context.configureSwapChain === 'function') {
    //     this.context = new WebGPUContext(context, options)
    //   }
    // }
    // than try webgl2
    // use webgl for mobile phones as the WebGL2 techniques might be too much for phones? Untested.
    if (!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))) {
      context = this._canvas.getContext('webgl2', webglOptions)
      if (context && typeof context.getParameter === 'function') {
        this.context = new WebGL2Context(context, options)
        return
      }
    }
    // webgl
    context = this._canvas.getContext('webgl', webglOptions)
    if (context && typeof context.getParameter === 'function') {
      this.context = new WebGLContext(context, options)
    }
  }

  buildPrograms (buildSet: Set<ProgramType>) {
    const { programs } = this
    for (const program of buildSet) {
      switch (program) {
        case 'raster':
          programs.raster = new RasterProgram(this.context)
          break
        case 'fill':
          programs.fill = new FillProgram(this.context)
          break
        case 'line':
          programs.line = new LineProgram(this.context)
          break
        case 'point':
          programs.point = new PointProgram(this.context)
          break
        case 'heatmap':
          programs.heatmap = new HeatmapProgram(this.context)
          break
        case 'shade':
          programs.shade = new ShadeProgram(this.context)
          break
        case 'glyph':
          programs.glyphFilter = new GlyphFilterProgram(this.context)
          programs.glyph = new GlyphProgram(this.context, programs.glyphFilter)
          break
        case 'wallpaper':
          programs.wallpaper = new WallpaperProgram(this.context)
          break
        case 'skybox':
          programs.skybox = new SkyboxProgram(this.context)
          break
        default: break
      }
    }
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Float32Array) {
    const { programs } = this
    for (const programName in programs) programs[programName].injectFrameUniforms(matrix, view, aspect)
  }

  useProgram (programName: ProgramType): void | Program {
    const program = this.programs[programName]
    // if (this.currProgram !== programName) {
    //   this.currProgram = programName
    //   program.use()
    // }
    program.use()
    return program
  }

  resize () {
    const { context } = this
    // If we are using the text program, update the text program's framebuffer component's sizes
    const glyphFilter: GlyphFilterProgram = this.programs.glyphFilter
    const heatmap: HeatmapProgram = this.programs.heatmap
    if (glyphFilter) glyphFilter.resize()
    if (heatmap) heatmap.resize()
    // ensure interaction buffer is accurate
    context.resizeInteract()
    // ensure our default viewport is accurate
    context.resetViewport()
    // notify that the painter is dirty
    this.dirty = true
  }

  paint (projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    // PREPARE PHASE
    // prep frame uniforms
    const { view, aspect } = projection
    const matrix = projection.getMatrix('m')
    // if past zoom 12, the tile will self align to the screen
    for (const tile of tiles) tile.setScreenPositions(projection)
    this.injectFrameUniforms(matrix, view, aspect)
    // prep mask id's
    this._createTileMasksIDs(tiles)
    // prep all tile's features to draw
    // $FlowIgnore
    const features = tiles.flatMap(tile => tile.featureGuide)
    // draw heatmap data if applicable
    const heatmapFeatures = tiles.flatMap(tile => tile.heatmapGuide)
    if (heatmapFeatures.length) features.push(this.paintHeatmap(heatmapFeatures))
    // sort features
    features.sort(featureSort)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter(feature => feature.type === 'glyph' && !feature.overdraw)
    // use text boxes to filter out overlap
    if (glyphFeatures.length) this.paintGlyphFilter(tiles, glyphFeatures)
    // return to our default framebuffer
    context.bindMainBuffer()
    // clear main buffer
    context.newScene()

    // DRAW PHASE
    // prep masks
    this.paintMasks(tiles)
    // draw the wallpaper
    if (style.wallpaper) {
      const wallpaperProgram: WallpaperProgram = this.useProgram(style.wallpaper.skybox ? 'skybox' : 'wallpaper')
      if (wallpaperProgram) wallpaperProgram.draw(style.wallpaper)
    }
    // paint opaque fills
    const opaqueFillFeatures = features.filter(feature => feature.opaque).reverse()
    this.paintFeatures(opaqueFillFeatures, false, tiles)
    // paint features
    const residualFeatures = features.filter(feature => !feature.opaque)
    this.paintFeatures(residualFeatures, false, tiles)
    // cleanup
    context.cleanup()
  }

  paintInteractive (tiles: Array<Tile>) {
    const interactiveFeatures = tiles
      .flatMap(tile => tile.featureGuide)
      .sort(featureSort)
      .filter(feature => feature.interactive)
      .reverse()
    if (interactiveFeatures.length) {
      // prepare
      this.context.clearInteractBuffer()
      // draw
      this.paintFeatures(interactiveFeatures, true, tiles)
    }
  }

  _createTileMasksIDs (tiles: Array<Tile>) {
    let maskRef = 1
    // add all tiles
    for (const tile of tiles) {
      tile.tmpMaskID = maskRef
      maskRef++
    }
  }

  paintMasks (tiles: Array<Tile>) {
    // get context
    const { context } = this
    const { gl } = context
    // prep the fill program
    const fillProgram: FillProgram = this.useProgram('fill')
    // prep stencil - don't draw color, only to the stencil
    context.enableMaskTest()
    context.lequalDepth()
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    // create mask for each tile
    for (const tile of tiles) {
      const { tmpMaskID, faceST, bottom, top, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      fillProgram.setTilePos(bottom, top)
      // set correct tile mask
      gl.stencilFunc(gl.ALWAYS, tmpMaskID, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      fillProgram.draw(mask, mask)
    }
    // lock in the stencil, draw colors again
    gl.colorMask(true, true, true, true)
  }

  paintFeatures (features: Array<FeatureGuide>, interactive: boolean, tiles: Array<Tile>) {
    // setup context
    const { context } = this
    const { gl } = context
    // setup variables
    let curLayer: number = -1
    let inversion: number = null
    let program: Program
    // run through the features, and upon tile, layer, or program change, adjust accordingly
    for (const feature of features) {
      const {
        tile, parent, layerIndex, source, faceST, invert,
        depthPos, sourceName, type, layerCode, lch
      } = feature
      const { tmpMaskID } = tile
      const bottom = parent ? parent.bottom : tile.bottom
      const top = parent ? parent.top : tile.top
      const featureSource = source[sourceName]
      // inversion flush if necessary
      if (inversion && curLayer !== layerIndex) {
        this.flushInvert(tiles, program, inversion)
        inversion = null
      }
      // set program
      program = this.useProgram(type)
      // set stencil
      gl.stencilFunc(gl.EQUAL, tmpMaskID, 0xFF)
      // update layerCode if the current layer has changed
      if (curLayer !== layerIndex) {
        // now setup new layercode
        curLayer = layerIndex
        if (layerCode) program.setLayerCode(layerCode, lch)
        // set interactive if applicable
        program.setInteractive(interactive)
        // if this new layer is inverting its draw, we set
        if (invert && !inversion) {
          gl.colorMask(false, false, false, false)
          inversion = depthPos
        }
      }
      // adjust tile uniforms
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      // bind vao
      gl.bindVertexArray(featureSource.vao)
      // draw
      program.draw(feature, featureSource, interactive)
    }
  }

  // run through tiles and draw the masks, inject depthPos and
  flushInvert (tiles: Array<Tile>, program: Program, depthPos: number) {
    const { gl } = this.context
    // turn color back on
    gl.colorMask(true, true, true, true)
    // draw tile masks
    for (const tile of tiles) {
      const { tmpMaskID, faceST, bottom, top, sourceData } = tile
      const { mask } = sourceData
      // inject depthPos
      mask.depthPos = depthPos
      // set uniforms & stencil test
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      // set correct tile mask
      gl.stencilFunc(gl.ALWAYS, tmpMaskID, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      program.draw(mask, mask)
      // remove depthPos
      mask.depthPos = null
    }
  }

  paintHeatmap (features: Array<FeatureGuide>) {
    const { gl } = this.context
    // grab heatmap program
    const program = this.useProgram('heatmap')
    // setup texture draws
    program.setupTextureDraw()
    // draw all features
    for (const feature of features) {
      const { tile, parent, source, faceST, sourceName, layerCode } = feature
      // grab feature source and bottom-top
      const featureSource = source[sourceName]
      const bottom = parent ? parent.bottom : tile.bottom
      const top = parent ? parent.top : tile.top
      // set faceST & layercode, bind vao, and draw
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      if (layerCode) program.setLayerCode(layerCode)
      gl.bindVertexArray(featureSource.vao)
      program.drawTexture(feature, featureSource)
    }
    // prep program for canvas draws
    program.setupCanvasDraw()
    // return a "featureGuide" to draw to the screen
    return features[0]
  }

  paintGlyphFilter (tiles: Array<Tile>, glyphFeatures: Array<FeatureGuide>) {
    const { context } = this
    const glyphFilterProgram: GlyphFilterProgram = this.programs.glyphFilter
    if (!glyphFilterProgram) return new Error('The "glyphFilter" program does not exist, can not paint.')
    // disable blending
    context.enableDepthTest()
    // Step 1: draw points
    glyphFilterProgram.bindPointFrameBuffer()
    // setup mask first (uses the "fillProgram" - that's why we have not 'used' the glyphFilterProgram yet)
    this.paintMasks(tiles)
    // use the box program
    glyphFilterProgram.use()
    // paint the glyph "filter" points
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 0)
    // Step 2: draw quads
    context.disableBlend()
    glyphFilterProgram.bindQuadFrameBuffer()
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 1)
    context.enableBlend()
    // Step 3: draw result points
    glyphFilterProgram.bindResultFramebuffer()
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 2)
  }

  _paintGlyphFilter (glyphFilterProgram: GlyphFilterProgram, glyphFeatures: Array<FeatureGuide>, mode: 0 | 1 | 2) {
    const { gl } = this.context
    let curLayer: number = -1
    // set mode
    glyphFilterProgram.setMode(mode)
    // draw each feature
    for (const glyphFeature of glyphFeatures) {
      const { tile, layerIndex, sourceName, layerCode } = glyphFeature
      const { sourceData, faceST, bottom, top } = tile
      const featureSource = sourceData[sourceName]
      // update layerIndex
      if (curLayer !== layerIndex && layerCode) {
        curLayer = layerIndex
        glyphFilterProgram.setLayerCode(layerCode)
      }
      glyphFilterProgram.setFaceST(faceST)
      glyphFilterProgram.setTilePos(bottom, top)
      gl.bindVertexArray(featureSource.filterVAO)
      // draw
      glyphFilterProgram.draw(glyphFeature, featureSource, mode)
    }
  }

  injectGlyphImages (maxHeight: number, images: GlyphImages) {
    if (!this.programs.glyph) this.buildPrograms(new Set(['glyph']))
    const { glyph } = this.programs
    glyph.injectImages(maxHeight, images)
  }
}

function featureSort (a: FeatureGuide, b: FeatureGuide): number {
  let zoomDiff = a.tile.zoom - b.tile.zoom
  if (zoomDiff) return zoomDiff
  let diff = a.layerIndex - b.layerIndex
  if (diff) return diff
  let index = 0
  let maxSize = Math.min(a.featureCode.length, b.featureCode.length)
  while (diff === 0 && index < maxSize) {
    diff = a.featureCode[index] - b.featureCode[index]
    index++
  }
  return diff
}

// @flow
/* global HTMLCanvasElement */
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
// import { WebGL2Context, WebGLContext, WebGPUContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  FillProgram,
  GlyphFilterProgram,
  GlyphLineProgram,
  GlyphProgram,
  GlyphQuadProgram,
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
import type { FeatureGuide, GlyphTileSource } from '../source/tile'
import type { ProgramType } from './programs/program'

export default class Painter {
  _canvas: HTMLCanvasElement
  context: WebGL2Context | WebGLContext
  programs: { [string]: Program } = {}
  currProgram: ProgramType
  dirty: boolean = true
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    const self = this
    // setup canvas
    self._canvas = canvas
    // create a webgl or webgl2 context
    return self._createContext(options).then(() => { return self })
  }

  delete () {
    const { context, programs } = this
    for (const programName in programs) programs[programName].delete()
    context.delete()
  }

  clearCache () {
    const glyphProgram: GlyphProgram = this.programs.glyphFill
    if (glyphProgram) glyphProgram.clearCache()
  }

  async _createContext (options: MapOptions) {
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

  async buildPrograms (buildSet: Set<ProgramType>) {
    const self = this
    const { programs } = self
    let promises = []
    for (const program of buildSet) {
      switch (program) {
        case 'raster':
          promises.push((new RasterProgram(self.context)).then(p => programs.raster = p))
          break
        case 'fill':
          promises.push((new FillProgram(self.context)).then(p => programs.fill = p))
          break
        case 'line':
          promises.push((new LineProgram(self.context)).then(p => programs.line = p))
          break
        case 'point':
          promises.push((new PointProgram(self.context)).then(p => programs.point = p))
          break
        case 'heatmap':
          promises.push((new HeatmapProgram(self.context)).then(p => programs.heatmap = p))
          break
        case 'shade':
          promises.push((new ShadeProgram(self.context)).then(p => programs.shade = p))
          break
        case 'glyph':
          promises.push((new GlyphLineProgram(self.context)).then(p => programs.glyphLineProgram = p))
          promises.push((new GlyphFilterProgram(self.context)).then(p => programs.glyphFilter = p))
          promises.push((new GlyphProgram(self.context)).then(p => programs.glyphFill = p))
          promises.push((new GlyphQuadProgram(self.context)).then(p => { programs.glyph = p }))
          break
        case 'wallpaper':
          promises.push((new WallpaperProgram(self.context)).then(p => programs.wallpaper = p))
          break
        case 'skybox':
          promises.push((new SkyboxProgram(self.context)).then(p => programs.skybox = p))
          break
        default: break
      }
    }

    await Promise.all(promises).then(() => {
      const { programs } = self
      // if we build the glyph programs, ensure the programs know of eachother
      if (programs.glyph) {
        programs.glyphFill.injectGlyphLine(programs.glyphLineProgram)
        programs.glyph.injectGlyphPrograms(programs.glyphFilter, programs.glyphFill)
      }
    })
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
    const matrix = projection.getMatrix(768) // NOTE: For now, we have a default size of 512.
    // if past zoom 12, the tile will self align to the screen
    for (const tile of tiles) tile.setScreenPositions(matrix)
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

  buildGlyphTexture (glyphSource: GlyphTileSource): void | Error {
    // get the glyphProgram & draw the glyphs to a texture
    const glyphProgram: GlyphProgram = this.useProgram('glyphFill')
    if (glyphProgram) glyphProgram.draw(glyphSource)
    else return new Error('The "glyphFill" program does not exist, can not paint.')
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
      const { tile, layerIndex, invert, depthPos, sourceName, type, layerCode, lch } = feature
      const { sourceData, tmpMaskID, faceST, bottom, top } = tile
      const featureSource = sourceData[sourceName]
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
      const { tile, sourceName, layerCode } = feature
      const { sourceData, faceST, bottom, top } = tile
      // grab feature source
      const featureSource = sourceData[sourceName]
      // set faceST & layercode, bind vao, and draw
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      program.setLayerCode(layerCode)
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

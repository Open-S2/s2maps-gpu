// @flow
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  FillProgram,
  GlyphFilterProgram,
  GlyphLineProgram,
  GlyphProgram,
  GlyphQuadProgram,
  LineProgram,
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
import type { ProgramTypes } from './programs/program'
import type { SphereBackground } from '../styleSpec'

export default class Painter {
  _canvas: HTMLCanvasElement
  context: WebGL2Context | WebGLContext
  programs: { [string]: Program } = {}
  dirty: boolean = true
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    // setup canvas
    this._canvas = canvas
    // create a webgl or webgl2 context
    this._createContext(options)
  }

  _createContext (options: MapOptions) {
    // prep options
    const webglOptions = { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: true, stencil: true }
    // first try webgl2
    let context = this._canvas.getContext('webgl2', webglOptions)
    if (context && typeof context.getParameter === 'function') {
      return this.context = new WebGL2Context(context, options.canvasMultiplier)
    }
    // webgl
    context = this._canvas.getContext('experimental-webgl', webglOptions)
    if (context && typeof context.getParameter === 'function') {
      return this.context = new WebGLContext(context, options.canvasMultiplier)
    }
  }

  setClearColor (clearColor: [number, number, number, number]) {
    this.context.setClearColor(clearColor)
  }

  // programs are pre-set for tiles to create their VAO vertexAttribPointers
  prebuildPrograms (programs: Set) {
    const self = this
    programs.forEach(program => { self.getProgram(program) })
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Float32Array) {
    const { programs } = this
    for (const programName in programs) {
      programs[programName].injectFrameUniforms(matrix, view, aspect)
    }
  }

  getProgram (programName: string): null | ProgramTypes {
    const { programs } = this
    if (programs[programName]) return programs[programName]
    // if program not created yet, let's make it
    switch (programName) {
      case 'raster':
        programs.raster = new RasterProgram(this.context)
        break
      case 'fill':
        programs.fill = new FillProgram(this.context)
        break
      case 'line':
        programs.line = new LineProgram(this.context)
        break
      case 'shade':
        programs.shade = new ShadeProgram(this.context)
        break
      case 'text':
      case 'billboard':
      case 'glyph':
        programs.glyphLineProgram = new GlyphLineProgram(this.context)
        programs.glyphFilter = new GlyphFilterProgram(this.context)
        programs.glyphFill = new GlyphProgram(this.context, programs.glyphLineProgram)
        programs.text = programs.billboard = programs.glyph = new GlyphQuadProgram(this.context, programs.glyphFilter, programs.glyphFill)
        break
      case 'wallpaper':
        programs.wallpaper = new WallpaperProgram(this.context)
        break
      case 'skybox':
        programs.skybox = new SkyboxProgram(this.context)
        break
      default: break
    }
    // check one more time the program exists
    if (programs[programName]) return programs[programName]
    return null
  }

  useProgram (programName: string): Program {
    const program = this.getProgram(programName)
    program.use()
    return program
  }

  resize () {
    // If we are using the text program, update the text program's framebuffer component's sizes
    const glyphFilter: GlyphFilterProgram = this.programs.glyphFilter
    if (glyphFilter) glyphFilter.resize()
  }

  paint (projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    const { sphereBackground } = style

    // PREPARE PHASE
    // prep frame uniforms
    const { view, aspect } = projection
    const matrix = projection.getMatrix(512) // NOTE: For now, we have a default size of 512.
    this.injectFrameUniforms(matrix, view, aspect)

    // prep mask id's
    this._createTileMasksIDs(tiles)
    // prep tiles features to draw
    // console.log('tiles', tiles)
    const features = tiles.flatMap(tile => tile.featureGuide).sort(featureSort)
    // console.log('features', features)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter(feature => feature.type === 'glyph')
    // use text boxes to filter out overlap
    if (glyphFeatures.length) this.paintGlyphFilter(tiles, glyphFeatures)

    // clear main buffer
    context.newScene()

    // DRAW PHASE
    // draw the wallpaper
    if (style.wallpaper) {
      const wallpaperProgram: WallpaperProgram = this.useProgram(style.wallpaper.skybox ? 'skybox' : 'wallpaper')
      if (wallpaperProgram) wallpaperProgram.draw(style.wallpaper)
    }
    // prep masks
    this.paintMasks(tiles)
    // draw the sphere background should it exist
    if (sphereBackground) this.paintSphereBackground(tiles, sphereBackground)
    // paint features
    this.paintFeatures(features)
    // draw shade layer
    // if (glyphFeatures.length) this.paintGlyphFilter(tiles, glyphFeatures)
    // if (style.shade) drawShade(this, style.shade)
    // cleanup
    context.cleanup()
  }

  _createTileMasksIDs (tiles: Array<Tile>) {
    let maskRef = 1
    // add all tiles
    for (const tile of tiles) {
      tile.tmpMaskID = maskRef
      maskRef++
    }
  }

  buildGlyphTexture (glyphSource: GlyphTileSource) {
    // get the glyphProgram
    const glyphProgram: GlyphProgram = this.getProgram('glyphFill')
    if (!glyphProgram) return new Error('The "glyphFill" program does not exist, can not paint.')
    // build any glyph texture
    glyphProgram.draw(glyphSource)
  }

  paintMasks (tiles: Array<Tile>) {
    // get context
    const { context } = this
    const { gl } = context
    // prep the fill program
    const fillProgram: FillProgram = this.useProgram('fill')
    if (!fillProgram) return new Error('The "fill" program does not exist, can not paint.')
    // prep stencil - don't draw color, only to the stencil
    context.enableMaskTest()
    context.lequalDepth()
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    // create mask for each tile
    for (const tile of tiles) {
      const { tmpMaskID, faceST, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      // set correct tile mask
      gl.stencilFunc(gl.ALWAYS, tmpMaskID, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      fillProgram.draw(mask, mask)
    }
    // lock in the stencil
    context.lockMasks()
  }

  paintSphereBackground (tiles: Array<Tile>, sphereBackground: SphereBackground) {
    // get context
    const { context } = this
    const { gl } = context
    // grab sphere background properties
    const { code, lch } = sphereBackground
    // grab the fillProgram
    const fillProgram: FillProgram = this.getProgram('fill')
    // set layerCode
    fillProgram.setLayerCode(code, lch)
    // for each tile, draw a background
    context.alwaysDepth()
    for (const tile of tiles) {
      const { tmpMaskID, faceST, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      gl.stencilFunc(gl.EQUAL, tmpMaskID, 0xFF)
      // bind vao
      gl.bindVertexArray(mask.vao)
      // draw background
      fillProgram.draw(mask, mask)
    }
  }

  paintFeatures (features: Array<FeatureGuide>) {
    // setup context
    const { context } = this
    const { gl } = context
    // setup variables
    let curLayer: number = -1
    let curProgram: string = 'fill'
    let program: ProgramTypes = this.getProgram('fill')
    if (!program) return new Error('The "fill" program does not exist, can not paint.')
    // run through the features, and upon tile, layer, or program change, adjust accordingly
    context.alwaysDepth()
    for (const feature of features) {
      const { tile, faceST, layerID, source, sourceName, type, layerCode, lch } = feature
      const { tmpMaskID } = tile
      const featureSource = source[sourceName]
      // set program
      if (type !== curProgram) {
        curProgram = type
        program = this.useProgram(type)
        if (!program) return new Error(`The "${type}" program does not exist, can not paint.`)
      }
      // set stencil
      gl.stencilFunc(gl.EQUAL, tmpMaskID, 0xFF)
      // update layerID
      if (curLayer !== layerID && layerCode) {
        curLayer = layerID
        program.setLayerCode(layerCode, lch)
      }
      program.setFaceST(faceST)
      gl.bindVertexArray(featureSource.vao)
      // draw
      // if (feature.type !== 'glyph') program.draw(feature, featureSource, tmpMaskID)
      program.draw(feature, featureSource, tmpMaskID)
    }
  }

  paintGlyphFilter (tiles: Array<Tile>, glyphFeatures: Array<FeatureGuide>) {
    // console.log('glyphFeatures', glyphFeatures)
    const { context } = this
    // const { gl } = context
    const glyphFilterProgram: GlyphFilter = this.getProgram('glyphFilter')
    if (!glyphFilterProgram) return new Error('The "glyphFilter" program does not exist, can not paint.')
    // disable blending
    context.disableBlend()
    // Step 1: draw points
    glyphFilterProgram.bindPointFrameBuffer()
    // setup mask first (uses the "fillProgram" - that's why we have not 'used' the glyphFilterProgram yet)
    this.paintMasks(tiles)
    // use the box program
    glyphFilterProgram.use()
    // paint the glyph "filter" points
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 0)
    // Step 2: draw quads
    glyphFilterProgram.bindQuadFrameBuffer()
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 1)

    // const { gl } = context
    // const res = new Uint8Array(1 * 4096 * 4)
    // gl.readPixels(0, 0, 4096, 1, gl.RGBA, gl.UNSIGNED_BYTE, res)
    // const list = []
    // for (let i = 0; i < 5; i++) {
    //   list.push([(res[(i * 4)] << 8) + res[(i * 4) + 1], (res[(i * 4) + 2] << 8) + res[(i * 4) + 3], (res[(i + 2048) * 4] << 8) + res[(i + 2048) * 4 + 1], (res[(i + 2048) * 4 + 2] << 8) + res[(i + 2048) * 4 + 3]])
    // }
    // console.log('list', list)

    // Step 3: draw result points
    glyphFilterProgram.bindResultFramebuffer()
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 2)
    // return to our default framebuffer
    context.bindMainBuffer()
    // we can use blend again
    context.enableBlend()
  }

  _paintGlyphFilter (glyphFilterProgram: GlyphFilter, glyphFeatures: Array<FeatureGuide>, mode: 0 | 1 | 2) {
    const { gl } = this.context
    let curLayer: number = -1
    // set mode
    glyphFilterProgram.setMode(mode)
    // draw each feature
    for (const glyphFeature of glyphFeatures) {
      const { faceST, layerID, source, sourceName, layerCode } = glyphFeature
      const featureSource = source[sourceName]
      // update layerID
      if (curLayer !== layerID && layerCode) {
        curLayer = layerID
        glyphFilterProgram.setLayerCode(layerCode)
      }
      glyphFilterProgram.setFaceST(faceST)
      gl.bindVertexArray(featureSource.filterVAO)
      // draw
      glyphFilterProgram.draw(glyphFeature, featureSource, mode)
    }
  }
}

function featureSort (a: FeatureGuide, b: FeatureGuide): number {
  let zoomDiff = a.tile.zoom - b.tile.zoom
  if (zoomDiff) return zoomDiff
  let diff = a.layerID - b.layerID
  if (diff) return diff
  let index = 0
  let maxSize = Math.min(a.featureCode.length, b.featureCode.length)
  while (diff === 0 && index < maxSize) {
    diff = a.featureCode[index] - b.featureCode[index]
    index++
  }
  return diff
}

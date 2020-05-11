// @flow
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  FillProgram,
  GlyphFilterProgram,
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

export default class Painter {
  _canvas: HTMLCanvasElement
  context: WebGL2Context | WebGLContext
  programs: { [string]: Program } = {}
  glyphSources: Array<GlyphTileSource> = []
  dirty: boolean = true
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    // setup canvas
    this._canvas = canvas
    // create a webgl or webgl2 context
    this._createContext()
  }

  _createContext () {
    // prep options
    const webglOptions = { antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false, alpha: true, stencil: true }
    // first try webgl2
    let context = this._canvas.getContext('webgl2', webglOptions)
    if (context && typeof context.getParameter === 'function') {
      return this.context = new WebGL2Context(context)
    }
    // webgl
    context = this._canvas.getContext('webgl', webglOptions)
    if (context && typeof context.getParameter === 'function') {
      return this.context = new WebGLContext(context)
    }
  }

  addGlyphSource (glyphSource: GlyphTileSource) {
    this.glyphSources.push(glyphSource)
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
        programs.glyphTex = new GlyphProgram(this.context)
        programs.glyph = new GlyphQuadProgram(this.context)
        programs.glyphFilter = new GlyphFilterProgram(this.context)
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

    // prep tiles features to draw
    const features = tiles.flatMap(tile => tile.featureGuide).sort(featureSort)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter(feature => feature.type === 'glyph')

    // if any glyph or fill textures are not ready, we prep them now
    if (this.glyphSources.length) this.buildTextures()

    if (glyphFeatures.length) this.paintGlyphFilter(tiles, glyphFeatures)

    // incase we have glyph source data or glyph feature data, reset to the main framebuffer
    context.bindMainBuffer()
    // clear main buffer
    context.newScene()

    // prep frame uniforms
    const { view, aspect } = projection
    const matrix = projection.getMatrix(512) // NOTE: For now, we have a default size of 512.
    this.injectFrameUniforms(matrix, view, aspect)

    // prep masks
    this.paintMasks(tiles)
    // now we use the depth test
    context.enableDepthTest()
    // draw the sphere background should it exist
    if (sphereBackground) this.paintSphereBackground(tiles, sphereBackground)
    // paint features
    this.paintFeatures(features)
    // paint glyph "filter" quads
    // if (glyphFeatures.length) this.paintGlyphFilter(tiles, glyphFeatures)
    // disable stencil
    context.disableStencilTest()
    // if (this.glyphSources.length) this.buildGlyphTextures()
    // draw the wallpaper
    if (style.wallpaper) {
      const wallpaperProgram: WallpaperProgram = this.useProgram(style.wallpaper.skybox ? 'skybox' : 'wallpaper')
      if (wallpaperProgram) wallpaperProgram.draw(style.wallpaper)
    }
    // draw shade layer
    // if (style.shade) drawShade(this, style.shade)
    // cleanup
    context.cleanup()
  }

  buildTextures () {
    // get the glyphProgram
    const glyphProgram: GlyphProgram = this.useProgram('glyphTex')
    if (!glyphProgram) return new Error('The "glyphTex" program does not exist, can not paint.')
    // prep program for drawing glyphs
    glyphProgram.prepContext()
    // build any glyph textures
    for (const glyphSource of this.glyphSources) glyphProgram.drawGlyph(glyphSource)
    // cleanup from drawing glyphs
    glyphProgram.cleanupContext()
    // clear the glyph sources as they are prepped for drawing from
    this.glyphSources = []
  }

  paintMasks (tiles: Array<Tile>, fb: boolean = false) {
    // get context
    const { context } = this
    const { gl } = context
    // prep the fill program
    const fillProgram: FillProgram = this.useProgram('fill')
    if (!fillProgram) return new Error('The "fill" program does not exist, can not paint.')
    // prep stencil - don't draw color, only to the stencil
    context.enableStencil()
    // get a starting mask index
    let maskRef = 1
    for (const tile of tiles) {
      const { faceST, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      // set correct tile mask
      if (!fb) gl.stencilFunc(gl.ALWAYS, maskRef, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      fillProgram.draw(mask)
      // keep tabs on the mask identifier
      tile.tmpMaskID = maskRef
      // update mask index
      maskRef++
    }
    // lock in the stencil
    context.lockStencil()
  }

  paintSphereBackground (tiles: Array<Tile>, sphereBackground: Float32Array) {
    // get context
    const { context } = this
    const { gl } = context
    // grab the fillProgram
    const fillProgram: FillProgram = this.getProgram('fill')
    // set layerCode
    fillProgram.setLayerCode(sphereBackground)
    // for each tile, draw a background
    for (const tile of tiles) {
      const { faceST, sourceData, tmpMaskID } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      gl.stencilFunc(gl.EQUAL, tmpMaskID, 0xFF)
      // bind vao
      gl.bindVertexArray(mask.vao)
      // draw background
      fillProgram.draw(mask)
    }
  }

  paintFeatures (features: Array<FeatureGuide>) {
    // setup context
    const { context } = this
    const { gl } = context
    // setup variables
    let drawTile: Tile
    let curLayer: number = -1
    let curProgram: string = 'fill'
    let program: ProgramTypes = this.getProgram('fill')
    if (!program) return new Error('The "fill" program does not exist, can not paint.')
    // run through the features, and upon tile, layer, or program change, adjust accordingly
    for (const feature of features) {
      const { parent, tile, layerID, source, type, layerCode } = feature
      const { tmpMaskID } = tile
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
        program.setLayerCode(layerCode)
      }
      // update tile
      drawTile = (parent) ? parent : tile
      const { faceST, sourceData } = drawTile
      program.setFaceST(faceST)
      gl.bindVertexArray(sourceData[source].vao)
      // draw
      program.draw(feature, sourceData[source], tmpMaskID)
    }
  }

  paintGlyphFilter (tiles: Array<Tile>, glyphFeatures: Array<FeatureGuide>) {
    const { context } = this
    const glyphFilterProgram: GlyphFilter = this.getProgram('glyphFilter')
    if (!glyphFilterProgram) return new Error('The "glyphFilter" program does not exist, can not paint.')
    // Step 1: draw points
    glyphFilterProgram.bindPointFrameBuffer(context)
    this.paintMasks(tiles, true)
    // use the box program
    glyphFilterProgram.use()
    // paint the glyph "filter" quads
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 0)
    // Step 2: draw quads
    glyphFilterProgram.bindQuadFrameBuffer(context)
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 1)
    // return to our default framebuffer
    context.bindMainBuffer()
  }

  _paintGlyphFilter (glyphFilterProgram: GlyphFilter, glyphFeatures: Array<FeatureGuide>, mode: 0 | 1 | 2) {
    const { gl } = this.context
    let drawTile: Tile, glyphSource: GlyphTileSource
    let tileSet = new Set()
    // set mode
    glyphFilterProgram.setMode(mode)
    // draw each feature
    for (const glyphFeature of glyphFeatures) {
      const { parent, tile, source } = glyphFeature
      drawTile = (parent) ? parent : tile
      // ensure no overdraw
      if (tileSet.has(drawTile.id)) continue
      else tileSet.add(drawTile.id)
      // setup vao and uniforms
      const { faceST, sourceData, tmpMaskID } = drawTile
      glyphSource = sourceData[source]
      glyphFilterProgram.setFaceST(faceST)
      gl.bindVertexArray(glyphSource.boxVAO)
      // draw
      if (mode === 0) {
        glyphFilterProgram.drawPoints(glyphSource)
      } else if (mode === 1) {
        glyphFilterProgram.drawQuads(glyphSource, tmpMaskID)
      } else if (mode === 2) {

      }
    }
  }
}

function featureSort (a: FeatureGuide, b: FeatureGuide): number {
  // layerID
  let diff = a.layerID - b.layerID
  let index = 0
  let maxSize = Math.min(a.featureCode.length, b.featureCode.length)
  while (diff === 0 && index < maxSize) {
    diff = a.featureCode[index] - b.featureCode[index]
    index++
  }
  return diff
}

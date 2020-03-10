// @flow
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  RasterProgram,
  FillProgram,
  LineProgram,
  ShadeProgram,
  TextProgram,
  SkyboxProgram,
  WallpaperProgram
} from './programs'
/** DRAWING **/
import {
  drawFill,
  drawLine,
  drawMask,
  drawRaster,
  // drawShade,
  drawWallpaper
} from './draw'
/** SOURCES **/
import { Tile } from '../source'

import type { MapOptions } from '../ui/map'
import type { Projection } from '../ui/camera/projections'
// import type { FeatureGuide, SourceData } from '../source/tile'
import type { ProgramTypes } from './programs/program'

export default class Painter {
  _canvas: HTMLCanvasElement
  context: WebGL2Context | WebGLContext
  indexSize: GLenum
  offsetSize: number
  programs: { [string]: Program } = {}
  dirty: boolean = true
  webglState: 0
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    // setup canvas
    this._canvas = canvas
    // create a webgl or webgl2 context
    this._createContext()
  }

  _createContext () {
    // const contextTypes = ['webgl2', 'webgl', 'experimental-webgl']

    // first webgl2
    let context = this._canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: true, stencil: true })
    if (context && typeof context.getParameter === 'function') {
      this.indexSize = context.UNSIGNED_INT
      this.webglState = 2
      this.offsetSize = 4
      return this.context = new WebGL2Context(context)
    }

    // webgl
    // context = this._canvas.getContext('webgl', { alpha: false, stencil: true })

    // esxperimental-webgl
    // context = this._canvas.getContext('experimental-webgl', { alpha: false, stencil: true })
  }

  // programs are pre-set for tiles to create their VAO vertexAttribPointers
  prebuildPrograms (programs: Set) {
    const self = this
    programs.forEach(program => { self.getProgram(program) })
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, faceST: Float32Array) {
    const { programs } = this
    for (const programName in programs) {
      programs[programName].injectFrameUniforms(matrix, view, faceST)
    }
  }

  getProgram (programName: string): null | Object {
    const { programs } = this
    if (programs[programName]) return programs[programName]
    // if program not created yet, let's make it
    switch (programName) {
      case 'raster':
        programs[programName] = new RasterProgram(this.context)
        break
      case 'fill':
        programs[programName] = new FillProgram(this.context)
        break
      case 'line':
        programs[programName] = new LineProgram(this.context)
        break
      case 'shade':
        programs[programName] = new ShadeProgram(this.context)
        break
      case 'text':
        programs[programName] = new TextProgram(this.context)
        break
      case 'wallpaper':
        programs[programName] = new WallpaperProgram(this.context)
        break
      case 'skybox':
        programs[programName] = new SkyboxProgram(this.context)
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

  paint (projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    const { view } = projection
    // prep painting
    context.newScene()
    // for each tile, draw background & features as necessary
    for (let tile of tiles) {
      const { size, faceST } = tile
      // grab the matrix (duplicate created) and view (input) properties
      const matrix = projection.getMatrix(size)
      // inject values to programs
      this.injectFrameUniforms(matrix, view, faceST)
      // now draw the tile according to the features it contains
      this.paintLayers(tile, style)
      // no matter what, clear the stencil to ensure it's ready for the next tile
      context.clearStencil()
    }
    // disable stencil
    context.disableStencilTest()
    // draw the wallpaper
    if (style.wallpaper) drawWallpaper(this, style.wallpaper)
    // draw shade layer
    // if (style.shade) drawShade(this, style.shade)
    // cleanup
    context.cleanup()
  }

  paintLayers (tile: Tile, style: Style) {
    // setup context and style data
    const { context } = this
    const { sphereBackground } = style
    // grab the featureGuide and vao from current tile
    const { faceST, sourceData, featureGuide } = tile
    const { mask } = sourceData
    // setup variables
    let curSource: string = 'mask'
    let curSourceData: object = mask
    let curProgram: ProgramTypes = 'fill'
    let program: Program = this.useProgram('fill')
    let parentSet: boolean = false
    let flush: boolean = false
    let curLayer: number = -1
    // use mask vao and fill program
    context.bindVertexArray(mask.vao)
    // First 'feature' is the mask feature
    drawMask(this, mask.indexArray.length, mask.mode, mask.threeD)
    // if we have a background, draw to fill in what's left
    if (sphereBackground) {
      program.setLayerCode(sphereBackground)
      drawFill(this, mask.indexArray.length, 0, null, mask.mode, mask.threeD)
    }
    // now we start drawing feature batches
    let stencilRef = 254
    for (let i = featureGuide.length - 1; i >= 0; i--) {
      const featureBatch = featureGuide[i]
      const { parent, tile, source, layerID, count, offset, type, featureCode, layerCode, texture } = featureBatch
      // if a parent tile, be sure to bind the parent tiles vao
      // rebind back to current vao and matrix when the parent is not being used
      if (parent && (!parentSet || source !== curSource)) {
        parentSet = true
        curSourceData = tile.sourceData[source]
        context.bindVertexArray(curSourceData.vao)
        this.injectFrameUniforms(null, null, tile.faceST)
        curSource = source
        flush = true
      } else if (!parent && (parentSet || source !== curSource)) {
        parentSet = false
        curSourceData = sourceData[source]
        context.bindVertexArray(curSourceData.vao)
        this.injectFrameUniforms(null, null, faceST)
        curSource = source
        flush = true
      }
      // if type is not the same as the curProgram, we have to update curProgram and set uniforms
      if (type !== curProgram) {
        program = this.useProgram(type)
        curProgram = type
      }
      if (flush) {
        flush = false
        program.flush()
      }
      // if new layerID, update layerCode
      if (layerID !== curLayer && layerCode) {
        context.setStencilFunc(context.gl.GREATER, stencilRef)
        program.setLayerCode(layerCode)
        stencilRef--
        curLayer = layerID
      }
      // now draw according to type
      if (type === 'raster') {
        drawRaster(this, curSourceData.indexArray.length, texture, curSourceData.mode, curSourceData.threeD)
      } else if (type === 'fill') {
        drawFill(this, count, offset, featureCode)
      } else if (type === 'line') {
        drawLine(this, count, offset, featureCode)
      } else if (type === 'text') {

      } else if (type === 'billboard') {

      }
    }
  }
}

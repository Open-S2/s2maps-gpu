// @flow
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  FillProgram,
  LineProgram,
  TextProgram,
  WallpaperProgram
} from './programs'
/** DRAWING **/
import {
  drawFill,
  drawMask,
  drawWallpaper
} from './draw'
/** SOURCES **/
import { Wallpaper, Tile } from '../source'

import type { MapOptions } from '../ui/map'
import type { Projection } from '../ui/camera/projections'
import type { FeatureGuide, SourceData } from '../source/tile'
import type { StyleLayers } from '../style'
import type { ProgramTypes } from './programs/program'

export default class Painter {
  _canvas: HTMLCanvasElement
  context: WebGL2Context | WebGLContext
  programs: { [string]: Program } = {}
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    // setup canvas
    this._canvas = canvas
    // create a webgl or webgl2 context
    this._createContext()
  }

  _createContext () {
    // const contextTypes = ['webgl2', 'webgl', 'experimental-webgl']

    // first webgl2
    let context = this._canvas.getContext('webgl2', { alpha: false, stencil: true })
    if (context && typeof context.getParameter === 'function') {
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

  injectFrameUniforms (matrix: Float32Array, eyePosHigh: Float32Array,
    eyePosLow: Float32Array, view: Float32Array) {
    const { programs } = this
    for (const programName in programs) {
      programs[programName].injectFrameUniforms(matrix, eyePosHigh, eyePosLow, view)
    }
  }

  getProgram (programName: string): null | Object {
    const { programs } = this
    if (programs[programName]) return programs[programName]
    // if program not created yet, let's make it
    switch (programName) {
      case 'fill':
        programs[programName] = new FillProgram(this.context)
        break
      case 'line':
        programs[programName] = new LineProgram(this.context)
        break
      case 'text':
        programs[programName] = new TextProgram(this.context)
        break
      case 'wallpaper':
        programs[programName] = new WallpaperProgram(this.context)
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

  buildVAO (source: string, tile: Tile) {
    const { gl } = this.context
    // grab the source
    const tileSource = tile.sourceData[source]
    // cleanup old setup
    if (tileSource.vao) {
      gl.deleteBuffer(tileSource.vertexBuffer)
      gl.deleteBuffer(tileSource.featureIndexBuffer)
      gl.deleteBuffer(tileSource.indexBuffer)
      this.context.deleteVertexArray(tileSource.vao)
    }
    // Create a starting vertex array object (attribute state)
    tileSource.vao = this.context.createVertexArray()
    // and make it the one we're currently working with
    this.context.bindVertexArray(tileSource.vao)
    // VERTEX
    // Create a vertex buffer
    tileSource.vertexBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, tileSource.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, tileSource.vertexArray, gl.STATIC_DRAW)
    // link attributes (aPosHigh will always be 0 and aPosLow will always be 1)
    gl.enableVertexAttribArray(0)
    gl.enableVertexAttribArray(1)
    // tell attribute how to get data out of vertexBuffer
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
    // FEATURE INDEX
    if (tileSource.featureIndexArray && tileSource.featureIndexArray.length) {
      // Create the feature index buffer
      tileSource.featureIndexBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, tileSource.featureIndexBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, tileSource.featureIndexArray, gl.STATIC_DRAW)
      // link attribute
      gl.enableVertexAttribArray(2)
      // tell attribute how to get data out of feature index buffer
      gl.vertexAttribPointer(2, 1, gl.UNSIGNED_BYTE, false, 1, 0)
    }
    // INDEX - If we are on a browser that lacks support for 32bit element array, we won't have indices
    if (tileSource.indexArray && tileSource.indexArray.length) {
      // Create an index buffer
      tileSource.indexBuffer = gl.createBuffer()
      // bind to ELEMENT_ARRAY
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tileSource.indexBuffer)
      // buffer the data
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tileSource.indexArray, gl.STATIC_DRAW)
    }
  }

  paint (wallpaper: Wallpaper, projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    const { gl } = context
    // prep painting:
    context.clearScene()
    context.enableCullFace()
    context.enableAlphaCoverage()
    context.disableDepthTest()
    // first draw the wallpaper
    drawWallpaper(this, wallpaper)
    // prep stencil
    context.enableStencilTest()
    // setup inputs for programs

    // for each tile, draw background & features as necessary
    for (let tile of tiles) {
      // grab the matrix (duplicate created) and view (input) properties
      const { matrix, eyePosHigh, eyePosLow } = projection.getMatrix(tile.size)
      const { view } = projection
      // inject values to programs
      this.injectFrameUniforms(matrix, eyePosHigh, eyePosLow, view)
      // grab the featureGuide and vao from current tile
      const { sourceData, featureGuide } = tile
      const { mask } = sourceData
      // use mask vao and fill program
      context.bindVertexArray(mask.vao)
      let program = this.useProgram('fill')
      // set the matrix and inputs uniforms by flushing the first program
      program.flush()
      // First 'feature' is the mask feature
      drawMask(this, mask.indexArray.length)
      // Second feature is the sphere-background feature should it exist
      const sphereBackground = style.sphereBackground
      program.setLayerCode(sphereBackground)
      if (sphereBackground) drawFill(this, mask.indexArray.length, 0, null, gl.TRIANGLE_STRIP)
      // now draw the tile according to the features it contains
      this.paintLayers(featureGuide, style.layers, sourceData, program)
      // assuming the mask has been drawn, we should tell the context to clear it
      context.clearStencil()
    }
    // disable stencil
    context.disableStencilTest()
    // cleanup
    context.cleanup()
  }

  paintLayers (featureGuide: Array<FeatureGuide>, layers: StyleLayers,
    sourceData: SourceData, program: Program) {
    const { context } = this
    let curSource: string = 'mask'
    let curProgram: ProgramTypes = 'fill'
    let curLayer: number = -1
    for (const featureBatch of featureGuide) {
      const { source, layerID, count, offset, type, featureCode } = featureBatch
      // if type is not the same as the curProgram, we have to update curProgram and set uniforms
      if (type !== curProgram) {
        program = this.useProgram(type)
        program.flush()
        curProgram = type
      }
      // if new layerID, update layerCode
      if (layerID !== curLayer) {
        program.setLayerCode(layers[layerID].code)
        curLayer = layerID
      }
      // if source is not the same, update vao
      if (source !== curSource) {
        context.bindVertexArray(sourceData[source].vao)
        curSource = source
      }
      // now draw according to type
      if (type === 'fill') {
        drawFill(this, count, offset, featureCode)
      } else if (type === 'line') {

      } else if (type === 'text') {

      } else if (type === 'billboard') {

      }
    }
  }
}

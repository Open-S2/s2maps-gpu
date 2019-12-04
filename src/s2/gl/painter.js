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
import type { LayerGuide, VectorTileSource } from '../source/tile'

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

  useProgram (programName: string) {
    const program = this.getProgram(programName)
    if (program) this.context.gl.useProgram(program.glProgram)
  }

  buildVAO (source: string, tile: Tile) {
    const { gl } = this.context
    // grab the source
    const tileSource = tile.sourceData[source]
    // cleanup old setup
    if (tileSource.vao) {
      gl.deleteBuffer(tileSource.vertexBuffer)
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
    // INDEX - If we are on a browser that lacks support for 32bit element array, we won't have indices
    if (tileSource.indexArray.length) {
      // Create an index buffer
      tileSource.indexBuffer = gl.createBuffer()
      // bind to ELEMENT_ARRAY
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tileSource.indexBuffer)
      // buffer the data
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tileSource.indexArray, gl.STATIC_DRAW)
    }
    // lastly link attributes (a_pos will always be 0 if applicable)
    gl.enableVertexAttribArray(0)
    // tell attribute how to get data out of vertexBuffer
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
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
    // for each tile, draw background & layers as necessary
    for (let tile of tiles) {
      // grab the matrix (duplicate created)
      const matrix = projection.getMatrix(tile)
      // grab the layersGuide and vao from current tile
      const { layersGuide } = tile
      const { mask } = tile.sourceData
      // use mask vao and fill program
      context.bindVertexArray(mask.vao)
      this.useProgram('fill')
      // First 'layer' is the mask layer
      drawMask(this, mask, matrix)
      // Second layer is the sphere-background layer should it exist
      const sphereBackground = style.sphereBackground(projection.zoom)
      if (sphereBackground) drawFill(this, mask, mask.indexArray.length, 0, matrix, sphereBackground, gl.TRIANGLE_STRIP)
      // now draw the tile according to the layers it contains
      this.paintLayers(layersGuide, projection, tile)
      // assuming the mask has been drawn, we should tell the context to clear it
      context.clearStencil()
    }
    // cleanup
    context.cleanup()
  }

  paintLayers (layersGuide: Array<LayerGuide>, projection: Projection, currentTile: Tile) {
    const { context } = this
    let matrix: Float32Array, tileSource: VectorTileSource
    let currentSource = 'mask'
    let currentProgram = 'fill'
    for (const layer of layersGuide) {
      const { parent, source, count, offset, type, attributes } = layer
      // if type is not the same as the currentProgram, we have to update currentProgram
      if (type !== currentProgram) {
        this.useProgram(type)
        currentProgram = type
      }
      // Given the layer's properties, we choose the appropraite matrix and source data (vao & buffers)
      if (parent) {
        matrix = projection.getMatrix(layer.tile)
        tileSource = layer.tile.sourceData[source]
      } else {
        matrix = projection.getMatrix(currentTile)
        tileSource = currentTile.sourceData[source]
      }
      // if source is not the same, update vao
      if (source !== currentSource) {
        context.bindVertexArray(tileSource.vao)
        currentSource = source
      }
      // now update paint attributes:
      if (type === 'fill') {
        const { color } = attributes
        const fillColor = (typeof color === 'function') ? color(projection.zoom) : color
        drawFill(this, tileSource, count, offset, matrix, fillColor)
      }
    }
  }
}

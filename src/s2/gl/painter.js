// @flow
import * as mat4 from '../util/mat4'
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

  buildVAO (tile: Tile) {
    const { gl } = this.context
    // cleanup old setup
    if (tile.vao) {
      gl.deleteBuffer(tile.vertexBuffer)
      gl.deleteBuffer(tile.indexBuffer)
      this.context.deleteVertexArray(tile.vao)
    }
    // Create a starting vertex array object (attribute state)
    tile.vao = this.context.createVertexArray()
    // and make it the one we're currently working with
    this.context.bindVertexArray(tile.vao)
    // VERTEX
    // Create a vertex buffer
    tile.vertexBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, tile.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tile.vertices), gl.STATIC_DRAW)
    // INDEX - If we are on a browser that lacks support for 32bit element array, we won't have indices
    if (tile.indices.length) {
      // Create an index buffer
      tile.indexBuffer = gl.createBuffer()
      // bind to ELEMENT_ARRAY
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tile.indexBuffer)
      // buffer the data
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(tile.indices), gl.STATIC_DRAW)
    }
    // lastly link attributes (a_pos will always be 0 if applicable)
    gl.enableVertexAttribArray(0)
    // tell attribute how to get data out of vertexBuffer
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
    // this._setProgramsAttributes()
  }

  // _setProgramsAttributes () {
  //   const { gl } = this.context
  //   for (const key in this.programs) {
  //     if (key !== 'wallpaper') {
  //       const program = this.programs[key]
  //       // bind the program
  //       // gl.useProgram(program.glProgram)
  //       // Turn on the attribute
  //       gl.enableVertexAttribArray(program.aPos)
  //       // tell attribute how to get data out of vertexBuffer
  //       gl.vertexAttribPointer(program.aPos, 3, gl.FLOAT, false, 0, 0)
  //     }
  //   }
  // }

  paint (wallpaper: Wallpaper, projection: Projection, style: Style, tiles: Array<Tile>) {
    // prep painting:
    this.context.clearScene()
    this.context.enableCullFace()
    this.context.enableAlphaCoverage()
    this.context.disableDepthTest()
    // first draw the wallpaper
    drawWallpaper(this, wallpaper)
    // for each tile, draw background & layers as necessary
    for (let tile of tiles) {
      // grab the matrix
      const matrix = projection.getMatrix(tile.size)
      // compute centerEye
      const centerEye = mat4.multiplyVector(matrix, tile.center)
      // add eye center
      mat4.addCenter(matrix, centerEye)
      // run through all tiles  and paint according to layers
      const { layersGuide, vao } = tile
      // bind the vao in relation to said tile
      this.context.bindVertexArray(vao)
      // grab the base layer for the mask and sphereBackground fill
      const baseLayerGuide = layersGuide[0]
      // First 'layer' is the mask layer
      drawMask(this, baseLayerGuide.count, 0, matrix)
      // Second layer is the sphere-background layer
      const sphereBackground = style.sphereBackground(projection.zoom)
      if (sphereBackground) drawFill(this, baseLayerGuide.count, 0, matrix, sphereBackground)
      // now draw the tile according to the layers it contains
      const lgl = layersGuide.length
      let i = 1
      while (i < lgl) {
        // grab the size, layerID, count, and offset
        let { count, offset, type, properties } = layersGuide[i]
        // now update paint properties:
        if (type === 'fill') {
          const { color } = properties
          const fillColor = (typeof color === 'function') ? color(projection.zoom) : color
          drawFill(this, count, offset, matrix, fillColor)
        }
        i++
      }
      // assuming the mask has been drawn, we should tell the context to clear it
      this.context.clearStencil()
    }
    // cleanup
    this.context.cleanup()
  }
}

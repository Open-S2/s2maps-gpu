// @flow
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** PROGRAMS **/
import {
  Program,
  FillProgram,
  LineProgram,
  MaskProgram,
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
// import type { FeatureGuide, SourceData } from '../source/tile'
import type { StyleLayers } from '../style'
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
    let context = this._canvas.getContext('webgl2', { alpha: false, stencil: true })
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
    programs.add('mask') // ensure our default tile drawing program is created
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
      case 'mask':
        programs[programName] = new MaskProgram(this.context)
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

  paint (wallpaper: Wallpaper, projection: Projection, style: Style, tiles: Array<Tile>) {    
    const { context } = this
    const { gl } = context
    // prep painting
    context.newScene()
    // first draw the wallpaper
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    drawWallpaper(this, wallpaper)
    // for each tile, draw background & features as necessary
    for (let tile of tiles) {
      const { sourceData, size, texture } = tile
      // grab the matrix (duplicate created) and view (input) properties
      const { matrix, eyePosHigh, eyePosLow } = projection.getMatrix(size)
      const { view } = projection
      // inject values to programs
      this.injectFrameUniforms(matrix, eyePosHigh, eyePosLow, view)
      // now draw the tile according to the features it contains
      if (this.dirty) this.paintLayers(tile, style, style.layers)
      // now that the framebuffer is ready, draw the texture to the 3D mask
      const { mask } = sourceData
      // bind to our canvas framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      // reset viewport
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
      // use the appropriate program
      const maskProgram = this.useProgram('mask')
      maskProgram.flush()
      context.bindVertexArray(mask.vao)
      drawMask(this, mask.indexArray.length, texture, mask.drawMode)
      // FUTURE: draw 3D layers should they exist
    }
    // cleanup
    context.cleanup()
  }

  paintLayers (tile: Tile, style: Style, layers: StyleLayers) {
    const { context } = this
    const { gl } = context
    // setup fbo, texture and layout
    gl.bindFramebuffer(gl.FRAMEBUFFER, tile.fbo)
    const tileSize = tile.size * tile.scale
    gl.viewport(0, 0, tileSize, tileSize)
    // clear the tile "scene"
    context.clearScene()
    // grab the featureGuide and vao from current tile
    const { sourceData, featureGuide } = tile
    const { background } = sourceData
    // setup variables
    let curSource: string = ''
    let curProgram: ProgramTypes = ''
    let program = null
    let curLayer: number = -1
    // let curTile: number = tile.id
    // let's draw the sphere-background feature should it exist
    const sphereBackground = style.sphereBackground
    if (sphereBackground) {
      curProgram = 'fill'
      program = this.useProgram('fill')
      program.flush()
      program.setLayerCode(sphereBackground)
      context.bindVertexArray(sourceData.background.vao)
      drawFill(this, background.indexArray.length, 0, null, background.drawMode)
    }
    // now we start drawing feature batches
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
        drawFill(this, count, offset, featureCode, sourceData[source].drawMode)
      } else if (type === 'line') {

      } else if (type === 'text') {

      } else if (type === 'billboard') {

      }
    }
  }
}

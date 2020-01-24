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
  dirty: boolean = true
  constructor (canvas: HTMLCanvasElement, options: MapOptions) {
    // setup canvas
    this._canvas = canvas
    // create a webgl or webgl2 context
    this._createContext()
  }

  _createContext () {
    // const contextTypes = ['webgl2', 'webgl', 'experimental-webgl']

    // first webgl2
    let context = this._canvas.getContext('webgl2', { antialias: false, alpha: false, stencil: true })
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

  paint (wallpaper: Wallpaper, projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    const { gl } = context
    // prep painting
    context.newScene()
    // first draw the wallpaper
    drawWallpaper(this, wallpaper)
    // prep stencil
    context.enableStencilTest()
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
      this.paintLayers(tile, style.layers)
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
    let program = this.useProgram('fill')
    let curLayer: number = -1
    let curTile: number = tile.id
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

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
  TextureProgram,
  SkyboxProgram,
  WallpaperProgram
} from './programs'
/** SOURCES **/
import { Tile } from '../source'

import type { MapOptions } from '../ui/map'
import type { Projection } from '../ui/camera/projections'
import type { FeatureGuide } from '../source/tile'
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
    // prep options
    const webglOptions = { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: true, stencil: true }
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
      case 'texture':
      case 'billboard':
        programs.text = programs.texture = programs.billboard = new TextureProgram(this.context)
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

  resize () {
    // If we are using the text program, update the text program's framebuffer component's sizes
    const texProgram: TextureProgram = this.programs.texture
    if (texProgram) texProgram.resize()
  }

  paint (projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    const { gl } = context
    const { sphereBackground } = style
    // prep painting
    context.newScene()
    // if we have a texture program, we draw
    const texProgram: TextureProgram = this.programs.texture
    if (texProgram) texProgram.newScene(context)

    // prep frame uniforms
    const { view, aspect } = projection
    const matrix = projection.getMatrix(512) // NOTE: For now, we have a default size of 512.
    this.injectFrameUniforms(matrix, view, aspect)

    // merge tile features
    const features = tiles.flatMap(tile => tile.featureGuide).sort(featureSort)
    // prep stencil - don't draw color, only to the stencil
    context.enableStencil()
    // prep masks
    this.paintMasks(tiles)
    if (texProgram) {
      texProgram.bindPointFrameBuffer()
      this.paintMasks(tiles)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    // lock in the stencil
    context.lockStencil()
    // now we use the depth test
    context.enableDepthTest()
    // draw the sphere background should it exist
    if (sphereBackground) this.paintSphereBackground(tiles, sphereBackground)
    // paint features
    this.paintFeatures(projection, style, features)
    // disable stencil
    context.disableStencilTest()
    // draw the wallpaper
    if (style.wallpaper) {
      const wallpaperProgram: WallpaperProgram = this.getProgram(style.wallpaper.skybox ? 'skybox' : 'wallpaper')
      if (wallpaperProgram) wallpaperProgram.draw(this, style.wallpaper)
    }
    // draw shade layer
    // if (style.shade) drawShade(this, style.shade)
    // cleanup
    context.cleanup()
  }

  paintMasks (tiles: Array<Tile>) {
    // get context
    const { gl } = this.context
    // prep the fill program
    const fillProgram: FillProgram = this.useProgram('fill')
    if (!fillProgram) return new Error('The "fill" program does not exist, can not paint.')
    // get a starting mask index
    let maskRef = 2
    for (const tile of tiles) {
      const { faceST, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      // set correct tile mask
      gl.stencilFunc(gl.ALWAYS, maskRef, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      fillProgram.draw(this, mask)
      // keep tabs on the mask identifier
      tile.tmpMaskID = maskRef
      // update mask index
      maskRef += 3
    }
  }

  paintSphereBackground (tiles: Array<Tile>, sphereBackground) {
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
      fillProgram.draw(this, mask)
    }
  }

  paintFeatures (projection: Projection, style: Style, features: Array<FeatureGuide>) {
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
      program.draw(this, feature, sourceData[source], tmpMaskID)
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

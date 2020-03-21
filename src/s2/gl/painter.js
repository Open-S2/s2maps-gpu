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
/** DRAWING **/
import {
  drawFill,
  drawLine,
  drawMask,
  drawRaster,
  // drawShade,
  drawTexture,
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

    // prep options
    const webglOptions = { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: true, stencil: true }
    // first webgl2
    let context = this._canvas.getContext('webgl2', webglOptions)
    if (context && typeof context.getParameter === 'function') {
      this.indexSize = context.UNSIGNED_INT
      this.webglState = 2
      this.offsetSize = 4
      return this.context = new WebGL2Context(context)
    }

    // webgl
    // context = this._canvas.getContext('webgl', webglOptions)

    // esxperimental-webgl
    // context = this._canvas.getContext('experimental-webgl', webglOptions)
  }

  setClearColor (clearColor: [number, number, number, number]) {
    this.context.setClearColor(clearColor)
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
    const texProgram = this.programs.texture
    if (texProgram) texProgram.resize()
  }

  paint (projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    const { gl } = context
    // prep painting
    context.newScene()
    // if we have a texture program, we draw
    const texProgram = this.programs.texture
    if (texProgram) {
      texProgram.bindPointFrameBuffer()
      context.newScene()
      texProgram.bindQuadFrameBuffer()
      context.newScene()
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    // prep depth & stencil
    context.enableStencilTest()
    // prep the depth test
    context.enableDepthTest()
    // for each tile, draw background & features as necessary
    for (let tile of tiles) {
      const { size, faceST } = tile
      // grab the matrix (duplicate created) and view (input) properties
      const matrix = projection.getMatrix(size)
      const { view } = projection
      // inject values to programs
      this.injectFrameUniforms(matrix, view, faceST)
      // now draw the tile according to the features it contains
      this.paintLayers(tile, style)
      // no matter what, clear the stencil to ensure it's ready for the next tile
      context.clearStencil()
    }
    // disable stencil
    context.disableStencilTest()
    // draw any text & billboards that exist
    // if (texProgram) this.paintTextures(projection, tiles)
    // draw the wallpaper
    if (style.wallpaper) drawWallpaper(this, style.wallpaper)
    // draw shade layer
    // if (style.shade) drawShade(this, style.shade)
    // cleanup
    context.cleanup()
  }

  paintTextures (projection: Projection, tiles: Array<Tile>) {
    const { context } = this
    const { gl } = context

    // grab the texture program
    const texProgram = this.useProgram('texture')
    // setup uniforms
    texProgram.flush()
    texProgram.setAspect(projection.aspect)

    // PASS 1 - draw points
    // ensure we equip depth testing
    context.lequalDepth()
    // bind the points framebuffer
    texProgram.bindPointFrameBuffer()
    // run through each tile and draw a point should it make it through the z-pass
    for (let tile of tiles) {
      for (const texSource of tile.textureSources) {
        texProgram.setFaceST(tile.faceST)
        context.bindVertexArray(texSource.vao)
        drawTexture(this, texSource.primcount, 0)
      }
    }

    // TEMP: While figuring out how to draw quads
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // PASS 2 - draw quads
    context.alwaysDepth()
    // all depth passes from now on
    // bind the quads framebuffer
    // texProgram.bindQuadFrameBuffer()
    // setup the scene
    // context.clearColor()
    // TEMP: bind pointTexture as our sampler
    texProgram.samplePointTexture()
    // run through each tile and draw a quad if the point exists
    for (let tile of tiles) {
      for (const texSource of tile.textureSources) {
        texProgram.setFaceST(tile.faceST)
        context.bindVertexArray(texSource.vao)
        // gl.bindTexture(gl.TEXTURE_2D, texSource.texture)
        drawTexture(this, texSource.primcount, 1)
      }
    }

    // PASS 3 - draw textures
    // return back to our main renderbuffer
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
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
    let curTileID: number = 0
    let curProgram: ProgramTypes = 'fill'
    let program: Program = this.useProgram('fill')
    let parentSet: boolean = false
    let flush: boolean = false
    let curLayer: number = -1
    // use mask vao and fill program
    context.bindVertexArray(mask.vao)
    // First 'feature' is the mask feature
    drawMask(this, mask.indexArray.length, mask.mode, mask.threeD)
    // Second feature is the sphere-background feature should it exist
    if (sphereBackground) {
      program.setLayerCode(sphereBackground)
      drawFill(this, mask.indexArray.length, 0, null, mask.mode, mask.threeD)
    }
    // now we start drawing feature batches
    for (const featureBatch of featureGuide) {
      const { parent, tile, source, layerID, count, offset, type, featureCode, layerCode, texture } = featureBatch
      // if a parent tile, be sure to bind the parent tiles vao
      // rebind back to current vao and matrix when the parent is not being used
      if (parent && (!parentSet || curTileID !== tile.id || source !== curSource)) {
        parentSet = true
        curTileID = tile.id
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
        program.setLayerCode(layerCode)
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

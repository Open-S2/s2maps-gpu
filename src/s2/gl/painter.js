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
  // drawLine,
  // drawMask,
  // drawRaster,
  // drawShade,
  drawTexture,
  drawWallpaper
} from './draw'
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

  injectFrameUniforms (matrix: Float32Array, view: Float32Array) {
    const { programs } = this
    for (const programName in programs) {
      programs[programName].injectFrameUniforms(matrix, view)
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
    const { sphereBackground } = style
    // prep painting
    context.newScene()
    // if we have a texture program, we draw
    // const texProgram: TextureProgram = this.programs.texture
    // if (texProgram) {
    //   texProgram.bindPointFrameBuffer()
    //   context.newScene()
    //   texProgram.bindQuadFrameBuffer()
    //   context.newScene()
    //   gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // }

    // prep frame uniforms
    const { view } = projection
    const matrix = projection.getMatrix(512) // NOTE: For now, we have a default size of 512.
    this.injectFrameUniforms(matrix, view)

    // merge tile features
    const features = tiles.flatMap(tile => tile.featureGuide).sort(featureSort)
    // prep masks
    this.paintMasks(tiles, sphereBackground)
    // paint features
    this.paintFeatures(projection, style, features)
    // disable stencil
    context.disableStencilTest()
    // draw the wallpaper
    if (style.wallpaper) drawWallpaper(this, style.wallpaper)
    // draw any text & billboards that exist
    // if (texProgram) this.paintTextures(projection, tiles)
    // draw shade layer
    // if (style.shade) drawShade(this, style.shade)
    // cleanup
    context.cleanup()
  }

  paintMasks (tiles: Array<Tile>, sphereBackground) {
    const { context } = this
    const { gl } = context
    // prep the fill program
    const fillProgram: FillProgram = this.useProgram('fill')
    if (!fillProgram) return new Error('The "fill" program does not exist, can not paint.')
    // prep stencil - don't draw color, only to the stencil
    context.enableStencil()
    // get a starting mask index
    let maskIndex = 2
    for (const tile of tiles) {
      const { faceST, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      gl.stencilFunc(gl.ALWAYS, maskIndex, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      fillProgram.draw(this, mask)
      // keep tabs on the mask identifier
      tile.tmpMaskID = maskIndex
      // update mask index
      maskIndex += 3
    }
    // lock in the stencil
    context.lockStencil()
    // now we use the depth test
    context.enableDepthTest()

    // draw the sphere background should it exist
    if (sphereBackground) {
      fillProgram.setLayerCode(sphereBackground)
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
    // run through the features, and upon tile, layer, or program change, adjust accordingly
    for (const feature of features) {
      const { parent, tile, layerID, source, type, layerCode } = feature
      const { tmpMaskID } = tile
      // set program
      if (type !== curProgram) {
        curProgram = type
        program = this.useProgram(type)
      }
      // set stencil
      gl.stencilFunc(gl.EQUAL, tmpMaskID, 0xFF)
      // update layerID
      if (curLayer !== layerID) {
        curLayer = layerID
        program.setLayerCode(layerCode)
      }
      // update tile
      drawTile = (parent) ? parent : tile
      const { faceST, sourceData } = drawTile
      program.setFaceST(faceST)
      gl.bindVertexArray(sourceData[source].vao)
      // draw
      program.draw(this, feature, tmpMaskID)
    }
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
        gl.bindVertexArray(texSource.vao)
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
        gl.bindVertexArray(texSource.vao)
        // gl.bindTexture(gl.TEXTURE_2D, texSource.texture)
        drawTexture(this, texSource.primcount, 1)
      }
    }

    // PASS 3 - draw textures
    // return back to our main renderbuffer
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // paintLayers (tile: Tile, style: Style) {
  //   // setup context and style data
  //   const { context } = this
  //   const { gl } = context
  //   const { sphereBackground } = style
  //   // grab the featureGuide and vao from current tile
  //   const { faceST, sourceData, featureGuide } = tile
  //   const { mask } = sourceData
  //   // setup variables
  //   let curSource: string = 'mask'
  //   let curSourceData: object = mask
  //   let curTileID: number = 0
  //   let curProgram: ProgramTypes = 'fill'
  //   let program: Program = this.useProgram('fill')
  //   let parentSet: boolean = false
  //   let flush: boolean = false
  //   let curLayer: number = -1
  //   program.setFaceST(faceST)
  //   // use mask vao and fill program
  //   gl.bindVertexArray(mask.vao)
  //   // First 'feature' is the mask feature
  //   drawMask(this, mask.indexArray.length, mask.mode, mask.threeD)
  //   // Second feature is the sphere-background feature should it exist
  //   if (sphereBackground) {
  //     program.setLayerCode(sphereBackground)
  //     drawFill(this, mask.indexArray.length, 0, null, mask.mode, mask.threeD)
  //   }
  //   // now we start drawing feature batches
  //   for (const featureBatch of featureGuide) {
  //     const { parent, tile, source, layerID, count, offset, type, featureCode, layerCode, texture } = featureBatch
  //     // if a parent tile, be sure to bind the parent tiles vao
  //     // rebind back to current vao and matrix when the parent is not being used
  //     if (parent && (!parentSet || curTileID !== tile.id || source !== curSource)) {
  //       parentSet = true
  //       curTileID = tile.id
  //       curSourceData = tile.sourceData[source]
  //       gl.bindVertexArray(curSourceData.vao)
  //       curSource = source
  //       flush = true
  //     } else if (!parent && (parentSet || source !== curSource)) {
  //       parentSet = false
  //       curSourceData = sourceData[source]
  //       gl.bindVertexArray(curSourceData.vao)
  //       curSource = source
  //       flush = true
  //     }
  //     // if type is not the same as the curProgram, we have to update curProgram and set uniforms
  //     if (type !== curProgram) {
  //       program = this.useProgram(type)
  //       curProgram = type
  //       program.setFaceST(tile.faceST)
  //     }
  //     if (flush) {
  //       flush = false
  //       program.flush()
  //     }
  //     // if new layerID, update layerCode
  //     if (layerID !== curLayer && layerCode) {
  //       program.setLayerCode(layerCode)
  //       curLayer = layerID
  //     }
  //     // now draw according to type
  //     if (type === 'raster') {
  //       drawRaster(this, curSourceData.indexArray.length, texture, curSourceData.mode, curSourceData.threeD)
  //     } else if (type === 'fill') {
  //       drawFill(this, count, offset, featureCode)
  //     } else if (type === 'line') {
  //       drawLine(this, count, offset, featureCode)
  //     } else if (type === 'text' || type === 'billboard') {
  //
  //     }
  //   }
  // }
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

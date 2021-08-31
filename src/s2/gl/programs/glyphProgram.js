// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyph1.vertex.glsl'
import frag1 from '../../shaders/glyph1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyph2.vertex.glsl'
import frag2 from '../../shaders/glyph2.fragment.glsl'

import type { Context } from '../contexts'
import type { GlyphTileSource } from '../../source/tile'

type FBO = {
  width: number,
  height: number,
  texSize: Float32Array,
  texture: WebGLTexture,
  stencil: WebGLRenderbuffer,
  glyphFramebuffer: WebGLFramebuffer
}

export default class GlyphProgram extends Program {
  uOverdraw: WebGLUniformLocation
  uSize: WebGLUniformLocation
  uFill: WebGLUniformLocation
  uStroke: WebGLUniformLocation
  uSWidth: WebGLUniformLocation
  uInteractive: WebGLUniformLocation
  uTexSize: WebGLUniformLocation
  uIsIcon: WebGLUniformLocation
  uBounds: WebGLUniformLocation
  uIsStroke: WebGLUniformLocation
  uFeatures: WebGLUniformLocation
  uGlyphTex: WebGLUniformLocation
  glyphType: 'text' | 'icon'
  glyphFilterProgram: Program
  filter: boolean
  fbo: FBO
  defaultBounds: Float32Array = new Float32Array([0, 0, 8192, 8192])
  constructor (context: Context, glyphFilterProgram: Program) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // build shaders
    if (type === 1) gl.attributeLocations = { aUV: 0, aST: 1, aXY: 2, aOffset: 3, aWH: 4, aTexXY: 5, aTexWH: 6, aID: 7, aColor: 8 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // set the glyphFilter program
    this.glyphFilterProgram = glyphFilterProgram
    // activate so we can setup samplers
    this.use()
    // set texture positions
    gl.uniform1i(this.uFeatures, 0) // uFeatures texture unit 0
    gl.uniform1i(this.uGlyphTex, 1) // uGlyphTex texture unit 1
    // setup the devicePixelRatio
    this.setDevicePixelRatio(devicePixelRatio)
    // build an initial fbo
    this.fbo = this._buildFramebuffer(200)
    // set the current fbo size
    gl.uniform2fv(this.uTexSize, this.fbo.texSize)
  }

  delete () {
    // cleanup fbos
    this._deleteFBO(this.fbo)
    // cleanup programs
    super.delete()
  }

  _buildFramebuffer (height: number): FBO {
    const { gl } = this
    const fbo = {
      height,
      texSize: new Float32Array([2048, height]),
      texture: gl.createTexture(),
      stencil: gl.createRenderbuffer(),
      glyphFramebuffer: gl.createFramebuffer()
    }
    // TEXTURE BUFFER
    // pre-build the glyph texture
    // bind
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture)
    // allocate size
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // DEPTH & STENCIL BUFFER
    // bind
    gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.stencil)
    // allocate size
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, 2048, height)
    // FRAMEBUFFER
    // bind
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyphFramebuffer)
    // attach texture to glyphFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo.texture, 0)
    // attach stencil renderbuffer to framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, fbo.stencil)
    // rebind our default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return fbo
  }

  _increaseFBOSize (height: number): FBO {
    const { gl, context, fbo } = this
    if (height <= fbo.height) return

    // use to update texture size
    this.use()
    // build the new fbo
    const newFBO = this._buildFramebuffer(height)
    // copy over data
    if (context.type === 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyphFramebuffer)
      gl.bindTexture(gl.TEXTURE_2D, newFBO.texture)
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, 2048, fbo.height)
    } else {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo.glyphFramebuffer)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, newFBO.glyphFramebuffer)
      gl.blitFramebuffer(0, 0, 2048, fbo.height, 0, 0, 2048, fbo.height, gl.COLOR_BUFFER_BIT, gl.LINEAR)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // set the texture size uniform
    gl.uniform2fv(this.uTexSize, newFBO.texSize)
    // delete old FBO and set new
    this._deleteFBO(fbo)
    // update to new FBO
    this.fbo = newFBO
  }

  _deleteFBO (fbo: FBO) {
    const { gl } = this
    if (fbo) {
      gl.deleteTexture(fbo.texture)
      gl.deleteRenderbuffer(fbo.stencil)
      gl.deleteFramebuffer(fbo.glyphFramebuffer)
      delete fbo.width
      delete fbo.height
      delete fbo.texSize
      delete fbo.texture
      delete fbo.stencil
      delete fbo.glyphFramebuffer
    }
  }

  setOverdraw (state: boolean) {
    if (this.filter !== state) {
      this.filter = state
      this.gl.uniform1i(this.uOverdraw, state)
    }
  }

  setGlyphType (type: 'text' | 'icon') {
    if (this.glyphType !== type) {
      this.gl.uniform1i(this.uIsIcon, (type === 'text') ? false : true)
      this.glyphType = type
    }
  }

  injectImages (maxHeight: number, images: GlyphImages) {
    const { gl } = this
    // increase texture size if necessary
    this._increaseFBOSize(maxHeight)
    // iterate through images and store
    gl.bindTexture(gl.TEXTURE_2D, this.fbo.texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    for (const { posX, posY, width, height, data } of images) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, posX, posY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8ClampedArray(data))
    }
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource, interactive: boolean = false) {
    const { gl, context, defaultBounds, fbo, glyphFilterProgram, uBounds } = this
    const { type } = context
    // pull out the appropriate data from the source
    const {
      overdraw, glyphType, depthPos, featureCode, offset,
      count, size, fill, stroke, strokeWidth, bounds
    } = featureGuide
    const { glyphQuadBuffer, glyphColorBuffer } = source
    // grab glyph texture
    const { texture } = fbo
    // WebGL1 - set paint properties; WebGL2 - set feature code
    if (type === 1) {
      if (!isNaN(size)) gl.uniform1f(this.uSize, size)
      if (fill && fill.length) gl.uniform4fv(this.uFill, fill)
      if (stroke && stroke.length) gl.uniform4fv(this.uStroke, stroke)
      if (!isNaN(strokeWidth)) gl.uniform1f(this.uSWidth, strokeWidth)
    } else { this.setFeatureCode(featureCode) }
    // if bounds exists, set them, otherwise set default bounds
    if (bounds) gl.uniform4fv(uBounds, bounds)
    else gl.uniform4fv(uBounds, defaultBounds)
    // turn stencil testing off
    context.stencilFuncAlways(0)
    // ensure proper z-testing state
    context.enableDepthTest()
    // set depth type
    if (interactive) context.lessDepth()
    else context.lequalDepth()
    context.setDepthRange(depthPos)
    // use default blending
    context.defaultBlend()
    // set overdraw
    this.setOverdraw(overdraw)
    // set draw type
    this.setGlyphType(glyphType)
    // bind the correct glyph texture
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // ensure glyphFilterProgram's result texture is set
    gl.activeTexture(gl.TEXTURE0)
    glyphFilterProgram.bindResultTexture()
    // apply the appropriate offset in the source vertexBuffer attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphQuadBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 52, offset * 52) // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 52, 8 + (offset * 52)) // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 52, 16 + (offset * 52)) // xOffset, yOffset
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 52, 24 + (offset * 52)) // width, height
    gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 52, 32 + (offset * 52)) // texture x, y
    gl.vertexAttribPointer(6, 2, gl.FLOAT, false, 52, 40 + (offset * 52)) // width, height
    gl.vertexAttribPointer(7, 1, gl.FLOAT, false, 52, 48 + (offset * 52)) // id
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphColorBuffer)
    gl.vertexAttribPointer(8, 4, gl.UNSIGNED_BYTE, true, 4, offset * 4)
    // draw
    if (glyphType === 'text') {
      gl.uniform1i(this.uIsStroke, true)
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
      gl.uniform1i(this.uIsStroke, false)
    }
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
  }
}

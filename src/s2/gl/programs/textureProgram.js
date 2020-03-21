// @flow
import Program from './program'

import textVertex from '../../shaders/text.vertex.glsl'
import textFragment from '../../shaders/text.fragment.glsl'

import type { Context } from '../contexts'

export default class TextureProgram extends Program {
  uAspect: WebGLUniformLocation
  uMode: WebGLUniformLocation
  uFeatureSampler: WebGLUniformLocation
  uTextureSampler: WebGLUniformLocation
  currentMode: number = -1
  pointFramebuffer: WebGLFramebuffer
  pointTexture: WebGLTexture
  quadTexture: WebGLTexture
  depthBuffer: WebGLRenderbuffer
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, textVertex, textFragment)
    // since we need to set texture positions, we use
    gl.useProgram(this.glProgram)
    // set uniforms
    this.uAspect = gl.getUniformLocation(this.glProgram, 'uAspect')
    this.uMode = gl.getUniformLocation(this.glProgram, 'uMode')
    this.uTextureSampler = gl.getUniformLocation(this.glProgram, 'uTexture')
    gl.uniform1i(this.uTextureSampler, 0)
    this.uFeatureSampler = gl.getUniformLocation(this.glProgram, 'uFeatures')
    gl.uniform1i(this.uFeatureSampler, 1)
    // set defaults
    this.update3D = false

    // TEXTURES
    // POINT TEXTURE
    this.pointTexture = gl.createTexture()
    // bind
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // create pointTexture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // QUAD TEXTURE
    this.quadTexture = gl.createTexture()
    // bind
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // create quadTexture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // DEPTH
    this.depthBuffer = gl.createRenderbuffer()
    // bind
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
    // allocate renderbuffer
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)

    // FRAMEBUFFERS
    // POINT FRAMEBUFFER
    this.pointFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    // attach pointTexture to pointFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pointTexture, 0)
    // attach depthBuffer renderbuffer to pointFramebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer)
    // QUAD FRAMEBUFFER
    this.quadFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    // attach quadTexture to quadFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.quadTexture, 0)

    // we are finished, so go back to our main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  resize () {
    const { gl } = this
    // bind the pointFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    // bind the pointTexture
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // bind the depthBuffer buffer
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
    // update the renderbuffer's aspect
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)
    // bind the quadFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    // bind the quadTexture
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // reassociate with the main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  bindPointFrameBuffer () {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    this.sampleQuadTexture()
  }

  bindQuadFrameBuffer () {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    this.samplePointTexture()
  }

  samplePointTexture () {
    const { gl } = this
    // activate texture 1
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // go back to texture0 for future bindings
    gl.activeTexture(gl.TEXTURE0)
  }

  sampleQuadTexture () {
    const { gl } = this
    // activate texture 1
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // go back to texture0 for future bindings
    gl.activeTexture(gl.TEXTURE0)
  }

  // because setting uniforms are cheap, once per draw call regardless of whether
  // the window size changed, we update the aspect ratio
  setAspect (aspect: Float32Array) { // [CanvasWidth, CanvasHeight]
    this.gl.uniform2fv(this.uAspect, aspect)
  }

  setMode (mode: number) {
    if (this.currentMode !== mode) {
      // update current value
      this.currentMode = mode
      // update gpu uniform
      this.gl.uniform1i(this.uMode, mode)
    }
  }
}

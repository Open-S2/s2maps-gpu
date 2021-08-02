// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/heatmap1.vertex.glsl'
import frag1 from '../../shaders/heatmap1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/heatmap2.vertex.glsl'
import frag2 from '../../shaders/heatmap2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class HeatmapProgram extends Program {
  uRadius: WebGLUniformLocation
  uOpacity: WebGLUniformLocation
  uIntensity: WebGLUniformLocation
  uDrawState: WebGLUniformLocation
  uImage: WebGLUniformLocation
  uColorRamp: WebGLUniformLocation
  uBounds: WebGLUniformLocation
  texture: WebGLTexture
  nullTextureA: WebGLTexture
  nullTextureB: WebGLTexture
  framebuffer: WebGLFramebuffer
  defaultBounds: Float32Array = new Float32Array([0, 0, 8192, 8192])
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aExtent: 0, aPos: 1 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // activate so we can setup samplers
    this.use()
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio)
    // set sampler positions
    gl.uniform1i(this.uColorRamp, 0)
    gl.uniform1i(this.uImage, 1)
    // build heatmap texture + FBO
    this._setupFBO()
  }

  delete () {
    const { gl, texture, framebuffer } = this
    // delete texture
    gl.deleteTexture(texture)
    // delete framebuffer
    gl.deleteFramebuffer(framebuffer)
    // cleanup programs
    super.delete()
  }

  _setupFBO () {
    const { gl } = this

    this.nullTextureA = this._createNullTexture()
    this.nullTextureB = this._createNullTexture()

    this.texture = gl.createTexture()
    this.resize()
    // create framebuffer
    this.framebuffer = gl.createFramebuffer()
    // bind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    // attach texture
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)

    // we are finished, so go back to our main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  resize () {
    const { gl } = this
    // const { devicePixelRatio } = context
    // bind the texture
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    // create aspect
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width / devicePixelRatio, gl.canvas.height / devicePixelRatio, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  _createNullTexture () {
    const { gl } = this
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    return texture
  }

  setupTextureDraw () {
    const { context, gl } = this
    // attach and clear framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer)
    context.clearColorBuffer()
    // ensure null textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.nullTextureA)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.nullTextureB)
    // set draw state
    gl.uniform1f(this.uDrawState, 0)
  }

  setupCanvasDraw () {
    const { gl } = this
    // set draw state
    gl.uniform1f(this.uDrawState, 1)
    // revert back to texture 0
    gl.activeTexture(gl.TEXTURE0)
  }

  drawTexture (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { context, defaultBounds, uIntensity, uRadius, uOpacity, uBounds } = this
    const { gl, type } = context
    // get current source data
    let { count, featureCode, intensity, radius, opacity, offset, mode, bounds } = featureGuide
    // ensure proper blend state
    context.oneBlend()
    // ensure we are not stencil, cull, or depth testing
    context.disableCullFace()
    context.disableDepthTest()
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform1f(uIntensity, intensity)
      gl.uniform1f(uRadius, radius)
      gl.uniform1f(uOpacity, opacity)
    } else { this.setFeatureCode(featureCode) }
    // if bounds exists, set them, otherwise set default bounds
    if (bounds) gl.uniform4fv(uBounds, bounds)
    else gl.uniform4fv(uBounds, defaultBounds)
    // setup offsets and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    gl.vertexAttribPointer(1, 2, gl.SHORT, false, 4, offset * 4)
    gl.bindBuffer(gl.ARRAY_BUFFER, source.weightBuffer)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 4, offset * 4)
    gl.drawArraysInstanced(mode || gl.TRIANGLES, 0, 6, count)
  }

  draw (featureGuide: FeatureGuide) {
    // grab the context
    const { gl, context } = this
    // get current featureGuide data
    let { colorRamp, depthPos } = featureGuide
    // set context's full screen fbo
    gl.bindVertexArray(context.vao)
    // set colorRamp
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, colorRamp)
    // ensure proper blend state and depth testing is on
    context.defaultBlend()
    context.enableDepthTest()
    context.disableCullFace()
    context.stencilFuncAlways(0)
    // adjust to current depthPos
    if (depthPos) {
      context.lessDepth()
      context.setDepthRange(depthPos)
    } else { context.resetDepthRange() }
    // draw a fan
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }
}

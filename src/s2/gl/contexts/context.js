// @flow
/* global WebGLVertexArrayObject WebGLBuffer */
import buildMask from '../../source/buildMask'
import type { VectorTileSource } from '../../source/tile'

import type { WebGLRenderingContext, WebGL2RenderingContext } from './'

export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  devicePixelRatio: number
  type: 1 | 2
  clearColorRGBA: [number, number, number, number] = [0, 0, 0, 0]
  masks: Map<number, VectorTileSource> = new Map()
  vao: WebGLVertexArrayObject
  vertexBuffer: WebGLBuffer
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext, devicePixelRatio: number) {
    this.gl = context
    this.devicePixelRatio = devicePixelRatio
  }

  resetViewport () {
    const { gl } = this
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }

  bindMainBuffer () {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  getMask (level: number, division: number) {
    const { masks } = this
    if (masks.has(level)) return masks.get(level)
    const mask = buildMask(division, this)
    masks.set(level, mask)
    return mask
  }

  _createDefaultQuad () {
    const { gl } = this
    // create a vertex array object
    this.vao = gl.createVertexArray()
    // bind the vao so we can work on it
    gl.bindVertexArray(this.vao)
    // Create a vertex buffer
    this.vertexBuffer = gl.createBuffer()
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = vertexBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW)
    // Turn on the attribute
    gl.enableVertexAttribArray(0)
    // tell attribute how to get data out of vertexBuffer
    // (attribute pointer, compenents per iteration (size), data size (type), normalize, stride, offset)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    // clear vao
    gl.bindVertexArray(null)
  }

  drawQuad () {
    const { gl } = this
    // bind the vao
    gl.bindVertexArray(this.vao)
    // draw a fan
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }

  setClearColor (clearColor: [number, number, number, number]) {
    this.clearColorRGBA = clearColor
  }

  newScene () {
    this.enableCullFace()
    this.enableStencilTest()
    this.enableDepthTest()
    this.enableBlend()
    this.clearScene()
  }

  clearScene () {
    const { gl } = this
    this.clearColor()
    gl.clearStencil(0x0)
    gl.clearDepth(1)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
  }

  clearColor () {
    const { gl } = this
    gl.clearColor(...this.clearColorRGBA)
    // gl.colorMask(true, true, true, true)
  }

  clearColorDepthBuffers () {
    const { gl } = this
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
  }

  clearColorBuffer () {
    const { gl } = this
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  enableDepthTest () {
    this.gl.enable(this.gl.DEPTH_TEST)
    this.alwaysDepth() // start with an always pass depth function
  }

  lessDepth () {
    this.gl.depthFunc(this.gl.LESS)
  }

  lequalDepth () {
    const { gl } = this
    gl.depthFunc(gl.LEQUAL)
  }

  wallpaperState () {
    const { gl } = this
    gl.depthFunc(gl.ALWAYS)
    gl.stencilFunc(gl.EQUAL, 0, 0xFF)
  }

  alwaysDepth () {
    this.gl.depthFunc(this.gl.ALWAYS)
  }

  disableDepthTest () {
    this.gl.disable(this.gl.DEPTH_TEST)
  }

  enableCullFace () {
    this.gl.enable(this.gl.CULL_FACE)
  }

  disableCullFace () {
    this.gl.disable(this.gl.CULL_FACE)
  }

  enableBlend () {
    const { gl } = this
    gl.enable(gl.BLEND)
    gl.blendColor(0, 0, 0, 0)
    this.setBlendDefault()
  }

  setBlendDefault () {
    const { gl } = this
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  setBlendShade () {
    const { gl } = this
    gl.blendFunc(gl.DST_COLOR, gl.ZERO)
  }

  inversionBlending () {
    const { gl } = this
    gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR)
  }

  zeroBlend () {
    const { gl } = this
    gl.blendFunc(gl.ZERO, gl.SRC_COLOR)
  }

  oneBlend () {
    const { gl } = this
    gl.blendFunc(gl.ONE, gl.ONE)
  }

  disableBlend () {
    this.gl.disable(this.gl.BLEND)
  }

  enableStencilTest () {
    this.gl.enable(this.gl.STENCIL_TEST)
  }

  disableStencilTest () {
    this.gl.disable(this.gl.STENCIL_TEST)
  }

  enableMaskTest () {
    const { gl } = this
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.colorMask(false, false, false, false)
  }

  stencilFunc (ref: number) {
    const { gl } = this
    gl.stencilFunc(gl.ALWAYS, ref, 0xFF)
  }

  stencilInvert () {
    const { gl } = this
    gl.colorMask(false, false, false, false)
    gl.stencilOp(gl.KEEP, gl.INVERT, gl.INVERT)
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF)
  }

  stencilZero () {
    const { gl } = this
    gl.colorMask(true, true, true, true)
    gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE)
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xFF)
  }

  cleanup () {
    const { gl } = this
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

// @flow
/* global WebGLVertexArrayObject WebGLBuffer */
import buildMask from '../../source/buildMask'
import type { VectorTileSource } from '../../source/tile'

import type { WebGLRenderingContext, WebGL2RenderingContext } from './'

export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  devicePixelRatio: number
  depthEpsilon: number
  depthTestState: boolean = false
  blendState: number = -1 // 0 -> default ; 1 ->
  zTestState: number = -1 // 0 -> always ; 1 -> less ; 2 -> lessThenOrEqual
  zLow: number = 0
  zHigh: numbber = 1
  type: 1 | 2
  clearColorRGBA: [number, number, number, number] = [0, 0, 0, 0]
  masks: Map<number, VectorTileSource> = new Map()
  vao: WebGLVertexArrayObject
  vertexBuffer: WebGLBuffer
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext, devicePixelRatio: number) {
    this.gl = context
    this.devicePixelRatio = devicePixelRatio
    this.depthEpsilon = 1 / Math.pow(2, 16)
  }

  delete () {
    const { gl, vertexBuffer, vao } = this
    // remove local data
    gl.deleteBuffer(vertexBuffer)
    gl.deleteVertexArray(vao)
    // remove all possible references
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // set canvas to smallest size possible
    gl.canvas.width = 1
    gl.canvas.height = 1
    // attempt to force a context loss
    gl.getExtension('WEBGL_lose_context').loseContext()
  }

  /** CONSTRUCTION **/

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

  /** PREP PHASE **/

  resetViewport () {
    const { gl } = this
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }

  bindMainBuffer () {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  setClearColor (clearColor: [number, number, number, number]) {
    this.clearColorRGBA = clearColor
  }

  newScene () {
    this.enableCullFace()
    this.enableStencilTest()
    this.disableDepthTest()
    this.enableBlend()
    this.resetDepthRange()
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
    gl.blendColor(0, 0, 0, 0)
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

  /** DEPTH **/

  enableDepthTest () {
    const { gl, depthTestState } = this
    if (!depthTestState) {
      gl.enable(gl.DEPTH_TEST)
      this.depthTestState = true
    }
  }

  disableDepthTest () {
    const { gl, depthTestState } = this
    if (depthTestState) {
      gl.disable(gl.DEPTH_TEST)
      this.depthTestState = false
    }
  }

  alwaysDepth () {
    const { gl, zTestState } = this
    if (zTestState !== 0) {
      this.zTestState = 0
      gl.depthFunc(gl.ALWAYS)
    }
  }

  lessDepth () {
    const { gl, zTestState } = this
    if (zTestState !== 1) {
      this.zTestState = 1
      gl.depthFunc(gl.LESS)
    }
  }

  lequalDepth () {
    const { gl, zTestState } = this
    if (zTestState !== 2) {
      this.zTestState = 2
      gl.depthFunc(gl.LEQUAL)
    }
  }

  setDepthRange (depthPos: number) {
    const { gl, zLow, zHigh } = this
    const depth = 1 - depthPos * this.depthEpsilon
    if (zLow !== depth || zHigh !== depth) {
      gl.depthRange(depth, depth)
      this.zLow = depth
      this.zHigh = depth
    }
  }

  resetDepthRange () {
    const { gl, zLow, zHigh } = this
    if (zLow !== 0 || zHigh !== 1) {
      gl.depthRange(0, 1)
      this.zLow = 0
      this.zHigh = 1
    }
  }

  /** WALLPAPER **/

  wallpaperState () {
    const { gl } = this
    this.alwaysDepth()
    gl.stencilFunc(gl.EQUAL, 0, 0xFF)
  }

  /** CULLING **/

  enableCullFace () {
    const { gl } = this
    gl.enable(gl.CULL_FACE)
  }

  disableCullFace () {
    const { gl } = this
    gl.disable(gl.CULL_FACE)
  }

  /** BLENDING **/

  enableBlend () {
    const { gl } = this
    gl.enable(gl.BLEND)
    this.defaultBlend()
  }

  disableBlend () {
    const { gl } = this
    gl.disable(gl.BLEND)
  }

  defaultBlend () {
    const { gl, blendState } = this
    if (blendState !== 0) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      this.blendState = 0
    }
  }

  shadeBlend () {
    const { gl, blendState } = this
    if (blendState !== 1) {
      gl.blendFunc(gl.DST_COLOR, gl.ZERO)
      this.blendState = 1
    }
  }

  inversionBlend () {
    const { gl, blendState } = this
    if (blendState !== 2) {
      gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR)
      this.blendState = 2
    }
  }

  zeroBlend () {
    const { gl, blendState } = this
    if (blendState !== 3) {
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR)
      this.blendState = 3
    }
  }

  oneBlend () {
    const { gl, blendState } = this
    if (blendState !== 4) {
      gl.blendFunc(gl.ONE, gl.ONE)
      this.blendState = 4
    }
  }

  /** STENCILING **/

  enableStencilTest () {
    const { gl } = this
    gl.enable(gl.STENCIL_TEST)
  }

  disableStencilTest () {
    const { gl } = this
    gl.disable(gl.STENCIL_TEST)
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

  /** MASKING **/

  enableMaskTest () {
    const { gl } = this
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.colorMask(false, false, false, false)
  }

  /** CLEANUP **/

  cleanup () {
    const { gl } = this
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

// @flow

export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = context
  }

  newScene () {
    this.clearScene()
    this.enableCullFace()
    this.disableDepthTest()
    this.enableBlend()
  }

  clearScene () {
    this.gl.clear(this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT | this.gl.COLOR_BUFFER_BIT)
    this.clearColor()
  }

  clearColor () {
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.colorMask(true, true, true, true)
  }

  enableDepthTest () {
    this.gl.enable(this.gl.DEPTH_TEST)
    this.alwaysDepth() // start with a default less than or equal
  }

  lessDepth () {
    this.gl.depthFunc(this.gl.LESS)
  }

  lequalDepth () {
    this.gl.depthFunc(this.gl.LEQUAL)
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
    // gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.blendColor(0, 0, 0, 0)
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

  enableStencil () {
    this.gl.stencilOp(this.gl.KEEP, this.gl.KEEP, this.gl.REPLACE)
  	this.gl.stencilFunc(this.gl.ALWAYS, 1, 0xFF)
  	this.gl.stencilMask(0xFF)
  	this.gl.colorMask(false, false, false, false)
  }

  lockStencil () {
    this.gl.stencilFunc(this.gl.EQUAL, 1, 0xFF)
  	this.gl.stencilMask(0x00)
  	this.gl.colorMask(true, true, true, true)
  }

  clearStencil () {
    this.gl.clearStencil(0x0)
  	this.gl.stencilMask(0xFF)
    this.gl.clear(this.gl.STENCIL_BUFFER_BIT)
  }

  cleanup () {
    this.bindVertexArray(null)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

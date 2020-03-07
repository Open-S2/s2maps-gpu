// @flow

export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = context
  }

  newScene () {
    this.clearScene()
    this.enableCullFace()
    this.enableDepthTest()
    this.enableStencilTest()
    this.enableBlend()
  }

  clearScene () {
    this.gl.clear(this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT | this.gl.COLOR_BUFFER_BIT)
    this.gl.clearStencil(0xFF)
    this.clearStencil()
    this.clearColor()
  }

  clearColor () {
    this.gl.clearColor(0, 0, 0, 0)
  }

  enableColorMask () {
    this.gl.colorMask(true, true, true, true)
  }

  disableColorMask () {
    this.gl.colorMask(false, false, false, false)
  }

  enableMask () {
    this.disableColorMask()
    this.setStencilFunc(this.gl.ALWAYS, 0)
  }

  lockMask (depth?: boolean = false) {
    this.enableColorMask()
    this.gl.stencilOp(this.gl.KEEP, (depth) ? this.gl.KEEP : this.gl.REPLACE, this.gl.REPLACE)
    // this.setStencilFunc()
  }

  setStencilFunc (func: GLenum = this.gl.GREATER, ref: GLint = 255, mask: GLuint = 0xFF) {
    this.gl.stencilFunc(func, ref, mask)
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

  clearStencil () {
    this.gl.clear(this.gl.STENCIL_BUFFER_BIT)
  }

  cleanup () {
    this.bindVertexArray(null)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

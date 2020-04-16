// @flow
export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  type: 1 | 2
  clearColorRGBA: [number, number, number, number] = [0, 0, 0, 0]
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = context
  }

  newScene () {
    this.clearScene()
    this.enableCullFace()
    this.enableStencilTest()
    this.enableDepthTest()
    this.enableBlend()
  }

  clearScene () {
    const { gl } = this
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
    this.clearColor()
    this.clearStencil()
  }

  clearColor () {
    this.gl.clearColor(...this.clearColorRGBA)
    this.gl.colorMask(true, true, true, true)
  }

  setClearColor (clearColor: [number, number, number, number]) {
    this.clearColorRGBA = clearColor
  }

  enableDepthTest () {
    this.gl.enable(this.gl.DEPTH_TEST)
    this.alwaysDepth() // start with an always pass depth function
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
    const { gl } = this
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
  	gl.colorMask(false, false, false, false)
  }

  stencilFunc (ref: number) {
    this.gl.stencilFunc(this.gl.ALWAYS, ref, 0xFF)
  }

  fillFirstPass (ref) {
    const { gl } = this
    gl.colorMask(false, false, false, false)
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.INCR, gl.INCR)
    gl.stencilFuncSeparate(gl.FRONT, gl.EQUAL, ref, 0xFF)
    gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.KEEP)
    gl.stencilFuncSeparate(gl.BACK, gl.EQUAL, ref, 0xFF)
  }

  fillSecondPass (ref) {
    const { gl } = this
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.KEEP)
    gl.stencilFuncSeparate(gl.FRONT, gl.EQUAL, ref + 1, 0xFF)
    gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.DECR, gl.DECR)
    gl.stencilFuncSeparate(gl.BACK, gl.EQUAL, ref + 1, 0xFF)
  }

  fillThirdPass (ref) {
    const { gl } = this
    gl.colorMask(true, true, true, true)
    gl.stencilFunc(gl.EQUAL, ref + 1, 0xFF)
    gl.stencilOp(gl.KEEP, gl.DECR, gl.DECR)
  }

  lockStencil () {
  	this.gl.colorMask(true, true, true, true)
  }

  clearStencil () {
    const { gl } = this
    gl.clearStencil(0x0)
  	gl.stencilMask(0xFF)
    gl.clear(gl.STENCIL_BUFFER_BIT)
  }

  cleanup () {
    const { gl } = this
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

// @flow
export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  type: 1 | 2
  clearColorRGBA: [number, number, number, number] = [0, 0, 0, 0]
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = context
  }

  resetViewport () {
    const { gl } = this
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }

  bindMainBuffer () {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,  1, -1,  1, 1,  -1, 1]), gl.STATIC_DRAW)
    // Turn on the attribute
    gl.enableVertexAttribArray(this.aPos)
    // tell attribute how to get data out of vertexBuffer
    // (attribute pointer, compenents per iteration (size), data size (type), normalize, stride, offset)
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0)
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
    this.clearScene()
    this.enableCullFace()
    this.enableStencilTest()
    this.enableDepthTest()
    this.enableBlend()
  }

  clearScene () {
    const { gl } = this
    this.clearColor()
    this.clearStencil()
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

  clearStencil () {
    const { gl } = this
    gl.clearStencil(0x0)
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

  additiveBlending () {
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

  enableStencil () {
    const { gl } = this
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
  	gl.colorMask(false, false, false, false)
  }

  stencilFunc (ref: number) {
    const { gl } = this
    gl.stencilFunc(gl.ALWAYS, ref, 0xFF)
  }

  lockStencil () {
  	this.gl.colorMask(true, true, true, true)
  }

  cleanup () {
    const { gl } = this
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

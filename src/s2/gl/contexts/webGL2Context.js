// @flow
import Context from './context'

export default class WebGL2Context extends Context {
  // constructor (context: WebGLRenderingContext) {
  //   super(context)
  // }

  createVertexArray (): WebGLVertexArrayObject {
    return this.gl.createVertexArray()
  }

  bindVertexArray (vao: WebGLVertexArrayObject) {
    return this.gl.bindVertexArray(vao)
  }

  deleteVertexArray (vao: WebGLVertexArrayObject) {
    return this.gl.deleteVertexArray(vao)
  }
}

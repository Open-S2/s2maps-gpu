// @flow
import Context from './context'

export default class WebGLContext extends Context {
  // constructor (context: WebGLRenderingContext) {
  //   super(context)
  // }
  createVertexArray (): WebGLVertexArrayObject {
    // TODO: VAO's are not naturally part of webgl
  }

  bindVertexArray (vao: WebGLVertexArrayObject) {
    // TODO: VAO's are not naturally part of webgl
  }

  deleteVertexArray (vao: WebGLVertexArrayObject) {
    // TODO: VAO's are not naturally part of webgl
  }
}

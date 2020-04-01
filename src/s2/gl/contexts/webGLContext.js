// @flow
import Context from './context'

export default class WebGLContext extends Context {
  elementIndexUint: 'OES_element_index_uint'
  angledInstancedArrays: 'ANGLE_instanced_arrays'
  vertexArrayObject: 'OES_vertex_array_object'
  constructor (context: WebGLRenderingContext) {
    super(context)
    // grab extensions
    this.elementIndexUint = this.gl.getExtension('OES_element_index_uint')
    if (!this.elementIndexUint) console.log('*** Error - "OES_element_index_uint" is not a supported extension')
    this.angledInstancedArrays = this.gl.getExtension('ANGLE_instanced_arrays')
    if (!this.angledInstancedArrays) console.log('*** Error - "ANGLE_instanced_arrays" is not a supported extension')
    this.vertexArrayObject = this.gl.getExtension('OES_vertex_array_object')
    if (!this.vertexArrayObject) console.log('*** Error - "OES_vertex_array_object" is not a supported extension')
    // polyfill
    this._polyfill()
  }

  _polyfill () {
    // OES_vertex_array_object
    if (this.vertexArrayObject) {
      // createVertexArray
      this.gl.createVertexArray = this.vertexArrayObject.createVertexArrayOES
      // bindVertexArray
      this.gl.bindVertexArray = this.vertexArrayObject.bindVertexArrayOES
      // deleteVertexArray
      this.gl.deleteVertexArray = this.vertexArrayObject.deleteVertexArrayOES
    }

    // ANGLE_instanced_arrays
    if (this.angledInstancedArrays) {
      // vertexAttribDivisor
      this.gl.vertexAttribDivisor = this.angledInstancedArrays.vertexAttribDivisorANGLE
      // drawArraysInstanced
      this.gl.drawArraysInstanced = this.angledInstancedArrays.drawArraysInstancedANGLE
    }
  }
}

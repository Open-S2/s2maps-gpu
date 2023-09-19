/* eslint-env browser */
import Context from './context'

import type { MapOptions } from 'ui/s2mapUI'

export default class WebGLContext extends Context {
  elementIndexUint: OES_element_index_uint | null
  angledInstancedArrays: ANGLE_instanced_arrays | null
  vertexArrayObject: OES_vertex_array_object | null
  constructor (context: WebGLRenderingContext, options: MapOptions) {
    super(context, options)
    // let the painter know it's a WebGLContext
    this.type = 1
    const { gl } = this
    // grab extensions
    this.elementIndexUint = gl.getExtension('OES_element_index_uint')
    if (this.elementIndexUint === null) console.error('*** Error - "OES_element_index_uint" is not a supported extension')
    this.angledInstancedArrays = gl.getExtension('ANGLE_instanced_arrays')
    if (this.angledInstancedArrays === null) console.error('*** Error - "ANGLE_instanced_arrays" is not a supported extension')
    this.vertexArrayObject = gl.getExtension('OES_vertex_array_object')
    if (this.vertexArrayObject === null) console.error('*** Error - "OES_vertex_array_object" is not a supported extension')
    // polyfill
    this._polyfill()
    // create default quad
    this._createDefaultQuad()
  }

  _polyfill (): void {
    const gl = this.gl as WebGLRenderingContext
    // OES_vertex_array_object
    if (this.vertexArrayObject !== null) {
      const vertexArrayObject = this.vertexArrayObject
      // createVertexArray
      gl.createVertexArray = () => vertexArrayObject.createVertexArrayOES()
      // bindVertexArray
      gl.bindVertexArray = (vao: WebGLVertexArrayObject | null) => { vertexArrayObject.bindVertexArrayOES(vao) }
      // deleteVertexArray
      gl.deleteVertexArray = (vao: WebGLVertexArrayObject | null) => { vertexArrayObject.deleteVertexArrayOES(vao) }
    }
    // ANGLE_instanced_arrays
    if (this.angledInstancedArrays !== null) {
      const angledInstancedArrays = this.angledInstancedArrays
      // vertexAttribDivisor
      gl.vertexAttribDivisor = (index: number, divisor: number) => {
        angledInstancedArrays.vertexAttribDivisorANGLE(index, divisor)
      }
      // drawArraysInstanced
      gl.drawArraysInstanced = (mode: number, first: number, count: number, instanceCount: number) => {
        angledInstancedArrays.drawArraysInstancedANGLE(mode, first, count, instanceCount)
      }
      // drawElementsInstanced
      gl.drawElementsInstanced = (mode: number, count: number, type: number, offset: number, primcount: number) => {
        angledInstancedArrays.drawElementsInstancedANGLE(mode, count, type, offset, primcount)
      }
    }
  }
}

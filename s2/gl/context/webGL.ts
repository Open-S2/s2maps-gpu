import Context from './context.js';

import type { MapOptions } from 'ui/s2mapUI.js';
import type { Painter } from '../painter.spec.js';

/**
 * # WebGL Context
 * Wrapper for WebGL context with plugins
 */
export default class WebGLContext extends Context {
  elementIndexUint: OES_element_index_uint | null;
  angledInstancedArrays: ANGLE_instanced_arrays | null;
  vertexArrayObject: OES_vertex_array_object | null;
  textureFloat: OES_texture_float | null;
  /**
   * @param context - the WebGL rendering context
   * @param options - map options to pull out wegl specific options
   * @param painter - painter wrapper
   */
  constructor(context: WebGLRenderingContext, options: MapOptions, painter: Painter) {
    super(context, options, painter);
    // let the painter know it's a WebGLContext
    this.type = 1;
    const { gl } = this;
    // grab extensions
    this.elementIndexUint = gl.getExtension('OES_element_index_uint');
    if (this.elementIndexUint === null)
      console.error('*** Error - "OES_element_index_uint" is not a supported extension');
    this.angledInstancedArrays = gl.getExtension('ANGLE_instanced_arrays');
    if (this.angledInstancedArrays === null)
      console.error('*** Error - "ANGLE_instanced_arrays" is not a supported extension');
    this.vertexArrayObject = gl.getExtension('OES_vertex_array_object');
    if (this.vertexArrayObject === null)
      console.error('*** Error - "OES_vertex_array_object" is not a supported extension');
    this.textureFloat = gl.getExtension('OES_texture_float');
    if (this.textureFloat === null)
      console.error('*** Error - "OES_texture_float" is not a supported extension');
    // polyfill
    this.#polyfill();
    // create default quad
    this._createDefaultQuad();
  }

  /** Interal polyfill ensures the renderer supports the required extensions */
  #polyfill(): void {
    const gl = this.gl as WebGLRenderingContext;
    // OES_vertex_array_object
    if (this.vertexArrayObject !== null) {
      const vertexArrayObject = this.vertexArrayObject;
      /**
       * createVertexArray
       * @returns the vertex array object if it was created successfully
       */
      gl.createVertexArray = (): WebGLVertexArrayObject | null =>
        vertexArrayObject.createVertexArrayOES() as WebGLVertexArrayObject | null;
      /**
       * bindVertexArray
       * @param vao - the vertex array object to bind
       */
      gl.bindVertexArray = (vao: WebGLVertexArrayObject | null) => {
        vertexArrayObject.bindVertexArrayOES(vao);
      };
      /**
       * deleteVertexArray
       * @param vao - the vertex array object to delete
       */
      gl.deleteVertexArray = (vao: WebGLVertexArrayObject | null) => {
        vertexArrayObject.deleteVertexArrayOES(vao);
      };
    }
    // ANGLE_instanced_arrays
    if (this.angledInstancedArrays !== null) {
      const angledInstancedArrays = this.angledInstancedArrays;
      /**
       * vertexAttribDivisor
       * @param index - the attribute index
       * @param divisor - the divisor
       */
      gl.vertexAttribDivisor = (index: number, divisor: number) => {
        angledInstancedArrays.vertexAttribDivisorANGLE(index, divisor);
      };
      /**
       * drawArraysInstanced
       * @param mode - the draw mode
       * @param first - the first index
       * @param count - the size of each instance
       * @param instanceCount - the number of instances
       */
      gl.drawArraysInstanced = (
        mode: number,
        first: number,
        count: number,
        instanceCount: number,
      ) => {
        angledInstancedArrays.drawArraysInstancedANGLE(mode, first, count, instanceCount);
      };
      /**
       * drawElementsInstanced
       * @param mode - the draw mode
       * @param count - the size of each instance
       * @param type - the data type
       * @param offset - the offset of the data to start reading from
       * @param primcount - the number of instances
       */
      gl.drawElementsInstanced = (
        mode: number,
        count: number,
        type: number,
        offset: number,
        primcount: number,
      ) => {
        angledInstancedArrays.drawElementsInstancedANGLE(mode, count, type, offset, primcount);
      };
    }
  }
}

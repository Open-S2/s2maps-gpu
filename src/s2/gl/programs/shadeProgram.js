// @flow
/* global VertexArrayObject WebGLVertexArrayObject GLint */
import Program from './program'

import vertex1 from '../../shaders/shade1.vertex.glsl'
import fragment1 from '../../shaders/shade1.fragment.glsl'

import vertex2 from '../../shaders/shade2.vertex.glsl'
import fragment2 from '../../shaders/shade2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class ShadeProgram extends Program {
  vao: VertexArrayObject
  vertexBuffer: WebGLVertexArrayObject
  aPos: GLint // 'a_pos' vec4 attribute
  update: boolean = true
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // if webgl1, setup attribute locations
    if (type === 1) {
      // prep attribute pointers
      gl.attributeLocations = { aPos: 0 }
      // build shaders
      super(context, vertex1, fragment1)
    } else {
      super(context, vertex2, fragment2)
    }
    // setup the devicePixelRatio
    this.use()
    this.setDevicePixelRatio(devicePixelRatio)
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { context } = this
    const { gl } = context
    // get current source data
    let { count, offset, mode } = featureGuide
    // set blend type
    context.setBlendShade()
    // draw elements
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)
    // revert back to current blend type
    context.setBlendDefault()
  }
}

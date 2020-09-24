// @flow
/* global WebGLUniformLocation */
import Program from './program'

// WEBGL1
import vertex1 from '../../shaders/fill1.vertex.glsl'
import fragment1 from '../../shaders/fill1.fragment.glsl'
// WEBGL2
import vertex2 from '../../shaders/fill2.vertex.glsl'
import fragment2 from '../../shaders/fill2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class FillProgram extends Program {
  uColors: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) {
      // prep attribute pointers
      gl.attributeLocations = { aPos: 0, aRadius: 6, aIndex: 7 }
      // build shaders
      super(context, vertex1, fragment1)
      // get the color uniform
      this.uColors = gl.getUniformLocation(this.glProgram, 'uColors')
    } else {
      super(context, vertex2, fragment2)
    }
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { context } = this
    const { gl, type } = context
    // get current source data
    let { count, featureCode, subFeatureCode, offset, mode } = featureGuide
    const { threeD } = source
    // set 3D uniform
    this.set3D(threeD)
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      if (subFeatureCode) gl.uniform4fv(this.uColors, subFeatureCode, 0, subFeatureCode.length)
    } else { this.setFeatureCode(featureCode) }
    // draw elements
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  }
}

// @flow
/* global WebGLUniformLocation */
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/fill1.vertex.glsl'
import frag1 from '../../shaders/fill1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/fill2.vertex.glsl'
import frag2 from '../../shaders/fill2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class FillProgram extends Program {
  uColors: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aPos: 0, aRadius: 6, aIndex: 7 }
    // inject Program
    super(context)
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build shaders
        self.buildShaders(vertex, fragment)

        return self
      })
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { context } = this
    const { gl, type } = context
    // get current source data
    let { count, depthPos, featureCode, color, offset, mode } = featureGuide
    const { threeD } = source
    // ensure proper blend state
    context.defaultBlend()
    // adjust to current depthPos
    if (depthPos) {
      context.enableDepthTest()
      context.lessDepth()
      context.setDepthRange(depthPos)
    } else { context.resetDepthRange() }
    // ensure culling
    context.enableCullFace()
    // set 3D uniform
    this.set3D(threeD)
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      if (color) gl.uniform4fv(this.uColors, color, 0, color.length)
    } else if (featureCode) { this.setFeatureCode(featureCode) }
    // draw elements
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  }
}

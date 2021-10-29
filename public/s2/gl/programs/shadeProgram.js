// @flow
import Program from './program'

import vert1 from '../shaders/shade1.vertex.glsl'
import frag1 from '../shaders/shade1.fragment.glsl'

import vert2 from '../shaders/shade2.vertex.glsl'
import frag2 from '../shaders/shade2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class ShadeProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aPos: 0 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // activate so we can setup samplers
    this.use()
    // set pixel ratio
    this.setDevicePixelRatio(devicePixelRatio)
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { gl, context } = this
    // get current source data
    let { count, offset, mode } = featureGuide
    // ensure culling
    context.enableCullFace()
    // set blend type
    context.shadeBlend()
    // ensure no depth testing
    context.disableDepthTest()
    // draw elements
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  }
}

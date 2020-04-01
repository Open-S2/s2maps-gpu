// @flow
import Painter from '../painter'
import Program from './program'

import fillVertex from '../../shaders/fill.vertex.glsl'
import fillFragment from '../../shaders/fill.fragment.glsl'

import type { FeatureGuide } from '../../source/tile'
import type { Context } from '../contexts'

export default class FillProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, fillVertex, fillFragment)
  }

  drawFill (painter: Painter, featureGuide: FeatureGuide, refMask: number) {
    // grab context
    const { context } = painter
    const { gl } = context
    // get current source data
    let { count, featureCode, offset, mode, threeD } = featureGuide
    // set 3D uniform
    this.set3D(threeD)
    // set feature code
    if (featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)
    // get mode
    if (!mode) mode = gl.TRIANGLES
    // set first pass
    // this.setMode(0)
    context.fillFirstPass(refMask)
    // draw elements
    gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
    // set for second pass
    // this.setMode(1)
    context.fillSecondPass(refMask)
    // draw elements
    gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
    // third pass
    context.fillThirdPass(refMask)
    // draw elements
    gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  }
}

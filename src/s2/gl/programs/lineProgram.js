// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/line1.vertex.glsl'
import frag1 from '../../shaders/line1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/line2.vertex.glsl'
import frag2 from '../../shaders/line2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class LineProgram extends Program {
  uColor: WebGLUniformLocation
  uWidth: WebGLUniformLocation
  uCap: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aType: 0, aPrev: 1, aCurr: 2, aNext: 3 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // activate so we can setup samplers
    this.use()
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio)
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    // grab context
    const { gl, context } = this
    const { type } = context
    // get current source data
    let { cap, count, offset, depthPos, featureCode, mode, color, width } = featureGuide
    // ensure no culling
    context.disableCullFace()
    // ensure proper blend state
    context.defaultBlend()
    // adjust to current depthPos
    context.lequalDepth()
    if (depthPos) context.setDepthRange(depthPos)
    else context.resetDepthRange()
    // set cap
    gl.uniform1f(this.uCap, cap)
    // set feature code
    if (type === 1) {
      gl.uniform4fv(this.uColor, color)
      gl.uniform1f(this.uWidth, width)
    } else { this.setFeatureCode(featureCode) }
    // apply the appropriate offset in the source vertexBuffer attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    gl.vertexAttribPointer(1, 2, gl.SHORT, false, 12, 0 + ((offset | 0) * 12))
    gl.vertexAttribPointer(2, 2, gl.SHORT, false, 12, 4 + ((offset | 0) * 12))
    gl.vertexAttribPointer(3, 2, gl.SHORT, false, 12, 8 + ((offset | 0) * 12))
    // draw elements
    gl.drawArraysInstanced(mode || gl.TRIANGLES, 0, 9, count) // gl.drawArraysInstancedANGLE(mode, first, count, primcount)
  }
}

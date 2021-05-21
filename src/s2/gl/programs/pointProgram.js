// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/point1.vertex.glsl'
import frag1 from '../../shaders/point1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/point2.vertex.glsl'
import frag2 from '../../shaders/point2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, VectorTileSource } from '../../source/tile'

export default class PointProgram extends Program {
  uColors: WebGLUniformLocation
  uRadius: WebGLUniformLocation
  uStroke: WebGLUniformLocation
  uStrokeWidth: WebGLUniformLocation
  uOpacity: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aExtent: 0, aPos: 1 }
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

  draw (featureGuide: FeatureGuide, source: VectorTileSource, interactive?: boolean) {
    // grab context
    const { gl, context } = this
    const { type } = context
    // get current source data
    let { count, featureCode, depthPos, color, radius, stroke, strokeWidth, opacity, offset, mode } = featureGuide
    // ensure proper blend state and depth testing is on
    context.defaultBlend()
    context.enableDepthTest()
    context.stencilFunc(0)
    // adjust to current depthPos
    context.lequalDepth()
    context.setDepthRange(depthPos)
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform4fv(this.uColor, color, 0, color.length)
      gl.uniform1f(this.uRadius, radius)
      gl.uniform4fv(this.uStroke, stroke, 0, stroke.length)
      gl.uniform1f(this.uStrokeWidth, strokeWidth)
      gl.uniform1f(this.uOpacity, opacity)
    } else { this.setFeatureCode(featureCode) }
    // setup offsets and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    gl.vertexAttribPointer(1, 2, gl.SHORT, false, 4, offset * 4)
    gl.drawArraysInstanced(mode || gl.TRIANGLES, 0, 6, count)
  }
}

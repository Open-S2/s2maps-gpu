// @flow
/* eslint-env browser */
import Program from './program'

// WEBGL1
import vert1 from '../shaders/sensors1.vertex.glsl'
import frag1 from '../shaders/sensors1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/sensors2.vertex.glsl'
import frag2 from '../shaders/sensors2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, RasterTileSource } from '../../source/tile'

export default class SensorProgram extends Program {
  uTime: WebGLUniformLocation
  uOpacity: WebGLUniformLocation
  nullTexture: WebGLTexture
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // install shaders
    if (type === 1) gl.attributeLocations = { aPos: 0 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
     // activate so we can setup samplers
     this.use()
     // set sampler positions
     gl.uniform1i(this.uColorRamp, 0)
     gl.uniform1i(this.uImage, 1)
     gl.uniform1i(this.uNextImage, 2)
     // set a null texture
     this.nullTexture = this._createNullTexture()
  }

  _createNullTexture () {
    const { gl } = this
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    return texture
  }

  draw (featureGuide: FeatureGuide, sourceData: RasterTileSource) {
    // grab gl from the context
    const { gl, context, uTime, uFace } = this
    const { type } = context

    // get current source data. Time is a uniform
    const { count, mode } = sourceData
    const { colorRamp, featureCode, opacity, depthPos } = featureGuide
    const { time, texture, textureNext } = featureGuide.getTextures()
    if (isNaN(time) || !texture) return
    // ensure proper blend state
    context.oneBlend()
    // adjust to current depthPos
    if (depthPos) {
      context.enableDepthTest()
      context.lessDepth()
      context.setDepthRange(depthPos)
    } else { context.resetDepthRange() }
    // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
    if (type === 1) {
      if (!isNaN(opacity)) gl.uniform1f(this.uOpacity, opacity)
    } else if (featureCode) { this.setFeatureCode(featureCode) }
    // set time uniform
    gl.uniform1f(uTime, time)
    // setup the textures
    gl.activeTexture(gl.TEXTURE2) // uNextImage
    if (textureNext) gl.bindTexture(gl.TEXTURE_2D, textureNext)
    else gl.bindTexture(gl.TEXTURE_2D, this.nullTexture)
    gl.activeTexture(gl.TEXTURE1) // uImage
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.activeTexture(gl.TEXTURE0) // uColorRamp
    gl.bindTexture(gl.TEXTURE_2D, colorRamp)
    // draw elements
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, 0)
  }
}

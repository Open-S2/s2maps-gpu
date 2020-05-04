// @flow
import Program from './program'

import type { Context } from '../contexts'
import type { FeatureGuide, GlyphTileSource } from '../../source/tile'

export default class GlyphQuadProgram extends Program {
  uTexSize: WebGLUniformLocation
  constructor (context: Context) {
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aUV: 0, aST: 1, aXY: 2, aTexUV: 3, aWH: 4, aID: 5, aColor: 6, aRadius: 7 }
    // build shaders
    super(gl, require(`../../shaders/glyphQuad${type}.vertex.glsl`), require(`../../shaders/glyphQuad${type}.fragment.glsl`))
    // get program
    const { glProgram } = this
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(glProgram, 'uTexSize')
  }

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  draw (painter: Painter, featureGuide: FeatureGuide, source: GlyphTileSource) {
    const { context } = painter
    const { gl } = this
    // pull out the appropriate data from the source
    // const { offset, count } = featureGuide
    const { texSize, texture, glyphQuadVAO, glyphPrimcount } = source
    // turn depth testing off
    context.stencilFunc(0)
    // set the correct vao
    gl.bindVertexArray(glyphQuadVAO)
    // set the texture size uniform
    this.setTexSize(texSize)
    // bind the correct glyph texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // draw
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, glyphPrimcount)
  }
}

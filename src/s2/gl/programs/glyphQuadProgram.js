// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyphQuad1.vertex.glsl'
import frag1 from '../../shaders/glyphQuad1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyphQuad2.vertex.glsl'
import frag2 from '../../shaders/glyphQuad2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, GlyphTileSource } from '../../source/tile'

export default class GlyphQuadProgram extends Program {
  uTexSize: WebGLUniformLocation
  constructor (context: Context) {
    const { gl, type } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { aUV: 0, aST: 1, aXY: 2, aTexUV: 3, aWH: 4, aID: 5, aColor: 6, aRadius: 7 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }
    // get program
    const { glProgram } = this
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(glProgram, 'uTexSize')
  }

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource) {
    const { context } = this
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

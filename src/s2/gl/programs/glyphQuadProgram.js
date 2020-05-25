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
  uColor: WebGLUniformLocation
  uFeatures: WebGLUniformLocation
  uGlyphTex: WebGLUniformLocation
  glyphFilterProgram: Program
  constructor (context: Context, glyphFilterProgram: Program) {
    const { gl, type } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { aUV: 0, aST: 1, aXY: 2, aTexUV: 3, aWH: 4, aID: 5, aColor: 6, aRadius: 7 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }
    // set glyphFilterProgram
    this.glyphFilterProgram = glyphFilterProgram
    // get program
    const { glProgram } = this
    // activate so we can setup samplers
    gl.useProgram(glProgram)
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(glProgram, 'uTexSize')
    this.uColor = gl.getUniformLocation(glProgram, 'uColor')
    // get the samplers
    this.uFeatures = gl.getUniformLocation(glProgram, 'uFeatures')
    this.uGlyphTex = gl.getUniformLocation(glProgram, 'uGlyphTex')
    // set texture positions
    gl.uniform1i(this.uFeatures, 0)  // uFeatures texture unit 0
    gl.uniform1i(this.uGlyphTex, 1)  // uGlyphTex texture unit 1
  }

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  setColor (set?: bool = false) {
    this.gl.uniform1i(this.uColor, set)
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource) {
    const { gl, context, glyphFilterProgram } = this
    // ensure glyphFilterProgram's result texture is set
    gl.activeTexture(gl.TEXTURE0)
    glyphFilterProgram.bindResultTexture()
    // pull out the appropriate data from the source
    // const { offset, count } = featureGuide
    const { texSize, texture, glyphQuadVAO, glyphPrimcount } = source
    // turn depth testing off
    context.stencilFunc(0)
    // set source blend
    context.zeroBlend()
    // ensure we are not drawing color this step
    this.setColor(false)
    // set the correct vao
    gl.bindVertexArray(glyphQuadVAO)
    // set the texture size uniform
    this.setTexSize(texSize)
    // bind the correct glyph texture
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // draw
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, glyphPrimcount)
    // draw color this time
    context.oneBlend()
    this.setColor(true)
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, glyphPrimcount)
    // reset default blend
    context.setBlendDefault()
    // reset to active texture 0
    gl.activeTexture(gl.TEXTURE0)
  }
}

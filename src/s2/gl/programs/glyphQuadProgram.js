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
  uIsFill: WebGLUniformLocation
  uFeatures: WebGLUniformLocation
  uGlyphTex: WebGLUniformLocation
  glyphFilterProgram: Program
  glyphProgram: Program
  isFill: boolean
  constructor (context: Context, glyphFilterProgram: Program, glyphProgram: Program) {
    const { gl, type, devicePixelRatio } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { aUV: 0, aST: 1, aXY: 2, aOffset: 3, aTexUV: 4, aTexWH: 5, aID: 6 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }
    // set programs
    this.glyphFilterProgram = glyphFilterProgram
    this.glyphProgram = glyphProgram
    // get program
    const { glProgram } = this
    // activate so we can setup samplers
    gl.useProgram(glProgram)
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(glProgram, 'uTexSize')
    this.uIsFill = gl.getUniformLocation(glProgram, 'uIsFill')
    // get the samplers
    this.uFeatures = gl.getUniformLocation(glProgram, 'uFeatures')
    this.uGlyphTex = gl.getUniformLocation(glProgram, 'uGlyphTex')
    // set texture positions
    gl.uniform1i(this.uFeatures, 0) // uFeatures texture unit 0
    gl.uniform1i(this.uGlyphTex, 1) // uGlyphTex texture unit 1
    // setup the devicePixelRatio
    this.setDevicePixelRatio(devicePixelRatio)
  }

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  setFill (state: boolean) {
    if (this.isFill !== state) {
      this.isFill = state
      this.gl.uniform1i(this.uIsFill, state)
    }
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource) {
    const { gl, context, glyphFilterProgram } = this
    // ensure glyphFilterProgram's result texture is set
    gl.activeTexture(gl.TEXTURE0)
    glyphFilterProgram.bindResultTexture()
    // pull out the appropriate data from the source
    const { featureCode, offset, count } = featureGuide
    const { textureID, glyphQuadBuffer } = source
    // grab glyph texture
    const { texSize, texture } = this.glyphProgram.getFBO(textureID)
    // set feature code
    if (featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)
    // turn depth testing off
    context.stencilFunc(0)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    // set the texture size uniform
    this.setTexSize(texSize)
    // bind the correct glyph texture
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // apply the appropriate offset in the source vertexBuffer attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphQuadBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 44, 0 + ((offset | 0) * 44)) // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 8 + ((offset | 0) * 44)) // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 44, 16 + ((offset | 0) * 44)) // xOffset, yOffset
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 44, 24 + ((offset | 0) * 44)) // texture u, v
    gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 44, 32 + ((offset | 0) * 44)) // width, height
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 44, 40 + ((offset | 0) * 44)) // id
    // draw stroke
    this.setFill(false)
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
    // draw fill
    this.setFill(true)
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
    // reset to active texture 0
    gl.activeTexture(gl.TEXTURE0)
    // set default blend
    context.setBlendDefault()
  }
}

// @flow
/* global WebGLUniformLocation */
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
  uSize: WebGLUniformLocation
  uFill: WebGLUniformLocation
  uStroke: WebGLUniformLocation
  uStrokeWidth: WebGLUniformLocation
  uTexSize: WebGLUniformLocation
  uIsFill: WebGLUniformLocation
  uFeatures: WebGLUniformLocation
  uColor: WebGLUniformLocation
  uGlyphTex: WebGLUniformLocation
  glyphFilterProgram: Program
  glyphProgram: Program
  isFill: boolean
  constructor (context: Context) {
    const { gl, type, devicePixelRatio } = context
    // build shaders
    if (type === 1) gl.attributeLocations = { aUV: 0, aST: 1, aXY: 2, aOffset: 3, aTexUV: 4, aTexWH: 5, aID: 6 }
    // inject program
    super(context)
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build said shaders
        self.buildShaders(vertex, fragment)
        // activate so we can setup samplers
        self.use()
        // set texture positions
        gl.uniform1i(self.uFeatures, 0) // uFeatures texture unit 0
        gl.uniform1i(self.uGlyphTex, 1) // uGlyphTex texture unit 1
        // setup the devicePixelRatio
        self.setDevicePixelRatio(devicePixelRatio)

        return self
      })
  }

  injectGlyphPrograms (glyphFilterProgram: Program, glyphProgram: Program) {
    // set programs
    this.glyphFilterProgram = glyphFilterProgram
    this.glyphProgram = glyphProgram
  }

  setColor (color?: boolean) {
    this.gl.uniform1i(this.uColor, color)
  }

  setFill (state: boolean) {
    if (this.isFill !== state) {
      this.isFill = state
      this.gl.uniform1i(this.uIsFill, state)
    }
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource, interactive: boolean = false) {
    const { gl, context, glyphFilterProgram } = this
    const { type } = context
    // ensure glyphFilterProgram's result texture is set
    gl.activeTexture(gl.TEXTURE0)
    glyphFilterProgram.bindResultTexture()
    // pull out the appropriate data from the source
    const { depthPos, featureCode, offset, count, size, fill, stroke, strokeWidth } = featureGuide
    const { textureID, glyphQuadBuffer } = source
    // grab glyph texture
    const { texSize, texture } = this.glyphProgram.getFBO(textureID)
    // WebGL1 - set paint properties; WebGL2 - set feature code
    if (type === 1) {
      gl.uniform1f(this.uSize, size)
      gl.uniform4fv(this.uFill, fill)
      gl.uniform4fv(this.uStroke, stroke)
      gl.uniform1f(this.uStrokeWidth, strokeWidth)
    } else { this.setFeatureCode(featureCode) }
    // turn stencil testing off
    context.stencilFunc(0)
    // ensure proper z-testing state
    context.enableDepthTest()
    context.lessDepth()
    // set the texture size uniform
    gl.uniform2fv(this.uTexSize, texSize)
    // bind the correct glyph texture
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // apply the appropriate offset in the source vertexBuffer attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphQuadBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 44, 0 + (offset * 44)) // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 8 + (offset * 44)) // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 44, 16 + (offset * 44)) // xOffset, yOffset
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 44, 24 + (offset * 44)) // texture u, v
    gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 44, 32 + (offset * 44)) // width, height
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 44, 40 + (offset * 44)) // id
    // interactive is just for fills
    if (interactive) {
      this.setFill(true)
      context.defaultBlend()
      // gl.blendEquation(gl.MAX)
      // context.setDepthRange(depthPos + 3)
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
    } else {
      /** DRAW STROKE **/
      this.setFill(false)
      this.setColor(false)
      context.zeroBlend()
      context.setDepthRange(depthPos)
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
      this.setColor(true)
      context.oneBlend()
      context.setDepthRange(depthPos + 1)
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
      /** DRAW STROKE **/
      /** DRAW FILL **/
      this.setFill(true)
      this.setColor(false)
      context.zeroBlend()
      context.setDepthRange(depthPos + 2)
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
      this.setColor(true)
      context.oneBlend()
      context.setDepthRange(depthPos + 3)
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, count)
      /** DRAW FILL **/
    }
    // reset to active texture 0
    gl.activeTexture(gl.TEXTURE0)
  }
}

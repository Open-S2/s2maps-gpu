// @flow
import Program from './program'

import type { Context } from '../contexts'
import type { GlyphTileSource } from '../../source/tile'

export default class GlyphProgram extends Program {
  uTexSize: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aPos: 0, type: 1 }
    // build shaders
    super(gl, require(`../../shaders/glyph${type}.vertex.glsl`), require(`../../shaders/glyph${type}.fragment.glsl`), false)
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(this.glProgram, 'uTexSize')
  }

  injectFrameUniforms () {}
  flush () {}

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  drawToTexture (source: GlyphTileSource) {
    const { gl } = this
    // pull out the appropriate data from the source
    const { width, height, texSize, glyphFramebuffer, glyphVAO, glyphIndices } = source
    // bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphFramebuffer)
    // set the viewport
    gl.viewport(0, 0, width, height)
    // set the correct vao
    gl.bindVertexArray(glyphVAO)
    // set the texture size uniform
    this.setTexSize(texSize)
    // draw
    gl.drawElements(gl.TRIANGLES, glyphIndices.length, gl.UNSIGNED_INT, 0)
  }
}

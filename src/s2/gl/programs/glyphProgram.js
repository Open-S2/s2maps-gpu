// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyph1.vertex.glsl'
import frag1 from '../../shaders/glyph1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyph2.vertex.glsl'
import frag2 from '../../shaders/glyph2.fragment.glsl'

import type { Context } from '../contexts'
import type { GlyphTileSource } from '../../source/tile'

export default class GlyphProgram extends Program {
  uTexSize: WebGLUniformLocation
  uColor: WebGLUniformLocation
  uOffset: WebGLUniformLocation
  offsets: Array<Float32Array>
  fillAspect: Float32Array = new Float32Array([4096, 4096])
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { aPos: 0, type: 7 }
      super(context, vert1, frag1, false)
    } else {
      super(context, vert2, frag2, false)
    }
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(this.glProgram, 'uTexSize')
    this.uColor = gl.getUniformLocation(this.glProgram, 'uColor')
    this.uOffset = gl.getUniformLocation(this.glProgram, 'uOffset')
    // set offset array
    this.offsets = [
      new Float32Array([-1 / 16, -5 / 16]),
      new Float32Array([1 / 16, 1 / 16]),
      new Float32Array([3 / 16, -1 / 16]),
      new Float32Array([5 / 16, 5 / 16]),
      new Float32Array([7 / 16, -3 / 16]),
      new Float32Array([9 / 16, 3 / 16])
    ]
  }

  injectFrameUniforms () {}
  flush () {}

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  setOffset (offset: Float32Array) {
    this.gl.uniform2fv(this.uOffset, offset)
  }

  setColor (color: Float32Array) {
    this.gl.uniform4fv(this.uColor, color)
  }

  prepContext () {
    const { context } = this
    // use additive blending
    context.additiveBlending()
    // allow front and back faces
    context.disableCullFace()
  }

  cleanupContext () {
    const { context } = this
    // reset the viewport to our canvas size
    context.resetViewport()
    // reset blend type
    context.setBlendDefault()
    // turn cull face back on
    context.enableCullFace()
  }

  // drawFill (source: VectorTileSource) {
  //   const { context, gl } = this
  //   const { vao, fillFramebuffer, features } = source
  //   // bind the framebuffer
  //   gl.bindFramebuffer(gl.FRAMEBUFFER, fillFramebuffer)
  //   // set the viewport
  //   gl.viewport(0, 0, 1024, 1024)
  //   // set the texture size uniform
  //   this.setTexSize(this.fillAspect)
  //   // set the vao
  //   gl.bindVertexArray(vao)
  //
  //   // draw
  //   for (const feature of features) {
  //     let { color, count, offset, texIndex, mode } = feature
  //     // get mode
  //     if (!mode) mode = gl.TRIANGLES
  //     // set the appropriate color buffer
  //     gl.drawBuffers([gl.COLOR_ATTACHMENT0 + texIndex])
  //     // set the color uniform
  //     this.setColor(color)
  //     // clear stencil
  //     // gl.clearStencil(0x0)
  //     // gl.clear(gl.STENCIL_BUFFER_BIT)
  //     // Step 1: Draw to the stencil using "nonzero rule" (inverting the stencil)
  //     context.fillStepOne()
  //     gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  //     // Step 2: Draw the tile mask and use the stencil as a guide on when to draw or not.
  //     // The "color" is the bit we want to store the feature's on/off information at.
  //     context.fillStepTwo()
  //     gl.drawElements(mode, count, gl.UNSIGNED_INT, (offset | 0) * 4)
  //   }
  // }

  drawGlyph (source: GlyphTileSource) {
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
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) this.setColor(new Float32Array([i === 0 ? 1 : 0, i === 2 ? 1 : 0, i === 4 ? 1 : 0, 0]))
      this.setOffset(this.offsets[i])
      gl.drawElements(gl.TRIANGLES, glyphIndices.length, gl.UNSIGNED_INT, 0)
    }
  }
}

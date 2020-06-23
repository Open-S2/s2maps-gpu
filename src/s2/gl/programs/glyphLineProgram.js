// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyphLine1.vertex.glsl'
import frag1 from '../../shaders/glyphLine1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyphLine2.vertex.glsl'
import frag2 from '../../shaders/glyphLine2.fragment.glsl'

import type { Context } from '../contexts'
import type { GlyphTileSource } from '../../source/tile'

export default class glyphLineProgram extends Program {
  uLineWidth: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) {
      gl.attributeLocations = { aPos: 0, aPar: 1, aLimits: 2, aScale: 3 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }
    // get uniform locations
    this.uLineWidth = gl.getUniformLocation(this.glProgram, 'uLineWidth')
  }

  setLineWidth (lineWidth: number) {
    this.gl.uniform1f(this.uLineWidth, lineWidth)
  }

  draw (source: GlyphTileSource) {
    // grab context
    const { gl } = this
    // grab necessary source data
    const { glyphLineVAO, glyphLineVertices } = source
    const count = glyphLineVertices.length / 7
    if (count) {
      // TODO: set maxDistance if exists (for now, just set to 4)
      this.setLineWidth(4)
      // this.setLineWidth(maxDistance | 4)
      gl.blendFunc(gl.ONE, gl.ZERO)
      // set the line vao
      gl.bindVertexArray(glyphLineVAO)
      // draw elements
      gl.drawArrays(gl.TRIANGLES, 0, count) // gl.drawArrays(mode, first, count)
    }
  }
}

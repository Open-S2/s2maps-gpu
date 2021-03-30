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
  uOffset: WebGLUniformLocation
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aPos: 0, aPar: 1, aLimits: 2, aScale: 3 }
    // inject Program
    super(context)
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build said shaders
        self.buildShaders(vertex, fragment)

        return self
      })
  }

  draw (source: GlyphTileSource) {
    // grab context
    const { gl, uOffset } = this
    // grab necessary source data
    const { glyphLineVAO, glyphLineVertices } = source
    const count = glyphLineVertices.length / 7
    if (count) {
      // TODO: set maxDistance if exists (for now, just set to 4)
      gl.uniform1f(this.uLineWidth, 4)
      // this.setLineWidth(maxDistance | 4)
      gl.blendFunc(gl.ONE, gl.ZERO)
      gl.blendEquation(gl.MAX)
      // set the line vao
      gl.bindVertexArray(glyphLineVAO)
      // draw elements at each offset
      for (let i = 0; i < 4; i++) {
        gl.uniform1i(uOffset, i)
        gl.drawArrays(gl.TRIANGLES, 0, count) // gl.drawArrays(mode, first, count)
      }
      gl.blendEquation(gl.FUNC_ADD)
    }
  }
}

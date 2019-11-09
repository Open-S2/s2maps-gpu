// @flow
import Program from './program'

import fillVertex from '../../shaders/fill.vertex.glsl'
import fillFragment from '../../shaders/fill.fragment.glsl'

import type { Context } from '../contexts'

export default class FillProgram extends Program {
  aPos: GLint // 'a_pos' attribute vec4
  color: GLint // 'u_color' uniform vec4
  matrix: GLint // 'u_matrix' uniform mat4
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, fillVertex, fillFragment)
    // acquire the attributes
    this.aPos = gl.getAttribLocation(this.glProgram, 'aPos')
    this.matrix = gl.getUniformLocation(this.glProgram, 'uMatrix')
    this.color = gl.getUniformLocation(this.glProgram, 'uColor')
  }
}

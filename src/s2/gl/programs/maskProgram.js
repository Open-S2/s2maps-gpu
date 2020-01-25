// @flow
import Program from './program'

import maskVertex from '../../shaders/mask.vertex.glsl'
import maskFragment from '../../shaders/mask.fragment.glsl'

import type { Context } from '../contexts'

export default class MaskProgram extends Program {
  texture: GLuint
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, maskVertex, maskFragment, true, false)
    // grab the texture uniform location
    this.texture = gl.getUniformLocation(this.glProgram, 'uTexture')
  }

  setTexture (texture: WebGLTexture) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
  }
}

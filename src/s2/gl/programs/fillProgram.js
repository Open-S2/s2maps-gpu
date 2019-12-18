// @flow
import Program from './program'

import fillVertex from '../../shaders/fill.vertex.glsl'
import fillFragment from '../../shaders/fill.fragment.glsl'

import type { Context } from '../contexts'

export default class FillProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, fillVertex, fillFragment)
  }
}

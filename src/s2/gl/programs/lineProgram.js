// @flow
import Context from '../contexts/context'
import Program from './program'

import lineVertex from '../../shaders/line.vertex.glsl'
import lineFragment from '../../shaders/line.fragment.glsl'

export default class lineProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, lineVertex, lineFragment)
  }
}

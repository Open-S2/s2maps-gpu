// @flow
import Context from '../contexts/context'
import Program from './program'

import textVertex from '../../shaders/text.vertex.glsl'
import textFragment from '../../shaders/text.fragment.glsl'

export default class TextProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, textVertex, textFragment)
  }
}

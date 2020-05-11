// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/line1.vertex.glsl'
import frag1 from '../../shaders/line1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/line2.vertex.glsl'
import frag2 from '../../shaders/line2.fragment.glsl'

import type { Context } from '../contexts'

export default class LineProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) {
      gl.attributeLocations = { aPos: 1, aNormal: 2, aRadius: 6, aIndex: 7 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }
  }
}

// @flow
import Program from './program'

import type { Context } from '../contexts'

export default class LineProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aPos: 1, aNormal: 2, aRadius: 6, aIndex: 7 }
    // build shaders
    super(gl, require(`../../shaders/line${type}.vertex.glsl`), require(`../../shaders/line${type}.fragment.glsl`))
  }
}

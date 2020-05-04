// @flow
// import Painter from '../painter'
import Program from './program'

// import type { FeatureGuide } from '../../source/tile'
import type { Context } from '../contexts'

export default class FillProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aPos: 0, aRadius: 6, aIndex: 7 }
    // build shaders
    super(gl, require(`../../shaders/fill${type}.vertex.glsl`), require(`../../shaders/fill${type}.fragment.glsl`))
  }
}

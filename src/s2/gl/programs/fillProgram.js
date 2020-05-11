// @flow
// import Painter from '../painter'
import Program from './program'

// WEBGL1
import vertex1 from '../../shaders/fill1.vertex.glsl'
import fragment1 from '../../shaders/fill1.fragment.glsl'
// WEBGL2
import vertex2 from '../../shaders/fill2.vertex.glsl'
import fragment2 from '../../shaders/fill2.fragment.glsl'

// import type { FeatureGuide, VectorTileSource } from '../../source/tile'
import type { Context } from '../contexts'

export default class FillProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) {
      // prep attribute pointers
      gl.attributeLocations = { aPos: 0, aRadius: 6, aIndex: 7 }
      // build shaders
      super(context, vertex1, fragment1)
    } else {
      super(context, vertex2, fragment2)
    }
  }
}

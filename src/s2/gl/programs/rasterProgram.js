// @flow
import Program from './program'

import rasterVertex from '../../shaders/raster.vertex.glsl'
import rasterFragment from '../../shaders/raster.fragment.glsl'

import type { Context } from '../contexts'

export default class RasterProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl } = context
    // upgrade
    super(gl, rasterVertex, rasterFragment)
  }
}

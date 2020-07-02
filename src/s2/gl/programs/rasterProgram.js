// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/raster1.vertex.glsl'
import frag1 from '../../shaders/raster1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/raster2.vertex.glsl'
import frag2 from '../../shaders/raster2.fragment.glsl'

import type { Context } from '../contexts'
import type { RasterTileSource } from '../../source/tile'

export default class RasterProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // install shaders
    if (type === 1) {
      // if webgl1, setup attribute locations
      gl.attributeLocations = { aPos: 0, aRadius: 6 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }
  }

  draw (featureGuide: FeatureGuide, sourceData: RasterTileSource) {
    // setup variables
    const { context } = this
    const { gl } = context

    // get current source data
    let { count, mode, threeD } = sourceData
    let { texture } = featureGuide
    // set 3D uniform
    this.set3D(threeD)
    // setup the texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // draw elements
    gl.drawElements(mode ? mode : gl.TRIANGLES, count, gl.UNSIGNED_INT, 0)
  }
}

// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/raster1.vertex.glsl'
import frag1 from '../../shaders/raster1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/raster2.vertex.glsl'
import frag2 from '../../shaders/raster2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, RasterTileSource } from '../../source/tile'

export default class RasterProgram extends Program {
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // install shaders
    if (type === 1) gl.attributeLocations = { aPos: 0, aRadius: 6 }
    // inject Program
    super(context)
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build shaders
        self.buildShaders(vertex, fragment)

        return self
      })
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
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, 0)
  }
}

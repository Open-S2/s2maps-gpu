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
    if (type === 1) gl.attributeLocations = { aPos: 0 }
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
    // grab gl from the context
    const { gl, context } = this

    // get current source data
    let { count, mode } = sourceData
    let { texture, depthPos } = featureGuide
    // ensure proper blend state
    context.defaultBlend()
    // adjust to current depthPos
    if (depthPos) {
      context.enableDepthTest()
      context.lessDepth()
      context.setDepthRange(depthPos)
    } else { context.resetDepthRange() }
    // setup the texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // draw elements
    gl.drawElements(mode || gl.TRIANGLES, count, gl.UNSIGNED_INT, 0)
  }
}

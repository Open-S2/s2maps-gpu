// @flow
import Program from './program'

import type { Context } from '../contexts'

export default class RasterProgram extends Program {
  constructor (context: Context, vertexShaderSource: string, fragmentShaderSource: string) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { 'aPos': 0, 'aRadius': 6 }
    // upgrade
    super(gl, require(`../../shaders/raster${type}.vertex.glsl`), require(`../../shaders/raster${type}.fragment.glsl`))
  }

  draw (painter: Painter, featureGuide: FeatureGuide, sourceData) {
    // setup variables
    const { context } = painter
    const { gl } = context

    // get current source data
    let { count, mode } = sourceData
    let { texture, threeD } = featureGuide
    // set 3D uniform
    this.set3D(threeD)
    // get mode
    if (!mode) mode = gl.TRIANGLES
    // setup the texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // draw elements
    gl.drawElements(mode, count, gl.UNSIGNED_INT, 0)
  }
}

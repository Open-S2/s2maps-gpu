// @flow
// import Painter from '../painter'
import Program from './program'

// WEBGL1
import vertex1 from '../../shaders/fill1.vertex.glsl'
import fragment1 from '../../shaders/fill1.fragment.glsl'
// WEBGL2
import vertex2 from '../../shaders/fill2.vertex.glsl'
import fragment2 from '../../shaders/fill2.fragment.glsl'

import type { FeatureGuide, VectorTileSource } from '../../source/tile'
import type { Context } from '../contexts'

export default class FillProgram extends Program {
  uColor: WebGLUniformLocation
  nullTexture: WebGLTexture
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
    // add extra uniforms
    this.uColor = gl.getUniformLocation(this.glProgram, 'uColor')
    // Setup NULL texture
    this.nullTexture = gl.createTexture()
    // bind
    gl.bindTexture(gl.TEXTURE_2D, this.nullTexture)
    // create nullTexture's 1x1 size
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  }

  setColor (color: Float32Array) {
    this.gl.uniform4fv(this.uColor, color)
  }

  draw (featureGuide: FeatureGuide, source: VectorTileSource) {
    if (featureGuide.color) {
      this.setMode(1)
      this._drawFill(featureGuide, source)
    } else {
      this.setMode(0)
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.nullTexture)
      super.draw(featureGuide)
    }
  }

  _drawFill (featureGuide: FeatureGuide, source: VectorTileSource) {
    const { gl } = this
    const { textures } = source
    let { color, texIndex, featureCode, parent, tile } = featureGuide
    // grab the tiles mask
    const drawTile = (parent) ? parent : tile
    const mask = drawTile.sourceData.mask
    // use the masks vao
    gl.bindVertexArray(mask.vao)
    // set the color uniform
    this.setColor(color)
    // set feature code
    if (featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)
    // setup the texture
    gl.bindTexture(gl.TEXTURE_2D, textures[texIndex])
    // draw the mask
    gl.drawElements(mask.mode, mask.count, gl.UNSIGNED_INT, 0)
  }
}

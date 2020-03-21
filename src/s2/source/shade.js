// @flow
import Style from '../style'
import Projection from '../ui/camera/projections'

export type ShadeUniforms = {
  uOffset: Float32Array,
  uRadius: Float32Array
}

export default class Shade {
  style: Style
  projection: Projection
  offsetPos: [number, number] = [-150, 200]
  uniforms: ShadeUniforms = {
    uOffset: new Float32Array(2),
    uRadius: new Float32Array(2)
  }
  constructor (style: Style, projection: Projection) {
    this.style = style
    this.projection = projection
  }

  getUniforms (): null | ShadeUniforms {
    if (this.projection.dirty) {
      this._updateUniforms()
      return this.uniforms
    } else { return null }
  }

  _updateUniforms () {
    const radius = 512 * Math.min(Math.pow(2, this.projection.zoom), 32768)
    this.uniforms.uRadius[0] = radius / (this.projection.aspect[0] * this.projection.multiplier)
    this.uniforms.uRadius[1] = radius / (this.projection.aspect[1] * this.projection.multiplier)
    this.uniforms.uOffset[0] = this.offsetPos[0] * this.uniforms.uRadius[0]
    this.uniforms.uOffset[1] = this.offsetPos[1] * this.uniforms.uRadius[1]
    // console.log('this.uniforms.uRadius', this.uniforms.uOffset)
  }
}

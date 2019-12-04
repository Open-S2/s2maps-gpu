// @flow
import Style from '../style'
import Projection from '../ui/camera/projections'

export type WallpaperUniforms = {
  uScale: Float32Array,
  backgroundColor: Float32Array,
  haloColor: Float32Array,
  fade1Color: Float32Array,
  fade2Color: Float32Array
}

export default class Wallpaper {
  style: Style // reference to the style objects colors
  projection: Projection
  uniforms: WallpaperUniforms = {
    uScale: new Float32Array(2),
    backgroundColor: new Float32Array(4),
    haloColor: new Float32Array(4),
    fade1Color: new Float32Array(4),
    fade2Color: new Float32Array(4)
  }
  dirty: boolean = true
  constructor (style: Style, projection: Projection) {
    this.style = style
    this.projection = projection
  }

  getUniforms (): null | WallpaperUniforms {
    let dirty = false
    if (this.projection.dirty) {
      this._updateScale()
      dirty = true
    }
    if (this.style.dirty) {
      this._updateStyle()
      dirty = true
    }

    if (!dirty) return null
    return this.uniforms
  }

  _updateScale () {
    const radius = 512 * Math.min(Math.pow(2, this.projection.zoom), 32768)
    this.uniforms.uScale[0] = radius / (this.projection.width * this.projection.multiplier)
    this.uniforms.uScale[1] = radius / (this.projection.height * this.projection.multiplier)
  }

  _updateStyle () {
    const { wallpaper } = this.style
    for (let key in wallpaper) {
      if (this.uniforms[key]) {
        this.uniforms[key] = wallpaper[key].getRGB()
      }
    }
  }
}

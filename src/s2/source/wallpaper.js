// @flow
import Style from '../style'
import Projection from '../ui/camera/projections'
import { degToRad } from 's2projection'
import * as mat4 from '../util/mat4'

import type { WallpaperStyle } from '../styleSpec'

export type WallpaperUniforms = {
  uScale: Float32Array,
  uBackgroundColor: Float32Array,
  uHaloColor: Float32Array,
  uFade1Color: Float32Array,
  uFade2Color: Float32Array
}

export class Wallpaper {
  style: Style // reference to the style objects colors
  projection: Projection
  uniforms: WallpaperUniforms = {
    uScale: new Float32Array(2),
    uBackgroundColor: new Float32Array(4),
    uHaloColor: new Float32Array(4),
    uFade1Color: new Float32Array(4),
    uFade2Color: new Float32Array(4)
  }
  skybox: boolean = false
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
    this.dirty = true
    return this.uniforms
  }

  _updateScale () {
    const radius = 512 * Math.min(Math.pow(2, this.projection.zoom), 32768)
    this.uniforms.uScale[0] = radius / (this.projection.width * this.projection.multiplier)
    this.uniforms.uScale[1] = radius / (this.projection.height * this.projection.multiplier)
  }

  _updateStyle () {
    const { wallpaperStyle } = this.style
    for (let key in wallpaperStyle) {
      if (this.uniforms[key]) {
        this.uniforms[key] = wallpaperStyle[key].getRGB()
      }
    }
  }
}

export class Skybox {
  projection: Projection
  path: string
  type: 'png' | 'jpg'
  size: number = 1024
  fov: number = degToRad(80)
  angle: number = degToRad(40)
  skybox: boolean = true
  dirty: boolean = true
  constructor (style: WallpaperStyle, projection: Projection) {
    const { skybox, type, size } = style
    this.path = skybox
    this.type = type
    if (size) this.size = size
    this.projection = projection
  }

  getMatrix (): null | Float32Array {
    if (this.projection.dirty) {
      const { width, height, lon, lat } = this.projection
      const matrix = mat4.create()
      // create a perspective matrix
      mat4.perspective(matrix, this.fov, width / height, 1, 2000)
      // rotate perspective
      mat4.rotate(matrix, [degToRad(lat), degToRad(lon), this.angle])
      // this is a simplified "lookat", since we maintain a set camera position
      mat4.multiply(matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
      // invert view
      mat4.invert(matrix, matrix)

      return matrix
    }
  }
}

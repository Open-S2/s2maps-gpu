// @flow
import * as mat4 from '../../../util/mat4'
import Projector from './projector'

import type Projection from './projection'

export type BlendConfig = {
  translation: [number, number, number],
  zTranslateStart: number,
  zTranslateEnd: number,
  zoomEnd: number,
  maxLatRotation: number,
  zoom: number,
  lon: number,
  lat: number,
  scale: number,
  zNear: number,
  zFar: number,
  width: number,
  height: number
}

export default class BlendProjection extends Projector implements Projection {
  zTranslateStart: number = -10
  zTranslateEnd: number = -3
  zoomEnd: number = 2
  constructor (config?: BlendConfig = {}) {
    super(config)
    if (config.translation) this.translation = config.translation
    if (config.zTranslateStart) this.zTranslateStart = config.zTranslateStart
    if (config.zTranslateEnd) this.zTranslateEnd = config.zTranslateEnd
    if (config.zoomEnd) this.zoomEnd = config.zoomEnd
  }

  onZoom (zoom?: number = 0) {
    this.zoom += 0.001 * zoom
    if (this.zoom > 22) this.zoom = 22
    if (this.zoom < 0) this.zoom = 0
    this.scale = Math.pow(2, this.zoom)
    // update transation
    this.translation[2] = Math.min(
      (((this.zTranslateEnd - this.zTranslateStart) / this.zoomEnd) * this.zoom) + this.zTranslateStart,
      this.zTranslateEnd
    )
    this.matrices = {}
    this.dirty = true
  }

  getMatrix (tileSize?: number = 512): Float32Array {
    if (this.matrices[tileSize]) return mat4.clone(this.matrices[tileSize])
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = this.width / (tileSize * this.scale)
    const heightRatio = this.height / (tileSize * this.scale)
    // create projection
    mat4.blend(matrix, widthRatio * (-1 / this.translation[2]), heightRatio * (-1 / this.translation[2]), this.zNear, this.zFar)
    // translate position
    mat4.translate(matrix, this.translation)
    // rotate position
    mat4.rotate(matrix, [degToRad(this.lat), degToRad(this.lon), 0])
    // updated matrix, no longer "dirty"
    this.matrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

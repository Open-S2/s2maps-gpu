// @flow
import * as mat4 from '../../../util/mat4'

export type PerspectiveConfig = {
  translation?: [number, number, number],
  zTranslateStart?: number,
  zTranslateEnd?: number,
  zoomEnd?: number,
  maxLatRotation?: number,
  zoom?: number,
  lon?: number,
  lat?: number,
  scale?: number,
  zNear?: number,
  zFar?: number,
  width?: number,
  height?: number
}

export default class PerspectiveProjection extends Projector {
  zTranslateStart: number = -5
  zTranslateEnd: number = -1.5
  zoomEnd: number = 2
  constructor (config?: PerspectiveConfig = {}) {
    super(config)
    if (config.translation) this.translation = config.translation
    if (config.zTranslateStart) this.zTranslateStart = config.zTranslateStart
    if (config.zTranslateEnd) this.zTranslateEnd = config.zTranslateEnd
    if (config.zoomEnd) this.zoomEnd = config.zoomEnd
  }

  onZoom (zoom?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoom
    if (this.zoom > this.maxzoom) {
      this.zoom = this.maxzoom // if it overzooms but the previous zoom was not at maxzoom, we need to render one more time
      if (this.prevZoom === this.maxzoom) return false
    } else if (this.zoom < this.minzoom) {
      this.zoom = this.minzoom // if it underzooms but the previous zoom was not at minzoom, we need to render one more time
      if (this.prevZoom === this.minzoom) return false
    }
    // update view
    this.view[0] = this.zoom
    // update scale
    this.scale = Math.pow(2, this.zoom)
    // update transation
    this.translation[2] = Math.min(
      (((this.zTranslateEnd - this.zTranslateStart) / this.zoomEnd) * this.zoom) + this.zTranslateStart,
      this.zTranslateEnd
    )
    // cleanup
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize?: number = 768): Float32Array {
    if (this.sizeMatrices[tileSize]) return mat4.clone(this.sizeMatrices[tileSize])
    const matrix = mat4.create()
    // create projection
    mat4.perspective(matrix, 0.68, this.aspect[0] / this.aspect[1], this.zNear, this.zFar)
    // updated matrix
    this.sizeMatrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

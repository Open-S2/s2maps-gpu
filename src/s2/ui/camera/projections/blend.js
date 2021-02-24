// @flow
import * as mat4 from '../../../util/mat4'
import Projector from './projector'

export type BlendConfig = {
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

export default class BlendProjection extends Projector {
  zTranslateStart: number = -10
  zTranslateEnd: number = -3
  // zoomStart: number = 2
  zoomEnd: number = 5
  radius: number = 1000
  constructor (config?: BlendConfig = {}) {
    super(config)
    if (config.translation) this.translation = config.translation
    if (config.zTranslateStart) this.zTranslateStart = config.zTranslateStart
    if (config.zTranslateEnd) this.zTranslateEnd = config.zTranslateEnd
    if (config.zoomEnd) this.zoomEnd = config.zoomEnd
    this.onZoom(this.zoom)
  }

  onZoom (zoomInput?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoomInput
    const { radius, prevZoom, minzoom, maxzoom, zoomEnd, zTranslateStart, zTranslateEnd } = this
    if (this.zoom > maxzoom) {
      this.zoom = maxzoom // if it overzooms but the previous zoom was not at maxzoom, we need to render one more time
      if (prevZoom === maxzoom) return false
    } else if (this.zoom < minzoom) {
      this.zoom = minzoom // if it underzooms but the previous zoom was not at minzoom, we need to render one more time
      if (prevZoom === minzoom) return false
    }
    const { zoom } = this
    // update view
    this.view[0] = zoom
    // update scale
    this.scale = Math.pow(2, zoom) / radius
    // update transation
    this.translation[2] = Math.min(
      (((zTranslateEnd - zTranslateStart) / zoomEnd) * zoom) + zTranslateStart,
      zTranslateEnd
    ) * radius
    // cleanup
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize?: number = 512): Float32Array {
    const { aspect, scale, multiplier, sizeMatrices, zNear, zFar, translation } = this

    if (sizeMatrices[tileSize]) return mat4.clone(sizeMatrices[tileSize])
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = aspect[0] / multiplier / (tileSize * scale) / -translation[2]
    const heightRatio = aspect[1] / multiplier / (tileSize * scale) / -translation[2]
    // create projection
    mat4.blend(matrix, widthRatio, heightRatio, zNear, zFar)
    // updated matrix
    sizeMatrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

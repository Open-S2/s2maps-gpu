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
  zTranslateEnd: number = -2
  zoomEnd: number = 2
  constructor (config?: BlendConfig = {}) {
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
    }
    else if (this.zoom < this.minzoom) {
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
    // update movement
    // let moveX = ((this.width / 2) - canvasX) / (this.width / 2)
    // let moveY = ((this.height / 2) - canvasX) / (this.height / 2)
    // if (zoom < 0) this.onMove(moveX, -moveY, 1, 6)
    // else this.onMove(-moveX, moveY, 1, 6)
    // cleanup
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize?: number = 512): Float32Array {
    if (this.sizeMatrices[tileSize]) return mat4.clone(this.sizeMatrices[tileSize])
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = this.width / (tileSize * this.scale)
    const heightRatio = this.height / (tileSize * this.scale)
    // create projection
    mat4.blend(matrix, widthRatio * (-1 / this.translation[2]), heightRatio * (-1 / this.translation[2]), this.zNear, this.zFar)
    // updated matrix
    this.sizeMatrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

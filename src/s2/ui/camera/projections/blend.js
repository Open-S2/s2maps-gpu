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
  zoomEnd: number = 2
  constructor (config?: BlendConfig = {}) {
    super(config)
    if (config.translation) this.translation = config.translation
    if (config.zTranslateStart) this.zTranslateStart = config.zTranslateStart
    if (config.zTranslateEnd) this.zTranslateEnd = config.zTranslateEnd
    if (config.zoomEnd) this.zoomEnd = config.zoomEnd
  }

  onZoom (zoom?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    this.zoom += 0.0015 * zoom
    if (this.zoom > this.maxZoom) { this.zoom = this.maxZoom; return false }
    else if (this.zoom < 0) { this.zoom = 0; return false }
    this.scale = Math.pow(2, this.zoom)
    // update transation
    this.translation[2] = Math.min(
      (((this.zTranslateEnd - this.zTranslateStart) / this.zoomEnd) * this.zoom) + this.zTranslateStart,
      this.zTranslateEnd
    )
    // setup move
    // let lonChange = 2 * (canvasX / this.width) - 1
    // let latChange = 2 * (canvasY / this.height) - 1
    // if (zoom > 0) {
    //   lonChange = -lonChange
    //   latChange = -latChange
    // }
    // this.onMove(lonChange, latChange, 0.25, 0.25)
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

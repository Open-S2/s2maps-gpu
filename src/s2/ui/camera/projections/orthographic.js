// @flow
import * as mat4 from '../../../util/mat4'
import Projector from './projector'

export type OrthographicConfig = {
  translation?: [number, number, number],
  maxLatRotation?: number,
  zoom?: number,
  lon?: number,
  lat?: number,
  scale?: number,
  zNear?: number,
  zFar?: number,
  width?: number,
  height?: number,
  multiplier?: number
}

export default class OrthographicProjection extends Projector {
  constructor (config?: OrthographicConfig = {}) {
    super(config)
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
    // clear matrices
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize?: number = 512): Float32Array {
    if (this.sizeMatrices[tileSize]) return mat4.clone(this.sizeMatrices[tileSize])
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = this.aspect[0] / (tileSize * this.scale)
    const heightRatio = this.aspect[1] / (tileSize * this.scale)
    // create projection
    mat4.ortho(matrix, widthRatio, heightRatio, this.zFar)
    // store the matrix for future use
    this.sizeMatrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

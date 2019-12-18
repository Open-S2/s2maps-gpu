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
    this.zoom += 0.0015 * zoom
    if (this.zoom > this.maxZoom) { this.zoom = this.maxZoom; return false }
    else if (this.zoom < 0) { this.zoom = 0; return false }
    this.scale = Math.pow(2, this.zoom)
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
    mat4.ortho(matrix, widthRatio, heightRatio, this.zFar)
    // store the matrix for future use
    this.sizeMatrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

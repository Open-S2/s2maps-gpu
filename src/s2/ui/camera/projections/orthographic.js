// @flow
import { degToRad } from 's2projection'
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

  onZoom (zoom: number) {
    this.zoom += 0.001 * zoom
    if (this.zoom > 22) this.zoom = 22
    if (this.zoom < 0) this.zoom = 0
    this.scale = Math.pow(2, this.zoom)
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
    mat4.ortho(matrix, widthRatio, heightRatio, this.zFar)
    // translate position
    mat4.translate(matrix, this.translation)
    // rotate position
    mat4.rotate(matrix, [degToRad(this.lat), degToRad(this.lon), 0])
    // store the matrix for future use
    this.matrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

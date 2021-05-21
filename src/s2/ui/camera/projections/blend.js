// @flow
import * as mat4 from '../../../util/mat4'
// import { S2Point } from 's2projection'

export type BlendConfig = {
  translation?: [number, number, number],
  zTranslateStart?: number,
  zTranslateEnd?: number,
  zoomEnd?: number,
  maxLatRotation?: number,
  zoom?: number,
  scale?: number,
  lon?: number,
  lat?: number,
  scale?: number,
  zNear?: number,
  zFar?: number,
  width?: number,
  height?: number
}

export default class BlendProjection extends Projector {
  // zTranslateStart: number = -10
  // zTranslateEnd: number = -0.001
  // // zoomStart: number = 2
  // zoomEnd: number = 10
  // scale: number = 1
  constructor (config?: BlendConfig = {}) {
    super(config)
    // if (config.translation) this.translation = config.translation
    // if (config.zTranslateStart) this.zTranslateStart = config.zTranslateStart
    // if (config.zTranslateEnd) this.zTranslateEnd = config.zTranslateEnd
    // if (config.zoomEnd) this.zoomEnd = config.zoomEnd
    // if (config.scale) this.scale = config.scale
    this.onZoom(this.zoom)
  }

  onZoom (zoomInput?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoomInput
    const { prevZoom, minzoom, maxzoom, zoomEnd, zTranslateStart, zTranslateEnd } = this
    // const { prevZoom, minzoom, maxzoom } = this
    if (this.zoom > maxzoom) {
      this.zoom = maxzoom // if it overzooms but the previous zoom was not at maxzoom, we need to render one more time
      if (prevZoom === maxzoom) return false
    } else if (this.zoom < minzoom) {
      this.zoom = minzoom // if it underzooms but the previous zoom was not at minzoom, we need to render one more time
      if (prevZoom === minzoom) return false
    }
    const { zoom, lon, lat } = this
    // update view
    this.view[0] = zoom
    // update scale
    this.scale = Math.pow(2, zoom)
    // // update transation
    // const multiplier = Math.min(
    //   (zTranslateEnd - zTranslateStart) / zoomEnd * zoom + zTranslateStart,
    //   zTranslateEnd
    // ) * this.radius

    // this.translation = S2Point.fromLonLat(-lon, lat).normalize().mul(multiplier)
    // this.translation = [this.translation.x, this.translation.y, this.translation.z]
    //
    // console.log('translate', lon, lat, this.translation)

    // console.log(this.translation[2])
    // this.translation[2] = -10 * this.radius
    // console.log(this.zoom, this.lon, this.lat)
    // cleanup
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize?: number = 768): Float32Array {
    if (this.sizeMatrices[tileSize]) return mat4.clone(this.sizeMatrices[tileSize])
    // const { radius, aspect, scale, multiplier, sizeMatrices, zNear, zFar, translation } = this
    const { zoom, radius, aspect, scale, multiplier, sizeMatrices } = this
    // prep a matrix
    const matrix = mat4.create()
    // get height and width ratios for each tile
    // const multpl = -radius / multiplier / (tileSize * scale * translation[2])
    const multpl = radius / multiplier / (tileSize * scale)

    const zFar = (zoom <= 12) ? 100_000_000 : 100_000

    // create projection
    // mat4.blend(matrix, aspect[0] * multpl, aspect[1] * multpl, zNear, zFar)
    mat4.ortho(matrix, aspect[0] * multpl, aspect[1] * multpl, zFar)
    // updated matrix
    sizeMatrices[tileSize] = matrix

    // console.log(matrix)

    return mat4.clone(matrix)
  }
}

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
  zTranslateStart: number = -10
  zTranslateEnd: number = -3
  // zoomStart: number = 2
  zoomEnd: number = 5
  scale: number = 1
  constructor (config?: BlendConfig = {}) {
    super(config)
    if (config.translation) this.translation = config.translation
    if (config.zTranslateStart) this.zTranslateStart = config.zTranslateStart
    if (config.zTranslateEnd) this.zTranslateEnd = config.zTranslateEnd
    if (config.zoomEnd) this.zoomEnd = config.zoomEnd
    if (config.scale) this.scale = config.scale
    this.onZoom(this.zoom)
  }

  onZoom (zoomInput?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoomInput
    // const { prevZoom, minzoom, maxzoom, zoomEnd, zTranslateStart, zTranslateEnd } = this
    const { prevZoom, minzoom, maxzoom } = this
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
    this.scale = Math.pow(2, zoom)
    // update transation
    // this.translation[2] = Math.min(
    //   (zTranslateEnd - zTranslateStart) / zoomEnd * zoom + zTranslateStart,
    //   zTranslateEnd
    // )
    this.translation[2] = -10
    // console.log(this.zoom, this.lon, this.lat)
    // cleanup
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize?: number = 768): Float32Array {
    if (this.sizeMatrices[tileSize]) return mat4.clone(this.sizeMatrices[tileSize])
    const { aspect, scale, multiplier, sizeMatrices, zNear, zFar, translation } = this
    // console.log('aspect', aspect)
    // console.log('scale', scale)
    // console.log('multiplier', multiplier)
    // console.log('translation', translation)
    // console.log('aspect', aspect)
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = aspect[0] / multiplier / (tileSize * scale) / -translation[2]
    const heightRatio = aspect[1] / multiplier / (tileSize * scale) / -translation[2]
    // const widthRatio = aspect[0] / multiplier / tileSize / 10
    // const heightRatio = aspect[1] / multiplier / tileSize / 10
    //
    // console.log('widthRatio', widthRatio)
    // console.log('heightRatio', heightRatio)

    // const widthRatio = aspect[0] / multiplier / (tileSize * scale)
    // const heightRatio = aspect[1] / multiplier / (tileSize * scale)
    // const widthRatio = aspect[0] / multiplier / (tileSize * scale)
    // const heightRatio = aspect[1] / multiplier / (tileSize * scale)
    // create projection
    mat4.blend(matrix, widthRatio, heightRatio, zNear, zFar)
    // console.log(matrix)
    // mat4.ortho(matrix, widthRatio, heightRatio, zFar)
    // updated matrix
    sizeMatrices[tileSize] = matrix

    // console.log('matrix', matrix)

    return mat4.clone(matrix)
  }
}

// rough estimated size: 246 x 346

// zoom: 18.023999999999983
// lon: 359.9998594810197
// lat: 45.00012543146265
// tile: 2-18-0-131072
// matrix [81231.65625, 0, 0, 0, 0, 189804.15625, 0, 0, 0, 0, -0.00009999999747378752, 0, 0, 0, 0, 1]
// bboxST: [ 0, 0.5, 0.000003814697265625, 0.5000038146972656 ]
// bboxUV (quadraticSTtoUV): [ -1, 0, -0.9999898274933608, 0.000005086282423386971 ]
// LL->ST: [2, 0.0000016418928877603989, 0.5000018393777144 ]
// LL->UV (quadraticSTtoUV): [ 2, -0.9999956216225604, 0.000002452508130209215 ]

// find the size of one tile (512 pixels)
// 2 / (1 << 18) === 0.00000762939453125

// 1.3333307902066736 length
// 0.666669209798177 width

//



// in UV space at zoom 0 the distance is -1 to +1 (2) broken into 1 piece that represents 512 pixels each (1 << 0)
// in UV space at zoom 1 the distance is -1 to +1 (2) broken into 2 piecs that represents 512 pixels each (1 << 1)

// zoom 0: 2 * (1 << 0) [2]
// zoom 1: 2 * (1 << 1) [4]
// zoom 10: 2 * (1 << 10) [2_048]
// zoom 18: 2 * (1 << 18) [524_288]
// zoom 20: 2 * (1 << 20) [2_097_152]

// in other words in UV space, 2 units will always represent 512 pixels.
// consider tile 2-18-0-131007 -> because tiles are stored in ST, the bboxST looks like:
// [ 0, 0.4997520446777344, 0.000003814697265625, 0.499755859375 ]
// convert to uv: [-1, -0.00033068907214328647, -0.9999898274933608, -0.0003256003061930338]
// ONE unit (512 pixels) in UV space at zoom 18 is (1 / (2 * (1 << 18))) [0.0000019073486328125]
// dU = 0.000010172506639150036 (-0.9999898274933608 - (-1))
// dV = 0.0000050887659502526486 (-0.0003256003061930338 - (-0.00033068907214328647))
// tileSize: []


// 3.4677, -1.2310, -9.1148, -0.6236, 2.8839, 1.4802, 10.9600, 0.7498, 0, 8.4939, -3.2310, -0.2211, 0, 0, 77022752, 80422096
// 3.4850, -2.4570, -3.6910, -0.5686, 2.8629, 2.9909, 4.4930, 0.6922, 0, 7.8019, -2.8848, -0.4444, 0, 0, 28473268, 27065658
// value: 3.7866, 0.7541, -10.1219, -0.5363, 2.4502, -1.1655, 15.6427, 0.8288, 0, 8.5980, 3.0082, 0.1594, 0, 0, 120401696, 7383461

// widthRatio 0.328125
// heightRatio 0.1216796875

// widthRatio 0.328125
// heightRatio 0.1216796875

// translate -10, zoom 0: [3.047619104385376, 0, 0, 0, 0, 8.21829891204834, 0, 0, 0, 0, -1.0100502967834473, -1, 0, 0, -1.0050251483917236, 0]
// translate -10, zoom 1: [6.095238208770752, 0, 0, 0, 0, 16.43659782409668, 0, 0, 0, 0, -1.0100502967834473, -1, 0, 0, -1.0050251483917236, 0]
// translate -5, zoom 1: [3.047619104385376, 0, 0, 0, 0, 8.21829891204834, 0, 0, 0, 0, -1.0100502967834473, -1, 0, 0, -1.0050251483917236, 0]

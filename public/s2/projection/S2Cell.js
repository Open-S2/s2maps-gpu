// @flow
/** COMPONENTS **/
// import {
//   quadraticSTtoUV as STtoUV,
//   quadraticUVtoST as UVtoST,
//   STtoIJ,
//   faceUVtoXYZ,
//   faceXYZtoUV,
//   faceUVtoXYZGL,
//   lonLatToXYZ,
//   xyzToLonLat
// } from './'
// import S2LonLat from './S2LonLat'

/** TYPES **/
import type { Face } from './'

export default class S2Cell {
  i: number
  j: number
  order: number
  limit: number
  constructor (i: number, j: number, order: number = 30) {
    this.i = i
    this.j = j
    this.order = order
    this.limit = 1 << order
  }

  clone () {
    return new S2Cell(this.i, this.j, this.order)
  }
}

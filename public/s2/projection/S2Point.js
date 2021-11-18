// @flow
/** COMPONENTS **/
import {
  quadraticSTtoUV as STtoUV,
  quadraticUVtoST as UVtoST,
  STtoIJ,
  faceUVtoXYZ,
  faceXYZtoUV,
  faceUVtoXYZGL,
  lonLatToXYZ,
  xyzToLonLat
} from './'
import S2LonLat from './S2LonLat'
import { doubleToTwoFloats } from './util'

/** TYPES **/
import type { Face } from './'

export default class S2Point {
  x: number
  y: number
  z: number
  constructor (x: number, y: number, z: number) {
    this.x = x
    this.y = y
    this.z = z
  }

  clone () {
    return new S2Point(this.x, this.y, this.z)
  }

  toFloats (): [[number, number, number], [number, number, number]] { // [highVec3, lowVec3]
    const floatsX = doubleToTwoFloats(this.x)
    const floatsY = doubleToTwoFloats(this.y)
    const floatsZ = doubleToTwoFloats(this.z)

    return [floatsX[0], floatsY[0], floatsZ[0], floatsX[1], floatsY[1], floatsZ[1]]
  }

  toArray (): [number, number, number] {
    return [this.x, this.y, this.z]
  }

  add (n: number) {
    this.x += n
    this.y += n
    this.z += n

    return this
  }

  addScalar (arr: [number, number, number]) {
    this.x += arr[0]
    this.y += arr[1]
    this.z += arr[2]

    return this
  }

  addScalarS2 (point: S2Point) {
    this.x += point.x
    this.y += point.y
    this.z += point.z

    return this
  }

  sub (n: number) {
    this.x -= n
    this.y -= n
    this.z -= n

    return this
  }

  subScalar (arr: [number, number, number]) {
    this.x -= arr[0]
    this.y -= arr[1]
    this.z -= arr[2]

    return this
  }

  subScalarS2 (point: S2Point) {
    this.x -= point.x
    this.y -= point.y
    this.z -= point.z

    return this
  }

  mul (n: number) {
    this.x *= n
    this.y *= n
    this.z *= n

    return this
  }

  mulArr (arr: [number, number, number]) {
    this.x *= arr[0]
    this.y *= arr[1]
    this.z *= arr[2]

    return this
  }

  normalize () {
    const length = this.length()
    this.x /= length
    this.y /= length
    this.z /= length

    return this
  }

  length () {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  toUV (): [Face, number, number] {
    // get the face from the x, y, z
    const face: Face = this.getFace()
    let [u, v] = faceXYZtoUV(face, this.x, this.y, this.z)

    return [face, u, v]
  }

  toST (): [Face, number, number] {
    const [face, u, v] = this.toUV()

    return [face, UVtoST(u), UVtoST(v)]
  }

  toIJ (): [Face, number, number] {
    const [face, s, t] = this.toST()

    return [face, STtoIJ(s), STtoIJ(t)]
  }

  toLonLat (): [number, number] {
    return xyzToLonLat(this.x, this.y, this.z)
  }

  getFace (): Face {
    let face = this._largestAbsComponent()
    const temp = [this.x, this.y, this.z]
    if (temp[face] < 0) face += 3
    // $FlowIgnoreLine
    return face
  }

  _largestAbsComponent (): Face {
    let temp = [Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)]

    return (temp[0] > temp[1])
      ? (temp[0] > temp[2]) ? 0 : 2
      : (temp[1] > temp[2]) ? 1 : 2
  }

  static fromS2LonLat (lonlat: S2LonLat): S2Point {
    // convert to x, y, z
    const [x, y, z] = lonLatToXYZ(lonlat.lon, lonlat.lat)
    // create the point
    return new S2Point(x, y, z)
  }

  static fromLonLat (lon: number, lat: number): S2Point {
    // convert to x, y, z
    const [x, y, z] = lonLatToXYZ(lon, lat)
    // create the point
    return new S2Point(x, y, z)
  }

  static fromLonLatGL (lon: number, lat: number): S2Point {
    // convert to x, y, z
    const [x, y, z] = lonLatToXYZ(lon, lat)
    // create the point
    return new S2Point(y, z, x)
  }

  static fromUV (face: Face, u: number, v: number): S2Point {
    return faceUVtoXYZ(face, u, v)
  }

  static fromST (face: Face, s: number, t: number): S2Point {
    const [u, v] = [STtoUV(s), STtoUV(t)]

    return this.fromUV(face, u, v)
  }

  static fromUVGL (face: Face, u: number, v: number): S2Point {
    return faceUVtoXYZGL(face, u, v)
  }

  static fromSTGL (face: Face, s: number, t: number) {
    const [u, v] = [STtoUV(s), STtoUV(t)]

    return this.fromUVGL(face, u, v)
  }
}

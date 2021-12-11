// @flow
/** COMPONENTS **/
import {
  quadraticSTtoUV as STtoUV,
  quadraticUVtoST as UVtoST,
  STtoIJ,
  IJtoST,
  faceUVtoXYZ,
  XYZtoFaceUV,
  faceUVtoXYZGL,
  lonLatToXYZ,
  lonLatToXYZGL,
  xyzToLonLat
} from './'
import * as S2CellID from './S2CellID'
import { EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR } from './util'

/** TYPES **/
import type { Face } from './'

export type XYZ = [number, number, number]

export function fromLonLat (lon: number, lat: number): XYZ {
  return lonLatToXYZ(lon, lat)
}

export function fromLonLatGL (lon: number, lat: number): XYZ {
  return lonLatToXYZGL(lon, lat)
}

export function fromUV (face: Face, u: number, v: number): XYZ {
  return faceUVtoXYZ(face, u, v)
}

export function fromST (face: Face, s: number, t: number): XYZ {
  const [u, v] = [STtoUV(s), STtoUV(t)]

  return fromUV(face, u, v)
}

export function fromIJ (face: Face, i: number, j: number): XYZ {
  const [s, t] = [IJtoST(i), IJtoST(j)]

  return fromST(face, i, j)
}

export function fromS2CellID (id: BigInt): XYZ {
  const [face, u, v] = S2CellID.toUV(id)

  return fromUV(face, u, v)
}

export function fromUVGL (face: Face, u: number, v: number): XYZ {
  return faceUVtoXYZGL(face, u, v)
}

export function fromSTGL (face: Face, s: number, t: number) {
  const [u, v] = [STtoUV(s), STtoUV(t)]

  return fromUVGL(face, u, v)
}

export function toUV (xyz: XYZ): [Face, number, number] {
  return XYZtoFaceUV(xyz)
}

export function toST (xyz: XYZ): [Face, number, number] {
  const [face, u, v] = toUV(xyz)

  return [face, UVtoST(u), UVtoST(v)]
}

export function toIJ (xyz: XYZ, level?: number): [Face, number, number] {
  const [face, s, t] = toST(xyz)
  let i = STtoIJ(s)
  let j = STtoIJ(t)

  if (level) {
    i = i >> (30 - level)
    j = j >> (30 - level)
  }

  return [face, i, j]
}

export function toLonLat (xyz: XYZ): [number, number] {
  return xyzToLonLat(xyz)
}

export function toS2CellID (xyz: XYZ): BigInt {
  return S2CellID.fromS2Point(face, i, j)
}

export function add (xyz: XYZ, n: number) {
  xyz[0] += n
  xyz[1] += n
  xyz[2] += n

  return xyz
}

export function addScalar (xyz: XYZ, point: XYZ) {
  xyz[0] += point[0]
  xyz[1] += point[1]
  xyz[2] += point[2]

  return xyz
}

export function sub (xyz: XYZ, n: number) {
  xyz[0] -= n
  xyz[1] -= n
  xyz[2] -= n

  return xyz
}

export function subScalar (xyz: XYZ, point: XYZ) {
  xyz[0] -= point[0]
  xyz[1] -= point[1]
  xyz[2] -= point[2]

  return xyz
}

export function mul (xyz: XYZ, n: number) {
  xyz[0] *= n
  xyz[1] *= n
  xyz[2] *= n

  return xyz
}

export function mulScalar (xyz: XYZ, point: XYZ) {
  xyz[0] *= point[0]
  xyz[1] *= point[1]
  xyz[2] *= point[2]

  return xyz
}

export function normalize (xyz: XYZ) {
  const [x, y, z] = xyz
  const len = length(xyz)
  xyz[0] /= len
  xyz[1] /= len
  xyz[2] /= len

  return xyz
}

export function length (xyz: XYZ) {
  const [x, y, z] = xyz
  return Math.sqrt(x * x + y * y + z * z)
}

export function distanceEarth (a: XYZ, b: XYZ) {
  a.x *= EARTH_RADIUS_EQUATORIAL
  b.x *= EARTH_RADIUS_EQUATORIAL
  a.y *= EARTH_RADIUS_EQUATORIAL
  b.y *= EARTH_RADIUS_EQUATORIAL
  a.z *= EARTH_RADIUS_POLAR
  b.z *= EARTH_RADIUS_POLAR

  return distance(a, b)
}

export function distance (a: XYZ, b: XYZ) {
  const { sqrt, pow, abs } = Math

  return Math.sqrt(pow(abs(b.x - a.x), 2) + pow(abs(b.y - a.y), 2) + pow(abs(b.z - a.z), 2))
}

export function getFace (xyz: XYZ) {
  return XYZtoFace(xyz)
}

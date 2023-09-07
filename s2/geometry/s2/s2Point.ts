import {
  IJtoST,
  STtoIJ,
  quadraticSTtoUV as STtoUV,
  quadraticUVtoST as UVtoST,
  XYZtoFace,
  XYZtoFaceUV,
  faceUVtoXYZ,
  faceUVtoXYZGL,
  lonLatToXYZ,
  lonLatToXYZGL,
  xyzToLonLat
} from './s2Coords'
import * as S2CellID from './s2CellID'
import { EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR } from '../util'

import type { Face } from './s2Proj.spec'
import type { XYZ } from '../proj.spec.js'

/** TYPES **/

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

  return fromST(face, s, t)
}

export function fromS2CellID (id: bigint): XYZ {
  const [face, u, v] = S2CellID.toUV(id)

  return fromUV(face, u, v)
}

export function fromUVGL (face: Face, u: number, v: number): XYZ {
  return faceUVtoXYZGL(face, u, v)
}

export function fromSTGL (face: Face, s: number, t: number): XYZ {
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

  if (level !== undefined) {
    i = i >> (30 - level)
    j = j >> (30 - level)
  }

  return [face, i, j]
}

export function toLonLat (xyz: XYZ): [number, number] {
  return xyzToLonLat(xyz)
}

export function toS2CellID (xyz: XYZ): bigint {
  return S2CellID.fromS2Point(xyz)
}

export function add (xyz: XYZ, n: number): XYZ {
  xyz[0] += n
  xyz[1] += n
  xyz[2] += n

  return xyz
}

export function addScalar (xyz: XYZ, point: XYZ): XYZ {
  xyz[0] += point[0]
  xyz[1] += point[1]
  xyz[2] += point[2]

  return xyz
}

export function sub (xyz: XYZ, n: number): XYZ {
  xyz[0] -= n
  xyz[1] -= n
  xyz[2] -= n

  return xyz
}

export function subScalar (xyz: XYZ, point: XYZ): XYZ {
  xyz[0] -= point[0]
  xyz[1] -= point[1]
  xyz[2] -= point[2]

  return xyz
}

export function mul (xyz: XYZ, n: number): XYZ {
  xyz[0] *= n
  xyz[1] *= n
  xyz[2] *= n

  return xyz
}

export function mulScalar (xyz: XYZ, point: XYZ): XYZ {
  xyz[0] *= point[0]
  xyz[1] *= point[1]
  xyz[2] *= point[2]

  return xyz
}

export function normalize (xyz: XYZ): XYZ {
  const len = length(xyz)
  xyz[0] /= len
  xyz[1] /= len
  xyz[2] /= len

  return xyz
}

export function length (xyz: XYZ): number {
  const [x, y, z] = xyz
  return Math.sqrt(x * x + y * y + z * z)
}

export function distanceEarth (a: XYZ, b: XYZ): number {
  a[0] *= EARTH_RADIUS_EQUATORIAL
  b[0] *= EARTH_RADIUS_EQUATORIAL
  a[1] *= EARTH_RADIUS_EQUATORIAL
  b[1] *= EARTH_RADIUS_EQUATORIAL
  a[2] *= EARTH_RADIUS_POLAR
  b[2] *= EARTH_RADIUS_POLAR

  return distance(a, b)
}

export function distance (a: XYZ, b: XYZ): number {
  const { sqrt, pow, abs } = Math

  return sqrt(pow(abs(b[0] - a[0]), 2) + pow(abs(b[1] - a[1]), 2) + pow(abs(b[2] - a[2]), 2))
}

export function getFace (xyz: XYZ): number {
  return XYZtoFace(xyz)
}

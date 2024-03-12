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

/** Convert a lon-lat coord to an XYZ Point using the left-hand-rule */
export function fromLonLat (lon: number, lat: number): XYZ {
  return lonLatToXYZ(lon, lat)
}

/** Convert a lon-lat coord to an XYZ Point using the right-hand-rule */
export function fromLonLatGL (lon: number, lat: number): XYZ {
  return lonLatToXYZGL(lon, lat)
}

/** Convert a u-v coordinate to an XYZ Point */
export function fromUV (face: Face, u: number, v: number): XYZ {
  return faceUVtoXYZ(face, u, v)
}

/** Convert an s-t coordinate to an XYZ Point */
export function fromST (face: Face, s: number, t: number): XYZ {
  const [u, v] = [STtoUV(s), STtoUV(t)]

  return fromUV(face, u, v)
}

/** Convert an i-j coordinate to an XYZ Point */
export function fromIJ (face: Face, i: number, j: number): XYZ {
  const [s, t] = [IJtoST(i), IJtoST(j)]

  return fromST(face, s, t)
}

/** Convert an S2CellID to an XYZ Point */
export function fromS2CellID (id: bigint): XYZ {
  const [face, u, v] = S2CellID.toUV(id)

  return fromUV(face, u, v)
}

/** Convert an Face-U-V coord to an XYZ Point using the right-hand-rule */
export function fromUVGL (face: Face, u: number, v: number): XYZ {
  return faceUVtoXYZGL(face, u, v)
}

/** Convert an Face-S-T coord to an XYZ Point using the right-hand-rule */
export function fromSTGL (face: Face, s: number, t: number): XYZ {
  const [u, v] = [STtoUV(s), STtoUV(t)]

  return fromUVGL(face, u, v)
}

/** Convert an XYZ Point to a Face-U-V coord */
export function toUV (xyz: XYZ): [face: Face, u: number, v: number] {
  return XYZtoFaceUV(xyz)
}

/** Convert an XYZ Point to a Face-S-T coord */
export function toST (xyz: XYZ): [face: Face, s: number, t: number] {
  const [face, u, v] = toUV(xyz)

  return [face, UVtoST(u), UVtoST(v)]
}

/** Convert an XYZ Point to a Face-I-J coord */
export function toIJ (xyz: XYZ, level?: number): [face: Face, i: number, j: number] {
  const [face, s, t] = toST(xyz)
  let i = STtoIJ(s)
  let j = STtoIJ(t)

  if (level !== undefined) {
    i = i >> (30 - level)
    j = j >> (30 - level)
  }

  return [face, i, j]
}

/** Convert an XYZ Point to a lon-lat coord */
export function toLonLat (xyz: XYZ): [lon: number, lat: number] {
  return xyzToLonLat(xyz)
}

/** Convert an XYZ Point to an S2CellID */
export function toS2CellID (xyz: XYZ): bigint {
  return S2CellID.fromS2Point(xyz)
}

/** Take an XYZ Point and add an n to each component */
export function add (xyz: XYZ, n: number): XYZ {
  xyz[0] += n
  xyz[1] += n
  xyz[2] += n

  return xyz
}

/** Take an XYZ Point and add another XYZ Point to it */
export function addScalar (xyz: XYZ, point: XYZ): XYZ {
  xyz[0] += point[0]
  xyz[1] += point[1]
  xyz[2] += point[2]

  return xyz
}

/** Take an XYZ Point and subtract an n from each component */
export function sub (xyz: XYZ, n: number): XYZ {
  xyz[0] -= n
  xyz[1] -= n
  xyz[2] -= n

  return xyz
}

/** Take an XYZ Point and subtract another XYZ Point from it */
export function subScalar (xyz: XYZ, point: XYZ): XYZ {
  xyz[0] -= point[0]
  xyz[1] -= point[1]
  xyz[2] -= point[2]

  return xyz
}

/** Take an XYZ Point and multiply each component by n */
export function mul (xyz: XYZ, n: number): XYZ {
  xyz[0] *= n
  xyz[1] *= n
  xyz[2] *= n

  return xyz
}

/** Take an XYZ Point and multiply it by another XYZ Point */
export function mulScalar (xyz: XYZ, point: XYZ): XYZ {
  xyz[0] *= point[0]
  xyz[1] *= point[1]
  xyz[2] *= point[2]

  return xyz
}

/** Take an XYZ Point and divide each component by its length */
export function normalize (xyz: XYZ): XYZ {
  const len = length(xyz)
  xyz[0] /= len
  xyz[1] /= len
  xyz[2] /= len

  return xyz
}

/** Get the length of the XYZ Point */
export function length (xyz: XYZ): number {
  const [x, y, z] = xyz
  return Math.sqrt(x * x + y * y + z * z)
}

/** Get the distance between two XYZ Points using Earth's size */
export function distanceEarth (a: XYZ, b: XYZ): number {
  a[0] *= EARTH_RADIUS_EQUATORIAL
  b[0] *= EARTH_RADIUS_EQUATORIAL
  a[1] *= EARTH_RADIUS_EQUATORIAL
  b[1] *= EARTH_RADIUS_EQUATORIAL
  a[2] *= EARTH_RADIUS_POLAR
  b[2] *= EARTH_RADIUS_POLAR

  return distance(a, b)
}

/** Get the distance between two XYZ Points */
export function distance (a: XYZ, b: XYZ): number {
  const { sqrt, pow, abs } = Math

  return sqrt(pow(abs(b[0] - a[0]), 2) + pow(abs(b[1] - a[1]), 2) + pow(abs(b[2] - a[2]), 2))
}

/** Find the S2 Hilbert Face of the XYZ Point [0, 6) */
export function getFace (xyz: XYZ): number {
  return XYZtoFace(xyz)
}

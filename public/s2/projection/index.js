// @flow
import { radToDeg, degToRad } from './util'

import type { XYZ } from './S2Point'

export const kLimitIJ = 1 << 30

export type Face = 0 | 1 | 2 | 3 | 4 | 5

export type BBox = [number, number, number, number] // left, bottom, right, top

export function linearSTtoUV (s: number) {
  return 2 * s - 1
}

export function linearUVtoST (u: number) {
  return 0.5 * (u + 1)
}

export function tanSTtoUV (s: number) {
  return Math.tan(Math.PI / 2 * s - Math.PI / 4)
}

export function tanUVtoST (u: number) {
  return (2 * (1 / Math.PI)) * (Math.atan(u) + Math.PI / 4)
}

export function quadraticSTtoUV (s: number) {
  if (s >= 0.5) return (1 / 3) * (4 * s * s - 1)
  return (1 / 3) * (1 - 4 * (1 - s) * (1 - s))
}

export function quadraticUVtoST (u: number) {
  if (u >= 0) return 0.5 * Math.sqrt(1 + 3 * u)
  return 1 - 0.5 * Math.sqrt(1 - 3 * u)
}

export function STtoIJ (s: number): number {
  const { max, min, floor } = Math
  return max(0, min(kLimitIJ - 1, floor(kLimitIJ * s)))
}

export function IJtoST (i: number): number {
  return i / kLimitIJ
}

export function SiTiToST (si) {
  return (1 / 2147483648) * si
}

// left hand rule
export function faceUVtoXYZ (face: Face, u: number, v: number): [number, number, number] {
  switch (face) {
    case 0: return [1, u, v]
    case 1: return [-u, 1, v]
    case 2: return [-u, -v, 1]
    case 3: return [-1, -v, -u]
    case 4: return [v, -1, -u]
    default: return [v, u, -1]
  }
}

// right hand rule
export function faceUVtoXYZGL (face: Face, u: number, v: number): S2Point {

  switch (face) {
    case 0: return [u, v, 1]
    case 1: return [1, v, -u]
    case 2: return [-v, 1, -u]
    case 3: return [-v, -u, -1]
    case 4: return [-1, -u, v]
    default: return [u, -1, v]
  }
}

// left hand rule
export function faceXYZtoUV (face: Face, xyz: XYZ): [number, number] {
  const [x, y, z] = xyz

  switch (face) {
    case 0: return [y / x, z / x]
    case 1: return [-x / y, z / y]
    case 2: return [-x / z, -y / z]
    case 3: return [z / x, y / x]
    case 4: return [z / y, -x / y]
    default: return [-y / z, -x / z]
  }
}

export function XYZtoFace (xyz: XYZ): [Face, number, number] {
  let temp = xyz.map(n => Math.abs(n))

  let face = (temp[0] > temp[1])
    ? (temp[0] > temp[2]) ? 0 : 2
    : (temp[1] > temp[2]) ? 1 : 2

  if (xyz[face] < 0) face += 3

  return face
}

export function XYZtoFaceUV (xyz: XYZ): [Face, number, number] {
  const face = XYZtoFace(xyz)
  return [face, ...faceXYZtoUV(face, xyz)]
}

// TODO: right hand rule
export function faceXYZGLtoUV (face: Face, xyz: XYZ): [number, number] {
  const [x, y, z] = xyz

  switch (face) {
    case 0: return [x / z, y / z]
    case 1: return [-z / x, y / x]
    case 2: return [-z / y, -x / y]
    case 3: return [y / z, x / z]
    case 4: return [y / x, -z / x]
    default: return [-x / y, -z / y]
  }
}

export function xyzToLonLat (xyz: XYZ): [number, number] {
  const [x, y, z] = xyz

  return [
    radToDeg(Math.atan2(y, x)),
    radToDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
  ]
}

export function lonLatToXYZ (lon: number, lat: number): [number, number, number] {
  lon = degToRad(lon)
  lat = degToRad(lat)
  return [
    Math.cos(lat) * Math.cos(lon), // x
    Math.cos(lat) * Math.sin(lon), // y
    Math.sin(lat) // z
  ]
}

export function lonLatToXYZGL (lon: number, lat: number): [number, number, number] {
  lon = degToRad(lon)
  lat = degToRad(lat)
  return [
    Math.cos(lat) * Math.sin(lon), // y
    Math.sin(lat), // z
    Math.cos(lat) * Math.cos(lon) // x
  ]
}

export function tileXYFromUVZoom (u: number, v: number, zoom: number): [number, number] {
  const s = quadraticUVtoST(u)
  const t = quadraticUVtoST(v)

  return tileXYFromSTZoom(s, t, zoom)
}

export function tileXYFromSTZoom (s: number, t: number, zoom: number): [number, number] {
  const divisionFactor = (2 / (1 << zoom)) * 0.5

  return [Math.floor(s / divisionFactor), Math.floor(t / divisionFactor)]
}

export function bboxUV (u: number, v: number, zoom: number): BBox {
  const divisionFactor = 2 / (1 << zoom)

  return [
    divisionFactor * u - 1,
    divisionFactor * v - 1,
    divisionFactor * (u + 1) - 1,
    divisionFactor * (v + 1) - 1
  ]
}

export function bboxST (x: number, y: number, zoom: number): BBox {
  const divisionFactor = (2 / (1 << zoom)) * 0.5

  return [
    divisionFactor * x,
    divisionFactor * y,
    divisionFactor * (x + 1),
    divisionFactor * (y + 1)
  ]
}

export function neighborsIJ (face: Face, i: number, j: number, level?: number = 30): Array<[Face, number, number]> {
  const size = 1 << (30 - level)

  if (level !== 30) {
    i = i << (30 - level)
    j = j << (30 - level)
  }

  return [
    fromIJWrap(face, i, j - size, level, j - size >= 0),
    fromIJWrap(face, i + size, j, level, i + size < size),
    fromIJWrap(face, i, j + size, level, j + size < size),
    fromIJWrap(face, i - size, j, level, i - size >= 0)
  ]
}

function fromIJWrap (face: Face, i: number, j: number, level: number, sameFace?: boolean): BigInt {
  if (sameFace) return [face, i >> (30 - level), j >> (30 - level)]
  const { max, min } = Math
  const kMaxSize = 1073741824

  i = max(-1, min(kMaxSize, i))
  j = max(-1, min(kMaxSize, j))

  const kScale = 1 / kMaxSize
  const kLimit = 1 + 2.2204460492503131e-16
  const u = max(-kLimit, min(kLimit, kScale * (2 * (i - kMaxSize / 2) + 1)))
  const v = max(-kLimit, min(kLimit, kScale * (2 * (j - kMaxSize / 2) + 1)))

  const [nFace, nU, nV] = XYZtoFaceUV(faceUVtoXYZ(face, u, v))
  return [nFace, STtoIJ(0.5 * (nU + 1)) >> (30 - level), STtoIJ(0.5 * (nV + 1)) >> (30 - level)]
}

export function updateFace (face: Face, s: number, t: number, size: number = 1) {
  const diff = (size === 1) ? size : size - 1
  if (face === 0) {
    if (s < 0) return [4, diff - t, size + s]
    else if (s === size) return [1, 0, t]
    else if (t < 0) return [5, s, size + t]
    else if (t === size) return [2, 0, diff - s]
  } else if (face === 1) {
    if (s < 0) return [0, size + s, t]
    else if (s == size) return [3, diff - t, 0]
    else if (t < 0) return [5, size + t, diff - s]
    else if (t === size) return [2, s, 0]
  } else if (face === 2) {
    if (s < 0) return [0, diff - t, size + s]
    else if (s === size) return [3, 0, t]
    else if (t < 0) return [1, s, size + t]
    else if (t === size) return [4, 0, diff - s]
  } else if (face === 3) {
    if (s < 0) return [2, size + s, t]
    else if (s === size) return [5, diff - t, 0]
    else if (t < 0) return [1, size + t, diff - s]
    else if (t === size) return [4, s, 0]
  } else if (face === 4) {
    if (s < 0) return [2, diff - t, size + s]
    else if (s === size) return [5, 0, t]
    else if (t < 0) return [3, s, size + t]
    else if (t === size) return [0, 0, diff - s]
  } else if (face === 5) {
    if (s < 0) return [4, size + s, t]
    else if (s === size) return [1, diff - t, 0]
    else if (t < 0) return [3, size + t, diff - s]
    else if (t === size) return [0, s, 0]
  }
}

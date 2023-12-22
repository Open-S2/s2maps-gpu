import { degToRad, radToDeg } from '../util'

import type { Face } from './s2Proj.spec'
import type { BBox, XYZ } from '../proj.spec'

export const kLimitIJ = 1 << 30

export function linearSTtoUV (s: number): number {
  return 2 * s - 1
}

export function linearUVtoST (u: number): number {
  return 0.5 * (u + 1)
}

export function tanSTtoUV (s: number): number {
  return Math.tan(Math.PI / 2 * s - Math.PI / 4)
}

export function tanUVtoST (u: number): number {
  return (2 * (1 / Math.PI)) * (Math.atan(u) + Math.PI / 4)
}

export function quadraticSTtoUV (s: number): number {
  if (s >= 0.5) return (1 / 3) * (4 * s * s - 1)
  return (1 / 3) * (1 - 4 * (1 - s) * (1 - s))
}

export function quadraticUVtoST (u: number): number {
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

export function SiTiToST (si: number): number {
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
export function faceUVtoXYZGL (face: Face, u: number, v: number): XYZ {
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

export function XYZtoFace (xyz: XYZ): Face {
  const temp = xyz.map((n: number): number => Math.abs(n))

  let face: number = (temp[0] > temp[1])
    ? (temp[0] > temp[2]) ? 0 : 2
    : (temp[1] > temp[2]) ? 1 : 2
  // $FlowIgnore
  if (xyz[face] < 0) face += 3

  return face as Face
}

export function XYZtoFaceUV (xyz: XYZ): [Face, number, number] {
  const face = XYZtoFace(xyz)
  return [face, ...faceXYZtoUV(face, xyz)]
}

export function faceXYZGLtoUV (face: number, xyz: XYZ): [number, number] {
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

export function neighborsIJ (face: Face, i: number, j: number, level = 30): Array<[number, number, number]> {
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

function fromIJWrap (face: Face, i: number, j: number, level: number, sameFace = false): [number, number, number] {
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

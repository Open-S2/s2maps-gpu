import { degToRad, radToDeg } from '../util'

import type { Face } from './s2Proj.spec'
import type { BBox, FaceIJ, Point, XYZ } from '../proj.spec'

export const K_LIMIT_IJ = 1 << 30

/** Convert a [0, 1] to a [-1, 1] in a linear fashion */
export function linearSTtoUV (s: number): number {
  return 2 * s - 1
}

/** Convert a [-1, 1] to a [0, 1] in a linear fashion */
export function linearUVtoST (u: number): number {
  return 0.5 * (u + 1)
}

/** Convert a [0, 1] to a [-1, 1] in a tangential fashion */
export function tanSTtoUV (s: number): number {
  return Math.tan(Math.PI / 2 * s - Math.PI / 4)
}

/** Convert a [-1, 1] to a [0, 1] in a tangential fashion */
export function tanUVtoST (u: number): number {
  return (2 * (1 / Math.PI)) * (Math.atan(u) + Math.PI / 4)
}

/** Convert a [0, 1] to a [-1, 1] in a quadratic fashion */
export function quadraticSTtoUV (s: number): number {
  if (s >= 0.5) return (1 / 3) * (4 * s * s - 1)
  return (1 / 3) * (1 - 4 * (1 - s) * (1 - s))
}

/** Convert a [-1, 1] to a [0, 1] in a quadratic fashion */
export function quadraticUVtoST (u: number): number {
  if (u >= 0) return 0.5 * Math.sqrt(1 + 3 * u)
  return 1 - 0.5 * Math.sqrt(1 - 3 * u)
}

/** Convert from st space to ij space (ij are whole numbers ranging an entire u30) */
export function STtoIJ (s: number): number {
  const { max, min, floor } = Math
  return max(0, min(K_LIMIT_IJ - 1, floor(K_LIMIT_IJ * s)))
}

/** Convert from ij space to st space (ij are whole numbers ranging an entire u30) */
export function IJtoST (i: number): number {
  return i / K_LIMIT_IJ
}

/** Convert SiTi to ST. */
export function SiTiToST (si: number): number {
  return (1 / 2_147_483_648) * si
}

/** Convert a face-u-v coords to left-hand-rule XYZ Point coords */
export function faceUVtoXYZ (face: Face, u: number, v: number): XYZ {
  switch (face) {
    case 0: return [1, u, v]
    case 1: return [-u, 1, v]
    case 2: return [-u, -v, 1]
    case 3: return [-1, -v, -u]
    case 4: return [v, -1, -u]
    default: return [v, u, -1]
  }
}

/** Convert a face-u-v coords to right-hand-rule XYZ Point coords */
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

/** Convert from a face and left-hand-rule XYZ Point to u-v coords */
export function faceXYZtoUV (face: Face, xyz: XYZ): [u: number, v: number] {
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

/** Find the face the point is located at */
export function XYZtoFace (xyz: XYZ): Face {
  const temp = xyz.map((n: number): number => Math.abs(n))

  let face: number = (temp[0] > temp[1])
    ? (temp[0] > temp[2]) ? 0 : 2
    : (temp[1] > temp[2]) ? 1 : 2
  if (xyz[face] < 0) face += 3

  return face as Face
}

/** Convert from an left-hand-rule XYZ Point to a Face-U-V coordinate */
export function XYZtoFaceUV (xyz: XYZ): [face: Face, u: number, v: number] {
  const face = XYZtoFace(xyz)
  return [face, ...faceXYZtoUV(face, xyz)]
}

/** Convert from a face and right-hand-rule XYZ Point to u-v coords */
export function faceXYZGLtoUV (face: number, xyz: XYZ): [u: number, v: number] {
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

/** Convert from an left-hand-rule XYZ Point to a lon-lat coord */
export function xyzToLonLat (xyz: XYZ): [lon: number, lat: number] {
  const [x, y, z] = xyz

  return [
    radToDeg(Math.atan2(y, x)),
    radToDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
  ]
}

/** Convert from a lon-lat coord to an left-hand-rule XYZ Point */
export function lonLatToXYZ (lon: number, lat: number): XYZ {
  lon = degToRad(lon)
  lat = degToRad(lat)
  return [
    Math.cos(lat) * Math.cos(lon), // x
    Math.cos(lat) * Math.sin(lon), // y
    Math.sin(lat) // z
  ]
}

/** Convert from a lon-lat coord to an right-hand-rule XYZ Point */
export function lonLatToXYZGL (lon: number, lat: number): XYZ {
  lon = degToRad(lon)
  lat = degToRad(lat)
  return [
    Math.cos(lat) * Math.sin(lon), // y
    Math.sin(lat), // z
    Math.cos(lat) * Math.cos(lon) // x
  ]
}

/** Convert an u-v-zoom coordinate to a tile coordinate */
export function tileXYFromUVZoom (u: number, v: number, zoom: number): Point {
  const s = quadraticUVtoST(u)
  const t = quadraticUVtoST(v)

  return tileXYFromSTZoom(s, t, zoom)
}

/** Convert an s-t-zoom coordinate to a tile coordinate */
export function tileXYFromSTZoom (s: number, t: number, zoom: number): Point {
  const { floor } = Math
  const divisionFactor = (2 / (1 << zoom)) * 0.5

  return { x: floor(s / divisionFactor), y: floor(t / divisionFactor) }
}

/** Given a quad-based tile schema of "zoom-x-y", get the local UV bounds of said tile. */
export function bboxUV (u: number, v: number, zoom: number): BBox {
  const divisionFactor = 2 / (1 << zoom)

  return [
    divisionFactor * u - 1,
    divisionFactor * v - 1,
    divisionFactor * (u + 1) - 1,
    divisionFactor * (v + 1) - 1
  ]
}

/** Given a quad-based tile schema of "zoom-x-y", get the local ST bounds of said tile. */
export function bboxST (s: number, t: number, zoom: number): BBox {
  const divisionFactor = (2 / (1 << zoom)) * 0.5

  return [
    divisionFactor * s,
    divisionFactor * t,
    divisionFactor * (s + 1),
    divisionFactor * (t + 1)
  ]
}

/**
 * Find the face-i-j coordinates of neighbors for a specific face-i-j coordinate.
 * Define an adjusted level (zoom) for the i-j coordinates. The level is 30 by default.
 */
export function neighborsIJ (face: Face, i: number, j: number, level = 30): FaceIJ[] {
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

/**
 * Adjust a manipulated face-i-j coordinate to a legal one if necessary.
 */
function fromIJWrap (face: Face, i: number, j: number, level: number, sameFace = false): FaceIJ {
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

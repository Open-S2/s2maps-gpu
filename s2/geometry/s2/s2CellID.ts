/** COMPONENTS **/
import {
  quadraticUVtoST as UVtoST,
  quadraticSTtoUV as STtoUV,
  lonLatToXYZ,
  faceUVtoXYZ,
  XYZtoFaceUV,
  xyzToLonLat,
  STtoIJ,
  IJtoST,
  SiTiToST
} from './s2Coords'
import { fromS2CellID, toIJ as S2PointToIJ } from './s2Point'
import { EARTH_RADIUS } from '../util'

import type { Face } from './s2Proj.spec'
import type { XYZ } from '../proj.spec'

/** CONSTANTS **/
const LOOKUP_POS: bigint[] = []
const LOOKUP_IJ: bigint[] = []
// const FACE_BITS: bigint = 3n
// const NUM_FACES: bigint = 6n
// const MAX_LEVEL: bigint = 30n
// const POS_BITS: bigint = 61n
// const MAX_SIZE: bigint = 1073741824n

/** INITIALIZATION **/
for (let i = 0; i < 4; i++) initLookupCell(0, 0, 0, i, 0, i)
function initLookupCell (
  level: number, i: number, j: number, origOrientation: number,
  pos: number, orientation: number
): void {
  const kPosToOriengation = [1, 0, 0, 3]
  const kPosToIJ = [
    [0, 1, 3, 2],
    [0, 2, 3, 1],
    [3, 2, 0, 1],
    [3, 1, 0, 2]
  ]
  if (level === 4) {
    const ij = (i << 4) + j
    LOOKUP_POS[(ij << 2) + origOrientation] = BigInt((pos << 2) + orientation)
    LOOKUP_IJ[(pos << 2) + origOrientation] = BigInt((ij << 2) + orientation)
  } else {
    level++
    i <<= 1
    j <<= 1
    pos <<= 2
    const r = kPosToIJ[orientation]
    initLookupCell(level, i + (r[0] >> 1), j + (r[0] & 1), origOrientation, pos, orientation ^ kPosToOriengation[0])
    initLookupCell(level, i + (r[1] >> 1), j + (r[1] & 1), origOrientation, pos + 1, orientation ^ kPosToOriengation[1])
    initLookupCell(level, i + (r[2] >> 1), j + (r[2] & 1), origOrientation, pos + 2, orientation ^ kPosToOriengation[2])
    initLookupCell(level, i + (r[3] >> 1), j + (r[3] & 1), origOrientation, pos + 3, orientation ^ kPosToOriengation[3])
  }
}

/** FUNCTIONS **/
export function fromFace (face: Face): bigint {
  return (BigInt(face) << 61n) + (1n << 60n)
}

export function fromLonLat (lon: number, lat: number): bigint {
  const xyz = lonLatToXYZ(lon, lat)
  return fromS2Point(xyz)
}

export function fromS2Point (xyz: XYZ): bigint {
  // convert to face-i-j
  const [face, i, j] = S2PointToIJ(xyz)
  // now convert from ij
  return fromIJ(face, i, j)
}

export function fromUV (face: Face, u: number, v: number): bigint {
  // convert to st
  const s = UVtoST(u)
  const t = UVtoST(v)
  // now convert from st
  return fromST(face, s, t)
}

export function fromST (face: Face, s: number, t: number): bigint {
  // convert to ij
  const i = STtoIJ(s)
  const j = STtoIJ(t)
  // now convert from ij
  return fromIJ(face, i, j)
}

export function fromDistance (distance: bigint, level = 30n): bigint {
  level = 2n * (30n - level)
  return (distance << (level + 1n)) + (1n << level)
}

export function fromIJ (face: Face, i: number, j: number, level?: number): bigint {
  const bigFace = BigInt(face)
  let bigI = BigInt(i)
  let bigJ = BigInt(j)
  if (level !== undefined) {
    const levelB = BigInt(level)
    bigI = bigI << (30n - levelB)
    bigJ = bigJ << (30n - levelB)
  }
  let n = bigFace << 60n
  // Alternating faces have opposite Hilbert curve orientations; this
  // is necessary in order for all faces to have a right-handed
  // coordinate system.
  let bits = bigFace & 1n
  // Each iteration maps 4 bits of "i" and "j" into 8 bits of the Hilbert
  // curve position.  The lookup table transforms a 10-bit key of the form
  // "iiiijjjjoo" to a 10-bit value of the form "ppppppppoo", where the
  // letters [ijpo] denote bits of "i", "j", Hilbert curve position, and
  // Hilbert curve orientation respectively.
  for (let k = 7n; k >= 0n; k--) {
    const kk = k * 4n
    bits += ((bigI >> kk) & 15n) << 6n
    bits += ((bigJ >> kk) & 15n) << 2n
    bits = LOOKUP_POS[Number(bits)]
    n |= (bits >> 2n) << (k * 8n)
    bits &= 3n
  }

  const id = n * 2n + 1n

  if (level !== undefined) return parent(id, level)
  return id
}

export function toIJ (id: bigint, level?: number | bigint): [Face, number, number, number] { // [face, i, j, orientation]
  let i = 0n
  let j = 0n
  const face = Number(id >> 61n)
  let bits = BigInt(face) & 1n

  // Each iteration maps 8 bits of the Hilbert curve position into
  // 4 bits of "i" and "j".  The lookup table transforms a key of the
  // form "ppppppppoo" to a value of the form "iiiijjjjoo", where the
  // letters [ijpo] represents bits of "i", "j", the Hilbert curve
  // position, and the Hilbert curve orientation respectively.
  //
  // On the first iteration we need to be careful to clear out the bits
  // representing the cube face.
  for (let k = 7n; k >= 0n; k--) {
    const nbits = (k === 7n) ? 2n : 4n
    bits += (id >> (k * 8n + 1n) & ((1n << (2n * nbits)) - 1n)) << 2n
    bits = LOOKUP_IJ[Number(bits)]
    i += (bits >> 6n) << (k * 4n)
    j += ((bits >> 2n) & 15n) << (k * 4n)
    bits &= 3n
  }

  // adjust bits to the orientation
  const lsb = id & (~id + 1n)
  if ((lsb & 1229782938247303424n) !== 0n) bits ^= 1n

  if (level !== undefined) {
    level = BigInt(level)
    i = i >> (30n - level)
    j = j >> (30n - level)
  }
  return [face as Face, Number(i), Number(j), Number(bits)]
}

export function toST (id: bigint): [Face, number, number] {
  const [face, i, j] = toIJ(id)
  const s = IJtoST(i)
  const t = IJtoST(j)

  return [face, s, t]
}

export function toUV (id: bigint): [Face, number, number] {
  const [face, s, t] = toST(id)
  const u = STtoUV(s)
  const v = STtoUV(t)

  return [face, u, v]
}

export function toLonLat (id: bigint): [number, number] {
  const xyz = toS2Point(id)

  return xyzToLonLat(xyz)
}

export function toS2Point (id: bigint): XYZ {
  return fromS2CellID(id)
}

export function face (id: bigint): Face {
  const face = Number(id >> 61n)
  return face as Face
}

export function isFace (id: bigint): boolean {
  return (id & ((1n << 60n) - 1n)) === 0n
}

export function pos (id: bigint): bigint {
  return id & 2305843009213693951n
}

export function level (id: bigint): number {
  let count = 0

  let i = 0n
  while ((id & (1n << i)) === 0n && i < 60n) {
    i += 2n
    count++
  }

  return 30 - count
}

export function distance (id: bigint, lev?: number): bigint {
  if (lev === undefined) lev = level(id)
  return id >> BigInt(2 * (30 - lev) + 1)
}

export function child (id: bigint, pos: 0n | 1n | 2n | 3n): bigint {
  const newLSB = (id & (~id + 1n)) >> 2n
  return id + (2n * pos - 3n) * newLSB
}

export function children (id: bigint, orientation = 0): [bigint, bigint, bigint, bigint] {
  const childs: [bigint, bigint, bigint, bigint] = [child(id, 0n), child(id, 3n), child(id, 2n), child(id, 1n)]
  if (orientation === 0) {
    const tmp = childs[1]
    childs[1] = childs[3]
    childs[3] = tmp
  }

  return childs
}

// [bottomLeft, bottomRight, topLeft, topRight]
export function childrenIJ (face: Face, level: number, i: number, j: number): [bigint, bigint, bigint, bigint] {
  i = i << 1
  j = j << 1

  return [
    fromIJ(face, i, j, level + 1),
    fromIJ(face, i + 1, j, level + 1),
    fromIJ(face, i, j + 1, level + 1),
    fromIJ(face, i + 1, j + 1, level + 1)
  ]
}

export function childPosition (id: bigint, level: number): number {
  return Number((id >> (2n * (30n - BigInt(level)) + 1n)) & 3n)
}

export function parent (id: bigint, level?: number): bigint {
  const newLSB = (level !== undefined) ? (1n << (2n * (30n - BigInt(level)))) : ((id & (~id + 1n)) << 2n)
  return (id & (~newLSB + 1n)) | newLSB
}

export function range (id: bigint): [bigint, bigint] {
  const lsb = id & (~id + 1n)

  return [
    id - (lsb - 1n),
    id + (lsb - 1n)
  ]
}

export function contains (a: bigint, b: bigint): boolean {
  const [min, max] = range(a)
  return b >= min && b <= max
}

export function intersects (a: bigint, b: bigint): boolean {
  const [aMin, aMax] = range(a)
  const [bMin, bMax] = range(b)
  return bMin <= aMax && bMax >= aMin
}

export function next (id: bigint): bigint {
  const n = id + ((id & (~id + 1n)) << 1n)
  const kWrapOffset = 13835058055282163712n
  if (n < kWrapOffset) return n
  return n - kWrapOffset
}

export function prev (id: bigint): bigint {
  const p = id - ((id & (~id + 1n)) << 1n)
  const kWrapOffset = 13835058055282163712n
  if (p < kWrapOffset) return p
  return p + kWrapOffset
}

export function isLeaf (id: bigint): boolean {
  return (id & 1n) === 1n
}

export function centerST (id: bigint): [number, number, number] {
  const [face, i, j] = toIJ(id)
  const delta = ((id & 1n) !== 0n)
    ? 1
    : (((BigInt(i) ^ (id >> 2n)) & 1n) !== 0n)
        ? 2
        : 0
  // Note that (2 * {i,j} + delta) will never overflow a 32-bit integer.
  const si = 2 * i + delta
  const ti = 2 * j + delta

  return [face, SiTiToST(Number(si)), SiTiToST(Number(ti))]
}

export function boundsST (id: bigint, lev: number): [number, number, number, number] {
  if (lev === undefined) lev = level(id)

  const [, s, t] = centerST(id)
  const halfSize = sizeST(lev) * 0.5

  return [
    s - halfSize,
    t - halfSize,
    s + halfSize,
    t + halfSize
  ]
}

export function sizeST (level: number): number {
  return IJtoST(sizeIJ(level))
}

export function sizeIJ (level: number): number {
  return 1 << (30 - level)
}

export function neighbors (id: bigint): [bigint, bigint, bigint, bigint] {
  const kMaxSize = 1073741824

  const lev = level(id)
  const size = sizeIJ(lev)
  const [face, i, j] = toIJ(id)

  return [
    parent(fromIJSame(face, i, j - size, j - size >= 0), lev),
    parent(fromIJSame(face, i + size, j, i + size < kMaxSize), lev),
    parent(fromIJSame(face, i, j + size, j + size < kMaxSize), lev),
    parent(fromIJSame(face, i - size, j, i - size >= 0), lev)
  ]
}

export function neighborsIJ (face: Face, i: number, j: number, level: number): [bigint, bigint, bigint, bigint] {
  const size = sizeIJ(level)

  return [
    parent(fromIJSame(face, i, j - size, j - size >= 0), level),
    parent(fromIJSame(face, i + size, j, i + size < size), level),
    parent(fromIJSame(face, i, j + size, j + size < size), level),
    parent(fromIJSame(face, i - size, j, i - size >= 0), level)
  ]
}

export function fromIJSame (face: Face, i: number, j: number, sameFace: boolean): bigint {
  if (sameFace) return fromIJ(face, i, j)
  else return fromIJWrap(face, i, j)
}

export function fromIJWrap (face: Face, i: number, j: number): bigint {
  const { max, min } = Math
  const kMaxSize = 1073741824

  // Convert i and j to the coordinates of a leaf cell just beyond the
  // boundary of this face.  This prevents 32-bit overflow in the case
  // of finding the neighbors of a face cell.
  i = max(-1, min(kMaxSize, i))
  j = max(-1, min(kMaxSize, j))

  // We want to wrap these coordinates onto the appropriate adjacent face.
  // The easiest way to do this is to convert the (i,j) coordinates to (x,y,z)
  // (which yields a point outside the normal face boundary), and then call
  // S2::XYZtoFaceUV() to project back onto the correct face.
  //
  // The code below converts (i,j) to (si,ti), and then (si,ti) to (u,v) using
  // the linear projection (u=2*s-1 and v=2*t-1).  (The code further below
  // converts back using the inverse projection, s=0.5*(u+1) and t=0.5*(v+1).
  // Any projection would work here, so we use the simplest.)  We also clamp
  // the (u,v) coordinates so that the point is barely outside the
  // [-1,1]x[-1,1] face rectangle, since otherwise the reprojection step
  // (which divides by the new z coordinate) might change the other
  // coordinates enough so that we end up in the wrong leaf cell.
  const kScale = 1 / kMaxSize
  const kLimit = 1 + 2.2204460492503131e-16
  const u = max(-kLimit, min(kLimit, kScale * (2 * (i - kMaxSize / 2) + 1)))
  const v = max(-kLimit, min(kLimit, kScale * (2 * (j - kMaxSize / 2) + 1)))

  // Find the leaf cell coordinates on the adjacent face, and convert
  // them to a cell id at the appropriate level.
  const [nFace, nU, nV] = XYZtoFaceUV(faceUVtoXYZ(face, u, v))
  return fromIJ(nFace, STtoIJ(0.5 * (nU + 1)), STtoIJ(0.5 * (nV + 1)))
}

export function getLevelFromMeters (meters: number): number {
  const angle = meters / EARTH_RADIUS

  return getLevelFromAngle(angle)
}

// convert radians to level
export function getLevelFromAngle (angle: number): number {
  const { round, log2, abs, max, min } = Math
  const lev = round(log2(abs(0.9428090415820635 / angle)))

  return max(0, min(30, lev))
}

// convert s2CellID "point" and a radius into s2CellID lookup "tiles"
export function getCover (s2CellID: bigint, radius: number): bigint[] {
  const level = getLevelFromMeters(radius)

  return vertexNeighbors(s2CellID, level)
}

export function vertexNeighbors (id: bigint, lev?: number): bigint[] {
  if (lev === undefined) lev = level(id)
  const kMaxSize = 1073741824
  const res = []

  const [face, i, j] = toIJ(id)

  // Determine the i- and j-offsets to the closest neighboring cell in each
  // direction.  This involves looking at the next bit of "i" and "j" to
  // determine which quadrant of this->parent(level) this cell lies in.
  const halfsize = sizeIJ(lev + 1)
  const size = halfsize << 1
  let isame, jsame, ioffset, joffset

  if ((i & halfsize) !== 0) {
    ioffset = size
    isame = (i + size) < kMaxSize
  } else {
    ioffset = -size
    isame = (i - size) >= 0
  }
  if ((j & halfsize) !== 0) {
    joffset = size
    jsame = (j + size) < kMaxSize
  } else {
    joffset = -size
    jsame = (j - size) >= 0
  }

  res.push(parent(id, lev))
  res.push(parent(fromIJSame(face, i + ioffset, j, isame), lev))
  res.push(parent(fromIJSame(face, i, j + joffset, jsame), lev))
  if (isame || jsame) res.push(parent(fromIJSame(face, i + ioffset, j + joffset, isame && jsame), lev))

  return res
}

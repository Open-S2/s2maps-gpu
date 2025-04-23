import { degToRad, radToDeg } from '../util.js';

import type { LonLat } from '../ll/index.js';
import type { BBox, Face, MValue, Point, Properties, VectorPoint } from '../index.js';

export const K_LIMIT_IJ = 1073741824; // 1 << 30;

/**
 * Convert a [0, 1] to a [-1, 1] in a linear fashion
 * @param s - input S or T coordinate
 * @returns output U or V coordinate
 */
export function linearSTtoUV(s: number): number {
  return 2 * s - 1;
}

/**
 * Convert a [-1, 1] to a [0, 1] in a linear fashion
 * @param u - input U or V coordinate
 * @returns output S or T coordinate
 */
export function linearUVtoST(u: number): number {
  return 0.5 * (u + 1);
}

/**
 * Convert a [0, 1] to a [-1, 1] in a tangential fashion
 * @param s - input S or T coordinate
 * @returns output U or V coordinate
 */
export function tanSTtoUV(s: number): number {
  const { PI, tan } = Math;
  return tan((PI / 2) * s - PI / 4);
}

/**
 * Convert a [-1, 1] to a [0, 1] in a tangential fashion
 * @param u - input U or V coordinate
 * @returns output S or T coordinate
 */
export function tanUVtoST(u: number): number {
  const { PI, atan } = Math;
  return 2 * (1 / PI) * (atan(u) + PI / 4);
}

/**
 * Convert a [0, 1] to a [-1, 1] in a quadratic fashion
 * @param s - input S or T coordinate
 * @returns output U or V coordinate
 */
export function quadraticSTtoUV(s: number): number {
  if (s >= 0.5) return (1 / 3) * (4 * s * s - 1);
  return (1 / 3) * (1 - 4 * (1 - s) * (1 - s));
}

/**
 * Convert a [-1, 1] to a [0, 1] in a quadratic fashion
 * @param u - input U or V coordinate
 * @returns output S or T coordinate
 */
export function quadraticUVtoST(u: number): number {
  const { sqrt } = Math;
  if (u >= 0) return 0.5 * sqrt(1 + 3 * u);
  return 1 - 0.5 * sqrt(1 - 3 * u);
}

/**
 * Convert from st space to ij space (ij are whole numbers ranging an entire u30)
 * @param s - input S or T
 * @returns output I or J
 */
export function STtoIJ(s: number): number {
  const { max, min, floor } = Math;
  return max(0, min(K_LIMIT_IJ - 1, floor(K_LIMIT_IJ * s)));
}

/**
 * Convert from ij space to st space (ij are whole numbers ranging an entire u30)
 * @param i - input I or J
 * @returns output S or T
 */
export function IJtoST(i: number): number {
  return i / K_LIMIT_IJ;
}

/**
 * Convert SiTi to ST.
 * @param si - input Si or Ti
 * @returns output S or T
 */
export function SiTiToST(si: number): number {
  return (1 / 2_147_483_648) * si;
}

/**
 * Convert a face-u-v coords to left-hand-rule XYZ Point coords
 * @param face - input face
 * @param u - input u
 * @param v - input v
 * @param m - m-value data
 * @returns output
 */
export function faceUVtoXYZ<M extends MValue = Properties>(
  face: Face,
  u: number,
  v: number,
  m?: M,
): VectorPoint<M> {
  switch (face) {
    case 0:
      return { x: 1, y: u, z: v, m };
    case 1:
      return { x: -u, y: 1, z: v, m };
    case 2:
      return { x: -u, y: -v, z: 1, m };
    case 3:
      return { x: -1, y: -v, z: -u, m };
    case 4:
      return { x: v, y: -1, z: -u, m };
    default:
      return { x: v, y: u, z: -1, m };
  }
}

/**
 * Convert a face-u-v coords to right-hand-rule XYZ Point coords
 * @param face - input face
 * @param u - input u
 * @param v - input v
 * @param m - M-Value data
 * @returns output
 */
export function faceUVtoXYZGL<M extends MValue = Properties>(
  face: Face,
  u: number,
  v: number,
  m?: M,
): VectorPoint<M> {
  switch (face) {
    case 0:
      return { x: u, y: v, z: 1, m };
    case 1:
      return { x: 1, y: v, z: -u, m };
    case 2:
      return { x: -v, y: 1, z: -u, m };
    case 3:
      return { x: -v, y: -u, z: -1, m };
    case 4:
      return { x: -1, y: -u, z: v, m };
    default:
      return { x: u, y: -1, z: v, m };
  }
}

/**
 * Convert from a face and left-hand-rule XYZ Point to u-v coords
 * @param face - input face
 * @param xyz - input
 * @returns output
 */
export function faceXYZtoUV(face: Face, xyz: VectorPoint): [u: number, v: number] {
  const { x, y, z = 1 } = xyz;

  switch (face) {
    case 0:
      return [y / x, z / x];
    case 1:
      return [-x / y, z / y];
    case 2:
      return [-x / z, -y / z];
    case 3:
      return [z / x, y / x];
    case 4:
      return [z / y, -x / y];
    default:
      return [-y / z, -x / z];
  }
}

/**
 * Find the face the point is located at
 * @param xyz - point3D input
 * @returns - outputs the associated face
 */
export function XYZtoFace(xyz: VectorPoint): Face {
  const xyzArr = [xyz.x, xyz.y, xyz.z ?? 1];
  const temp = xyzArr.map((n: number): number => Math.abs(n));

  let face: number = temp[0] > temp[1] ? (temp[0] > temp[2] ? 0 : 2) : temp[1] > temp[2] ? 1 : 2;
  if (xyzArr[face] < 0) face += 3;

  return face as Face;
}

/**
 * Convert from an left-hand-rule XYZ Point to a Face-U-V coordinate
 * @param xyz - point3D input
 * @returns output's a face, u, and v
 */
export function XYZtoFaceUV<M extends MValue = Properties>(
  xyz: VectorPoint<M>,
): [face: Face, u: number, v: number] {
  const face = XYZtoFace(xyz);
  return [face, ...faceXYZtoUV(face, xyz)];
}

/**
 * Convert from a face and right-hand-rule XYZ Point to u-v coords
 * @param face - input face
 * @param xyz - input VectorPoint
 * @returns output WebGL oriented UV coords
 */
export function faceXYZGLtoUV<M extends MValue = Properties>(
  face: number,
  xyz: VectorPoint<M>,
): [u: number, v: number] {
  const { x, y, z = 1 } = xyz;

  switch (face) {
    case 0:
      return [x / z, y / z];
    case 1:
      return [-z / x, y / x];
    case 2:
      return [-z / y, -x / y];
    case 3:
      return [y / z, x / z];
    case 4:
      return [y / x, -z / x];
    default:
      return [-x / y, -z / y];
  }
}

/**
 * Convert from an left-hand-rule XYZ Point to a lon-lat coord
 * @param xyz - point3D input
 * @returns - lon-lat coordinates
 */
export function xyzToLonLat<M extends MValue = Properties>(xyz: VectorPoint<M>): LonLat<M> {
  const { atan2, sqrt } = Math;
  const { x, y, z = 1, m } = xyz;

  return { x: radToDeg(atan2(y, x)), y: radToDeg(atan2(z, sqrt(x * x + y * y))), m };
}

/**
 * Convert from a lon-lat coord to an left-hand-rule XYZ Point
 * @param ll - lon-lat vector point
 * @returns - VectorPoint
 */
export function lonLatToXYZ<M extends MValue = Properties>(ll: VectorPoint<M>): VectorPoint<M> {
  let { x: lon, y: lat } = ll;
  const { sin, cos } = Math;
  lon = degToRad(lon);
  lat = degToRad(lat);
  return {
    x: cos(lat) * cos(lon), // x
    y: cos(lat) * sin(lon), // y
    z: sin(lat), // z
    m: ll.m,
  };
}

/**
 * Convert from a lon-lat coord to an right-hand-rule XYZ Point
 * @param ll - lon-lat vector point
 * @returns - WebGL oriented VectorPoint
 */
export function lonLatToXYZGL<M extends MValue = Properties>(ll: VectorPoint<M>): VectorPoint<M> {
  let { x: lon, y: lat } = ll;
  const { sin, cos } = Math;
  lon = degToRad(lon);
  lat = degToRad(lat);
  return {
    x: cos(lat) * sin(lon), // y
    y: sin(lat), // z
    z: cos(lat) * cos(lon), // x
    m: ll.m,
  };
}

/**
 * Convert an u-v-zoom coordinate to a tile coordinate
 * @param u - u coordinate
 * @param v - v coordinate
 * @param zoom - zoom level
 * @returns - tile X-Y coordinate
 */
export function tileXYFromUVZoom(u: number, v: number, zoom: number): Point {
  return tileXYFromSTZoom(quadraticUVtoST(u), quadraticUVtoST(v), zoom);
}

/**
 * Convert an x-y-zoom coordinate to a tile coordinate
 * @param x - x coordinate
 * @param y - y coordinate
 * @param zoom - zoom level
 * @returns - tile X-Y coordinate
 */
export function tileXYFromSTZoom(x: number, y: number, zoom: number): Point {
  const { floor } = Math;
  const divisionFactor = (2 / (1 << zoom)) * 0.5;

  return [floor(x / divisionFactor), floor(y / divisionFactor)];
}

/**
 * Given a quad-based tile schema of "zoom-x-y", get the local UV bounds of said tile.
 * @param u - u coordinate
 * @param v - v coordinate
 * @param zoom - zoom level
 * @returns - local UV bounds for the tile
 */
export function bboxUV(u: number, v: number, zoom: number): BBox {
  const divisionFactor = 2 / (1 << zoom);

  return [
    divisionFactor * u - 1,
    divisionFactor * v - 1,
    divisionFactor * (u + 1) - 1,
    divisionFactor * (v + 1) - 1,
  ];
}

/**
 * Given a quad-based tile schema of "zoom-x-y", get the local ST bounds of said tile.
 * @param s - s coordinate
 * @param t - t coordinate
 * @param zoom - zoom level
 * @returns - local ST bounds for the tile
 */
export function bboxST(s: number, t: number, zoom: number): BBox {
  const divisionFactor = (2 / (1 << zoom)) * 0.5;

  return [
    divisionFactor * s,
    divisionFactor * t,
    divisionFactor * (s + 1),
    divisionFactor * (t + 1),
  ];
}

/**
 * Find the face-i-j coordinates of neighbors for a specific face-i-j coordinate.
 * Define an adjusted level (zoom) for the i-j coordinates. The level is 30 by default.
 * @param face - face of the cell
 * @param i - i coordinate
 * @param j - j coordinate
 * @param level - zoom level
 * @returns - Face-i-j coordinates
 */
export function getNeighborsIJ(
  face: Face,
  i: number,
  j: number,
  level = 30,
): [face: Face, i: number, j: number][] {
  const size = 1 << (30 - level);

  if (level !== 30) {
    i = i << (30 - level);
    j = j << (30 - level);
  }

  return [
    fromIJWrap(face, i, j - size, level, j - size >= 0),
    fromIJWrap(face, i + size, j, level, i + size < size),
    fromIJWrap(face, i, j + size, level, j + size < size),
    fromIJWrap(face, i - size, j, level, i - size >= 0),
  ];
}

/**
 * Adjust a manipulated face-i-j coordinate to a legal one if necessary.
 * @param face - face of the cell
 * @param i - i coordinate
 * @param j - j coordinate
 * @param level - zoom level
 * @param sameFace - if the face should be the same
 * @returns - Face-i-j coordinates
 */
function fromIJWrap(
  face: Face,
  i: number,
  j: number,
  level: number,
  sameFace = false,
): [face: Face, i: number, j: number] {
  if (sameFace) return [face, i >> (30 - level), j >> (30 - level)];
  const { max, min } = Math;
  const kMaxSize = 1073741824;

  i = max(-1, min(kMaxSize, i));
  j = max(-1, min(kMaxSize, j));

  const kScale = 1 / kMaxSize;
  const kLimit = 1 + 2.2204460492503131e-16;
  const u = max(-kLimit, min(kLimit, kScale * (2 * (i - kMaxSize / 2) + 1)));
  const v = max(-kLimit, min(kLimit, kScale * (2 * (j - kMaxSize / 2) + 1)));

  const [nFace, nU, nV] = XYZtoFaceUV(faceUVtoXYZ(face, u, v));
  return [nFace, STtoIJ(0.5 * (nU + 1)) >> (30 - level), STtoIJ(0.5 * (nV + 1)) >> (30 - level)];
}

/**
 * Return the right-handed normal (not necessarily unit length) for an
 * edge in the direction of the positive v-axis at the given u-value on
 * the given face.  (This vector is perpendicular to the plane through
 * the sphere origin that contains the given edge.)
 * @param face - face
 * @param u - u
 * @returns - the 3D vector normal relative to the u
 */
export function getUNorm(face: Face, u: number): VectorPoint {
  if (face === 0) return { x: u, y: -1.0, z: 0.0 };
  if (face === 1) return { x: 1.0, y: u, z: 0.0 };
  if (face === 2) return { x: 1.0, y: 0.0, z: u };
  if (face === 3) return { x: -u, y: 0.0, z: 1.0 };
  if (face === 4) return { x: 0.0, y: -u, z: 1.0 };
  return { x: 0.0, y: -1, z: -u };
}

/**
 * Return the right-handed normal (not necessarily unit length) for an
 * edge in the direction of the positive u-axis at the given v-value on
 * the given face.
 * @param face - face
 * @param v - v
 * @returns - the 3D vector normal relative to the v
 */
export function getVNorm(face: Face, v: number): VectorPoint {
  if (face === 0) return { x: -v, y: 0.0, z: 1.0 };
  if (face === 1) return { x: 0.0, y: -v, z: 1.0 };
  if (face === 2) return { x: 0.0, y: -1.0, z: -v };
  if (face === 3) return { x: v, y: -1.0, z: 0.0 };
  if (face === 4) return { x: 1.0, y: v, z: 0.0 };
  return { x: 1.0, y: 0.0, z: v };
}

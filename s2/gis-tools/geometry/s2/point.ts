import { EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR } from '../../space/planets/index.js';
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
  xyzToLonLat,
} from './coords.js';
import { idFromS2Point, idToUV } from '../id.js';

import type { S1Angle } from '../s1/angle.js';
import type { Face, MValue, Properties, S2CellId, VectorPoint } from '../index.js';

/**
 * Convert a lon-lat coord to an XYZ Point using the left-hand-rule
 * @param ll - LonLat vector point in degrees
 * @returns The XYZ Point
 */
export function pointFromLonLat<M extends MValue = Properties>(ll: VectorPoint<M>): VectorPoint<M> {
  return lonLatToXYZ(ll);
}

/**
 * Convert a lon-lat coord to an XYZ Point using the right-hand-rule.
 * This function takes longitude and latitude as input and returns the corresponding XYZ coordinates.
 * @param ll - LonLat vector point in degrees
 * @returns The XYZ Point representing the provided longitude and latitude.
 */
export function pointFromLonLatGL<M extends MValue = Properties>(
  ll: VectorPoint<M>,
): VectorPoint<M> {
  // Convert longitude and latitude to XYZ coordinates using the right-hand rule.
  return lonLatToXYZGL(ll);
}

/**
 * Convert a u-v coordinate to an XYZ Point.
 * @param face - The face of the S2 cell.
 * @param u - The u-coordinate on the face.
 * @param v - The v-coordinate on the face.
 * @param m - M-Value data
 * @returns The XYZ Point representing the given u-v coordinates.
 */
export function pointFromUV<M extends MValue = Properties>(
  face: Face,
  u: number,
  v: number,
  m?: M,
): VectorPoint<M> {
  // Convert the given u-v coordinates to an XYZ Point using the left-hand rule.
  return pointNormalize(faceUVtoXYZ(face, u, v, m));
}

/**
 * Convert an s-t coordinate to an XYZ Point.
 * @param face - The face of the S2 cell.
 * @param s - The s-coordinate on the face.
 * @param t - The t-coordinate on the face.
 * @param m - M-Value data
 * @returns The XYZ Point representing the given s-t coordinates.
 */
export function pointFromST<M extends MValue = Properties>(
  face: Face,
  s: number,
  t: number,
  m?: M,
): VectorPoint<M> {
  // Convert the given s-t coordinates to u-v coordinates.
  const u = STtoUV(s);
  const v = STtoUV(t);

  // Convert the u-v coordinates to an XYZ Point.
  return pointFromUV(face, u, v, m);
}

/**
 * Convert an i-j coordinate to an XYZ Point.
 * @param face - The face of the S2 cell.
 * @param i - The i-coordinate on the face.
 * @param j - The j-coordinate on the face.
 * @returns The XYZ Point representing the given i-j coordinates.
 */
export function pointFromIJ(face: Face, i: number, j: number): VectorPoint {
  // Convert the given i-j coordinates to s-t coordinates.
  const s = IJtoST(i);
  const t = IJtoST(j);

  // Convert the s-t coordinates to an XYZ Point.
  return pointFromST(face, s, t);
}

/**
 * Convert an S2CellID to an XYZ Point.
 * @param id - The S2CellID to convert.
 * @returns The XYZ Point representing the given S2CellID.
 */
export function pointFromS2CellID(id: S2CellId): VectorPoint {
  // Decompose the S2CellID into its constituent parts: face, u, and v.
  const [face, u, v] = idToUV(id);

  // Use the decomposed parts to construct an XYZ Point.
  return pointNormalize(pointFromUV(face, u, v));
}

/**
 * Convert an Face-U-V coord to an XYZ Point using the right-hand-rule
 * @param face - The face of the S2 cell.
 * @param u - The u-coordinate on the face.
 * @param v - The v-coordinate on the face.
 * @returns The XYZ Point representing the given Face-U-V coordinates.
 */
export function pointFromUVGL(face: Face, u: number, v: number): VectorPoint {
  // Convert the given Face-U-V coordinates to an XYZ Point using the right-hand rule.
  return pointNormalize(faceUVtoXYZGL(face, u, v));
}

/**
 * Convert an Face-S-T coord to an XYZ Point using the right-hand-rule
 * @param face - The face of the S2 cell.
 * @param s - The s-coordinate on the face.
 * @param t - The t-coordinate on the face.
 * @returns The XYZ Point representing the given Face-S-T coordinates.
 */
export function pointFromSTGL(face: Face, s: number, t: number): VectorPoint {
  // Convert the given Face-S-T coordinates to an XYZ Point using the right-hand rule.
  // First, convert the s-t coordinates to u-v coordinates.
  const [u, v] = [STtoUV(s), STtoUV(t)];

  // Then, convert the u-v coordinates to an XYZ Point.
  return pointFromUVGL(face, u, v);
}

/**
 * Convert an XYZ Point to a Face-U-V coord
 * @param xyz - The XYZ Point to convert.
 * @returns - The Face-U-V coordinates representing the given XYZ Point.
 */
export function pointToUV(xyz: VectorPoint): [face: Face, u: number, v: number] {
  // Convert the given XYZ Point to Face-U-V coordinates using the right-hand rule.
  return XYZtoFaceUV(xyz);
}

/**
 * Convert an XYZ Point to a Face-S-T coord
 * @param xyz - The XYZ Point to convert.
 * @returns - The Face-S-T coordinates representing the given XYZ Point.
 */
export function pointToST(xyz: VectorPoint): [face: Face, s: number, t: number] {
  // Convert the given XYZ Point to Face-U-V coordinates.
  const [face, u, v] = pointToUV(xyz);

  // Convert the U-V coordinates to S-T coordinates using the inverse of the
  // UVtoST function.
  return [face, UVtoST(u), UVtoST(v)];
}

/**
 * Convert an XYZ Point to a Face-I-J coord
 * @param xyz - The XYZ Point to convert.
 * @param level - The zoom level of the result. If not provided, the result will have 30 bits of precision.
 * @returns The Face-I-J coordinates representing the given XYZ Point.
 */
export function pointToIJ(xyz: VectorPoint, level?: number): [face: Face, i: number, j: number] {
  // Convert the given XYZ Point to Face-S-T coordinates.
  const [face, s, t] = pointToST(xyz);

  // Convert the S-T coordinates to I-J coordinates using the STtoIJ function.
  let i = STtoIJ(s);
  let j = STtoIJ(t);

  // If a level is provided, shift the I-J coordinates to the right by (30 - level) bits.
  if (level !== undefined) {
    i = i >> (30 - level);
    j = j >> (30 - level);
  }

  // Return the Face-I-J coordinates.
  return [face, i, j];
}

/**
 * Convert an XYZ Point to a lon-lat coord
 * @param xyz - The XYZ Point to convert.
 * @returns The lon-lat coordinates representing the given XYZ Point.
 */
export function pointToLonLat<M extends MValue = Properties>(xyz: VectorPoint<M>): VectorPoint<M> {
  return xyzToLonLat(xyz);
}

/**
 * Convert an XYZ Point to an S2CellID
 * @param xyz - The XYZ Point to convert.
 * @returns The S2CellID representing the given XYZ Point.
 */
export function pointToS2CellID(xyz: VectorPoint): S2CellId {
  return idFromS2Point(xyz);
}

/**
 * Take an XYZ Point and add another XYZ Point to it
 * @param a - The XYZ Point to add to.
 * @param b - The XYZ Point to add.
 * @returns - The XYZ Point with the added XYZ Point.
 */
export function pointAdd(a: VectorPoint, b: VectorPoint): VectorPoint {
  return { x: a.x + b.x, y: a.y + b.y, z: (a.z ?? 0) + (b.z ?? 0) };
}

/**
 * Take an XYZ Point and add another XYZ Point to it
 * @param a - The XYZ Point to add to.
 * @param b - The XYZ Point to add.
 */
export function pointAddMut(a: VectorPoint, b: VectorPoint): void {
  a.x += b.x;
  a.y += b.y;
  if (a.z === undefined || b.z === undefined) return;
  a.z += b.z;
}

/**
 * Take an XYZ Point and add an n to each component
 * @param xyz - The XYZ Point to add to.
 * @param n - The amount to add.
 * @returns - The XYZ Point with the added amount.
 */
export function pointAddScalar(xyz: VectorPoint, n: number): VectorPoint {
  return { x: xyz.x + n, y: xyz.y + n, z: (xyz.z ?? 0) + n };
}

/**
 * Take an XYZ Point and subtract another XYZ Point from it
 * @param a - The XYZ Point to subtract from.
 * @param b - The XYZ Point to subtract.
 * @returns - The XYZ Point with the subtracted XYZ Point.
 */
export function pointSub(a: VectorPoint, b: VectorPoint): VectorPoint {
  return { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
}

/**
 * Take an XYZ Point and subtract an n from each component
 * @param xyz - The XYZ Point to subtract from.
 * @param n - The amount to subtract.
 * @returns - The XYZ Point with the subtracted amount.
 */
export function pointSubScalar(xyz: VectorPoint, n: number): VectorPoint {
  return { x: xyz.x - n, y: xyz.y - n, z: (xyz.z ?? 0) - n };
}

/**
 * Take an XYZ Point and multiply it by another XYZ Point
 * @param a - The XYZ Point to multiply.
 * @param b - The XYZ Point to multiply.
 * @returns - The XYZ Point with the multiplied XYZ Point.
 */
export function pointMul(a: VectorPoint, b: VectorPoint): VectorPoint {
  return { x: a.x * b.x, y: a.y * b.y, z: (a.z ?? 0) * (b.z ?? 0) };
}

/**
 * Take an XYZ Point and multiply each component by n
 * @param xyz - The XYZ Point to multiply.
 * @param n - The amount to multiply.
 * @returns - The XYZ Point with the multiplied amount.
 */
export function pointMulScalar(xyz: VectorPoint, n: number): VectorPoint {
  return { x: xyz.x * n, y: xyz.y * n, z: (xyz.z ?? 0) * n };
}

/**
 * Take an XYZ Point and divide it by another XYZ Point
 * @param a - The XYZ Point to divide.
 * @param b - The XYZ Point to divide by.
 * @returns - The XYZ Point with the multiplied XYZ Point.
 */
export function pointDiv(a: VectorPoint, b: VectorPoint): VectorPoint {
  return { x: a.x / b.x, y: a.y / b.y, z: (a.z ?? 0) / (b.z ?? 0) };
}

/**
 * Take an XYZ Point and divide each component by n
 * @param xyz - The XYZ Point to divide.
 * @param n - The amount to divide by.
 * @returns - The XYZ Point with the multiplied amount.
 */
export function pointDivScalar(xyz: VectorPoint, n: number): VectorPoint {
  return { x: xyz.x / n, y: xyz.y / n, z: (xyz.z ?? 0) / n };
}

/**
 * Take an XYZ Point and divide each component by n
 * @param xyz - The XYZ Point to divide.
 * @param n - The amount to divide by.
 */
export function pointDivMutScalar(xyz: VectorPoint, n: number) {
  xyz.x /= n;
  xyz.y /= n;
  if (xyz.z !== undefined) xyz.z /= n;
}

/**
 * Take an XYZ Point and divide each component by its length
 * @param xyz - The XYZ Point to divide.
 * @returns - The XYZ Point with the divided amount.
 */
export function pointNormalize<M extends MValue = Properties>(xyz: VectorPoint<M>): VectorPoint<M> {
  const len = pointLength(xyz);
  xyz.x /= len;
  xyz.y /= len;
  if (xyz.z !== undefined) xyz.z /= len;

  return xyz;
}

/**
 * Get the length of the XYZ Point
 * @param xyz - The XYZ Point
 * @returns - The length of the XYZ Point
 */
export function pointLength(xyz: VectorPoint): number {
  return Math.sqrt(pointNorm2(xyz));
}

/**
 * Get the squared length of the XYZ Point with itself
 * @param xyz - The XYZ Point
 * @returns - The squared length of the XYZ Point
 */
export function pointNorm2(xyz: VectorPoint): number {
  return pointDot(xyz, xyz);
}

/**
 * Invert the XYZ Point
 * @param xyz - The XYZ Point
 * @returns - The inverted XYZ Point
 */
export function pointInvert<M extends MValue = Properties>(xyz: VectorPoint<M>): VectorPoint<M> {
  const { x, y, z, m } = xyz;
  return { x: -x, y: -y, z: -(z ?? 0), m };
}

/**
 * dot returns the standard dot product of a and b.
 * @param a - The first XYZ Point
 * @param b - The second XYZ Point
 * @returns - The dot product of the two XYZ Points
 */
export function pointDot(a: VectorPoint, b: VectorPoint): number {
  return a.x * b.x + a.y * b.y + (a.z ?? 0) * (b.z ?? 0);
}

/**
 * Get the cross product of two XYZ Points
 * @param a - The first XYZ Point
 * @param b - The second XYZ Point
 * @returns - The cross product of the two XYZ Points
 */
export function pointCross(a: VectorPoint, b: VectorPoint): VectorPoint {
  const az = a.z ?? 0;
  const bz = b.z ?? 0;
  return { x: a.y * bz - az * b.y, y: az * b.x - a.x * bz, z: a.x * b.y - a.y * b.x };
}

/**
 * Get the distance between two XYZ Points using Earth's size
 * @param a - The first XYZ Point
 * @param b - The second XYZ Point
 * @param equatorial - The equatorial radius (default: EARTH_RADIUS_EQUATORIAL)
 * @param polar - The polar radius (default: EARTH_RADIUS_POLAR)
 * @returns - The distance between the two XYZ Points
 */
export function pointDistancePlanet(
  a: VectorPoint,
  b: VectorPoint,
  equatorial = EARTH_RADIUS_EQUATORIAL,
  polar = EARTH_RADIUS_POLAR,
): number {
  a.x *= equatorial;
  b.x *= equatorial;
  a.y *= equatorial;
  b.y *= equatorial;
  if (a.z !== undefined) a.z *= polar;
  if (b.z !== undefined) b.z *= polar;

  return pointDistance(a, b);
}

/**
 * Get the distance between two XYZ Points
 * @param a - The first XYZ Point
 * @param b - The second XYZ Point
 * @returns - The raw distance between the two XYZ Points. Highly inaccurate for large distances
 */
export function pointDistance(a: VectorPoint, b: VectorPoint): number {
  const { sqrt, pow } = Math;

  return sqrt(pow(b.x - a.x, 2) + pow(b.y - a.y, 2) + pow((b.z ?? 0) - (a.z ?? 0), 2));
}

/**
 * @param a - The first XYZ Point
 * @param b - The second XYZ Point
 * @returns - The angle between the two XYZ Points
 */
export function pointAngle(a: VectorPoint, b: VectorPoint): S1Angle {
  return Math.atan2(pointLength(pointCross(a, b)), pointDot(a, b));
}

/**
 * Find the S2 Hilbert Face of the XYZ Point [0, 6)
 * @param xyz - The XYZ Point
 * @returns - The S2 Hilbert Face
 */
export function pointGetFace(xyz: VectorPoint): number {
  return XYZtoFace(xyz);
}

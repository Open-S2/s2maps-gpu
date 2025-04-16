import { lonLatToXYZ } from '../s2/coords.js';
import { degToRad, radToDeg } from '../util.js';

import type { S1Angle } from '../s1/angle.js';
import type { MValue, Properties, VectorPoint } from '../index.js';

/** Just another way of defining a standard 2D point. */
export type LonLat<M extends MValue = Properties> = VectorPoint<M>;

/**
 * Converts an LonLat to the equivalent unit-length vector.  Unnormalized
 * values (see Normalize()) are wrapped around the sphere as would be expected
 * based on their definition as spherical angles.  So for example the
 * following pairs yield equivalent points (modulo numerical error):
 *     (90.5, 10) =~ (89.5, -170)
 *     (a, b) =~ (a + 360 * n, b)
 * The maximum error in the result is 1.5 * DBL_EPSILON.  (This does not
 * include the error of converting degrees, E5, E6, or E7 to radians.)
 *
 * Can be used just like an S2Point constructor.  For example:
 *   S2Cap cap;
 *   cap.AddPoint(S2Point(latlon));
 * @param ll - input LonLat
 * @returns - equivalent unit-length vector 3D point
 */
export function llToS2Point<M extends MValue = Properties>(ll: LonLat<M>): VectorPoint<M> {
  return lonLatToXYZ(ll);
}

/**
 * Convert a direction vector (not necessarily unit length) to an LonLat.
 * @param p - input direction vector
 * @returns - LonLat
 */
export function llFromS2Point<M extends MValue = Properties>(p: VectorPoint<M>): LonLat<M> {
  const { atan2, sqrt } = Math;
  const { x, y, z = 1, m } = p;

  return { x: radToDeg(atan2(y, x)), y: radToDeg(atan2(z, sqrt(x * x + y * y))), m };
}

/**
 * Converts an LonLat to the equivalent spherical angles.
 * @param ll - input LonLat
 * @returns a lon-lat in radians
 */
export function llToAngles(ll: LonLat): [S1Angle, S1Angle] {
  return [ll.x, ll.y].map(degToRad) as [S1Angle, S1Angle];
}

/**
 * Ensures that lon is in [-180, 180] and lat is in [-90, 90]. Updates the input in place
 * @param ll - input lon-lat in degrees
 * @returns - the input lon-lat but normalized
 */
export function llNormalize<M extends MValue = Properties>(ll: LonLat<M>): LonLat<M> {
  let { x: lon, y: lat } = ll;
  // Normalize longitude using modulo
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  // Clamp latitude between -90 and 90
  lat = Math.max(-90, Math.min(90, lat));

  ll.x = lon;
  ll.y = lat;

  return ll;
}

/**
 * Returns the distance (measured along the surface of the sphere) to the
 * given LonLat, implemented using the Haversine formula.  This is
 * equivalent to
 *
 *   S1Angle(ToPoint(), o.ToPoint())
 *
 * except that this function is slightly faster, and is also somewhat less
 * accurate for distances approaching 180 degrees (see s1angle.h for
 * details).  Both LngLats must be normalized.
 * @param a - input LonLat
 * @param b - input LonLat
 * @returns - distance in radians
 */
export function llGetDistance(a: LonLat, b: LonLat): number {
  const { asin, sin, cos, sqrt, min } = Math;
  // This implements the Haversine formula, which is numerically stable for
  // small distances but only gets about 8 digits of precision for very large
  // distances (e.g. antipodal points).  Note that 8 digits is still accurate
  // to within about 10cm for a sphere the size of the Earth.
  //
  // This could be fixed with another sin() and cos() below, but at that point
  // you might as well just convert both arguments to S2Points and compute the
  // distance that way (which gives about 15 digits of accuracy for all
  // distances).
  let { x: lonA, y: latA } = a;
  let { x: lonB, y: latB } = b;
  // conver all to radians
  lonA = degToRad(lonA);
  latA = degToRad(latA);
  lonB = degToRad(lonB);
  latB = degToRad(latB);
  const dlat = sin(0.5 * (latB - latA));
  const dlon = sin(0.5 * (lonB - lonA));
  const x = dlat * dlat + dlon * dlon * cos(latA) * cos(latB);
  return 2 * asin(sqrt(min(1, x)));
}

/**
 * Returns the bearing from the first point to the second point.
 * @param a - first LonLat
 * @param b - second LonLat to find the bearing to
 * @returns - bearing in degrees
 */
export function llGetBearing(a: LonLat, b: LonLat): number {
  const { atan2, sin, cos } = Math;
  let { x: lonA, y: latA } = a;
  let { x: lonB, y: latB } = b;
  // conver all to radians
  lonA = degToRad(lonA);
  latA = degToRad(latA);
  lonB = degToRad(lonB);
  latB = degToRad(latB);
  const y = sin(lonB - lonA) * cos(latB);
  const x = cos(latA) * sin(latB) - sin(latA) * cos(latB) * cos(lonB - lonA);
  return (radToDeg(atan2(y, x)) + 360) % 360;
}

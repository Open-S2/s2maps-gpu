import { MAXLAT, llToPX, pxToLL } from 'gis-tools';

import type { VectorPoint } from 'gis-tools';

// https://github.com/proj4js/proj4js/blob/master/lib/projections/ortho.js
const EPSLN = 1.0e-10;
const D2R = 0.017453292519943295;
const R2D = 57.29577951308232;

/**
 * Get the longitude and latitude of the cursor position in the S2 Geometry Projection.
 * centerLon and centerlat is where the center of the sphere is currently located
 * x is the distance from center
 * @param centerLon - center longitude
 * @param centerLat - center latitude
 * @param xOffset - distance from center
 * @param yOffset - distance from center
 * @param radius - the radius of the sphere
 * @returns longitude and latitude
 */
export function cursorToLonLatS2(
  centerLon: number,
  centerLat: number,
  xOffset: number,
  yOffset: number,
  radius: number,
): undefined | VectorPoint {
  // pre adjust to radians
  centerLon *= D2R;
  centerLat *= D2R;
  // prep
  const { PI, sqrt, sin, cos, abs, atan2 } = Math;
  const rh = sqrt(xOffset * xOffset + yOffset * yOffset);
  // corner case, the x+y is too far
  if (rh > radius) return;
  const z = asinz(rh / radius);
  const sinP14 = sin(centerLat);
  const cosP14 = cos(centerLat);
  const sinz = sin(z);
  const cosz = cos(z);
  let lon = centerLon;
  let lat = centerLat;
  const con = abs(centerLat) - PI / 2;
  // corner case: basically on the dot center
  if (abs(rh) <= EPSLN) return { x: lon * R2D, y: lat * R2D };
  // build lat
  lat = asinz(cosz * sinP14 + (yOffset * sinz * cosP14) / rh);
  // negative angles
  if (abs(con) <= EPSLN) {
    if (centerLat >= 0) lon = adjustLon(centerLon + atan2(xOffset, -yOffset));
    else lon = adjustLon(centerLon - atan2(-xOffset, yOffset));
  } else {
    // positive angles
    lon = adjustLon(
      centerLon + atan2(xOffset * sinz, rh * cosP14 * cosz - yOffset * sinP14 * sinz),
    );
  }
  return { x: lon * R2D, y: lat * R2D };
}

/**
 * Get the longitude and latitude of the cursor position in the web mercator projection.
 * @param lon - center longitude
 * @param lat - center latitude
 * @param xOffset - x offset
 * @param yOffset - y offset
 * @param zoom - zoom
 * @param tileSize - tile size
 * @returns longitude and latitude
 */
export function cursorToLonLatWM(
  lon: number,
  lat: number,
  xOffset: number,
  yOffset: number,
  zoom: number,
  tileSize: number,
): undefined | VectorPoint {
  // grab the px position of lon lat
  const px = llToPX({ x: lon, y: lat }, zoom, false, tileSize);
  // if px + offset is outside of min and max, return undefined
  // adjust by the offset
  px.x += xOffset;
  px.y -= yOffset;
  // convert back to lon lat
  const ll = pxToLL(px, zoom, tileSize);
  if (ll.x > 180 || ll.x < -180 || ll.y > MAXLAT || ll.y < -MAXLAT) return;
  return ll;
}

/**
 * Arcsine
 * @param x - input
 * @returns the arcsine(x)
 */
function asinz(x: number): number {
  const { abs, asin } = Math;
  if (abs(x) > 1) x = x > 1 ? 1 : -1;
  return asin(x);
}

/**
 * Adjust longitude to be between -180 and 180
 * @param x - longitude
 * @returns adjusted longitude
 */
function adjustLon(x: number): number {
  const { PI, abs } = Math;
  return abs(x) <= 3.14159265359 ? x : x - sign(x) * PI * 2;
}

/**
 * Get the sign of a number
 * @param x - input
 * @returns the sign(x)
 */
function sign(x: number): number {
  return x < 0 ? -1 : 1;
}

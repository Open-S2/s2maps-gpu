import { MAXLAT, llToPX, pxToLL } from 'gis-tools';

import type { VectorPoint } from 'gis-tools';

// https://github.com/proj4js/proj4js/blob/master/lib/projections/ortho.js
const EPSLN = 1.0e-10;
const D2R = 0.01745329251994329577 // eslint-disable-line
const R2D = 57.29577951308232088 // eslint-disable-line

// centerLon and centerlat is where the center of the sphere is currently located
// x is the distance from center
/**
 * @param centerLon
 * @param centerLat
 * @param xOffset
 * @param yOffset
 * @param radius
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
 * @param lon
 * @param lat
 * @param xOffset
 * @param yOffset
 * @param zoom
 * @param tileSize
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
 * @param x
 */
function asinz(x: number): number {
  const { abs, asin } = Math;
  if (abs(x) > 1) x = x > 1 ? 1 : -1;
  return asin(x);
}

/**
 * @param x
 */
function adjustLon(x: number): number {
  const { PI, abs } = Math;
  return abs(x) <= 3.14159265359 ? x : x - sign(x) * PI * 2;
}

/**
 * @param x
 */
function sign(x: number): number {
  return x < 0 ? -1 : 1;
}

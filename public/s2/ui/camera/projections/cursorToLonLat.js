// @flow

// https://github.com/proj4js/proj4js/blob/master/lib/projections/ortho.js
const EPSLN = 1.0e-10
const D2R = 0.01745329251994329577
const R2D = 57.29577951308232088

// centerLon and centerlat is where the center of the sphere is currently located
// x is the distance from center
export default function cursorToLonLat (centerLon: number, centerLat: number,
  x: number, y: number, radius: number): null | [number, number] {
  // pre adjust to radians
  centerLon *= D2R
  centerLat *= D2R
  // prep
  const { PI, sqrt, sin, cos, abs, atan2 } = Math
  const rh = sqrt(x * x + y * y)
  // corner case, the x+y is too far
  if (rh > radius) return [null, null]
  const z = asinz(rh / radius)
  const sin_p14 = sin(centerLat)
  const cos_p14 = cos(centerLat)
  const sinz = sin(z)
  const cosz = cos(z)
  let lon = centerLon
  let lat = centerLat
  const con = abs(centerLat) - (PI / 2)
  // corner case: basically on the dot center
  if (abs(rh) <= EPSLN) return [lon * R2D, lat * R2D]
  // build lat
  lat = asinz(cosz * sin_p14 + (y * sinz * cos_p14) / rh)
  // negative angles
  if (abs(con) <= EPSLN) {
    if (centerLat >= 0) lon = adjustLon(centerLon + atan2(x, -y))
    else lon = adjustLon(centerLon - atan2(-x, y))
  } else { // positive angles
    lon = adjustLon(centerLon + atan2((x * sinz), rh * cos_p14 * cosz - y * sin_p14 * sinz))
  }
  return [lon * R2D, lat * R2D]
}

function asinz (x: number): number {
  const { abs, asin } = Math
  if (abs(x) > 1) x = (x > 1) ? 1 : -1
  return asin(x)
}

function adjustLon (x: number): number {
  const { PI, abs } = Math
  return (abs(x) <= 3.14159265359) ? x : (x - (sign(x) * PI * 2))
}

function sign (x: number): number {
  return x < 0 ? -1 : 1
}

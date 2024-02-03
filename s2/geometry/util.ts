export const EARTH_RADIUS = 6_371_008.8 // meters
export const EARTH_RADIUS_EQUATORIAL = 6_378_137 // meters
export const EARTH_RADIUS_POLAR = 6_356_752.3 // meters

export const MARS_RADIUS = 3389500 // meters
export const MARS_RADIUS_EQUATORIAL = 3396200 // meters
export const MARS_RADIUS_POLAR = 3376200 // meters

// 900913 (Web Mercator) properties.
export const A = 6378137.0
export const MAXEXTENT = 20037508.342789244
export const MAXLAT = 85.0511287798

/** convert radians to degrees */
export function radToDeg (radians: number): number {
  return radians * 180 / Math.PI
}

/** convert degrees to radians */
export function degToRad (deg: number): number {
  return deg * Math.PI / 180
}

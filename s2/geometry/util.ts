/** Earth's radius in meters */
export const EARTH_RADIUS = 6_371_008.8
/** Earth's equitorial radius in meters */
export const EARTH_RADIUS_EQUATORIAL = 6_378_137
/** Earth's polar radius in meters */
export const EARTH_RADIUS_POLAR = 6_356_752.3

/** Mars' radius in meters */
export const MARS_RADIUS = 3_389_500
/** Mars' equitorial radius in meters */
export const MARS_RADIUS_EQUATORIAL = 3_396_200
/** Mars' polar radius in meters */
export const MARS_RADIUS_POLAR = 3_376_200

/** 900913 (Web Mercator) constant */
export const A = 6_378_137.0
/** 900913 (Web Mercator) max extent */
export const MAXEXTENT = 20_037_508.342789244
/** 900913 (Web Mercator) maximum latitude */
export const MAXLAT = 85.0511287798

/** convert radians to degrees */
export function radToDeg (radians: number): number {
  return radians * 180 / Math.PI
}

/** convert degrees to radians */
export function degToRad (deg: number): number {
  return deg * Math.PI / 180
}

/** a modulo function that works with negative numbers */
export function mod (x: number, n: number): number {
  return ((x % n) + n) % n
}

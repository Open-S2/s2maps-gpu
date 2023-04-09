export const EARTH_RADIUS = 6_371_008.8 // meters
export const EARTH_RADIUS_EQUATORIAL = 6_378_137 // meters
export const EARTH_RADIUS_POLAR = 6_356_752.3 // meters

export const MARS_RADIUS = 3389500 // meters
export const MARS_RADIUS_EQUATORIAL = 3396200 // meters
export const MARS_RADIUS_POLAR = 3376200 // meters

export const EPSILON = 1.0e-10

export function radToDeg (radians: number): number {
  return radians * 180 / Math.PI
}

export function degToRad (deg: number): number {
  return deg * Math.PI / 180
}

export function isFloat (n: number): boolean {
  return n % 1 !== 0
}

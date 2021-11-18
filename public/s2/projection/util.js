// @flow
import type { Face } from './'

export const EARTH_RADIUS = 6_371_008.8 // meters
export const EARTH_RADIUS_EQUATORIAL = 6_378_137 // meters
export const EARTH_RADIUS_POLAR = 6_356_752.3 // meters

export const MARS_RADIUS = 3389500 // meters
export const MARS_RADIUS_EQUATORIAL = 3396200 // meters
export const MARS_RADIUS_POLAR = 3376200 // meters

export function tileHash (f: Face, z: number, x: number, y: number) {
  const tileLength = (1 << z)
  const tileSize = tileLength * tileLength
  const xyz = tileLength * (tileLength + x) + y
  return f * (tileSize) + tileSize + xyz
}

export function radToDeg (radians: number): number {
  return radians * 180 / Math.PI
}

export function degToRad (deg: number): number {
  return deg * Math.PI / 180
}

export function doubleToFloats (num: number): [number, number] {
  const high = Math.fround(num)
  const low = num - high

  return [high, low]
}

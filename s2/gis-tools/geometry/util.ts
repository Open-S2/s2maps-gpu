/**
 * convert radians to degrees
 * @param radians - radian value
 * @returns degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * convert degrees to radians
 * @param deg - degree value
 * @returns radians
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

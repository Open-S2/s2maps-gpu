import type { XYZ } from './proj.spec'

export * from './lonlat'
export * from './s2'
export * from './webMerc'
export * from './proj.spec'
export * from './util'

/** BASIC GEOMETRIC FUNCTIONS */

/** check if any 4 points in a rectangle is less than zero */
export function lessThanZero (zero: number, bl: number, br: number, tl: number, tr: number): boolean {
  if (bl < zero || br < zero || tl < zero || tr < zero) return true
  return false
}

/** check 3D point boundries of a rectangle are within the range of -1->1 */
export function pointBoundaries (bl: XYZ, br: XYZ, tl: XYZ, tr: XYZ): boolean {
  return (tl[0] <= 1 && tl[0] >= -1 && tl[1] <= 1 && tl[1] >= -1) ||
    (tr[0] <= 1 && tr[0] >= -1 && tr[1] <= 1 && tr[1] >= -1) ||
    (bl[0] <= 1 && bl[0] >= -1 && bl[1] <= 1 && bl[1] >= -1) ||
    (br[0] <= 1 && br[0] >= -1 && br[1] <= 1 && br[1] >= -1)
}

/** test boxIntersect against the 4 lines of a rectangle */
export function boxIntersects (bl: XYZ, br: XYZ, tl: XYZ, tr: XYZ): boolean {
  return boxIntersect(tl, bl) || // leftLine
    boxIntersect(br, tr) || // rightLine
    boxIntersect(bl, br) || // bottomLine
    boxIntersect(tr, tl) // topLine
}

/** check line intersections of p1 and p2 against a [[-1, -1], [1, 1]] box. */
export function boxIntersect (p1: XYZ, p2: XYZ): boolean {
  if (
    lineIntersect(p1[0], p1[1], p2[0], p2[1], -1, -1, -1, 1) || // leftLineBox
    lineIntersect(p1[0], p1[1], p2[0], p2[1], 1, -1, 1, 1) || // rightLineBox
    lineIntersect(p1[0], p1[1], p2[0], p2[1], -1, -1, 1, -1) || // bottomLineBox
    lineIntersect(p1[0], p1[1], p2[0], p2[1], -1, 1, 1, 1) // topLineBox
  ) return true
  return false
}

/** check if two lines intersect */
export function lineIntersect (
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  x4: number, y4: number
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (denom === 0) return false
  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom
  return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1)
}

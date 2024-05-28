import { flattenGeometryToLines, lineLength } from './lineTools'

import type {
  Point,
  VectorFeatureType,
  VectorGeometry,
  VectorPoints
} from 'open-vector-tile'
import type { Path, PathData } from './lineTools'

export function flattenGeometryToPoints (
  geometry: VectorGeometry,
  type: VectorFeatureType
): VectorPoints {
  if (type === 1) return geometry as VectorPoints
  const res: VectorPoints = []

  const lines = flattenGeometryToLines(geometry, type)
  for (const line of lines) {
    for (const point of line) res.push(point)
  }

  return res
}

export function getCenterPoints (
  geometry: VectorGeometry,
  type: VectorFeatureType
): VectorPoints {
  if (type === 1) return geometry as VectorPoints
  return findCenterPoints(geometry, type, 0).map(sp => sp.point)
}

export function getSpacedPoints (
  geometry: VectorGeometry,
  type: VectorFeatureType,
  spacing: number,
  extent: number
): VectorPoints {
  if (type === 1) return geometry as VectorPoints
  return findSpacedPoints(geometry, type, spacing, extent).map(sp => sp.point)
}

export interface SpacedPoints {
  point: Point
  distance: number
  pathLeft: Path
  pathRight: Path
}

export function findCenterPoints (
  geometry: VectorGeometry,
  type: VectorFeatureType,
  extent: number
): SpacedPoints[] {
  const res: SpacedPoints[] = []
  if (type === 1) return res

  const lines = flattenGeometryToLines(geometry, type)
  for (const line of lines) {
    const { length, distIndex } = lineLength(line)
    const center = Math.floor(length / 2)
    const { point, pathLeft, pathRight } = buildPointAtDistance(line, distIndex, center, extent)
    res.push({
      point,
      distance: center,
      pathLeft,
      pathRight
    })
  }

  return res
}

export function findSpacedPoints (
  geometry: VectorGeometry,
  type: VectorFeatureType,
  spacing: number,
  extent: number
): SpacedPoints[] {
  const res: SpacedPoints[] = []
  if (type === 1) return res
  // safety check
  if (spacing <= 50) return res

  const lines = flattenGeometryToLines(geometry, type)
  for (const line of lines) {
    const { length, distIndex } = lineLength(line)
    // every spacing distance, add a point
    const distances: number[] = []
    let distance = spacing
    while (distance < length) {
      distances.push(distance)
      distance += spacing
    }
    for (const d of distances) {
      const { point, pathLeft, pathRight } = buildPointAtDistance(line, distIndex, d, extent)
      res.push({
        point,
        distance: d,
        pathLeft,
        pathRight
      })
    }
  }

  return res
}

// NOTE: Assumes the line is longer then the distance
function buildPointAtDistance (
  line: VectorPoints,
  index: number[],
  distance: number,
  extent: number
): PathData {
  const fourthExtent = extent * 0.25
  let i = 0
  while (i < index.length - 1 && index[i + 1] < distance) i++
  const p1 = line[i]
  const p2 = line[i + 1]
  const d1 = index[i]
  const d2 = index[i + 1]
  const t = (distance - d1) / (d2 - d1)
  const point: Point = {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t
  }
  // store either 7 points or as many as possible
  const pathLeft: Point[] = []
  const pathRight: Point[] = []
  let l = i
  let r = i + 1
  let curAngle: number = pointAngle(point, line[l]) ?? 0
  while (l >= 0 && pathLeft.length < 3) {
    pathLeft.push(duplicatePoint(line[l]))
    l--
    curAngle = pointAngle(line[l + 1], line[l]) ?? curAngle
  }
  // pathLeft length needs to be 4; add 1 at pathAngle
  while (pathLeft.length < 4) {
    const { x, y } = pathLeft[pathLeft.length - 1]
    pathLeft.push({ x: x + fourthExtent * Math.cos(curAngle), y: y + fourthExtent * Math.sin(curAngle) })
  }
  curAngle = pointAngle(point, line[r]) ?? 0
  while (r < line.length && pathRight.length < 3) {
    pathRight.push(duplicatePoint(line[r]))
    r++
    curAngle = pointAngle(line[r - 1], line[r]) ?? curAngle
  }
  while (pathRight.length < 4) {
    const { x, y } = pathRight[pathRight.length - 1]
    pathRight.push({ x: x + fourthExtent * Math.cos(curAngle), y: y + fourthExtent * Math.sin(curAngle) })
  }

  return {
    point,
    pathLeft: pathLeft as Path,
    pathRight: pathRight as Path
  }
}

export function duplicatePoint (point: Point): Point {
  return { x: point.x, y: point.y, m: point.m }
}

export function pointAngle (a: Point, b?: Point): number | undefined {
  if (b === undefined || (a.x === b.x && a.y === b.y)) return undefined
  return Math.atan2(b.y - a.y, b.x - a.x)
}

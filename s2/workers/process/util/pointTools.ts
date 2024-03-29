import { flattenGeometryToLines, lineLength } from './lineTools'

import type {
  Point,
  S2VectorGeometry,
  S2VectorPoints,
  S2VectorTileFeatureType
} from 's2-vector-tile'

export function flattenGeometryToPoints (
  geometry: S2VectorGeometry,
  type: S2VectorTileFeatureType
): S2VectorPoints {
  if (type === 1) return geometry as S2VectorPoints
  const res: S2VectorPoints = []

  const lines = flattenGeometryToLines(geometry, type)
  for (const line of lines) {
    for (const point of line) res.push(point)
  }

  return res
}

export function findCenterPoints (
  geometry: S2VectorGeometry,
  type: S2VectorTileFeatureType
): S2VectorPoints {
  if (type === 1) return geometry as S2VectorPoints
  const res: S2VectorPoints = []

  const lines = flattenGeometryToLines(geometry, type)
  for (const line of lines) {
    const { length, distIndex } = lineLength(line)
    const center = Math.floor(length / 2)
    res.push(buildPointAtDistance(line, distIndex, center))
  }

  return res
}

export function findSpacedPoints (
  geometry: S2VectorGeometry,
  type: S2VectorTileFeatureType,
  spacing: number
): S2VectorPoints {
  if (type === 1) return geometry as S2VectorPoints
  const res: S2VectorPoints = []
  // safety check
  if (spacing <= 25) return res

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
    for (const d of distances) res.push(buildPointAtDistance(line, distIndex, d))
  }

  return res
}

// NOTE: Assumes the line is longer then the distance
function buildPointAtDistance (
  line: S2VectorPoints,
  index: number[],
  distance: number
): Point {
  let i = 0
  while (i < index.length - 1 && index[i + 1] < distance) i++
  const p1 = line[i]
  const p2 = line[i + 1]
  const d1 = index[i]
  const d2 = index[i + 1]
  const t = (distance - d1) / (d2 - d1)
  return [
    p1[0] + (p2[0] - p1[0]) * t,
    p1[1] + (p2[1] - p1[1]) * t
  ]
}

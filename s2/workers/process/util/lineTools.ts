import { findCenterPoints, findSpacedPoints, pointAngle } from './pointTools'

import type { Point } from 'geometry'
import type {
  S2VectorGeometry,
  S2VectorLine,
  S2VectorLines,
  S2VectorMultiPoly,
  S2VectorTileFeatureType
} from 's2-vector-tile'
import type { Cap } from 'style/style.spec'

export interface Line {
  prev: number[]
  curr: number[]
  next: number[]
  lengthSoFar: number[]
}

// if line, return, if poly or multipoly, flatten to lines
export function flattenGeometryToLines (
  geometry: S2VectorGeometry,
  type: S2VectorTileFeatureType
): S2VectorLines {
  if (type === 2 || type === 3) return geometry as S2VectorLines
  else if (type === 4) {
    // manage poly
    const res = [] as S2VectorLines
    for (const poly of geometry as S2VectorMultiPoly) {
      for (const line of poly) res.push(line)
    }
    return res
  } else return []
}

export type Path = [Point, Point, Point, Point]

export interface PathData {
  point: Point
  pathLeft: Path
  pathRight: Path
}

// TODO: given the geometry, check if the line is long enough to fit the glyph otherwise return empty array
// TODO: If the path has sharp corners, simplify the path to be smoother without losing the original shape
export function getPointsAndPathsAlongLines (
  geometry: S2VectorGeometry,
  type: S2VectorTileFeatureType,
  spacing: number,
  extent: number
): PathData[] {
  const res: PathData[] = []
  for (const { point, pathLeft, pathRight } of findSpacedPoints(geometry, type, spacing, extent)) {
    // for now just slice the first 3 points
    res.push({
      point: point.map(p => p / extent) as Point,
      pathLeft: pathLeft.map(p => [p[0] / extent, p[1] / extent]) as Path,
      pathRight: pathRight.map(p => [p[0] / extent, p[1] / extent]) as Path
    })
  }
  return res
}

export function getPointsAndPathsAtCenterOfLines (
  geometry: S2VectorGeometry,
  type: S2VectorTileFeatureType,
  extent: number
): PathData[] {
  const res: PathData[] = []
  for (const { point, pathLeft, pathRight } of findCenterPoints(geometry, type, extent)) {
    // for now just slice the first 3 points
    res.push({
      point: point.map(p => p / extent) as Point,
      pathLeft: pathLeft.map(p => [p[0] / extent, p[1] / extent]) as Path,
      pathRight: pathRight.map(p => [p[0] / extent, p[1] / extent]) as Path
    })
  }
  return res
}

export type QuadPos = [s: number, t: number, offsetX: number, offsetY: number, xPos: number, yPos: number]

export function getPathPos (
  quadPos: QuadPos,
  pathLeft: Path,
  pathRight: Path,
  tileSize: number,
  size: number
): Point {
  // note: st is 0->1 ratio relative to tile size
  // note: offset is in pixels
  // note: xPos and yPos are 0->1 ratio relative to glyph size
  let [s, t, offsetX, offsetY, xPos, yPos] = quadPos
  yPos *= size
  offsetY += yPos
  // get the path but in pixel coordinates
  s = s * tileSize + offsetX
  t = t * tileSize + offsetY
  xPos = Math.abs(xPos) * size
  const path: Point[] = (xPos >= 0 ? pathRight : pathLeft).map(p => [p[0] * tileSize + offsetX, p[1] * tileSize + offsetY])
  // now setup an x-y and travel xPos distance along the path
  let dist = 0
  let pathIndex = 0
  let currAngle = 0
  // using the current s-t as the starting point and the distance function
  // travel xPos distance along the path
  while (dist < xPos && pathIndex < path.length - 1) {
    currAngle = pointAngle(path[pathIndex], path[pathIndex + 1]) ?? currAngle
    const next = path[pathIndex]
    const d = distance([s, t], next)
    if (dist + d < xPos) {
      dist += d
      pathIndex++
    } else {
      const [x1, y1] = path[pathIndex]
      const [x2, y2] = next
      const ratio = (xPos - dist) / d
      s = x1 + (x2 - x1) * ratio
      t = y1 + (y2 - y1) * ratio
      break
    }
  }

  return [s, t]
}

export interface LineLengthRes {
  length: number
  distIndex: number[]
}

export function lineLength (line: S2VectorLine): LineLengthRes {
  let length = 0
  let prev = line[0]
  const distIndex: number[] = [0]
  for (let i = 1, ll = line.length; i < ll; i++) {
    const curr = line[i]
    length += distance(prev, curr)
    distIndex.push(length)
    prev = curr
  }
  return { length, distIndex }
}

export function drawLine (
  points: S2VectorLine,
  cap: Cap = 'butt',
  maxDistance = 0
): Line {
  let ll = points.length
  // corner case: Theres less than 2 points in the array
  if (ll < 2) return { prev: [], curr: [], next: [], lengthSoFar: [] }

  // check line type
  const closed: boolean = (points[0][0] === points[ll - 1][0] && points[0][1] === points[ll - 1][1])

  // step pre: If maxDistance is not Infinity we need to ensure no point is too far from another
  if (maxDistance > 0) {
    let prev: Point, curr: Point
    prev = points[0]
    for (let i = 1; i < points.length; i++) {
      curr = points[i]
      while (Math.abs(prev[0] - curr[0]) > maxDistance || Math.abs(prev[1] - curr[1]) > maxDistance) {
        curr = [(prev[0] + curr[0]) / 2, (prev[1] + curr[1]) / 2] // set new current
        points.splice(i, 0, curr) // store current
      }
      prev = curr
    }
    // update length
    ll = points.length
  }

  const prev = [...points[0]]
  const curr = [...points[0]]
  const next: number[] = []
  const lengthSoFar = [0]
  let curLength = 0
  let prevPoint = points[0]

  for (let i = 1; i < ll; i++) {
    // get the next point
    const point = points[i]
    // move on if duplicate point
    if (prevPoint[0] === point[0] && prevPoint[1] === point[1]) continue
    // store the next pair
    next.push(...point)
    // store the point as the next "start"
    curr.push(...point)
    // store the previous point
    prev.push(...prevPoint)
    // build the lengthSoFar
    curLength += distance(prevPoint, point)
    lengthSoFar.push(curLength)
    // store the old point
    prevPoint = point
  }
  // here we actually just store 'next'
  next.push(...points[ll - 1])
  // if closed, add a 'final' point for the connector piece
  if (closed) {
    prev.push(...points[ll - 2])
    curr.push(...points[ll - 1])
    next.push(...points[1])
    curLength += distance(points[ll - 1], points[1])
    lengthSoFar.push(curLength)
  }

  // if not a butt cap, we add a duplicate of beginning and end
  if (cap !== 'butt') {
    // start cap
    prev.unshift(next[0], next[1])
    curr.unshift(curr[0], curr[1])
    next.unshift(prev[2], prev[3])
    lengthSoFar.unshift(0)
    // end cap
    const len = curr.length - 1
    prev.push(next[len - 1], next[len])
    curr.push(curr[len - 1], curr[len])
    next.push(prev[len - 1], prev[len])
    // update length
    lengthSoFar.push(curLength)
  }

  return { prev, curr, next, lengthSoFar }
}

function distance (a: Point, b: Point): number {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2))
}

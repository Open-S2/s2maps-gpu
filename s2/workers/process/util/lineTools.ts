import type {
  Point,
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
export function flattenGeometry (geometry: S2VectorGeometry, type: S2VectorTileFeatureType): S2VectorLines {
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

export function findPointsAlongLine (
  lines: S2VectorLines,
  minWidth: number,
  extent: number
): Array<[s: number, t: number]> {
  const res: Array<[s: number, t: number]> = []
  // step 1: cleanup the lines to not include data outside the 0->1 boundary
  for (const line of lines) {
    // iterate through the line. Find:
    // 1: If the line passes through the 0->1 boundary of the tile
    // 2: If the line is long enough to fit the glyph
    // 3: Find the anchor points to place the glyph
    const { length } = lineLength(line)
    if (length < minWidth) continue
    // find the anchor points to place the glyph
    const numPoints = Math.floor(length / minWidth)
    console.info(numPoints)
  }
  return res
}

function lineLength (line: S2VectorLine): { length: number } {
  let length = 0
  let prev = line[0]
  for (let i = 1, ll = line.length; i < ll; i++) {
    const curr = line[i]
    length += distance(prev, curr)
    prev = curr
  }
  return { length }
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
  const next = []
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

// @flow
export type Line = {
  prev: Array<number>,
  curr: Array<number>,
  next: Array<number>,
  lengthSoFar: Array<number>
}

type Point = [number, number]

type Cap = 'butt' | 'round' | 'square'

export default function drawLine (points: Array<Point>, cap?: Cap = 'butt', dashed?: boolean = false, maxDistance?: number = 0): Line {
  let ll = points.length
  // corner case: Theres less than 2 points in the array
  // if (ll < 2) return { prev: [], curr: [], next: [], lengthSoFar: [] }
  if (ll < 2) return { prev: [], curr: [], next: [] }

  // check line type
  const closed: boolean = (points[0][0] === points[ll - 1][0] && points[0][1] === points[ll - 1][1])

  // step pre: If maxDistance is not Infinity we need to ensure no point is too far from another
  if (maxDistance) {
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
  // const lengthSoFar = [0]
  // let curLength = 0
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
    // if (dashed) curLength += Math.sqrt(Math.pow(point[0] - prevPoint[0], 2) + Math.pow(point[1] - prevPoint[1], 2))
    // lengthSoFar.push(curLength)
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
  }

  // if not a butt cap, we add a duplicate of beginning and end
  if (cap !== 'butt') {
    // start cap
    prev.unshift(next[0], next[1])
    curr.unshift(curr[0], curr[1])
    next.unshift(prev[2], prev[3])
    // end cap
    const len = curr.length - 1
    prev.push(next[len - 1], next[len])
    curr.push(curr[len - 1], curr[len])
    next.push(prev[len - 1], prev[len])
  }

  return { prev, curr, next }
}

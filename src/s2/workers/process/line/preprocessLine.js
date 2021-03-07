// @flow
import { drawLine } from 'line-gl'

type Point = [number, number]

type Cap = 'butt' | 'round' | 'square'

export default function preprocessLine (geometry: Array<Array<Point>>,
  type: 2 | 3 | 4, cap: Cap, dashed: boolean, vertices: Array<number>,
  division: number, extent: number) {
  if (!geometry.length) return
  // create multiplier
  const multiplier = 8192 / extent
  // find a max distance to modify lines too large (round off according to the sphere)
  const maxDistance = (division === 1) ? 0 : extent / division
  // if multi-polygon, join all outer rings and holes together
  const geo: Array<Point> = []
  if (type === 4) {
    for (const poly of geometry) geo.push(...poly)
    geometry = geo
  }
  // draw
  const { round } = Math
  for (const lineString of geometry) {
    // build the vertex, normal, and index data
    // const { prev, curr, next, lengthSoFar } = drawLine(lineString, cap, dashed, maxDistance)
    const { prev, curr, next } = drawLine(lineString, cap, dashed, maxDistance)
    for (let i = 0, vc = curr.length; i < vc; i += 2) {
      vertices.push(
        round(prev[i] * multiplier), round(prev[i + 1] * multiplier),
        round(curr[i] * multiplier), round(curr[i + 1] * multiplier),
        round(next[i] * multiplier), round(next[i + 1] * multiplier)
      )
    }
  }
}

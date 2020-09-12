// @flow
import { drawLine } from 'line-gl'

type Point = [number, number]

export default function preprocessLine (geometry: Array<Array<Point>>,
  type: 2 | 3 | 4, dashed: boolean, vertices: Array<number>,
  division: number, extent: number) {
  // find a max distance to modify lines too large (round off according to the sphere)
  const maxDistance = (division === 1) ? 0 : extent / division
  // if multi-polygon, join all outer rings and holes together
  const geo: Array<Point> = []
  if (type === 4) {
    for (const poly of geometry) geo.push(...poly)
    geometry = geo
  }
  // draw
  for (const lineString of geometry) {
    // build the vertex, normal, and index data
    // const { prev, curr, next, lengthSoFar } = drawLine(lineString, dashed, maxDistance)
    const { prev, curr, next } = drawLine(lineString, dashed, maxDistance)
    let verticesCount = curr.length
    for (let i = 0; i < verticesCount; i += 2) {
      vertices.push(
        prev[i], prev[i + 1],
        curr[i], curr[i + 1],
        next[i], next[i + 1]
      )
    }
  }
}

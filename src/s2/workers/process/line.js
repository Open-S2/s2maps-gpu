// @flow
import drawLine from 'line-gl'

import type { Attributes } from 'line-gl'
type Point = [number, number]

// const PRECISION = 4096

export default function processLine (geometry: Array<Array<Point>>,
  type: 2 | 3 | 4, attributes: Attributes, vertices: Array<number>,
  indices: Array<number>, extent: number): number {
  // if multi-polygon, join all outer rings and holes together
  const geo = []
  if (type === 4) {
    for (const poly of geometry) geo.push(...poly)
    geometry = geo
  }
  // draw
  for (const lineString of geometry) {
    // build the vertex, normal, and index data
    const data = drawLine(lineString, attributes, vertices.length / 4)
    let verticesCount = data.vertices.length
    for (let i = 0; i < verticesCount; i += 2) {
      vertices.push(
        data.vertices[i],
        data.vertices[i + 1],
        // pack(data.normals[i], data.normals[i + 1]),
        Math.round(data.normals[i] * 32767),
        Math.round(data.normals[i + 1] * 32767)
        // data.lengthSoFar[i] / extent
      )
    }
    // store indices
    for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
  }
}

// https://stackoverflow.com/questions/17638800/storing-two-float-values-in-a-single-float-variable
// function pack (x: number, y: number): number {
//   const prec = PRECISION - 1
//   return Math.fround((Math.floor(x * prec) * PRECISION) + Math.floor(y * prec))
// }

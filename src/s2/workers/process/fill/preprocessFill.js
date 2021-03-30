// @flow
import { earclip } from 'earclip'
// import remapVertices from '../remapVertices'
// import { zeroClip } from 'zero-clip'

type Point = [number, number]

export default function preprocessFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, vertices: Array<number>, indices: Array<number>,
  extent: number, division: number) {
  // edge case: no geometry
  if (!geometry.length) return
  // prep polys
  const polys = []
  // prep for processing
  if (type === 4) {
    for (const poly of geometry) polys.push(poly)
  } else { polys.push(geometry) }
  // create multiplier
  const multiplier = 8192 / extent
  // process
  const { round } = Math
  for (const poly of polys) {
    // create triangle mesh
    let data = earclip(poly, extent / division, vertices.length / 2)
    // store vertices
    for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(round(data.vertices[i] * multiplier))
    // store indices
    for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
  }
}

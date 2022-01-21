// @flow
import { earclip } from 'earclip'
import type { Feature } from '../../../tile.worker'

// geometry: Array<Array<Point>> | Array<Point>
export default function preprocessFill (feature: Feature, division: number) {
  // pull data
  const { geometry, type, vertices, indices, extent } = feature
  if (indices.length) {
    feature.vertices = geometry
    return
  }
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
    const data = earclip(poly, extent / division, vertices.length / 2)
    // store vertices
    for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(round(data.vertices[i] * multiplier))
    // store indices
    for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
  }
}

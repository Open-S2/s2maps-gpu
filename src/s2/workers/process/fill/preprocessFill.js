// @flow
import { earclip, tesselate, flatten } from 'earclip'

type Point = [number, number]

export default function preprocessFill (geometry: Array<Array<Point>> | Array<Point>,
  featureIndices?: Array<number>, type: 3 | 4, vertices: Array<number>,
  indices: Array<number>, extent: number, division: number) {
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
  if (featureIndices) {
    const verts = []
    // grab current vertex offset
    const offset = vertices.length / 2
    // build vertices
    for (const poly of polys) {
      const data = flatten(poly)
      verts.push(...data.vertices)
    }
    // tesselate
    tesselate(verts, featureIndices, extent / division, 2)
    // store vertices
    for (let i = 0, vl = verts.length; i < vl; i++) vertices.push(round(verts[i] * multiplier))
    // store indices
    for (let i = 0, il = featureIndices.length; i < il; i++) indices.push(featureIndices[i] + offset)
  } else {
    for (const poly of polys) {
      // create triangle mesh
      let data = earclip(poly, extent / division, vertices.length / 2)
      // store vertices
      for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(round(data.vertices[i] * multiplier))
      // store indices
      for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
    }
  }
}

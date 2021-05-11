// @flow
import { earclip, tesselate, flatten } from 'earclip'

type Point = [number, number]

// geometry: Array<Array<Point>> | Array<Point>
export default function preprocessFill (feature: Feature, division: number) {
  // pull data
  const { geometry, type, vertices, indices, extent } = feature
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
  if (indices) {
    const verts = []
    // build vertices
    for (const poly of polys) {
      const data = flatten(poly)
      verts.push(...data.vertices)
    }
    // tesselate
    tesselate(verts, indices, extent / division, 2)
    // store vertices
    for (let i = 0, vl = verts.length; i < vl; i++) vertices.push(round(verts[i] * multiplier))
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

// @flow
import { earclip } from 'earclip'
// import { zeroClip } from 'zero-clip'
// import { meshelate } from 'meshelate'

type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, vertices: Array<number>, indices: Array<number>,
  division: number, extent: number) {
  // prep polys
  const polys = []
  // prep for processing
  if (type === 4) {
    for (const poly of geometry) polys.push(poly)
  } else { polys.push(geometry) }
  // process
  for (const poly of polys) {
    // get current vertices offset
    // let offset = vertices.length / 2
    // create triangle mesh
    let data = earclip(poly, extent / division, vertices.length / 2)
    // let data = zeroClip(poly, offset)
    // tesselate if necessary
    // if (division > 1) data = meshelate(data.vertices, data.indices, extent / division, offset)
    // store vertices
    for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(data.vertices[i] / extent)
    // store indices
    for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
  }
}

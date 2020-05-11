// @flow
// import { earclip } from 'earclip'
import { zeroClip } from 'zero-clip'

type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, vertices: Array<number>, indices: Array<number>, vertexType: Array<number>,
  division: number, extent: number) {
  // prep polys
  const polys = []
  // prep for processing
  if (type === 4) {
    for (const poly of geometry) polys.push(poly)
  } else { polys.push(geometry) }
  // process
  for (const poly of polys) {
    // create triangle mesh
    // let data = earclip(poly, extent / division, vertices.length / 2)
    let data = zeroClip(poly, vertices.length / 2)
    // store vertices
    if (extent === 4096) for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(data.vertices[i])
    else for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(Math.round(data.vertices[i] / extent * 4096))
    // store types
    for (let i = 0, vl = data.vertices.length / 2; i < vl; i++) vertexType.push(0)
    // store indices
    for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
  }
}

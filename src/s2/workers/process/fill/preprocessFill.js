// @flow
import { earclip } from 'earclip'
// import remapVertices from '../remapVertices'
// import { zeroClip } from 'zero-clip'

import type { TileRequest } from '../../tile.worker.js'

type Point = [number, number]

export default function preprocessFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, vertices: Array<number>, indices: Array<number>,
  extent: number, division: number) {
  // const { face, zoom, bbox, division } = tile
  // edge case: no geometry
  if (!geometry.length) return
  // prep polys
  const polys = []
  // prep for processing
  if (type === 4) {
    for (const poly of geometry) polys.push(poly)
  } else { polys.push(geometry) }
  // create multiplier
  // const multiplier = 8192 / extent
  // process
  // const highZoom = zoom >= 13
  for (const poly of polys) {
    // create triangle mesh
    // const indexPos = vertices.length / (highZoom ? 6 : 2)
    let data = earclip(poly, extent / division, vertices.length / 2)
    // store vertices
    // if (highZoom) {
    //   // remap vertices to x, y, z than store
    //   remapVertices(data.vertices, vertices, face, bbox, ds, dt)
    // } else {
    //   for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(Math.round(data.vertices[i] * multiplier))
    // }
    for (let i = 0, vl = data.vertices.length; i < vl; i++) vertices.push(data.vertices[i] / extent)
    // store indices
    for (let i = 0, il = data.indices.length; i < il; i++) indices.push(data.indices[i])
  }
}

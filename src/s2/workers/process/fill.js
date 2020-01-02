// @flow
import { earclip } from 'earclip'
import { S2Point } from 's2projection'

import type { TileRequest } from '../tile.worker'
type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, tile: TileRequest, vertices: Array<number>, indices: Array<number>,
  featureIndices: Array<number>, encodingIndex: number, maxLength: number): number {
  const { division, extent, bbox } = tile
  // given geometry, convert data to tiles bounds, than
  // push results to vertices and indices updating offset as we go.
  const ds = (bbox[2] - bbox[0]) / extent
  const dt = (bbox[3] - bbox[1]) / extent
  // figure out current vertex offset. if vertices length doesn't align with proper
  // length for this program, add padding 0s
  let vertexalignment = vertices.length % 6
  while (vertexalignment--) vertices.push(0)

  if (type === 4) {
    for (const poly of geometry) {
      const data = earclip(poly, maxLength, vertices.length / 6)
      // remap vertices to x, y, z than store
      remapVertices(data.vertices, vertices, tile, ds, dt, featureIndices, encodingIndex)
      // store indices
      indices.push(...data.indices)
    }
  } else {
    const data = earclip(geometry, maxLength, vertices.length / 6) // just the first ring for now
    // remap vertices to x, y, z than store
    remapVertices(data.vertices, vertices, tile, ds, dt, featureIndices, encodingIndex)
    // store indices
    indices.push(...data.indices)
  }
}

// since we are looking at a EXTENTxEXTENT mapping, we need to convert it back to the
// proper ST and than x, y, z coordinates
function remapVertices (stVertices: Array<number>, vertices: Array<number>,
  tile: TileRequest, ds: number, dt: number, featureIndices: Array<number>, encodingIndex: number) {
  const { face, bbox } = tile
  let point: S2Point
  let sT: number = bbox[0]
  let tT: number = bbox[1]
  for (let i = 0, vl = stVertices.length; i < vl; i += 2) {
    // create s2Point using WebGL's projection scheme, normalize, and than store
    point = S2Point.fromSTGL(face, ds * stVertices[i] + sT, dt * stVertices[i + 1] + tT)
    point.normalize()
    vertices.push(...point.toFloats())
    featureIndices.push(encodingIndex)
  }
}

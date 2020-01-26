// @flow
import { earclip } from 'earclip'
import { S2Point } from 's2projection'

import type { TileRequest } from '../tile.worker'
type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, tile: TileRequest, vertices: Array<number>, indices: Array<number>,
  featureIndices: Array<number>, encodingIndex: number): number {
  const { division, extent, bbox } = tile
  // figure out current vertex offset. if vertices length doesn't align with proper
  // length for this program, add padding 0s
  let vertexalignment = vertices.length % 4
  while (vertexalignment--) vertices.push(0)
  // prep polys
  const polys = []
  // prep for processing
  if (type === 4) {
    for (const poly of geometry) polys.push(poly)
  } else { polys.push(geometry) }
  // process
  for (const poly of polys) {
    const data = earclip(poly, vertices.length / 2)
    // store vertices and add encodingIndex for each vertex pair
    vertices.push(...data.vertices)
    const verticesCount = data.vertices.length / 2
    // TODO: If tile extent does not match stored layer extent, remap as well
    for (let i = 0; i < verticesCount; i++) featureIndices.push(encodingIndex)
    // store indices
    indices.push(...data.indices)
  }
}

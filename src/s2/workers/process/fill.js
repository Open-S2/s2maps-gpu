// @flow
import { earclip } from 'earclip'
import { S2Point } from 's2projection'

import type { TileRequest } from '../tile.worker'
type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, tile: TileRequest, vertices: Array<number>, indices: Array<number>,
  featureIndices: Array<number>, encodingIndex: number, maxLength: number): number {
  const { division, extent, bbox } = tile
  // TODO: If tile extent does not match stored layer extent, remap
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
    for (let i = 0; i < verticesCount; i++) featureIndices.push(encodingIndex)
    // store indices
    indices.push(...data.indices)
  }
}

// @flow
import { earclip } from 'earclip'
import remapVertices from './remapVertices'

type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, tile: TileRequest, vertices: Array<number>, indices: Array<number>,
  featureIndices: Array<number>, encodingIndex: number) {
  const { division, extent, bbox } = tile
  // given geometry, convert data to tiles bounds, than
  // push results to vertices and indices updating offset as we go.
  const ds = (bbox[2] - bbox[0]) / extent
  const dt = (bbox[3] - bbox[1]) / extent
  let maxLength = extent / division
  if (maxLength === extent) maxLength = Infinity

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

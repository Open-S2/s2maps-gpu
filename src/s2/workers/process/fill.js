// @flow
import { earclip } from 'earclip'
import remapVertices from './remapVertices'

type Point = [number, number]

export default function processFill (geometry: Array<Array<Point>> | Array<Point>,
  type: 3 | 4, tile: TileRequest, vertices: Array<number>, indices: Array<number>) {
  const { division, extent, bbox } = tile
  // given geometry, convert data to tiles bounds, position all points relative to center,
  // push results to vertices and indices updating offset as we go.
  const ds = (bbox[2] - bbox[0]) / 4096
  const dt = (bbox[3] - bbox[1]) / 4096

  if (type === 4) {
    for (const poly of geometry) {
      const data = earclip(poly, division, extent, vertices.length / 3)
      // remap vertices to x, y, z than store
      remapVertices(data.vertices, vertices, tile, ds, dt)
      // store indices
      indices.push(...data.indices)
    }
  } else {
    const data = earclip(geometry, division, extent, vertices.length / 3) // just the first ring for now
    // remap vertices to x, y, z than store
    remapVertices(data.vertices, vertices, tile, ds, dt)
    // store indices
    indices.push(...data.indices)
  }
}

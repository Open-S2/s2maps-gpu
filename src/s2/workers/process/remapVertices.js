// @flow
import { S2Point } from 's2projection'
import type { TileRequest } from '../tile.worker'

// since we are looking at a 4096x4096 mapping, we need to convert it back to the proper ST and than x, y, z coordinates
export default function remapVertices (stVertices: Array<number>, vertices: Array<number>, tile: TileRequest,
  ds: number, dt: number) {
  const { face, center, bbox } = tile
  let point: S2Point
  let sT: number = bbox[0]
  let tT: number = bbox[1]
  for (let i = 0, vl = stVertices.length; i < vl; i += 2) {
    // create s2Point using WebGL's projection scheme, normalize, inject center, and than store
    point = S2Point.fromSTGL(face, ds * stVertices[i] + sT, dt * stVertices[i + 1] + tT)
    point.normalize()
    point.subScalar(center)
    vertices.push(point.x, point.y, point.z)
  }
}

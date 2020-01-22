// @flow
import drawLine from 'line-gl'
import encodeNormal from './encodeNormal'
import { S2Point } from 's2projection'

import type { Attributes } from 'line-gl'
import type { TileRequest } from '../tile.worker'
type Point = [number, number]

export default function processLine (geometry: Array<Array<Point>> | Array<Point>,
  attributes: Attributes, tile: TileRequest, vertices: Array<number>, indices: Array<number>,
  featureIndices: Array<number>, encodingIndex: number, maxLength: number, width: number): number {
  const { division, extent, bbox, size } = tile
  // given geometry, convert data to tiles bounds, than
  // push results to vertices and indices updating offset as we go.
  const ds = (bbox[2] - bbox[0]) / extent
  const dt = (bbox[3] - bbox[1]) / extent
  // figure out current vertex offset. if vertices length doesn't align with proper
  // length for this program, add padding 0s
  let vertexalignment = vertices.length % 8
  while (vertexalignment--) vertices.push(0)

  for (const lineString of geometry) {
    const data = drawLine(lineString, attributes, vertices.length / 8)
    // console.log('data.vertices', data.vertices)
    // remap vertices to x, y, z than store
    remapVerticesNormals(data.vertices, vertices, data.normals, tile, ds, dt, featureIndices, encodingIndex, width)
    // store indices
    indices.push(...data.indices)
    // console.log('vertices', vertices)
  }
}

// since we are looking at a EXTENTxEXTENT mapping, we need to convert it back to the
// proper ST and than x, y, z coordinates. In the case of a line, since we precompute the vertex
// at its position in world space, the number is split in two, so we can't easily create variable
// width of the point + normal. To alleviate this, we compute what the lines paint maximum width
// would look like, and use the vector of those two points to create variable width. Stationary
// width looks aesthetically better for roads/paths and borders which comprise pretty much all
// lines on the surface of the earth. 3D lines will use a different technique. anything less than
// max-width will just follow the path that max-width creates, therefore many pixel difference at low
// zoom will look even smaller, however anything zoom 4 or greater should look relatively normal with large widths.
function remapVerticesNormals (stVertices: Array<number>, vertices: Array<number>,
  stNormals: Array<number>, tile: TileRequest, ds: number, dt: number,
  featureIndices: Array<number>, encodingIndex: number, width: number) {
  const { face, bbox } = tile
  let vertex: S2Point, normal: S2Point
  let sT: number = bbox[0]
  let tT: number = bbox[1]
  // console.log('fst', face, sT, tT)
  for (let i = 0, vl = stVertices.length; i < vl; i += 2) {
    // create normal's point at a distance of 1unit (this applies a width to
    // understand the position relative to the vertex in 3d space)
    normal = S2Point.fromSTGL(face, ds * (stVertices[i] + (width * stNormals[i])) + sT, dt * (stVertices[i + 1] + (width * stNormals[i + 1])) + tT)
    normal.normalize()
    // create the vertex using s2Point using WebGL's projection scheme, normalize, and than store
    vertex = S2Point.fromSTGL(face, ds * stVertices[i] + sT, dt * stVertices[i + 1] + tT)
    vertex.normalize()
    vertices.push(...vertex.toFloats())
    // use the vertex to find the vector between the vertex and the 1unit distance "normal"
    normal.subScalarS2(vertex)
    normal.normalize() // normalizing here gives the vector pointing from the vertex towards where the normal originally was
    // store the normal
    vertices.push(...encodeNormal(normal))
    // store encodingIndex for vertex
    featureIndices.push(encodingIndex)
  }
}

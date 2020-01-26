// @flow
import drawLine from 'line-gl'
import encodeNormal from './encodeNormal'
import { S2Point } from 's2projection'

import type { Attributes } from 'line-gl'
import type { TileRequest } from '../tile.worker'
type Point = [number, number]

export default function processLine (geometry: Array<Array<Point>> | Array<Point>,
  attributes: Attributes, tile: TileRequest, vertices: Array<number>, indices: Array<number>,
  featureIndices: Array<number>, encodingIndex: number): number {
  for (const lineString of geometry) {
    // figure out current vertex offset. if vertices length doesn't align with proper
    // length for this program, add padding 0s
    let vertexalignment = vertices.length % 4
    while (vertexalignment--) vertices.push(0)
    // build the vertex, normal, and index data
    const data = drawLine(lineString, attributes, vertices.length / 4)
    // store vertices and add encodingIndex for each vertex pair
    vertices.push(...data.vertices)
    const verticesCount = data.vertices.length / 2
    // store vertices and add encodingIndex for each vertex pair
    for (let i = 0; i < verticesCount; i++) featureIndices.push(encodingIndex)
    // remapVerticesNormals(data.vertices, vertices, data.normals, tile, ds, dt, featureIndices, encodingIndex, width)
    // store indices
    indices.push(...data.indices)
  }
}

// @flow
import buildSource from './buildSource'
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import type { VectorTileSource } from './tile'

export default function buildMask (division: number, context: WebGL2Context | WebGLContext): VectorTileSource {
  const vertices = []
  const indices = []
  // prep variables
  const indexLength = division + 1
  let t: number, s: number, indexAbove: number
  let index: number = 0
  // now we can build out the vertices and indices
  // vertices
  for (let j = 0; j <= division; j++) {
    t = 1 / division * j
    for (let i = 0; i <= division; i++) {
      s = 1 / division * i
      vertices.push(s, t)
    }
  }
  // indices
  for (let j = 0; j < division; j++) {
    // add degenerate if j is not 0
    if (j !== 0) indices.push((j + 1) * indexLength)
    for (let i = 0; i <= division; i++) {
      index = j * indexLength + i
      indexAbove = (j + 1) * indexLength + i
      indices.push(indexAbove, index)
    }
    // upon finishing a row, add a degenerate
    indices.push(index)
  }
  // create our initial vertices and indices:
  const mask: VectorTileSource = {
    type: 'vector',
    subType: 'fill',
    vertexArray: new Float32Array(vertices),
    indexArray: new Uint32Array(indices),
    count: indices.length,
    mode: context.gl.TRIANGLE_STRIP
  }
  //  build
  buildSource(context, mask)
  // return the mask
  return mask
}

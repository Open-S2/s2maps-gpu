/* eslint-env browser */
import type { WebGL2Context, WebGLContext } from '.'
import type { MaskSource } from './context.spec'

export default function buildMask (division: number, context: WebGL2Context | WebGLContext): MaskSource {
  const { gl } = context
  const vertices = []
  const indices = []
  // prep variables
  const indexLength = division + 1
  let t: number, s: number, indexAbove: number
  let index = 0
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

  // setup arrays
  const vertexArray = new Float32Array(vertices)
  const indexArray = new Uint32Array(indices)

  // setup vertex array object
  const vao = context.buildVAO()
  // Create a vertex buffer
  const vertexBuffer = context.bindEnableVertexAttr(vertexArray, 0, 2, gl.FLOAT, false, 0, 0)
  // Create an index buffer
  const indexBuffer = context.bindElementArray(indexArray)
  // flush vao
  context.cleanup()

  // return the mask
  return {
    type: 'mask',
    vao,
    vertexBuffer,
    indexBuffer,
    count: indices.length,
    offset: 0
  }
}

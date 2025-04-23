import type { MaskSource } from '../workflows/workflow.spec.js';
import type { WebGPUContext } from './index.js';

/**
 * Builds a mask source
 * @param division - number of division to slice the geometry by
 * @param context - The current rendering context
 * @returns The mask source
 */
export default function buildMask(division: number, context: WebGPUContext): MaskSource {
  const vertices: number[] = [];
  const indices: number[] = [];
  // prep variables
  const indexLength = division + 1;
  let t: number, s: number, indexAbove: number;
  let index = 0;
  // now we can build out the vertices and indices
  // vertices
  for (let j = 0; j <= division; j++) {
    t = (1 / division) * j;
    for (let i = 0; i <= division; i++) {
      s = (1 / division) * i;
      vertices.push(s, t);
    }
  }
  // indices
  for (let j = 0; j < division; j++) {
    // add degenerate if j is not 0
    if (j !== 0) indices.push((j + 1) * indexLength);
    for (let i = 0; i <= division; i++) {
      index = j * indexLength + i;
      indexAbove = (j + 1) * indexLength + i;
      indices.push(indexAbove, index);
    }
    // upon finishing a row, add a degenerate
    indices.push(index);
  }

  // return the mask
  const maskSource: MaskSource = {
    type: 'mask',
    vertexBuffer: context.buildGPUBuffer(
      'mask vertex buffer',
      new Float32Array(vertices),
      GPUBufferUsage.VERTEX,
    ),
    indexBuffer: context.buildGPUBuffer(
      'mask index buffer',
      new Uint32Array(indices),
      GPUBufferUsage.INDEX,
    ),
    codeTypeBuffer: context.buildGPUBuffer(
      'mask code type buffer',
      new Uint32Array([0]),
      GPUBufferUsage.VERTEX,
    ),
    count: indices.length,
    offset: 0,
  };

  return maskSource;
}

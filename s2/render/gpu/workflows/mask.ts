import type { Tile } from 'source/tile.spec.js';
import type { WebGPUContext } from '../index.js';

/** Mask Source */
export interface MaskSource {
  type: 'mask';
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  codeTypeBuffer: GPUBuffer;
  count: number;
  offset: number;
}

/** Tile Mask Source */
export interface TileMaskSource extends MaskSource {
  bindGroup: GPUBindGroup;
  fillPatternBindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  positionBuffer: GPUBuffer;
  draw: () => void;
  destroy: () => void;
}

/**
 * Builds a mask source
 * @param division - number of division to slice the geometry by
 * @param context - The current rendering context
 * @returns The mask source
 */
export function buildMask(division: number, context: WebGPUContext): MaskSource {
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

/**
 * Get the mask for a tile
 * the zoom determines the number of divisions necessary to maintain a visually
 * asthetic spherical shape. As we zoom in, the tiles are practically flat,
 * so division is less useful.
 * 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
 * context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
 * @param division - number of division to slice the geometry by
 * @param tile - the tile to create the mask for
 * @param context - The current rendering context
 * @returns the mask
 */
export function buildMaskSource(
  division: number,
  tile: Tile,
  context: WebGPUContext,
): TileMaskSource {
  const { masks, nullTexture } = context;
  // check if we have a mask for this level
  let mask = masks.get(division);
  if (mask === undefined) {
    mask = buildMask(division, context);
    masks.set(division, mask);
  }

  // tile binding
  const uniformBuffer = context.buildGPUBuffer(
    'Tile Uniform Buffer',
    new Float32Array(tile.uniforms),
    GPUBufferUsage.UNIFORM,
  );
  const positionBuffer = context.buildGPUBuffer(
    'Tile Position Buffer',
    tile.bottomTop as Float32Array<ArrayBuffer>,
    GPUBufferUsage.UNIFORM,
  );
  // layer binding
  const layerBuffer = context.buildGPUBuffer(
    'Layer Uniform Buffer',
    new Float32Array([1, 0]),
    GPUBufferUsage.UNIFORM,
  );
  const layerCodeBuffer = context.buildGPUBuffer(
    'Layer Code Buffer',
    new Float32Array([0]),
    GPUBufferUsage.STORAGE,
  );
  // feature binding
  const featureCodeBuffer = context.buildGPUBuffer(
    'Feature Code Buffer',
    new Float32Array([0]),
    GPUBufferUsage.STORAGE,
  );
  // store the group
  const bindGroup = context.buildGroup('Feature BindGroup', context.featureBindGroupLayout, [
    uniformBuffer,
    positionBuffer,
    layerBuffer,
    layerCodeBuffer,
    featureCodeBuffer,
  ]);
  // pattern binding
  const fillTexturePositions = context.buildGPUBuffer(
    'Fill Texture Positions',
    new Float32Array([0, 0, 0, 0, 0]),
    GPUBufferUsage.UNIFORM,
  );
  // create the mask, copying the shape of other draw/workflow structures
  const tileMaskSource: TileMaskSource = {
    ...mask,
    bindGroup,
    uniformBuffer,
    positionBuffer,
    fillPatternBindGroup: context.createPatternBindGroup(fillTexturePositions, nullTexture),
    /** Draw the mask */
    draw: (): void => {
      context.setStencilReference(tile.tmpMaskID);
      context.painter.workflows.fill?.drawMask(tileMaskSource);
    },
    /** Destroy the mask */
    destroy: () => {
      uniformBuffer.destroy();
      positionBuffer.destroy();
      layerBuffer.destroy();
      layerCodeBuffer.destroy();
      featureCodeBuffer.destroy();
      fillTexturePositions.destroy();
    },
  };

  return tileMaskSource;
}

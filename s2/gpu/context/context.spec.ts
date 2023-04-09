import type { TileGPU as Tile } from 's2/source/tile.spec'
// import type { GPUType } from 's2/style/style.spec'

export interface MaskSource {
  type: 'mask'
  vertexArray: Int16Array
  indexArray: Uint32Array
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  count: number
  offset: number
  vao: WebGLVertexArrayObject
}

export interface FeatureGuideBase {
  // TODO:
  type: any
  tile: Tile
  parent?: Tile
  layerIndex: number
  sourceName: string
  layerCode: number[]
  lch: boolean
  opaque?: boolean
  interactive?: boolean
  featureCode: number[] // webgl2
}

export interface FeatureGuide extends FeatureGuideBase {}

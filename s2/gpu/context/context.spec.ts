import type { TileGPU as Tile } from 'source/tile.spec'
import type { Resampling } from 'style/style.spec'
import type { SensorTextureDefinition } from 'ui/camera/timeCache'

export type { default as Context } from './context'

export interface MaskSource {
  type: 'mask'
  vertexArray: Int16Array
  indexArray: Uint32Array
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  count: number
  offset: number
}

export interface FillSource {
  type: 'fill'
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  fillIDBuffer: GPUBuffer
  codeTypeBuffer: GPUBuffer
}

export interface GlyphSource {
  type: 'glyph'
  glyphFilterBuffer: GPUBuffer
  glyphFilterIDBuffer: GPUBuffer
  glyphQuadBuffer: GPUBuffer
  glyphQuadIDBuffer: GPUBuffer
  glyphColorBuffer: GPUBuffer
}

export interface HeatmapSource {
  type: 'heatmap'
  vertexBuffer: GPUBuffer
  weightBuffer: GPUBuffer
}

export interface LineSource {
  type: 'line'
  // fillIDBuffer: GPUBuffer
  vertexBuffer: GPUBuffer
  lengthSoFarBuffer?: GPUBuffer
}

export interface PointSource {
  type: 'point'
  vertexBuffer: GPUBuffer
  fillIDBuffer: GPUBuffer
}

// Uses MaskSource vao, count, and offset
export interface RasterSource {
  type: 'raster'
  texture: GPUTexture
}

export interface SensorSource {
  texture?: GPUTexture
  delete?: undefined
}

export type FeatureSource = MaskSource | FillSource | LineSource | PointSource | HeatmapSource | RasterSource | GlyphSource

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

// ** FILL **
export interface FillFeatureGuide extends FeatureGuideBase {
  type: 'fill'
  maskLayer: boolean
  source: FillSource | MaskSource
  count: number
  offset: number
  invert: boolean
  interactive: boolean
  opaque: boolean
  color?: number[] // webgl1
  opacity?: number[] // webgl1
  mode: number
}

// ** GLYPH + GLYPH FILTER **
export type GlyphType = 'text' | 'icon'
export interface GlyphFeatureGuide extends FeatureGuideBase {
  type: 'glyph'
  source: GlyphSource
  count: number
  offset: number
  filterCount: number
  filterOffset: number
  overdraw: boolean
  isIcon: boolean
  interactive: boolean
  bounds?: [number, number, number, number]
  size?: number
  fill?: [number, number, number, number]
  stroke?: [number, number, number, number]
  strokeWidth?: number
}

// ** HEATMAP **
export interface HeatmapFeatureGuide extends FeatureGuideBase {
  type: 'heatmap'
  source: HeatmapSource
  count: number
  offset: number
  colorRamp: WebGLTexture
  radiusLo?: number // webgl1
  opacityLo?: number // webgl1
  intensityLo?: number // webgl1
  radiusHi?: number // webgl1
  opacityHi?: number // webgl1
  intensityHi?: number // webgl1
  bounds?: [number, number, number, number]
}

// ** LINE **
export interface LineFeatureGuide extends FeatureGuideBase {
  type: 'line'
  source: LineSource
  interactive: boolean
  count: number
  offset: number
  dashed: boolean
  dashTexture?: WebGLTexture
  cap: number
  color?: [number, number, number, number] // webgl1
  opacity?: number // webgl1
  width?: number // webgl1
  gapwidth?: number // webgl1
}

// ** POINT **
export interface PointFeatureGuide extends FeatureGuideBase {
  type: 'point'
  source: PointSource
  count: number
  offset: number
  color?: [number, number, number, number] // webgl1
  radius?: number // webgl1
  stroke?: [number, number, number, number] // webgl1
  strokeWidth?: number // webgl1
  opacity?: number // webgl1
  bounds?: [number, number, number, number]
}

// ** RASTER **
export interface RasterFeatureGuide extends FeatureGuideBase {
  type: 'raster'
  source: RasterSource
  resampling: Resampling
  fadeDuration: number
  fadeStartTime: number
  opacity?: number // webgl1
  contrast?: number // webgl1
  saturation?: number // webgl1
}

// ** SENSOR **
export interface SensorFeatureGuide extends FeatureGuideBase {
  type: 'sensor'
  fadeDuration: number
  fadeStartTime: number
  colorRamp: WebGLTexture
  getTextures: () => SensorTextureDefinition
  opacity?: number // webgl1
}

export interface ShadeFeatureGuide extends FeatureGuideBase {
  tile: Tile
  layerIndex: number
  sourceName: string
  type: 'shade'
  maskLayer: boolean
  source: MaskSource
  count: number
  offset: number
}

export type FeatureGuide =
  FillFeatureGuide | GlyphFeatureGuide | HeatmapFeatureGuide |
  LineFeatureGuide | PointFeatureGuide | RasterFeatureGuide |
  SensorFeatureGuide | ShadeFeatureGuide

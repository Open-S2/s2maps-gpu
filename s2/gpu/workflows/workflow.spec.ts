import type {
  FillLayerDefinition,
  FillLayerStyle,
  FillWorkflowLayerGuideGPU,
  GlyphLayerDefinition,
  GlyphLayerStyle,
  HeatmapLayerDefinition,
  HeatmapLayerStyle,
  HillshadeLayerDefinition,
  HillshadeLayerStyle,
  LayerDefinitionBase,
  LineLayerDefinition,
  LineLayerStyle,
  PointLayerDefinition,
  PointLayerStyle,
  RasterLayerDefinition,
  RasterLayerStyle,
  Resampling,
  SensorLayerDefinition,
  SensorLayerStyle,
  ShadeLayerDefinition,
  ShadeLayerStyle
} from 'style/style.spec'
import type { WebGPUContext } from '../context'
import type { SensorTextureDefinition } from 'ui/camera/timeCache'
import type TimeCache from 'ui/camera/timeCache'
import type {
  FillData,
  GlyphData,
  HeatmapData,
  HillshadeData,
  LineData,
  PointData,
  RasterData,
  SensorData
} from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

// SOURCES

export interface MaskSource {
  type: 'mask'
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  fillIDBuffer: GPUBuffer
  codeTypeBuffer: GPUBuffer
  count: number
  offset: number
}
export interface TileMaskSource {
  type: 'mask'
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  fillIDBuffer: GPUBuffer
  codeTypeBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  uniformBuffer: GPUBuffer
  positionBuffer: GPUBuffer
  count: number
  offset: number
  draw: () => void
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
  lengthSoFarBuffer: GPUBuffer
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

// Features

export interface FeatureBase {
  tile: Tile
  parent?: Tile
  layerIndex: number
  sourceName: string
  lch: boolean
  opaque?: boolean
  interactive?: boolean
  featureCode: number[]
  bindGroup: GPUBindGroup
  draw: () => void
}

// tile, parent, layerIndex, layerUniforms, layerCode, featureCode

// ** FILL **
export interface FillFeature extends FeatureBase {
  type: 'fill'
  maskLayer: boolean
  source: FillSource | MaskSource
  count: number
  offset: number
  invert: boolean
  interactive: boolean
  opaque: boolean
}

// ** GLYPH + GLYPH FILTER **
export type GlyphType = 'text' | 'icon'
export interface GlyphFeature extends FeatureBase {
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
  strokeWidth?: number
}

// ** HEATMAP **
export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap'
  source: HeatmapSource
  count: number
  offset: number
  colorRamp: WebGLTexture
  bounds?: [number, number, number, number]
}

// ** LINE **
export interface LineFeature extends FeatureBase {
  type: 'line'
  source: LineSource
  interactive: boolean
  count: number
  offset: number
  dashed: boolean
  dashTexture?: WebGLTexture
  cap: number
}

// ** POINT **
export interface PointFeature extends FeatureBase {
  type: 'point'
  source: PointSource
  count: number
  offset: number
  bounds?: [number, number, number, number]
}

// ** RASTER **
export interface RasterFeature extends FeatureBase {
  type: 'raster'
  source: RasterSource
  resampling: Resampling
  fadeDuration: number
  fadeStartTime: number
}

// ** SENSOR **
export interface SensorFeature extends FeatureBase {
  type: 'sensor'
  fadeDuration: number
  fadeStartTime: number
  colorRamp: WebGLTexture
  getTextures: () => SensorTextureDefinition
}

export interface ShadeFeature extends FeatureBase {
  tile: Tile
  layerIndex: number
  sourceName: string
  type: 'shade'
  maskLayer: boolean
  source: MaskSource
  count: number
  offset: number
}

export type Features =
  FillFeature | GlyphFeature | HeatmapFeature |
  LineFeature | PointFeature | RasterFeature |
  SensorFeature | ShadeFeature

// WORKFLOWS

export interface Workflows {
  fill?: FillWorkflow
  glyphFilter?: GlyphFilterWorkflow
  glyph?: GlyphWorkflow
  heatmap?: HeatmapWorkflow
  line?: LineWorkflow
  point?: PointWorkflow
  raster?: RasterWorkflow
  hillshade?: HillshadeWorkflow
  sensor?: SensorWorkflow
  shade?: ShadeWorkflow
  wallpaper?: WallpaperWorkflow
  skybox?: SkyboxWorkflow
  background?: WallpaperWorkflow | SkyboxWorkflow
}

export interface WorkflowImports {
  fill: FillWorkflow
  // glyphFilter: () => Promise<{ default: (context: WebGPUContext) => Promise<GlyphFilterWorkflow> }>
  // glyph: () => Promise<{ default: (context: WebGPUContext) => Promise<GlyphWorkflow> }>
  // heatmap: () => Promise<{ default: (context: WebGPUContext) => Promise<HeatmapWorkflow> }>
  // line: () => Promise<{ default: (context: WebGPUContext) => Promise<LineWorkflow> }>
  // point: () => Promise<{ default: (context: WebGPUContext) => Promise<PointWorkflow> }>
  // raster: () => Promise<{ default: (context: WebGPUContext) => Promise<RasterWorkflow> }>
  // hillshade: () => Promise<{ default: (context: WebGPUContext) => Promise<HillshadeWorkflow> }>
  // sensor: () => Promise<{ default: (context: WebGPUContext) => Promise<SensorWorkflow> }>
  // shade: () => Promise<{ default: (context: WebGPUContext) => Promise<ShadeWorkflow> }>
  // wallpaper: () => Promise<{ default: (context: WebGPUContext) => Promise<WallpaperWorkflow> }>
  // skybox: () => Promise<{ default: (context: WebGPUContext) => Promise<SkyboxWorkflow> }>
}

export type WorkflowKey = keyof Workflow

export type WorkflowType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor' | 'shade' | 'skybox' | 'wallpaper'

export interface Workflow {
  context: WebGPUContext
  setup: () => Promise<void>
}

export interface FillWorkflow extends Workflow {
  layerGuides: Map<number, FillWorkflowLayerGuideGPU>
  draw: (feature: FillFeature) => void
  drawMask: (maskSource: TileMaskSource) => void
  buildSource: (fillData: FillData, tile: Tile) => void
  buildMaskFeature: (maskLayer: FillLayerDefinition, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillLayerStyle) => FillLayerDefinition
}

export interface GlyphFilterWorkflow extends Workflow {
}

export interface GlyphWorkflow extends Workflow {
  buildSource: (glyphData: GlyphData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphLayerStyle) => GlyphLayerDefinition
}

export interface HeatmapWorkflow extends Workflow {
  buildSource: (heatmapData: HeatmapData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapLayerStyle) => HeatmapLayerDefinition
}

export interface LineWorkflow extends Workflow {
  buildSource: (lineData: LineData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineLayerStyle) => LineLayerDefinition
}

export interface PointWorkflow extends Workflow {
  buildSource: (pointData: PointData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointLayerStyle) => PointLayerDefinition
}

export interface RasterWorkflow extends Workflow {
  buildSource: (rasterData: RasterData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterLayerStyle) => RasterLayerDefinition
}

export interface HillshadeWorkflow extends Workflow {
  buildSource: (rasterData: HillshadeData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HillshadeLayerStyle) => HillshadeLayerDefinition
}

export interface SensorWorkflow extends Workflow {
  buildSource: (sensorData: SensorData, tile: Tile) => void
  injectTimeCache: (timeCache: TimeCache) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorLayerStyle) => SensorLayerDefinition
}

export interface ShadeWorkflow extends Workflow {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeLayerStyle) => ShadeLayerDefinition
}

export interface WallpaperWorkflow extends Workflow {
}

export interface SkyboxWorkflow extends Workflow {
}

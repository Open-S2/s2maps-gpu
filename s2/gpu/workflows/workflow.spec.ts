import type {
  FillLayerDefinition,
  FillLayerStyle,
  FillWorkflowLayerGuideGPU,
  GlyphLayerDefinition,
  GlyphLayerStyle,
  GlyphWorkflowLayerGuideGPU,
  HeatmapLayerDefinition,
  HeatmapLayerStyle,
  HeatmapWorkflowLayerGuideGPU,
  HillshadeLayerDefinition,
  HillshadeLayerStyle,
  HillshadeWorkflowLayerGuideGPU,
  LayerDefinitionBase,
  LineLayerDefinition,
  LineLayerStyle,
  LineWorkflowLayerGuideGPU,
  PointLayerDefinition,
  PointLayerStyle,
  PointWorkflowLayerGuideGPU,
  RasterLayerDefinition,
  RasterLayerStyle,
  RasterWorkflowLayerGuideGPU,
  SensorLayerDefinition,
  SensorLayerStyle,
  ShadeLayerDefinition,
  ShadeLayerDefinitionGPU,
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
import type Projector from 'ui/camera/projector'
import type { BBox } from 'geometry'

// SOURCES

export interface MaskSource {
  type: 'mask'
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  codeTypeBuffer: GPUBuffer
  count: number
  offset: number
}
export interface TileMaskSource {
  type: 'mask'
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  codeTypeBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  fillPatternBindGroup: GPUBindGroup
  uniformBuffer: GPUBuffer
  positionBuffer: GPUBuffer
  count: number
  offset: number
  draw: () => void
  destroy: () => void
}

export interface FillSource {
  type: 'fill'
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  idBuffer: GPUBuffer
  codeTypeBuffer: GPUBuffer
  destroy: () => void
}

export interface GlyphSource {
  type: 'glyph'
  glyphFilterBuffer: GPUBuffer
  glyphQuadBuffer: GPUBuffer
  glyphQuadIndexBuffer: GPUBuffer
  glyphColorBuffer: GPUBuffer
  indexOffset: number // tracks the offset of the glyphFilterBuffer relative to all sources being processed
  filterLength: number // tracks the length of the glyphFilterBuffer
  destroy: () => void
}

export interface HeatmapSource {
  type: 'heatmap'
  vertexBuffer: GPUBuffer
  weightBuffer: GPUBuffer
  destroy: () => void
}

export interface LineSource {
  type: 'line'
  vertexBuffer: GPUBuffer
  lengthSoFarBuffer: GPUBuffer
  destroy: () => void
}

export interface PointSource {
  type: 'point'
  vertexBuffer: GPUBuffer
  idBuffer: GPUBuffer
  destroy: () => void
}

// Uses MaskSource vao, count, and offset
export interface RasterSource {
  type: 'raster'
  texture: GPUTexture
  // pulled from maskSource
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  count: number
  offset: number
  destroy: () => void
}

export interface SensorSource {
  texture?: GPUTexture
  delete?: undefined
  destroy: () => void
}

export type FeatureSource = MaskSource | FillSource | LineSource | PointSource | HeatmapSource | RasterSource | GlyphSource
export type LayerGuides = FillWorkflowLayerGuideGPU | GlyphWorkflowLayerGuideGPU | HeatmapWorkflowLayerGuideGPU | HillshadeWorkflowLayerGuideGPU | LineWorkflowLayerGuideGPU | PointWorkflowLayerGuideGPU | RasterWorkflowLayerGuideGPU | SensorLayerDefinition | ShadeLayerDefinitionGPU

// Features

export interface FeatureBase {
  tile: Tile
  parent?: Tile
  layerGuide: LayerGuides
  maskLayer?: boolean
  sourceName: string
  opaque?: boolean
  interactive?: boolean
  featureCode: number[]
  bindGroup: GPUBindGroup
  draw: () => void
  destroy: () => void
  duplicate?: (tile: Tile, parent: Tile, bounds: BBox) => FeatureBase
  compute?: () => void
  updateSharedTexture?: () => void
}

// ** FILL **
export interface FillFeature extends FeatureBase {
  workflow: FillWorkflow
  type: 'fill'
  maskLayer: boolean
  source: FillSource | MaskSource
  layerGuide: FillWorkflowLayerGuideGPU
  count: number
  offset: number
  invert: boolean
  interactive: boolean
  opaque: boolean
  featureCodeBuffer: GPUBuffer
  fillTexturePositions: GPUBuffer
  fillPatternBindGroup: GPUBindGroup
  fillInteractiveBindGroup?: GPUBindGroup
  duplicate: (tile: Tile, parent: Tile) => FillFeature
}

// ** GLYPH + GLYPH FILTER **
export type GlyphType = 'text' | 'icon'
export interface GlyphFeature extends FeatureBase {
  type: 'glyph'
  source: GlyphSource
  layerGuide: GlyphWorkflowLayerGuideGPU
  count: number
  offset: number
  filterCount: number
  filterOffset: number
  overdraw: boolean
  isIcon: boolean
  interactive: boolean
  viewCollisions: boolean
  bounds?: BBox
  size?: number
  strokeWidth?: number
  glyphBindGroup: GPUBindGroup
  glyphStrokeBindGroup: GPUBindGroup
  glyphFilterBindGroup: GPUBindGroup
  glyphInteractiveBindGroup: GPUBindGroup
  glyphUniformBuffer: GPUBuffer
  duplicate: (tile: Tile, parent: Tile, bounds: BBox) => GlyphFeature
}

// ** HEATMAP **
export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap'
  source: HeatmapSource
  layerGuide: HeatmapWorkflowLayerGuideGPU
  count: number
  offset: number
  bounds?: BBox
  heatmapBindGroup: GPUBindGroup
  duplicate: (tile: Tile, parent: Tile, bounds: BBox) => HeatmapFeature
}

// ** LINE **
export interface LineFeature extends FeatureBase {
  type: 'line'
  source: LineSource
  layerGuide: LineWorkflowLayerGuideGPU
  interactive: boolean
  count: number
  offset: number
  dashed: boolean
  dashTexture?: WebGLTexture
  cap: number
  lineBindGroup: GPUBindGroup
  duplicate: (tile: Tile, parent: Tile) => LineFeature
}

// ** POINT **
export interface PointFeature extends FeatureBase {
  type: 'point'
  source: PointSource
  layerGuide: PointWorkflowLayerGuideGPU
  count: number
  offset: number
  bounds?: BBox
  pointBindGroup: GPUBindGroup
  pointInteractiveBindGroup: GPUBindGroup
  duplicate: (tile: Tile, parent: Tile, bounds: BBox) => PointFeature
}

// ** RASTER **
export interface RasterFeature extends FeatureBase {
  type: 'raster'
  source: RasterSource
  layerGuide: RasterWorkflowLayerGuideGPU
  fadeDuration: number
  fadeStartTime: number
  rasterBindGroup: GPUBindGroup
  duplicate: (tile: Tile, parent: Tile) => RasterFeature
}

// ** SENSOR **
export interface SensorFeature extends FeatureBase {
  type: 'sensor'
  layerGuide: SensorLayerDefinition
  fadeDuration: number
  fadeStartTime: number
  colorRamp: WebGLTexture
  getTextures: () => SensorTextureDefinition
  duplicate: (tile: Tile, parent: Tile) => SensorFeature
}

// ** HILLSHADE **
export interface HillshadeFeature extends FeatureBase {
  type: 'hillshade'
  source: RasterSource
  layerGuide: HillshadeWorkflowLayerGuideGPU
  fadeDuration: number
  fadeStartTime: number
  hillshadeBindGroup: GPUBindGroup
  duplicate: (tile: Tile, parent: Tile) => HillshadeFeature
}

export interface ShadeFeature extends FeatureBase {
  tile: Tile
  layerIndex: number
  sourceName: string
  type: 'shade'
  maskLayer: boolean
  source: MaskSource
  layerGuide: ShadeLayerDefinitionGPU
  count: number
  offset: number
}

export type Features =
  FillFeature | GlyphFeature | HeatmapFeature |
  LineFeature | PointFeature | RasterFeature |
  SensorFeature | ShadeFeature | HillshadeFeature

// WORKFLOWS

export interface Workflows {
  fill?: FillWorkflow
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
  fill: () => FillWorkflow
  glyph: () => GlyphWorkflow
  heatmap: () => HeatmapWorkflow
  line: () => LineWorkflow
  point: () => PointWorkflow
  raster: () => RasterWorkflow
  hillshade: () => HillshadeWorkflow
  // sensor: () => Promise<{ default: (context: WebGPUContext) => Promise<SensorWorkflow> }>
  shade: () => ShadeWorkflow
  wallpaper: () => WallpaperWorkflow
  skybox: () => SkyboxWorkflow
}

export type WorkflowKey = keyof Workflow

export type WorkflowType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor' | 'shade' | 'skybox' | 'wallpaper'

export interface Workflow {
  context: WebGPUContext
  setup: () => Promise<void>
  destroy: () => void
  resize?: (width: number, height: number) => void
}

export interface FillWorkflow extends Workflow {
  layerGuides: Map<number, FillWorkflowLayerGuideGPU>
  interactivePipeline: GPUComputePipeline
  maskPipeline: GPURenderPipeline
  fillPipeline: GPURenderPipeline
  maskFillPipeline: GPURenderPipeline
  invertPipeline: GPURenderPipeline
  fillInteractiveBindGroupLayout: GPUBindGroupLayout
  draw: (feature: FillFeature) => void
  drawMask: (maskSource: TileMaskSource, feature?: FillFeature) => void
  buildSource: (fillData: FillData, tile: Tile) => void
  buildMaskFeature: (maskLayer: FillLayerDefinition, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillLayerStyle) => FillLayerDefinition
}

export interface GlyphWorkflow extends Workflow {
  module: GPUShaderModule
  layerGuides: Map<number, GlyphWorkflowLayerGuideGPU>
  pipeline: GPURenderPipeline
  testRenderPipeline: GPURenderPipeline
  bboxPipeline: GPUComputePipeline
  testBBoxPipeline: GPUComputePipeline
  interactivePipeline: GPUComputePipeline
  glyphBindGroupLayout: GPUBindGroupLayout
  glyphPipelineLayout: GPUPipelineLayout
  glyphFilterBindGroupLayout: GPUBindGroupLayout
  glyphFilterPipelineLayout: GPUPipelineLayout
  glyphInteractiveBindGroupLayout: GPUBindGroupLayout
  glyphInteractivePiplineLayout: GPUPipelineLayout
  glyphBBoxesBuffer: GPUBuffer
  glyphFilterResultBuffer: GPUBuffer
  buildSource: (glyphData: GlyphData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphLayerStyle) => GlyphLayerDefinition
  computeInteractive: (feature: GlyphFeature) => void
  computeFilters: (features: GlyphFeature[]) => void
  draw: (feature: GlyphFeature) => void
}

export interface HeatmapWorkflow extends Workflow {
  layerGuides: Map<number, HeatmapWorkflowLayerGuideGPU>
  pipeline: GPURenderPipeline
  module: GPUShaderModule
  texturePipeline: GPURenderPipeline
  heatmapBindGroupLayout: GPUBindGroupLayout
  heatmapTextureBindGroupLayout: GPUBindGroupLayout
  buildSource: (heatmapData: HeatmapData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapLayerStyle) => HeatmapLayerDefinition
  textureDraw: (features: HeatmapFeature[]) => HeatmapFeature[] | undefined
  draw: (feature: HeatmapFeature) => void
}

export interface LineWorkflow extends Workflow {
  layerGuides: Map<number, LineWorkflowLayerGuideGPU>
  pipeline: GPURenderPipeline
  lineBindGroupLayout: GPUBindGroupLayout
  buildSource: (lineData: LineData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineLayerStyle) => LineLayerDefinition
  draw: (feature: LineFeature) => void
}

export interface PointWorkflow extends Workflow {
  layerGuides: Map<number, PointWorkflowLayerGuideGPU>
  pipeline: GPURenderPipeline
  interactivePipeline: GPUComputePipeline
  pointInteractiveBindGroupLayout: GPUBindGroupLayout
  pointBindGroupLayout: GPUBindGroupLayout
  module: GPUShaderModule
  buildSource: (pointData: PointData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointLayerStyle) => PointLayerDefinition
  computeInteractive: (feature: PointFeature) => void
  draw: (feature: PointFeature) => void
}

export interface RasterWorkflow extends Workflow {
  layerGuides: Map<number, RasterWorkflowLayerGuideGPU>
  pipeline: GPURenderPipeline
  rasterBindGroupLayout: GPUBindGroupLayout
  buildSource: (rasterData: RasterData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterLayerStyle) => RasterLayerDefinition
  draw: (feature: RasterFeature) => void
}

export interface HillshadeWorkflow extends Workflow {
  layerGuides: Map<number, HillshadeWorkflowLayerGuideGPU>
  pipeline: GPURenderPipeline
  hillshadeBindGroupLayout: GPUBindGroupLayout
  buildSource: (rasterData: HillshadeData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HillshadeLayerStyle) => HillshadeLayerDefinition
  draw: (feature: HillshadeFeature) => void
}

export interface SensorWorkflow extends Workflow {
  buildSource: (sensorData: SensorData, tile: Tile) => void
  injectTimeCache: (timeCache: TimeCache) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorLayerStyle) => SensorLayerDefinition
  draw: (feature: SensorFeature) => void
}

export interface ShadeWorkflow extends Workflow {
  layerDefinition: ShadeLayerDefinitionGPU
  pipeline: GPURenderPipeline
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeLayerStyle) => ShadeLayerDefinitionGPU
  buildMaskFeature: (maskLayer: ShadeLayerDefinition, tile: Tile) => void
  draw: (feature: ShadeFeature) => void
}

export interface WallpaperWorkflow extends Workflow {
  draw: (feature: Projector) => void
}

export interface SkyboxWorkflow extends Workflow {
  draw: (feature: Projector) => void
}

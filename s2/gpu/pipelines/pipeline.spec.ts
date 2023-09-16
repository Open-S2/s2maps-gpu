import type {
  // FillLayerDefinition,
  FillWorkflowLayerGuide,
  GlyphLayerDefinition,
  HeatmapLayerDefinition,
  LayerDefinitionBase,
  LayerStyle,
  LineLayerDefinition,
  PointLayerDefinition,
  RasterLayerDefinition,
  SensorLayerDefinition,
  ShadeLayerDefinition
} from 'style/style.spec'
import type { FillFeatureGuide, WebGPUContext } from '../context'

// import type { TileGPU as Tile } source/tile.spec'
import type TimeCache from 'ui/camera/timeCache'
import type {
  FillData,
  GlyphData,
  HeatmapData,
  LineData,
  PointData,
  RasterData,
  SensorData
} from 'workers/worker.spec'
import type { Tile } from 'source/tile.spec'

export interface Workflow {
  fill?: FillPipeline
  glyphFilter?: GlyphFilterPipeline
  glyph?: GlyphPipeline
  heatmap?: HeatmapPipeline
  line?: LinePipeline
  point?: PointPipeline
  raster?: RasterPipeline
  sensor?: SensorPipeline
  shade?: ShadePipeline
  wallpaper?: WallpaperPipeline
  skybox?: SkyboxPipeline
  background?: WallpaperPipeline | SkyboxPipeline
}

export type WorkflowKey = keyof Workflow

export type WorkflowType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'sensor' | 'shade' | 'skybox' | 'wallpaper'

export interface Pipeline {
  context: WebGPUContext
  setup: (
    vert: string,
    frag: string,
    buffers?: Iterable<GPUVertexBufferLayout | null>,
    primitive?: GPUPrimitiveState,
    depthStencil?: GPUDepthStencilState
  ) => Promise<void>
  use: (passEncoder: GPURenderPassEncoder) => void
  // flush: () => void
}

export interface FillPipeline extends Pipeline {
  layerGuides: Map<number, FillWorkflowLayerGuide>
  setup: () => Promise<void>
  draw: (featureGuide: FillFeatureGuide, passEncoder: GPURenderPassEncoder) => void
  buildSource: (fillData: FillData, tile: Tile) => void
  // buildMaskFeatures: (layerIndexes: number[], tile: Tile) => void
  // buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => FillLayerDefinition
}

export interface GlyphFilterPipeline extends Pipeline {
}

export interface GlyphPipeline extends Pipeline {
  buildSource: (glyphData: GlyphData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => GlyphLayerDefinition
}

export interface HeatmapPipeline extends Pipeline {
  buildSource: (heatmapData: HeatmapData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => HeatmapLayerDefinition
}

export interface LinePipeline extends Pipeline {
  buildSource: (lineData: LineData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => LineLayerDefinition
}

export interface PointPipeline extends Pipeline {
  buildSource: (pointData: PointData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => PointLayerDefinition
}

export interface RasterPipeline extends Pipeline {
  buildSource: (rasterData: RasterData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => RasterLayerDefinition
}

export interface SensorPipeline extends Pipeline {
  buildSource: (sensorData: SensorData, tile: Tile) => void
  injectTimeCache: (timeCache: TimeCache) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => SensorLayerDefinition
}

export interface ShadePipeline extends Pipeline {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => ShadeLayerDefinition
}

export interface WallpaperPipeline extends Pipeline {
}

export interface SkyboxPipeline extends Pipeline {
}

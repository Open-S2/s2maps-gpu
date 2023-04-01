import {
  FillLayerDefinition,
  GlyphLayerDefinition,
  HeatmapLayerDefinition,
  LayerDefinitionBase,
  LayerStyle,
  LineLayerDefinition,
  PointLayerDefinition,
  RasterLayerDefinition,
  SensorLayerDefinition,
  ShadeLayerDefinition
} from '../../style/style.spec'
import { WebGPUContext } from '../context'

import type { TileGPU as Tile } from '../../source/tile.spec'
import type TimeCache from '../../ui/camera/timeCache'

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
  background?: WallpaperPipeline | SkyboxPipeline
}

export type WorkflowKey = keyof Workflow

export type WorkflowType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'sensor' | 'shade' | 'skybox' | 'wallpaper'

export interface Pipeline {
  context: WebGPUContext
  buildPipeline: () => GPURenderPipeline
  draw: () => void
  use: () => void
  flush: () => void
}

export interface FillPipeline extends Pipeline {
  buildMaskFeatures: (layerIndexes: number[], tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => FillLayerDefinition
}

export interface GlyphFilterPipeline extends Pipeline {
}

export interface GlyphPipeline extends Pipeline {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => GlyphLayerDefinition
}

export interface HeatmapPipeline extends Pipeline {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => HeatmapLayerDefinition
}

export interface LinePipeline extends Pipeline {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => LineLayerDefinition
}

export interface PointPipeline extends Pipeline {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => PointLayerDefinition
}

export interface RasterPipeline extends Pipeline {
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LayerStyle) => RasterLayerDefinition
}

export interface SensorPipeline extends Pipeline {
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

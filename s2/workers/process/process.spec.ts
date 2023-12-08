import type { VectorTileFeature } from 's2-vector-tile'
import type { TileRequest } from '../worker.spec'
import type {
  Cap,
  FillLayerDefinition,
  FillWorkerLayer,
  GPUType,
  GlyphLayerDefinition,
  GlyphWorkerLayer,
  HeatmapLayerDefinition,
  HeatmapWorkerLayer,
  HillshadeLayerDefinition,
  HillshadeWorkerLayer,
  InteractiveWorkerLayer,
  LineLayerDefinition,
  LineWorkerLayer,
  PointLayerDefinition,
  PointWorkerLayer,
  RasterLayerDefinition,
  RasterWorkerLayer,
  SensorLayerDefinition,
  SensorWorkerLayer
} from 'style/style.spec'
import type { Properties } from 'geometry'
import type { JSONVectorFeature } from '../source/json-vt/tile'
import type { GlyphObject } from './glyph/glyph.spec'

export interface IDGen {
  workerID: number
  num: number
  incrSize: number
  maxNum: number
  startNum: number
  getNum: () => number
}

/** FEATURES **/

export interface FeatureBase {
  layerIndex: number
  code: number[]
  gl2Code: number[]
}
export interface InteractiveFeatureBase extends FeatureBase {
  idRGB: [number, number, number, number]
}

export type GlyphFeature = GlyphObject

export interface FillFeature extends InteractiveFeatureBase {
  vertices: number[]
  indices: number[]
  pattern?: string
  patternFamily: string
}

export interface LineFeature extends InteractiveFeatureBase {
  vertices: number[]
  lengthSoFar: number[]
  cap: Cap
}

export interface PointFeature extends InteractiveFeatureBase {
  type: 'point'
  vertices: number[]
}

export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap'
  vertices: number[]
  weights: number[]
}

export type Feature = GlyphFeature | FillFeature | LineFeature | PointFeature | HeatmapFeature

/** WORKERS **/

export type VTFeature = VectorTileFeature | JSONVectorFeature

export interface VectorWorker {
  idGen: IDGen
  gpuType: GPUType
  _addInteractiveFeature: (id: number, properties: Properties, workerLayer: InteractiveWorkerLayer) => void
  flush: (mapID: string, tile: TileRequest, sourceName: string) => void
  postInteractive: (mapID: string, sourceName: string, tileID: bigint) => void
}

export interface FillWorker extends VectorWorker {
  features: FillFeature[]
  invertLayers: Map<number, FillWorkerLayer>
  setupLayer: (layer: FillLayerDefinition) => FillWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: FillWorkerLayer) => boolean
}

export interface LineWorker extends VectorWorker {
  setupLayer: (layer: LineLayerDefinition) => LineWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: LineWorkerLayer) => boolean
}

export interface PointWorker extends VectorWorker {
  setupLayer: (layer: PointLayerDefinition | HeatmapLayerDefinition) => PointWorkerLayer | HeatmapWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: PointWorkerLayer | HeatmapWorkerLayer) => boolean
}

export interface HeatmapWorker extends PointWorker {
}

export interface GlyphWorker extends VectorWorker {
  setupLayer: (layer: GlyphLayerDefinition) => GlyphWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: GlyphWorkerLayer) => boolean
}

export interface RasterWorker {
  gpuType: GPUType
  setupLayer: (
    layerDefinition: SensorLayerDefinition | RasterLayerDefinition | HillshadeLayerDefinition
  ) => RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer

  buildTile: (
    mapID: string,
    sourceName: string,
    layers: Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>,
    tile: TileRequest,
    data: ArrayBuffer,
    size: number
  ) => Promise<void>
}

export interface Workers {
  fill?: FillWorker
  line?: LineWorker
  point?: PointWorker
  heatmap?: HeatmapWorker
  glyph?: GlyphWorker
  raster?: RasterWorker
  sensor?: RasterWorker
  hillshade?: RasterWorker
}

export type WorkersKeys = keyof Workers

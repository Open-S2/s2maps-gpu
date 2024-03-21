import type { VectorTileFeature } from 's2-vector-tile'
import type { TileRequest } from '../worker.spec'
import type {
  Cap,
  ColorArray,
  FillDefinition,
  FillWorkerLayer,
  GPUType,
  GlyphDefinition,
  GlyphWorkerLayer,
  HeatmapDefinition,
  HeatmapWorkerLayer,
  HillshadeDefinition,
  HillshadeWorkerLayer,
  InteractiveWorkerLayer,
  LineDefinition,
  LineWorkerLayer,
  PointDefinition,
  PointWorkerLayer,
  RasterDefinition,
  RasterWorkerLayer,
  SensorDefinition,
  SensorWorkerLayer
} from 'style/style.spec'
import type { Properties } from 'geometry'
import type { JSONVectorFeature } from '../source/jsonVT/tile'
import type { GlyphObject } from './glyph/glyph.spec'
import type { Features as PointHeatFeatures } from './point'

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
  idRGB: ColorArray
}

export type GlyphFeature = GlyphObject

export interface FillFeature extends InteractiveFeatureBase {
  vertices: number[]
  indices: number[]
  pattern?: string
  patternFamily: string
  patternMovement: boolean
  missing: boolean
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
  flush: (mapID: string, tile: TileRequest, sourceName: string, wait: Promise<void>) => Promise<void>
  postInteractive: (mapID: string, sourceName: string, tileID: bigint) => void
}

export interface FillWorker extends VectorWorker {
  featureStore: Map<string, FillFeature[]>
  invertLayers: Map<number, FillWorkerLayer>
  setupLayer: (layer: FillDefinition) => FillWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: FillWorkerLayer, mapID: string, sourceName: string) => Promise<boolean>
}

export interface LineWorker extends VectorWorker {
  featureStore: Map<string, LineFeature[]>
  setupLayer: (layer: LineDefinition) => LineWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: LineWorkerLayer, mapID: string, sourceName: string) => boolean
}

export interface PointWorker extends VectorWorker {
  featureStore: Map<string, PointHeatFeatures>
  setupLayer: (layer: PointDefinition | HeatmapDefinition) => PointWorkerLayer | HeatmapWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: PointWorkerLayer | HeatmapWorkerLayer, mapID: string, sourceName: string) => boolean
}

export interface HeatmapWorker extends PointWorker {}

export interface GlyphWorker extends VectorWorker {
  featureStore: Map<string, GlyphObject[]>
  setupLayer: (layer: GlyphDefinition) => GlyphWorkerLayer
  buildFeature: (tile: TileRequest, feature: VTFeature, sourceLayer: GlyphWorkerLayer, mapID: string, sourceName: string) => Promise<boolean>
}

export interface RasterWorker {
  gpuType: GPUType
  setupLayer: (
    layerDefinition: SensorDefinition | RasterDefinition | HillshadeDefinition
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

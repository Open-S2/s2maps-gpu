import type { GlyphObject } from './glyph/glyph.spec.js';
import type { Features as PointHeatFeatures } from './point.js';
import type { TileRequest } from '../worker.spec.js';
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
  SensorWorkerLayer,
} from 'style/style.spec.js';
import type {
  Properties,
  S2CellId,
  VectorGeometryType,
  VectorMultiLineOffset,
  VectorMultiLineString,
  VectorMultiPoint,
  VectorMultiPolygon,
  VectorMultiPolygonOffset,
} from 'gis-tools/index.js';

// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 22bit: 4,194,304 --- 16bit: 65,535 --- 7bit: 128
export const ID_MAX_SIZE = 1 << 22;

/** Id Generator to ensure features don't overlap. Used by vector workers. */
export class IDGen {
  workerID: number;
  num: number;
  startNum: number;
  incrSize: number;
  maxNum = ID_MAX_SIZE;

  /**
   * @param id - the thread id
   * @param totalWorkers - the total number of threads
   */
  constructor(id: number, totalWorkers: number) {
    this.workerID = id;
    this.num = id + 1;
    this.startNum = id + 1;
    this.incrSize = totalWorkers;
  }

  /** @returns the next id */
  getNum(): number {
    const res = this.num;
    this.num += this.incrSize;
    if (this.num >= this.maxNum) this.num = this.startNum;
    return res;
  }
}

/** FEATURES */

/** All features share these properties */
export interface FeatureBase {
  layerIndex: number;
  code: number[];
  gl2Code: number[];
}
/** All interactive features share these properties */
export interface InteractiveFeatureBase extends FeatureBase {
  idRGB: ColorArray;
}

/** A glyph feature used in a Tile Worker */
export type GlyphFeature = GlyphObject;

/** The output of a Fill Feature from TileWorker->MapRenderer */
export interface FillFeature extends InteractiveFeatureBase {
  vertices: number[];
  indices: number[];
  pattern?: string;
  patternFamily: string;
  patternMovement: boolean;
  missing: boolean;
}

/** The output of a Line Feature from TileWorker->MapRenderer */
export interface LineFeature extends InteractiveFeatureBase {
  vertices: number[];
  lengthSoFar: number[];
  cap: Cap;
}

/** The output of a Point Feature from TileWorker->MapRenderer */
export interface PointFeature extends InteractiveFeatureBase {
  type: 'point';
  vertices: number[];
}

/** The output of a Heatmap Feature from TileWorker->MapRenderer */
export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap';
  vertices: number[];
  weights: number[];
}

/** Grouping of all Features that are shipped to the Renderer */
export type Feature = GlyphFeature | FillFeature | LineFeature | PointFeature | HeatmapFeature;

/** WORKERS */

/** A Trait like Wrapper for Vector Tiles */
export interface VTTile {
  layers: Record<string, VTLayer>;
}

/** A Trait like Wrapper for Vector Layers */
export interface VTLayer {
  length: number;
  extent: number;
  feature: (i: number) => VTFeature;
  features?: VTFeature[];
}

/** A Trait like Wrapper for Vector Features */
export interface VTFeature {
  id?: number;
  properties: Properties;
  offset?: unknown;
  geometry?: unknown;
  geoType: () => VectorGeometryType;
  loadPoints: () => VectorMultiPoint | undefined;
  loadLines: () => [VectorMultiLineString, VectorMultiLineOffset] | undefined;
  loadPolys: () => [VectorMultiPolygon, VectorMultiPolygonOffset] | undefined;
  loadGeometryFlat?: () => [verts: number[], indices: number[]];
}

/** A Trait like Wrapper for Vector Workers */
export interface VectorWorker {
  idGen: IDGen;
  gpuType: GPUType;
  _addInteractiveFeature: (
    id: number,
    properties: Properties,
    workerLayer: InteractiveWorkerLayer,
  ) => void;
  flush: (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    wait: Promise<void>,
  ) => Promise<void>;
  postInteractive: (mapID: string, sourceName: string, tileID: S2CellId) => void;
}

/** Fill Worker */
export interface FillWorker extends VectorWorker {
  featureStore: Map<string, FillFeature[]>;
  invertLayers: Map<number, FillWorkerLayer>;
  setupLayer: (layer: FillDefinition) => FillWorkerLayer;
  buildFeature: (
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    sourceLayer: FillWorkerLayer,
    mapID: string,
    sourceName: string,
  ) => Promise<boolean>;
}

/** Line Worker */
export interface LineWorker extends VectorWorker {
  featureStore: Map<string, LineFeature[]>;
  setupLayer: (layer: LineDefinition) => LineWorkerLayer;
  buildFeature: (
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    sourceLayer: LineWorkerLayer,
    mapID: string,
    sourceName: string,
  ) => boolean;
}

/** Point Worker */
export interface PointWorker extends VectorWorker {
  featureStore: Map<string, PointHeatFeatures>;
  setupLayer: (layer: PointDefinition | HeatmapDefinition) => PointWorkerLayer | HeatmapWorkerLayer;
  buildFeature: (
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    sourceLayer: PointWorkerLayer | HeatmapWorkerLayer,
    mapID: string,
    sourceName: string,
  ) => boolean;
}

/** Heatmap Worker */
export type HeatmapWorker = PointWorker;

/** Glyph Worker */
export interface GlyphWorker extends VectorWorker {
  featureStore: Map<string, GlyphObject[]>;
  setupLayer: (layer: GlyphDefinition) => GlyphWorkerLayer;
  buildFeature: (
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    sourceLayer: GlyphWorkerLayer,
    mapID: string,
    sourceName: string,
  ) => Promise<boolean>;
}

/** Raster Worker */
export interface RasterWorker {
  gpuType: GPUType;
  setupLayer: (
    layerDefinition: SensorDefinition | RasterDefinition | HillshadeDefinition,
  ) => RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer;

  buildTile: (
    mapID: string,
    sourceName: string,
    layers: Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>,
    tile: TileRequest,
    data: ArrayBuffer,
    size: number,
  ) => Promise<void>;
}

/** List of workers the TileWorker handles */
export interface Workers {
  fill?: FillWorker;
  line?: LineWorker;
  point?: PointWorker;
  heatmap?: HeatmapWorker;
  glyph?: GlyphWorker;
  raster?: RasterWorker;
  sensor?: RasterWorker;
  hillshade?: RasterWorker;
}

/** The keys of the workers */
export type WorkersKeys = keyof Workers;

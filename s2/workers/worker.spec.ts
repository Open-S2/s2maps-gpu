import type { AnimationDirections } from 'ui/camera/animator';
import type { Glyph } from 'workers/process/glyph/familySource';
import type { ImageMetadata } from './source/imageSource';
import type { MapOptions } from 'ui/s2mapUI';
import type { MarkerDefinition } from './source/markerSource';
import type { UserTouchEvent } from 'ui/camera/dragPan';
import type { View } from 'ui/camera/projector';
import type {
  Analytics,
  Attributions,
  LayerDefinition,
  Projection,
  StyleDefinition,
  StylePackage,
} from 'style/style.spec';
import type { BBox, Face, Properties } from 'gis-tools';
import type { GlyphImages, GlyphMetadata } from './source/glyphSource';

/** GENERIC WORKER TYPES */

/**
 *
 */
export type CancelTileRequest = number[]; // S2CellIDs of tiles e.g. ['204', '1003', '1245', ...]

/**
 *
 */
export interface MapID {
  mapID: string;
}

/**
 *
 */
export interface ParentLayer {
  face: Face;
  zoom: number;
  i: number;
  j: number;
  id: bigint;
  layerIndexes: number[];
  time?: number;
}

/**
 *
 */
export type ParentLayers = Record<string | number, ParentLayer>;

/**
 *
 */
export interface TileRequest {
  id: bigint;
  face: Face;
  zoom: number;
  i: number;
  j: number;
  type: Projection;
  bbox: BBox;
  division: number;
  time?: number;
  parent?: ParentLayer;
  layerIndexes?: number[];
}

/**
 *
 */
export interface Feature {
  geometry: never[];
  properties: Properties;
  indices?: number[];
}

/**
 *
 */
export interface InteractiveObject extends Properties {
  __id: number;
  __cursor: string;
  __name: string;
  __source: string;
  __layer: string;
}

/** FRONT END TO MAP WORKER MESSAGES */
export interface CanvasMessage {
  type: 'canvas';
  options: MapOptions;
  canvas: HTMLCanvasElement;
  id: string;
}

/**
 *
 */
export interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

/**
 *
 */
export interface ScrollMessage {
  type: 'scroll';
  deltaY: number;
  clientX: number;
  clientY: number;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 *
 */
export interface MousedownMessage {
  type: 'mousedown';
}

/**
 *
 */
export interface MouseupMessage {
  type: 'mouseup';
  clientX: number;
  clientY: number;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

/**
 *
 */
export interface MousemoveMessage {
  type: 'mousemove';
  movementX: number;
  movementY: number;
}

/**
 *
 */
export interface CanvasMousemoveMessage {
  type: 'canvasmousemove';
  x: number;
  y: number;
}

/**
 *
 */
export interface TouchstartMessage {
  type: 'touchstart';
  touchEvent: UserTouchEvent;
}

/**
 *
 */
export interface TouchendMessage {
  type: 'touchend';
  touchEvent: UserTouchEvent;
}

/**
 *
 */
export interface TouchmoveMessage {
  type: 'touchmove';
  touchEvent: UserTouchEvent;
}

/**
 *
 */
export interface NavMessage {
  type: 'nav';
  ctrl: 'zoomIn' | 'zoomOut';
  lon?: number;
  lat?: number;
}

/**
 *
 */
export interface MouseupCompassMessage {
  type: 'mouseupCompass';
}

/**
 *
 */
export interface ResetCompassMessage {
  type: 'resetCompass';
}

/**
 *
 */
export interface ColorModeMessage {
  type: 'colorMode';
  mode: 0 | 1 | 2 | 3;
}

/**
 *
 */
export interface SetStyleMessage {
  type: 'setStyle';
  style: StyleDefinition;
  ignorePosition: boolean;
}

/**
 *
 */
export interface UpdateStyleMessage {
  type: 'updateStyle';
  style: StyleDefinition;
}

/**
 *
 */
export interface JumpToMessage {
  type: 'jumpTo';
  lon: number;
  lat: number;
  zoom?: number;
}

/**
 *
 */
export interface EaseToMessage {
  type: 'easeTo';
  directions?: AnimationDirections;
}

/**
 *
 */
export interface FlyToMessage {
  type: 'flyTo';
  directions?: AnimationDirections;
}

/**
 *
 */
export interface MoveStateMessage {
  type: 'moveState';
  state: boolean;
}

/**
 *
 */
export interface ZoomStateMessage {
  type: 'zoomState';
  state: boolean;
}

/**
 *
 */
export interface ScreenshotMessage {
  type: 'screenshot';
}

/**
 *
 */
export interface AwaitRenderedMessage {
  type: 'awaitRendered';
}

/**
 *
 */
export interface ResetSourceMessage {
  type: 'resetSource';
  sourceNames: Array<[string, string | undefined]>;
  keepCache: boolean;
  awaitReplace: boolean;
}

/**
 *
 */
export interface ClearSourceMessage {
  type: 'clearSource';
  sourceNames: string[];
}

/**
 *
 */
export interface AddLayerMessage {
  type: 'addLayer';
  layer: LayerDefinition;
  nameIndex: number | string;
}

/**
 *
 */
export interface UpdateLayerMessage {
  type: 'updateLayer';
  layer: LayerDefinition;
  nameIndex: number | string;
  fullUpdate: boolean;
}

/**
 *
 */
export interface DeleteLayerMessage {
  type: 'deleteLayer';
  nameIndex: number | string;
}

/**
 *
 */
export interface ReorderLayersMessage {
  type: 'reorderLayers';
  layerChanges: Record<number, number>;
}

/**
 *
 */
export interface DeleteMessage {
  type: 'delete';
}

/**
 *
 */
export type S2MapMessage =
  | CanvasMessage
  | ResizeMessage
  | ScrollMessage
  | MousedownMessage
  | MouseupMessage
  | MousemoveMessage
  | CanvasMousemoveMessage
  | TouchstartMessage
  | TouchendMessage
  | TouchmoveMessage
  | NavMessage
  | UpdateCompassMessage
  | MouseupCompassMessage
  | ResetCompassMessage
  | ColorModeMessage
  | SetStyleMessage
  | UpdateStyleMessage
  | JumpToMessage
  | EaseToMessage
  | FlyToMessage
  | MoveStateMessage
  | ZoomStateMessage
  | ScreenshotMessage
  | AwaitRenderedMessage
  | ResetSourceMessage
  | ClearSourceMessage
  | AddLayerMessage
  | UpdateLayerMessage
  | DeleteLayerMessage
  | ReorderLayersMessage
  | DeleteMessage;

/** FRONT END TO SOURCE WORKER MESSAGES */

/**
 *
 */
export interface AddMarkersMessage extends MapID {
  type: 'addMarkers';
  markers: MarkerDefinition[];
  sourceName: string;
}

/**
 *
 */
export interface DeleteMarkersMessage extends MapID {
  type: 'deleteMarkers';
  ids: number[];
  sourceName: string;
}

/**
 *
 */
export interface DeleteSourceMessage extends MapID {
  type: 'deleteSource';
  sourceNames: string[];
}

/**
 *
 */
export type S2MapToSourceMessage = AddMarkersMessage | DeleteMarkersMessage | DeleteSourceMessage;

/** UI GL REQUESTS -> S2Map or Worker Pool */

/**
 *
 */
export interface TileRequestMessage extends MapID {
  type: 'tilerequest';
  tiles: TileRequest[];
  sources: Array<[string, string | undefined]>;
}

/**
 *
 */
export interface TimeRequestMessage extends MapID {
  type: 'timerequest';
  tiles: TileRequest[];
  sourceNames: string[];
}

/**
 *
 */
export interface MouseEnterMessage extends MapID {
  type: 'mouseenter';
  /** The features that the mouse just "entered" into */
  features: InteractiveObject[];
  /** All features including features "entered" in previous frames */
  currentFeatures: InteractiveObject[];
}

/**
 *
 */
export interface MouseLeaveMessage extends MapID {
  type: 'mouseleave';
  /** The features that the mouse just "left" */
  features: InteractiveObject[];
  /** All features including features "left" in previous frames */
  currentFeatures: InteractiveObject[];
}

/**
 *
 */
export interface MouseClickMessage extends MapID {
  type: 'click';
  features: InteractiveObject[];
  lon: number;
  lat: number;
}

/**
 *
 */
export interface ViewMessage extends MapID {
  type: 'view';
  view: Required<View>;
}

/**
 *
 */
export interface RequestStyleMessage extends MapID {
  type: 'requestStyle';
  style: string; // url
  analytics: Analytics;
  apiKey?: string;
  urlMap?: Record<string, string>;
}

/**
 *
 */
export interface StyleMessage extends MapID {
  type: 'style';
  style: StylePackage;
}

/**
 *
 */
export interface UpdateCompassMessage extends MapID {
  type: 'updateCompass';
  bearing: number;
  pitch: number;
}

/**
 *
 */
export interface AddLayerMessageGL extends MapID {
  type: 'addLayer';
  layer: LayerDefinition;
  index: number;
  tileRequest: TileRequest[];
}

/**
 *
 */
export interface DeleteLayerMessageGL extends MapID {
  type: 'deleteLayer';
  index: number;
}

/**
 *
 */
export interface ReorderLayersMessageGL extends MapID {
  type: 'reorderLayers';
  layerChanges: Record<number, number>;
}

/**
 *
 */
export interface ScreenshotMessageGL extends MapID {
  type: 'screenshot';
  screen: ArrayBuffer;
}

/**
 *
 */
export interface RenderedMessageGL extends MapID {
  type: 'rendered';
}

/**
 *
 */
export interface ReadyMessageGL extends MapID {
  type: 'ready';
}

/**
 *
 */
export type MapGLMessage =
  | TileRequestMessage
  | TimeRequestMessage
  | MouseEnterMessage
  | MouseLeaveMessage
  | MouseClickMessage
  | ViewMessage
  | RequestStyleMessage
  | StyleMessage
  | UpdateCompassMessage
  | AddLayerMessageGL
  | DeleteLayerMessageGL
  | ReorderLayersMessageGL
  | ScreenshotMessageGL
  | RenderedMessageGL
  | ReadyMessageGL;

/**
 *
 */
export type MapGLToSourceMessage =
  | RequestStyleMessage
  | StyleMessage
  | TileRequestMessage
  | TimeRequestMessage
  | AddLayerMessageGL
  | DeleteLayerMessageGL
  | ReorderLayersMessageGL;

/** SOURCE WORKER MESSAGES */

/**
 *
 */
export interface AttributionsMessage extends MapID {
  type: 'attributions';
  attributions: Attributions;
}

/**
 *
 */
export interface SourceSetStyleMessage extends MapID {
  type: 'setStyle';
  style: StyleDefinition;
  ignorePosition: boolean;
}

/**
 *
 */
export interface SpriteImageMessage extends MapID {
  type: 'spriteimage';
  name: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  maxHeight: number;
  image: ImageBitmap;
}

/**
 *
 */
export interface SourceFlushMessage extends MapID {
  type: 'flush';
  from: 'source';
  tileID: bigint;
  layersToBeLoaded: Set<number>;
}

/**
 *
 */
export type SourceWorkerMessage =
  | AttributionsMessage
  | SourceSetStyleMessage
  | SpriteImageMessage
  | SourceFlushMessage;

/** TILE WORKER MESSAGES */

/**
 *
 */
export interface WorkerMessageBase extends MapID {
  tileID: bigint;
  sourceName: string;
}

/**
 *
 */
export interface FillData extends WorkerMessageBase {
  type: 'fill';
  vertexBuffer: ArrayBuffer;
  indexBuffer: ArrayBuffer;
  idBuffer: ArrayBuffer;
  codeTypeBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/**
 *
 */
export interface LineData extends WorkerMessageBase {
  type: 'line';
  vertexBuffer: ArrayBuffer;
  lengthSoFarBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/**
 *
 */
export interface GlyphData extends WorkerMessageBase {
  type: 'glyph';
  glyphFilterBuffer: ArrayBuffer;
  glyphFilterIDBuffer: ArrayBuffer;
  glyphQuadBuffer: ArrayBuffer;
  glyphQuadIDBuffer: ArrayBuffer;
  glyphColorBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/**
 *
 */
export interface GlyphImageData extends MapID {
  type: 'glyphimages';
  maxHeight: number;
  images: GlyphImages;
}

/**
 *
 */
export interface RasterDataGuide {
  code: number[];
  layerIndex: number;
}

/**
 *
 */
export interface RasterData extends WorkerMessageBase {
  type: 'raster';
  image: ImageBitmap;
  size: number;
  featureGuides: RasterDataGuide[];
}

/**
 *
 */
export interface HillshadeData extends WorkerMessageBase {
  type: 'hillshade';
  image: ImageBitmap;
  size: number;
  featureGuides: RasterDataGuide[];
}

/**
 *
 */
export interface SensorData extends WorkerMessageBase {
  type: 'sensor';
  image: ImageBitmap;
  size: number;
  featureGuides: RasterDataGuide[];
  time: number;
}

/**
 *
 */
export interface PointData extends WorkerMessageBase {
  type: 'point';
  vertexBuffer: ArrayBuffer;
  idBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/**
 *
 */
export interface HeatmapData extends WorkerMessageBase {
  type: 'heatmap';
  vertexBuffer: ArrayBuffer;
  weightBuffer: ArrayBuffer;
  idBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/**
 *
 */
export interface InteractiveData extends WorkerMessageBase {
  type: 'interactive';
  interactiveGuideBuffer: ArrayBuffer;
  interactiveDataBuffer: ArrayBuffer;
}

/**
 *
 */
export interface TileFlushMessage extends MapID {
  type: 'flush';
  from: 'tile';
  tileID: bigint;
  sourceName: string;
  deadLayers: number[];
}

/**
 *
 */
export interface TimeSourceData extends WorkerMessageBase {
  type: 'timesource';
  interval: number;
}

/**
 *
 */
export type PainterData =
  | RasterData
  | HillshadeData
  | SensorData
  | FillData
  | LineData
  | PointData
  | HeatmapData
  | GlyphData;

/**
 *
 */
export type TileWorkerMessage =
  | FillData
  | LineData
  | GlyphData
  | GlyphImageData
  | SpriteImageMessage
  | RasterData
  | HillshadeData
  | SensorData
  | PointData
  | HeatmapData
  | InteractiveData
  | TileFlushMessage
  | TimeSourceData;

/** TILE WORKER TO SOURCE WORKER MESSAGES */

/**
 *
 */
export interface GlyphRequestMessage extends MapID {
  type: 'glyphrequest';
  workerID: number;
  reqID: string;
  glyphList: Record<string, string[]>;
}
/**
 *
 */
export type TileWorkerToSourceWorkerMessage = GlyphRequestMessage;

/* SOURCE WORKER TO TILE WORKER MESSAGES */

/**
 *
 */
export interface AddLayerMessageTileWorker extends MapID {
  type: 'addLayer';
  layer: LayerDefinition;
  index: number;
}
/**
 *
 */
export interface VectorMessage extends MapID {
  type: 'vector';
  tile: TileRequest;
  sourceName: string;
  data: ArrayBuffer;
}

/**
 *
 */
export interface RasterMessage extends MapID {
  type: 'raster';
  tile: TileRequest;
  sourceName: string;
  data: ArrayBuffer;
  size: number;
}

/**
 *
 */
export interface JSONDataMessage extends MapID {
  type: 'jsondata';
  tile: TileRequest;
  sourceName: string;
  data: ArrayBuffer;
}

/**
 *
 */
export interface GlyphMetadataMessage extends MapID {
  type: 'glyphmetadata';
  glyphMetadata: GlyphMetadata[];
  imageMetadata: ImageMetadata[];
}

/**
 *
 */
export interface GlyphResponseMessage extends MapID {
  type: 'glyphresponse';
  reqID: string;
  glyphMetadata: Glyph[];
  familyName: string;
}

/* WORKER POOL MESSAGE */

/**
 *
 */
export interface WorkerPoolPortMessage {
  type: 'port';
  id: number;
  totalWorkers: number;
}

/**
 *
 */
export type WorkerPoolMessage = WorkerPoolPortMessage;

/**
 *
 */
export type SourceWorkerMessages =
  | TileWorkerToSourceWorkerMessage
  | S2MapToSourceMessage
  | WorkerPoolMessage
  | MapGLToSourceMessage;

/**
 *
 */
export type TileWorkerMessages =
  | WorkerPoolMessage
  | StyleMessage
  | VectorMessage
  | RasterMessage
  | JSONDataMessage
  | GlyphResponseMessage
  | GlyphMetadataMessage
  | AddLayerMessageTileWorker
  | DeleteLayerMessageGL
  | ReorderLayersMessageGL;

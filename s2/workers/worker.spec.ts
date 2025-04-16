import type { AnimationDirections } from 'ui/camera/animator.js';
import type { ColorMode } from 's2/s2Map.js';
import type { Glyph } from 'workers/process/glyph/familySource.js';
import type { ImageSourceMetadata } from './source/imageSource.js';
import type { MapOptions } from 'ui/s2mapUI.js';
import type { MarkerDefinition } from './source/markerSource.js';
import type { UserTouchEvent } from 'ui/camera/dragPan.js';
import type { View } from 'ui/camera/projector/index.js';
import type {
  Analytics,
  Attributions,
  LayerDefinition,
  Projection,
  Source,
  StyleDefinition,
  StylePackage,
} from 'style/style.spec.js';
import type { BBox, Face, Properties } from 'gis-tools/index.js';
import type { GlyphImages, GlyphMetadata } from './source/glyphSource.js';

/* GENERIC WORKER TYPES */

/** S2CellIDs of tiles e.g. ['204n', '1003n', '1245n', ...] */
export type CancelTileRequest = number[];

/** Tracks the map who made the request */
export interface MapID {
  mapID: string;
}

/** Parent Layer Information. Layer indexes effected by this parent tile */
export interface ParentLayer {
  face: Face;
  zoom: number;
  i: number;
  j: number;
  id: bigint;
  layerIndexes: number[];
  time?: number;
}

/** Parent Layer Information. Layer indexes effected by this parent tile */
export type ParentLayers = Record<string | number, ParentLayer>;

/** Tile Request */
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

/** Interactive Object sub properties */
export interface InteractiveObject extends Properties {
  __id: number;
  __cursor: string;
  __name: string;
  __source: string;
  __layer: string;
}

/* FRONT END TO MAP WORKER MESSAGES */

/** Canvas message shipping the canvas element from the front end to the map worker */
export interface CanvasMessage {
  type: 'canvas';
  options: MapOptions;
  canvas: HTMLCanvasElement;
  id: string;
}

/** Resize message sent from the front end to the map worker */
export interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

/** Scroll message sent from the front end to the map worker */
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

/** Mouse down message sent from the front end to the map worker */
export interface MousedownMessage {
  type: 'mousedown';
}

/** Mouse up message sent from the front end to the map worker */
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

/** Mouse move message sent from the front end to the map worker */
export interface MousemoveMessage {
  type: 'mousemove';
  movementX: number;
  movementY: number;
}

/** Canvas mouse move message sent from the front end to the map worker */
export interface CanvasMousemoveMessage {
  type: 'canvasmousemove';
  x: number;
  y: number;
}

/** Touch start message sent from the front end to the map worker */
export interface TouchstartMessage {
  type: 'touchstart';
  touchEvent: UserTouchEvent;
}

/** Touch end message sent from the front end to the map worker */
export interface TouchendMessage {
  type: 'touchend';
  touchEvent: UserTouchEvent;
}

/** Touch move message sent from the front end to the map worker */
export interface TouchmoveMessage {
  type: 'touchmove';
  touchEvent: UserTouchEvent;
}

/** Navigation message sent from the front end to the map worker */
export interface NavMessage {
  type: 'nav';
  ctrl: 'zoomIn' | 'zoomOut';
  lon?: number;
  lat?: number;
}

/** Mouse up compass message sent from the front end to the map worker */
export interface MouseupCompassMessage {
  type: 'mouseupCompass';
}

/** Reset compass message sent from the front end to the map worker */
export interface ResetCompassMessage {
  type: 'resetCompass';
}

/** Color mode message sent from the front end to the map worker */
export interface ColorModeMessage {
  type: 'colorMode';
  mode: ColorMode;
}

/** Set style message sent from the front end to the map worker */
export interface SetStyleMessage {
  type: 'setStyle';
  style: StyleDefinition;
  ignorePosition: boolean;
}

/** Update style message sent from the front end to the map worker */
export interface UpdateStyleMessage {
  type: 'updateStyle';
  style: StyleDefinition;
}

/** Jump to message sent from the front end to the map worker */
export interface JumpToMessage {
  type: 'jumpTo';
  lon: number;
  lat: number;
  zoom?: number;
}

/** Ease to message sent from the front end to the map worker */
export interface EaseToMessage {
  type: 'easeTo';
  directions?: AnimationDirections;
}

/** Fly to message sent from the front end to the map worker */
export interface FlyToMessage {
  type: 'flyTo';
  directions?: AnimationDirections;
}

/** Move state message sent from the front end to the map worker */
export interface MoveStateMessage {
  type: 'moveState';
  state: boolean;
}

/** Zoom state message sent from the front end to the map worker */
export interface ZoomStateMessage {
  type: 'zoomState';
  state: boolean;
}

/** Screenshot request message sent from the front end to the map worker */
export interface ScreenshotMessage {
  type: 'screenshot';
}

/** Await rendered message sent from the front end to the map worker */
export interface AwaitRenderedMessage {
  type: 'awaitRendered';
}

/** Reset source message sent from the front end to the map worker */
export interface ResetSourceMessage {
  type: 'resetSource';
  sourceNames: Array<[string, string | undefined]>;
  keepCache: boolean;
  awaitReplace: boolean;
}

/** Clear source message sent from the front end to the map worker */
export interface ClearSourceMessage {
  type: 'clearSource';
  sourceNames: string[];
}

/** Add layer message sent from the front end to the map worker */
export interface AddLayerMessage {
  type: 'addLayer';
  layer: LayerDefinition;
  nameIndex: number | string;
}

/** Update layer message sent from the front end to the map worker */
export interface UpdateLayerMessage {
  type: 'updateLayer';
  layer: LayerDefinition;
  nameIndex: number | string;
  fullUpdate: boolean;
}

/** Delete layer message sent from the front end to the map worker */
export interface DeleteLayerMessage {
  type: 'deleteLayer';
  nameIndex: number | string;
}

/** Reorder layers message sent from the front end to the map worker */
export interface ReorderLayersMessage {
  type: 'reorderLayers';
  layerChanges: Record<number, number>;
}

/** Delete message sent from the front end to the map worker */
export interface DeleteMessage {
  type: 'delete';
}

/** Message sent from the front end to the map worker */
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

/* FRONT END TO SOURCE WORKER MESSAGES */

/** Add markers message sent from the front end to the source worker */
export interface AddMarkersMessage extends MapID {
  type: 'addMarkers';
  markers: MarkerDefinition[];
  sourceName: string;
}

/** Delete markers message sent from the front end to the source worker */
export interface DeleteMarkersMessage extends MapID {
  type: 'deleteMarkers';
  ids: number[];
  sourceName: string;
}

/** Add source message sent from the front end to the source worker */
export interface AddSourceMessage extends MapID {
  type: 'addSource';
  sourceName: string;
  source: Source;
  tileRequest: TileRequest[];
}

/** Delete source message sent from the front end to the source worker */
export interface DeleteSourceMessage extends MapID {
  type: 'deleteSource';
  sourceNames: string[];
}

/** Messages sent from the front end to the source worker */
export type S2MapToSourceMessage = AddMarkersMessage | DeleteMarkersMessage | DeleteSourceMessage;

/* UI GL REQUESTS -> S2Map or Worker Pool */

/** Tile request message sent from the map worker to the source worker */
export interface TileRequestMessage extends MapID {
  type: 'tilerequest';
  tiles: TileRequest[];
  sources: Array<[string, string | undefined]>;
}

/** Time request message sent from the map worker to the source worker */
export interface TimeRequestMessage extends MapID {
  type: 'timerequest';
  tiles: TileRequest[];
  sourceNames: string[];
}

/** Messages sent from the map worker to the source worker */
export interface MouseEnterMessage extends MapID {
  type: 'mouseenter';
  /** The features that the mouse just "entered" into */
  features: InteractiveObject[];
  /** All features including features "entered" in previous frames */
  currentFeatures: InteractiveObject[];
}

/** Messages sent from the map worker to the source worker */
export interface MouseLeaveMessage extends MapID {
  type: 'mouseleave';
  /** The features that the mouse just "left" */
  features: InteractiveObject[];
  /** All features including features "left" in previous frames */
  currentFeatures: InteractiveObject[];
}

/** Messages sent from the map worker to the source worker */
export interface MouseClickMessage extends MapID {
  type: 'click';
  features: InteractiveObject[];
  lon: number;
  lat: number;
}

/** View message sent from the map worker to the front end */
export interface ViewMessage extends MapID {
  type: 'view';
  view: Required<View>;
}

/** Requesting a style from the map worker to the source worker */
export interface RequestStyleMessage extends MapID {
  type: 'requestStyle';
  style: string; // url
  analytics: Analytics;
  apiKey?: string;
  urlMap?: Record<string, string>;
}

/** Style request message sent from the map worker to the front end */
export interface StyleMessage extends MapID {
  type: 'style';
  style: StylePackage;
}

/** Update compass message sent from the map worker to the front end */
export interface UpdateCompassMessage extends MapID {
  type: 'updateCompass';
  bearing: number;
  pitch: number;
}

/** Add layer message sent from the map worker to the source worker */
export interface AddLayerMessageGL extends MapID {
  type: 'addLayer';
  layer: LayerDefinition;
  index: number;
  tileRequest: TileRequest[];
}

/** Delete layer message sent from the map worker to the source worker */
export interface DeleteLayerMessageGL extends MapID {
  type: 'deleteLayer';
  index: number;
}

/** Reorder layers message sent from the map worker to the source worker */
export interface ReorderLayersMessageGL extends MapID {
  type: 'reorderLayers';
  layerChanges: Record<number, number>;
}

/** Screenshot message sent from the map worker to the front end */
export interface ScreenshotMessageGL extends MapID {
  type: 'screenshot';
  screen: ArrayBuffer;
}

/** Rendered message sent from the map worker to the front end */
export interface RenderedMessageGL extends MapID {
  type: 'rendered';
}

/** Ready message sent from the map worker to the front end */
export interface ReadyMessageGL extends MapID {
  type: 'ready';
}

/** Collection of messages that can be sent from the map worker to the front end */
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

/** Collection of messages that can be sent from the map worker to the source worker */
export type MapGLToSourceMessage =
  | RequestStyleMessage
  | StyleMessage
  | TileRequestMessage
  | TimeRequestMessage
  | AddLayerMessageGL
  | DeleteLayerMessageGL
  | ReorderLayersMessageGL;

/* SOURCE WORKER MESSAGES */

/** Attribution message sent from the source worker to the front-end */
export interface AttributionsMessage extends MapID {
  type: 'attributions';
  attributions: Attributions;
}

/** Style message sent from the source worker to the front-end */
export interface SourceSetStyleMessage extends MapID {
  type: 'setStyle';
  style: StyleDefinition;
  ignorePosition: boolean;
}

/** Sprite image message sent from the source worker to the front-end */
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

/** Flush message sent from the source worker to the front-end */
export interface SourceFlushMessage extends MapID {
  type: 'flush';
  from: 'source';
  tileID: bigint;
  layersToBeLoaded: Set<number>;
}

/** Collection of messages that can be sent from the source worker to the front-end */
export type SourceWorkerMessage =
  | AttributionsMessage
  | SourceSetStyleMessage
  | SpriteImageMessage
  | SourceFlushMessage;

/* TILE WORKER MESSAGES */

/** Worker message base. Used in most messages from the tile worker to the source worker or front-end */
export interface WorkerMessageBase extends MapID {
  tileID: bigint;
  sourceName: string;
}

/** Fill render data from the Tile Worker to the front-end */
export interface FillData extends WorkerMessageBase {
  type: 'fill';
  vertexBuffer: ArrayBuffer;
  indexBuffer: ArrayBuffer;
  idBuffer: ArrayBuffer;
  codeTypeBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/** Line render data from the Tile Worker to the front-end */
export interface LineData extends WorkerMessageBase {
  type: 'line';
  vertexBuffer: ArrayBuffer;
  lengthSoFarBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/** Glyph render data from the Tile Worker to the front-end */
export interface GlyphData extends WorkerMessageBase {
  type: 'glyph';
  glyphFilterBuffer: ArrayBuffer;
  glyphFilterIDBuffer: ArrayBuffer;
  glyphQuadBuffer: ArrayBuffer;
  glyphQuadIDBuffer: ArrayBuffer;
  glyphColorBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/** Glyph image data from the Tile Worker to the front-end */
export interface GlyphImageData extends MapID {
  type: 'glyphimages';
  maxHeight: number;
  images: GlyphImages;
}

/** Raster data guide shipped from the Tile Worker to the front-end */
export interface RasterDataGuide {
  code: number[];
  layerIndex: number;
}

/** Raster data shipped from the Tile Worker to the front-end */
export interface RasterData extends WorkerMessageBase {
  type: 'raster';
  image: ImageBitmap;
  size: number;
  featureGuides: RasterDataGuide[];
}

/** Hillshade data shipped from the Tile Worker to the front-end */
export interface HillshadeData extends WorkerMessageBase {
  type: 'hillshade';
  image: ImageBitmap;
  size: number;
  featureGuides: RasterDataGuide[];
}

/** Sensor data shipped from the Tile Worker to the front-end */
export interface SensorData extends WorkerMessageBase {
  type: 'sensor';
  image: ImageBitmap;
  size: number;
  featureGuides: RasterDataGuide[];
  time: number;
}

/** Point data shipped from the Tile Worker to the front-end */
export interface PointData extends WorkerMessageBase {
  type: 'point';
  vertexBuffer: ArrayBuffer;
  idBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/** Heatmap data shipped from the Tile Worker to the front-end */
export interface HeatmapData extends WorkerMessageBase {
  type: 'heatmap';
  vertexBuffer: ArrayBuffer;
  weightBuffer: ArrayBuffer;
  idBuffer: ArrayBuffer;
  featureGuideBuffer: ArrayBuffer;
}

/** Interactive data shipped from the Tile Worker to the front-end */
export interface InteractiveData extends WorkerMessageBase {
  type: 'interactive';
  interactiveGuideBuffer: ArrayBuffer;
  interactiveDataBuffer: ArrayBuffer;
}

/** Tile Flush message shipped from the Tile Worker to the front-end */
export interface TileFlushMessage extends MapID {
  type: 'flush';
  from: 'tile';
  tileID: bigint;
  sourceName: string;
  deadLayers: number[];
}

/** Temporal source data shipped from the Tile Worker to the front-end */
export interface TimeSourceData extends WorkerMessageBase {
  type: 'timesource';
  interval: number;
}

/** All rendering type data grouped */
export type PainterData =
  | RasterData
  | HillshadeData
  | SensorData
  | FillData
  | LineData
  | PointData
  | HeatmapData
  | GlyphData;

/** Tile worker messages that are shipped from a Tile Worker to the front end */
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

/** Glyph Request asked by the Tile Worker to the Source Worker */
export interface GlyphRequestMessage extends MapID {
  type: 'glyphrequest';
  workerID: number;
  reqID: string;
  glyphList: Record<string, string[]>;
}

/** Messages the Tile Worker's ship to the Source Worker */
export type TileWorkerToSourceWorkerMessage = GlyphRequestMessage;

/* SOURCE WORKER TO TILE WORKER MESSAGES */

/** Add layer message sent from the Source Worker to the Tile Worker */
export interface AddLayerMessageTileWorker extends MapID {
  type: 'addLayer';
  layer: LayerDefinition;
  index: number;
}
/** Vector tile message sent from the Source Worker to the Tile Worker */
export interface VectorMessage extends MapID {
  type: 'vector';
  tile: TileRequest;
  sourceName: string;
  data: ArrayBuffer;
}

/** Raster tile message sent from the Source Worker to the Tile Worker */
export interface RasterMessage extends MapID {
  type: 'raster';
  tile: TileRequest;
  sourceName: string;
  data: ArrayBuffer;
  size: number;
}

/** JSON data message sent from the Source Worker to the Tile Worker */
export interface JSONDataMessage extends MapID {
  type: 'jsondata';
  tile: TileRequest;
  sourceName: string;
  data: ArrayBuffer;
}

/** Glyph metadata message sent from the Source Worker to the Tile Worker */
export interface GlyphMetadataMessage extends MapID {
  type: 'glyphmetadata';
  glyphMetadata: GlyphMetadata[];
  imageMetadata: ImageSourceMetadata[];
}

/** Glyph response message sent from the Source Worker to the Tile Worker */
export interface GlyphResponseMessage extends MapID {
  type: 'glyphresponse';
  reqID: string;
  glyphMetadata: Glyph[];
  familyName: string;
}

/* WORKER POOL MESSAGE */

/** Message from the worker pool to the tile workers so they can track their own id and total tile worker count */
export interface WorkerPoolPortMessage {
  type: 'port';
  id: number;
  totalWorkers: number;
}

/* LISTED MESSAGES */

/** List of messages that are sent from the WorkerPool */
export type WorkerPoolMessage = WorkerPoolPortMessage;

/** List of messages that are sent from the SourceWorker */
export type SourceWorkerMessages =
  | TileWorkerToSourceWorkerMessage
  | S2MapToSourceMessage
  | WorkerPoolMessage
  | MapGLToSourceMessage;

/** List of messages that are sent from the TileWorker */
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

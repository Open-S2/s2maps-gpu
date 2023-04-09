import type { Analytics, Attributions, LayerDefinition, StyleDefinition, StylePackage } from 's2/style/style.spec'
import type { AnimationDirections } from 's2/ui/camera/animator'
import type { UserTouchEvent } from 's2/ui/camera/dragPan'
import type { InfoData } from 's2/ui/info'
import type { MapOptions } from 's2/ui/s2mapUI'
import type { Face, Properties } from 's2/projections'
import type { ColorMap, GlyphImages, IconMap } from './source/glyphSource'
import type { MarkerDefinition } from './source/markerSource'

/** GENERIC WORKER TYPES **/

export type CancelTileRequest = number[] // S2CellIDs of tiles e.g. ['204', '1003', '1245', ...]

export interface MapID {
  mapID: string
}

export interface ParentLayer {
  face: Face
  zoom: number
  i: number
  j: number
  id: bigint
  layerIndexes: number[]
  time?: number
}

export interface ParentLayers {
  [key: string | number]: ParentLayer
}

export interface TileRequest {
  id: bigint
  face: Face
  zoom: number
  i: number
  j: number
  bbox: [number, number, number, number]
  division: number
  size: number
  time?: number
  parent?: ParentLayer
  layerIndexes?: number[]
}

// export interface Feature {
//   vertices: number[]
//   indices: number[]
//   geometry?: number[][]
//   featureCode: number[]
//   code: number[]
//   size: number
//   divisor: number
//   layerIndex: number
// }

export interface Feature {
  geometry: any[]
  properties: Properties
  indices?: number[]
}

export interface InteractiveObject extends Properties {
  __id: number
  __cursor: string
  __name: string
  __source: string
  __layer: string
}

/** FRONT END TO MAP WORKER MESSAGES */
export interface CanvasMessage {
  type: 'canvas'
  options: MapOptions
  canvas: HTMLCanvasElement
  id: string
}

export interface ResizeMessage {
  type: 'resize'
  width: number
  height: number
}

export interface ScrollMessage {
  type: 'scroll'
  deltaY: number
  clientX: number
  clientY: number
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
}

export interface MousedownMessage {
  type: 'mousedown'
}

export interface MouseupMessage {
  type: 'mouseup'
  clientX: number
  clientY: number
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
}

export interface MousemoveMessage {
  type: 'mousemove'
  movementX: number
  movementY: number
}

export interface CanvasMousemoveMessage {
  type: 'canvasmousemove'
  x: number
  y: number
}

export interface TouchstartMessage {
  type: 'touchstart'
  touchEvent: UserTouchEvent
}

export interface TouchendMessage {
  type: 'touchend'
  touchEvent: UserTouchEvent
}

export interface TouchmoveMessage {
  type: 'touchmove'
  touchEvent: UserTouchEvent
}

export interface NavMessage {
  type: 'nav'
  ctrl: 'zoomIn' | 'zoomOut'
  lon?: number
  lat?: number
}

export interface UpdateComassMessage {
  type: 'updateCompass'
  bearing: number
}

export interface MouseupCompassMessage {
  type: 'mouseupCompass'
}

export interface ResetCompassMessage {
  type: 'resetCompass'
}

export interface ColorModeMessage {
  type: 'colorMode'
  mode: 0 | 1 | 2 | 3
}

export interface SetStyleMessage {
  type: 'setStyle'
  style: StyleDefinition
  ignorePosition: boolean
}

export interface UpdateStyleMessage {
  type: 'updateStyle'
  style: StyleDefinition
}

export interface JumpToMessage {
  type: 'jumpTo'
  lon: number
  lat: number
  zoom?: number
}

export interface EaseToMessage {
  type: 'easeTo'
  directions?: AnimationDirections
}

export interface FlyToMessage {
  type: 'flyTo'
  directions?: AnimationDirections
}

export interface MoveStateMessage {
  type: 'moveState'
  state: boolean
}

export interface ZoomStateMessage {
  type: 'zoomState'
  state: boolean
}

export interface ScreenshotMessage {
  type: 'screenshot'
}

export interface ResetSourceMessage {
  type: 'resetSource'
  sourceNames: Array<[string, string | undefined]>
  keepCache: boolean
  awaitReplace: boolean
}

export interface ClearSourceMessage {
  type: 'clearSource'
  sourceNames: string[]
}

export interface AddLayerMessage {
  type: 'addLayer'
  layer: LayerDefinition
  nameIndex: number | string
}

export interface UpdateLayerMessage {
  type: 'updateLayer'
  layer: LayerDefinition
  nameIndex: number | string
  fullUpdate: boolean
}

export interface RemoveLayerMessage {
  type: 'removeLayer'
  nameIndex: number | string
}

export interface ReorderLayersMessage {
  type: 'reorderLayers'
  layerChanges: { [key: number]: number }
}

export interface DeleteMessage {
  type: 'delete'
}

export type S2MapMessage =
  CanvasMessage | ResizeMessage | ScrollMessage | MousedownMessage |
  MouseupMessage | MousemoveMessage | CanvasMousemoveMessage | TouchstartMessage |
  TouchendMessage | TouchmoveMessage | NavMessage | UpdateComassMessage |
  MouseupCompassMessage | ResetCompassMessage | ColorModeMessage |
  SetStyleMessage | UpdateStyleMessage | JumpToMessage | EaseToMessage | FlyToMessage |
  MoveStateMessage | ZoomStateMessage | ScreenshotMessage | ResetSourceMessage |
  ClearSourceMessage | AddLayerMessage | UpdateLayerMessage | RemoveLayerMessage |
  ReorderLayersMessage | DeleteMessage

/** FRONT END TO SOURCE WORKER MESSAGES */

export interface GetInfoMessage extends MapID {
  type: 'getInfo'
  featureID: number
}

export interface AddMarkersMessage extends MapID {
  type: 'addMarkers'
  markers: MarkerDefinition[]
  sourceName: string
}

export interface RemoveMarkersMessage extends MapID {
  type: 'removeMarkers'
  ids: number[]
  sourceName: string
}

export interface DeleteSourceMessage extends MapID {
  type: 'deleteSource'
  sourceNames: string[]
}

export type S2MapToSourceMessage =
  GetInfoMessage | AddMarkersMessage | RemoveMarkersMessage | DeleteSourceMessage

/** UI GL REQUESTS -> S2Map or Worker Pool **/

export interface TileRequestMessage extends MapID {
  type: 'tilerequest'
  tiles: TileRequest[]
  sources: Array<[string, string]>
}

export interface TimeRequestMessage extends MapID {
  type: 'timerequest'
  tiles: TileRequest[]
  sourceNames: string[]
}

export interface MouseEnterMessage extends MapID {
  type: 'mouseenter'
  feature: InteractiveObject
}

export interface MouseLeaveMessage extends MapID {
  type: 'mouseleave'
  feature?: InteractiveObject
}

export interface MouseClickMessage extends MapID {
  type: 'click'
  feature: InteractiveObject
  lon: number
  lat: number
}

export interface PositionMessage extends MapID {
  type: 'pos'
  lon: number
  lat: number
  zoom: number
}

export interface RequestStyleMessage extends MapID {
  type: 'requestStyle'
  style: string // url
  analytics: Analytics
  apiKey?: string
}

export interface StyleMessage extends MapID {
  type: 'style'
  style: StylePackage
}

export interface UpdateCompassMessage extends MapID {
  type: 'updateCompass'
  bearing: number
  pitch: number
}

export interface AddLayerMessageGL extends MapID {
  type: 'addLayer'
  layer: LayerDefinition
  index: number
  tileRequest: TileRequest[]
}

export interface RemoveLayerMessageGL extends MapID {
  type: 'removeLayer'
  index: number
}

export interface ReorderLayersMessageGL extends MapID {
  type: 'reorderLayers'
  layerChanges: { [key: number]: number }
}

export interface ScreenshotMessageGL extends MapID {
  type: 'screenshot'
  screen: ArrayBuffer
}

export interface ReadyMessageGL extends MapID {
  type: 'ready'
}

export type MapGLMessage =
  TileRequestMessage | TimeRequestMessage | MouseEnterMessage |
  MouseLeaveMessage | MouseClickMessage | PositionMessage |
  RequestStyleMessage | StyleMessage | UpdateCompassMessage |
  AddLayerMessageGL | RemoveLayerMessageGL | ReorderLayersMessageGL |
  ScreenshotMessageGL | ReadyMessageGL

export type MapGLToSourceMessage =
  RequestStyleMessage | StyleMessage | TileRequestMessage |
  TimeRequestMessage | AddLayerMessageGL | RemoveLayerMessageGL |
  ReorderLayersMessageGL

/** SOURCE WORKER MESSAGES **/

export interface AttributionsMessage extends MapID {
  type: 'attributions'
  attributions: Attributions
}

export interface InfoMessage extends MapID {
  type: 'info'
  json: InfoData
}

export interface SourceSetStyleMessage extends MapID {
  type: 'setStyle'
  style: StyleDefinition
  ignorePosition: boolean
}

export type SourceWorkerMessage =
  AttributionsMessage | InfoMessage | SourceSetStyleMessage

/** TILE WORKER MESSAGES **/

export interface WorkerMessageBase extends MapID {
  tileID: bigint
  sourceName: string
}

export interface FillData extends WorkerMessageBase {
  type: 'fill'
  vertexBuffer: ArrayBuffer
  indexBuffer: ArrayBuffer
  fillIDBuffer: ArrayBuffer
  codeTypeBuffer: ArrayBuffer
  featureGuideBuffer: ArrayBuffer
}

export interface LineData extends WorkerMessageBase {
  type: 'line'
  vertexBuffer: ArrayBuffer
  lengthSoFarBuffer: ArrayBuffer
  featureGuideBuffer: ArrayBuffer
}

export interface GlyphData extends WorkerMessageBase {
  type: 'glyph'
  glyphFilterBuffer: ArrayBuffer
  glyphFilterIDBuffer: ArrayBuffer
  glyphQuadBuffer: ArrayBuffer
  glyphQuadIDBuffer: ArrayBuffer
  glyphColorBuffer: ArrayBuffer
  featureGuideBuffer: ArrayBuffer
}

export interface GlyphImageData extends WorkerMessageBase {
  type: 'glyphimages'
  maxHeight: number
  images: GlyphImages
}

export interface RasterDataGuide {
  code: number[]
  layerIndex: number
}

export interface RasterData extends WorkerMessageBase {
  type: 'raster'
  image: ArrayBuffer | ImageBitmap
  built: boolean
  size: number
  featureGuides: RasterDataGuide[]
}

export interface SensorDataGuide extends RasterDataGuide {}

export interface SensorData extends WorkerMessageBase {
  type: 'sensor'
  image: ArrayBuffer | ImageBitmap
  built: boolean
  size: number
  featureGuides: RasterDataGuide[]
  time: number
}

export interface PointData extends WorkerMessageBase {
  type: 'point'
  vertexBuffer: ArrayBuffer
  fillIDBuffer: ArrayBuffer
  featureGuideBuffer: ArrayBuffer
}

export interface HeatmapData extends WorkerMessageBase {
  type: 'heatmap'
  vertexBuffer: ArrayBuffer
  weightBuffer: ArrayBuffer
  fillIDBuffer: ArrayBuffer
  featureGuideBuffer: ArrayBuffer
}

export interface InteractiveData extends WorkerMessageBase {
  type: 'interactive'
  interactiveGuideBuffer: ArrayBuffer
  interactiveDataBuffer: ArrayBuffer
}

export interface FlushData extends MapID {
  type: 'flush'
  tileID: bigint
  layers: {
    [key: number]: number
  }
}

export interface TimeSourceData extends WorkerMessageBase {
  type: 'timesource'
  interval: number
}

export type PainterData =
  RasterData | SensorData | FillData | LineData |
  PointData | HeatmapData | GlyphData | SensorData

export type TileWorkerMessage =
  FillData | LineData | GlyphData | GlyphImageData |
  RasterData | SensorData | PointData | HeatmapData |
  InteractiveData | FlushData | TimeSourceData

/** TILE WORKER TO SOURCE WORKER MESSAGES */

export interface GlyphRequestMessage extends MapID {
  type: 'glyphrequest'
  workerID: number
  reqID: string
  glyphList: { [key: string]: ArrayBuffer }
  iconList: { [key: string]: Set<string> }
}
export type TileWorkerToSourceWorkerMessage = GlyphRequestMessage

/* SOURCE WORKER TO TILE WORKER MESSAGES */

export interface AddLayerMessageTileWorker extends MapID {
  type: 'addLayer'
  layer: LayerDefinition
  index: number
}
export interface VectorMessage extends MapID {
  type: 'vector'
  tile: TileRequest
  sourceName: string
  data: ArrayBuffer
}

export interface RasterMessage extends MapID {
  type: 'raster'
  tile: TileRequest
  sourceName: string
  data: ArrayBuffer
  size: number
}

export interface JSONDataMessage extends MapID {
  type: 'jsondata'
  tile: TileRequest
  sourceName: string
  data: ArrayBuffer
}

export interface GlyphResponseMessage extends MapID {
  type: 'glyphresponse'
  reqID: string
  glyphMetadata: ArrayBuffer
  familyName: string
  icons: IconMap
  colors: ColorMap
}

/* WORKER POOL MESSAGE */

export interface WorkerPoolPortMessage {
  type: 'port'
  id: number
  totalWorkers: number
}

export type WorkerPoolMessage = WorkerPoolPortMessage

export type SourceWorkerMessages =
  TileWorkerToSourceWorkerMessage | S2MapToSourceMessage |
  WorkerPoolMessage | MapGLToSourceMessage

export type TileWorkerMessages =
  WorkerPoolMessage | StyleMessage | VectorMessage |
  RasterMessage | JSONDataMessage | GlyphResponseMessage |
  AddLayerMessageTileWorker | RemoveLayerMessageGL | ReorderLayersMessageGL

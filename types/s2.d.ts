interface Properties {
  [key: string]: any
}

type Point = [number, number]

interface MarkerDefinition {
  id?: number
  lon: number
  lat: number
  html?: string // HTMLElement
  properties?: { [key: string]: any }
  geometry?: Point
}

interface MouseEvent {
  layerX: number
  layerY: number
}

interface CorsWorker extends Worker {}

class WorkerPool {
  workerCount: number
  workers: CorsWorker[]
  sourceWorker: CorsWorker
  maps: { [key: string]: S2Map }
  addMap: (map: S2Map) => void
  requestStyle: (mapID: string, style: string, analytics: Analytics, apiKey?: string) => void
  injectStyle: (mapID: string, style: StylePackage) => void
  delete: () => void
  tileRequest: (mapID: string, tiles: TileRequest[], sources?: Array<[string, string | undefined]>) => void
  timeRequest: (mapID: string, tiles: TileRequest[], sourceNames: string[]) => void
  getInfo: (mapID: string, featureID: number) => void
  addMarkers: (mapID: string, markers: MarkerDefinition[], sourceName: string) => void
  removeMarkers: (mapID: string, ids: number[], sourceName: string) => void
  deleteSource: (mapID: string, sourceNames: string[]) => void
  addLayer: (mapID: string, layer: LayerDefinition, index: number, tileRequest: TileRequest[]) => void
  removeLayer: (mapID: string, index: number) => void
  reorderLayers: (mapID: string, layerChanges: { [key: string | number]: number }) => void
}

type Ready = (s2map: S2Map) => void

interface MapOptions {
  contextType?: 1 | 2 | 3 // can force a specific context type (1 -> webgl1, 2 -> webgl2, 3 -> webgpu)
  container?: HTMLElement // used by offscreen canvas
  interactive?: boolean
  apiKey?: string
  style: StyleDefinition | string
  scrollZoom?: boolean
  positionalZoom?: boolean // If true, cursor position impacts zoom's x & y directions [default: true]
  canvasMultiplier?: number
  attributions?: { [key: string]: string }
  attributionOff?: boolean
  infoLayers?: string[]
  controls?: boolean // zoom, compass, and colorblind turned on or off
  zoomController?: boolean
  compassController?: boolean
  colorblindController?: boolean
  canZoom?: boolean
  canMove?: boolean
  darkMode?: boolean
  webworker?: boolean
  noClamp?: boolean // lat and lon can be any number
}

class S2Map extends EventTarget {
  bearing: number
  pitch: number
  colorMode: ColorMode
  map?: S2MapGL
  offscreen?: Worker
  info?: Info
  id: string
  _canvas: HTMLCanvasElement
  constructor (options: MapOptions, ready?: Ready)
  delete: () => void
  injectData: (data: SourceWorkerMessage | TileWorkerMessage) => void
  getContainer: () => HTMLElement
  getCanvasContainer: () => HTMLElement
  getContainerDimensions: () => null | [number, number]
  setStyle: (style: StyleDefinition, ignorePosition: boolean = true) => void
  updateStyle: (style: StyleDefinition) => void
  setMoveState: (state: boolean) => void
  setZoomState: (state: boolean) => void
  jumpTo: (lon: number, lat: number, zoom?: number) => void
  easeTo: (directions?: AnimationDirections) => void
  flyTo: (directions?: AnimationDirections) => void
  getInfo: (featureID: number) => void
  addSource: (sourceName: string, href: string) => void
  updateSource: (
    sourceName: string,
    href: string,
    keepCache: boolean = true,
    awaitReplace: boolean = true
  ) => void

  resetSource: (
    sourceNames: Array<[string, string | undefined]>,
    keepCache: boolean = false,
    awaitReplace: boolean = false
  ) => void

  deleteSource: (sourceNames: string | string[]) => void
  addLayer: (layer: LayerStyle, nameIndex: number | string) => void
  updateLayer: (layer: LayerStyle, nameIndex: number | string, fullUpdate: boolean) => void
  removeLayer: (nameIndex: number | string) => void
  reorderLayers: (layerChanges: { [key: string | number]: number }) => void

  addMarker: (
    markers: MarkerDefinition | MarkerDefinition[],
    sourceName?: string
  ) => void

  removeMarker: (
    ids: number | number[],
    sourceName?: string
  ) => void

  async screenshot: () => Promise<null | Uint8Array>
}

/* STYLE DATA */

type FilterFunction = (properties: Properties) => boolean

interface StyleDefinition {
  version?: number
  name?: string
  description?: string
  center?: [number, number]
  zoom?: number
  zNear?: number
  zFar?: number
  bearing?: number
  pitch?: number
  minzoom?: number
  maxzoom?: number
  minLatPosition?: number
  maxLatPosition?: number
  zoomOffset?: number
  noClamp?: boolean
  sources?: Sources
  'time-series'?: TimeSeriesStyle
  glyphs?: Glyphs
  fonts?: Fonts
  icons?: Icons
  skybox?: SkyboxStyle
  wallpaper?: WallpaperStyle
  layers?: LayerStyle[]
}

/** SOURCES **/
type Format = 'fzxy' | 'tfzxy'

interface LayerMetaData {
  [key: string]: { // layer
    minzoom: number
    maxzoom: number
    fields?: { [key: string]: Array<string | number | boolean> } // max fields size of 50
  }
}

interface Attributions {
  [key: string]: string
}

// MUST have
interface SourceMetadata {
  path: string
  type: 'vector' | 'json' | 'raster' | 'raster-dem' | 'sensor'
  extension: string
  fileType?: 'json' | 's2json' | 'pbf' | 'png' | 'jpg' | 'webp'
  encoding?: 'gz' | 'br' | 'none'
  format?: Format
  size?: number // required by raster type sources
  attributions?: Attributions
  interval?: number
  minzoom?: number
  maxzoom?: number
  faces?: number[]
  layers?: LayerMetaData
  sourceName?: string // if you want to make requests without getting metadata, you need this
}
type Source = string | SourceMetadata
interface Sources { [key: string]: Source } // address to source or source itself

/** GLYPHS, FONTS, AND ICONS */

interface Glyphs {
  [key: string]: string | {
    path: string
    fallback?: string
  }
}
interface Fonts extends Glyphs {}
interface Icons extends Glyphs {}

/** LAYER MANAGMENT

User defined layers are stored in the style.layers array.
To ensure proper ordering (future GPU use) and ensure valid data,
The layer data is sent to the appropriate program to process into a "Definition" version.
Style -> Definition

The next step deviates upon whether the layer is used for rendering (program), or for filtering (worker).

Worflow (program / pipeline):
Definition[paint + layout] ->
  webgl1: encodeLayerAttribute (stores "code" var)
  webgl2 + webgpu: encodeLayerAttribute (stores "code" var)

Worker:
Definition[paint + layout] -> parseFeatureFunction (updates all paint + layout properties to LayerFunction)

**/

type Cursor = 'default' | 'pointer' | 'wait' | 'not-allowed' | 'crosshair' | 'none'

type LayerWorkerFunction<U> = (code: number[], properties: Properties, zoom: number) => U

type BuildCodeFunction = (zoom: number, properties: Properties) => [number[], number[]]
type BuildCodeFunctionZoom = (zoom: number) => number[]

/** FILL **/
interface FillPaintStyle {
  color?: string | any[]
  opacity?: number | any[]
}
interface FillPaintDefinition {
  color: string | any[]
  opacity: number | any[]
}

/** POINT **/
interface PointPaintStyle {
  color?: string | any[]
  radius?: number | any[]
  stroke?: string | any[]
  strokeWidth?: number | any[]
  opacity?: number | any[]
}
interface PointPaintDefinition {
  color: string | any[]
  radius: number | any[]
  stroke: string | any[]
  strokeWidth: number | any[]
  opacity: number | any[]
}

/** HEATMAP **/
interface HeatmapLayoutStyle {
  'color-ramp'?: 'sinebow' | 'sinebow-extended' | Array<number | string>
  weight?: number | any[]
}
interface HeatmapLayoutDefinition {
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<number | string>
  weight: number | any[]
}
interface HeatmapPaintStyle {
  radius?: number | any[]
  opacity?: number | any[]
  intensity?: number | any[]
}
interface HeatmapPaintDefinition {
  radius: number | any[]
  opacity: number | any[]
  intensity: number | any[]
}

/** LINE **/
type Cap = 'butt' | 'square' | 'round'
type Join = 'bevel' | 'miter' | 'round'
interface LineLayoutStyle {
  cap?: Cap
  join?: Join
  dasharray?: Array<[number, string]>
}
interface LineLayoutDefinition {
  cap: Cap
  join: Join
  dasharray: number[] | any[]
}
interface LinePaintStyle {
  color?: string | any[]
  opacity?: number | any[]
  width?: number | any[]
  gapwidth?: number | any[]
}
interface LinePaintDefinition {
  color: string | any[]
  opacity: number | any[]
  width: number | any[]
  gapwidth: number | any[]
}

/** GLYPH **/
type Anchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type Alignment = 'center' | 'left' | 'right'
interface GlyphLayoutStyle {
  'text-family'?: string | any[]
  'text-field'?: string | string[] | any[]
  'text-anchor'?: Anchor | any[]
  'text-offset'?: number | any[]
  'text-padding'?: number | any[]
  'text-word-wrap'?: number | any[]
  'text-align'?: Alignment | any[]
  'text-kerning'?: number | any[]
  'text-line-height'?: number | any[]
  'icon-family'?: string | any[]
  'icon-field'?: string | string[] | any[]
  'icon-anchor'?: Anchor | any[]
  'icon-offset'?: number | any[]
  'icon-padding'?: number | any[]
}
interface GlyphLayoutDefinition {
  textFamily: string | any[]
  textField: string | string[] | any[]
  textAnchor: Anchor | any[]
  textOffset: number | any[]
  textPadding: number | any[]
  textWordWrap: number | any[]
  textAlign: Alignment | any[]
  textKerning: number | any[]
  textLineHeight: number | any[]
  iconFamily: string | any[]
  iconField: string | string[] | any[]
  iconAnchor: Anchor | any[]
  iconOffset: number | any[]
  iconPadding: number | any[]
}
interface GlyphWorkerLayout {
  textFamily: LayerWorkerFunction<string>
  textField: LayerWorkerFunction<string | string[]>
  textAnchor: LayerWorkerFunction<string>
  textOffset: LayerWorkerFunction<[number, number]>
  textPadding: LayerWorkerFunction<[number, number]>
  textWordWrap: LayerWorkerFunction<number>
  textAlign: LayerWorkerFunction<Alignment>
  textKerning: LayerWorkerFunction<number>
  textLineHeight: LayerWorkerFunction<number>
  iconFamily: LayerWorkerFunction<string>
  iconField: LayerWorkerFunction<string | string[]>
  iconAnchor: LayerWorkerFunction<Anchor>
  iconOffset: LayerWorkerFunction<[number, number]>
  iconPadding: LayerWorkerFunction<[number, number]>
}
interface GlyphPaintStyle {
  'text-size'?: number | any[]
  'text-fill'?: string | any[]
  'text-stroke'?: string | any[]
  'text-stroke-width'?: number | any[]
  'icon-size'?: number | any[]
}
interface GlyphPaintDefinition {
  textSize: number | any[]
  textFill: string | any[]
  textStroke: string | any[]
  textStrokeWidth: number | any[]
  iconSize: number | any[]
}

/** RASTER **/
type Resampling = 'nearest' | 'linear'

interface RasterPaintStyle {
  opacity?: number | any[]
  saturation?: number | any[]
  contrast?: number | any[]
  'fade-duration'?: number
  resampling?: Resampling
}
interface RasterPaintDefinition {
  opacity: number | any[]
  saturation: number | any[]
  contrast: number | any[]
}
interface RasterWorkerPaint {
  opacity: LayerWorkerFunction<number>
  saturation: LayerWorkerFunction<number>
  contrast: LayerWorkerFunction<number>
}

/** SENSOR DATA **/
interface SensorPaintStyle {
  opacity?: number | any[]
  'fade-duration'?: number
}
interface SensorPaintDefinition {
  opacity: number | any[]
}
interface SensorLayoutStyle {
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<number | string>
}

/** TIME SERIES **/

interface TimeSeriesStyle {
  'start-date'?: number | string // date formatted string or unix timestamp
  'end-date'?: 1631124000000 // date formatted string or unix timestamp
  speed?: 10800 // seconds in time series per second
  'pause-duration'?: 3 // in seconds
  'auto-play'?: true // if true, start playing automatically
  loop?: true // if true, loop the animation
}

/** Layer **/
type LayerType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'sensor' | 'shade'
type LayerDataType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'sensor'

// Found in style.json
interface LayerStyleBase {
  type?: LayerType
  name?: string
  source?: string
  layer?: string
  minzoom?: number
  maxzoom?: number
  filter?: any[] // ["any" ["class" "==" "ocean"] ["class" "==" "river"]]
  lch?: boolean
}
// refines the style.json to ensure all variables exist that need to
interface LayerDefinitionBase {
  type?: any
  name: string
  layerIndex: number
  source: string
  layer: string
  minzoom: number
  maxzoom: number
  filter?: any[] // ["any" ["class" "==" "ocean"] ["class" "==" "river"]]
  lch: boolean
}
// uses definition to create a guide for the workflow (program/pipeline)
interface LayerWorkflowGuideBase {
  sourceName: string
  layerIndex: number
  layerCode: number[]
  lch: boolean
}
// worker takes the definition and creates a layer to prep input data for workflow (program/pipeline)
interface LayerWorkerBase {
  type: LayerType
  name: string
  layerIndex: number
  source: string
  layer: string
  minzoom: number
  maxzoom: number
  filter: FilterFunction
}

interface LayerWorkerBaseRaster {
  type: LayerType
  name: string
  layerIndex: number
  source: string
  layer: string
  minzoom: number
  maxzoom: number
}

interface UnkownLayerStyle extends LayerStyleBase {}

interface FillLayerStyle extends LayerStyleBase {
  type: 'fill'
  paint?: FillPaintStyle
  invert?: boolean
  interactive?: boolean
  cursor?: Cursor
  opaque?: boolean
}
interface FillLayerDefinition extends LayerDefinitionBase {
  type: 'fill'
  paint: FillPaintDefinition
  invert: boolean
  interactive: boolean
  cursor: Cursor
  opaque: boolean
}
interface FillWorkflowLayerGuide extends LayerWorkflowGuideBase {
  invert: boolean
  opaque: boolean
  interactive: boolean
  color?: LayerWorkerFunction<[number, number, number, number]>
  opacity?: LayerWorkerFunction<number[]>
}
interface FillWorkerLayer extends LayerWorkerBase {
  type: 'fill'
  getCode: BuildCodeFunction
  invert: boolean
  interactive: boolean
  cursor: Cursor
  opaque: boolean
}

interface GlyphLayerStyle extends LayerStyleBase {
  type: 'glyph'
  paint?: GlyphPaintStyle
  layout?: GlyphLayoutStyle
  overdraw?: boolean
  interactive?: boolean
  cursor?: Cursor
}
interface GlyphLayerDefinition extends LayerDefinitionBase {
  type: 'glyph'
  paint: GlyphPaintDefinition
  layout: GlyphLayoutDefinition
  overdraw: boolean
  interactive: boolean
  cursor: Cursor
}
interface GlyphWorkflowLayerGuide extends LayerWorkflowGuideBase {
  interactive: boolean
  cursor: Cursor
  overdraw: boolean
}
interface GlyphWorkerLayer extends LayerWorkerBase {
  type: 'glyph'
  textGetCode: BuildCodeFunction
  iconGetCode: BuildCodeFunction
  iconPaint?: number[]
  textSize: LayerWorkerFunction<number>
  iconSize: LayerWorkerFunction<number>
  layout: GlyphWorkerLayout
  overdraw: boolean
  interactive: boolean
  cursor: Cursor
}

interface HeatmapLayerStyle extends LayerStyleBase {
  type: 'heatmap'
  paint?: HeatmapPaintStyle
  layout?: HeatmapLayoutStyle
}
interface HeatmapLayerDefinition extends LayerDefinitionBase {
  type: 'heatmap'
  paint: HeatmapPaintDefinition
  layout: HeatmapLayoutDefinition
}
interface HeatmapWorkflowLayerGuide extends LayerWorkflowGuideBase {
  colorRamp: WebGLTexture
}
interface HeatmapWorkerLayer extends LayerWorkerBase {
  type: 'heatmap'
  getCode: BuildCodeFunction
  weight: LayerWorkerFunction<number>
}

interface LineLayerStyle extends LayerStyleBase {
  type: 'line'
  paint?: LinePaintStyle
  layout?: LineLayoutStyle
  onlyLines?: boolean
  interactive?: boolean
  cursor?: Cursor
}
interface LineLayerDefinition extends LayerDefinitionBase {
  type: 'line'
  paint: LinePaintDefinition
  layout: LineLayoutDefinition
  dashed: boolean
  onlyLines: boolean
  interactive: boolean
  cursor: Cursor
}
interface LineWorkflowLayerGuide extends LayerWorkflowGuideBase {
  dashed: boolean
  dashTexture?: WebGLTexture
  interactive: boolean
  cursor: Cursor
}
interface LineWorkerLayer extends LayerWorkerBase {
  type: 'line'
  layout: {
    cap: LayerWorkerFunction<Cap>
    join: LayerWorkerFunction<Join>
  }
  getCode: BuildCodeFunction
  dashed: boolean
  onlyLines: boolean
  interactive: boolean
  cursor: Cursor
}

interface PointLayerStyle extends LayerStyleBase {
  type: 'point'
  paint?: PointPaintStyle
  interactive?: boolean
  cursor?: Cursor
}
interface PointLayerDefinition extends LayerDefinitionBase {
  type: 'point'
  paint: PointPaintDefinition
  interactive: boolean
  cursor: Cursor
}
interface PointWorkflowLayerGuide extends LayerWorkflowGuideBase {
  interactive: boolean
  cursor: Cursor
}
interface PointWorkerLayer extends LayerWorkerBase {
  type: 'point'
  getCode: BuildCodeFunction
  interactive: boolean
  cursor: Cursor
}

interface RasterLayerStyle extends LayerStyleBase {
  type: 'raster'
  paint?: RasterPaintStyle
}
interface RasterLayerDefinition extends LayerDefinitionBase {
  type: 'raster'
  paint: RasterPaintDefinition
}
interface RasterWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
  resampling: Resampling
}
interface RasterWorkerLayer extends LayerWorkerBaseRaster {
  type: 'raster'
  getCode: BuildCodeFunctionZoom
}

interface SensorLayerStyle extends LayerStyleBase {
  type: 'sensor'
  paint?: SensorPaintStyle
  layout?: SensorLayoutStyle
  interactive?: boolean
  cursor?: Cursor
}
interface SensorLayerDefinition extends LayerDefinitionBase {
  type: 'sensor'
  paint: SensorPaintDefinition
}
interface SensorWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
  colorRamp: WebGLTexture
}
interface SensorWorkerLayer extends LayerWorkerBaseRaster {
  type: 'sensor'
  getCode: BuildCodeFunctionZoom
}

interface ShadeLayerStyle extends LayerStyleBase {
  type: 'shade'
}
interface ShadeLayerDefinition extends LayerDefinitionBase {
  type: 'shade'
}
interface ShadeWorkerLayer extends LayerWorkerBase {
  type: 'shade'
}

type LayerStyle =
  UnkownLayerStyle | FillLayerStyle | GlyphLayerStyle | HeatmapLayerStyle |
  LineLayerStyle | PointLayerStyle | RasterLayerStyle | SensorLayerStyle |
  ShadeLayerStyle
type LayerDefinition =
  FillLayerDefinition | GlyphLayerDefinition | HeatmapLayerDefinition |
  LineLayerDefinition | PointLayerDefinition | RasterLayerDefinition |
  SensorLayerDefinition | ShadeLayerDefinition
type WorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | HeatmapWorkerLayer |
  LineWorkerLayer | PointWorkerLayer | RasterWorkerLayer |
  SensorWorkerLayer
type VectorWorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | HeatmapWorkerLayer |
  LineWorkerLayer | PointWorkerLayer

type InteractiveWorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | LineWorkerLayer |
  PointWorkerLayer

/** WORKER PACKAGE **/
type GPUType = 1 | 2 | 3

interface Analytics {
  gpu: string
  context: number
  language: string
  width: number
  height: number
}

interface StylePackage {
  gpuType: GPUType
  sources: Sources
  fonts: Fonts
  icons: Icons
  glyphs: Glyphs
  layers: LayerDefinition[]
  minzoom: number
  maxzoom: number
  analytics: Analytics
  apiKey?: string
}

/** WALLPAPER **/
type SkyboxImageType = 'png' | 'jpg' | 'jpeg' | 'webp' | 'avic'

interface SkyboxStyle {
  path: string
  size: number
  type: SkyboxImageType
  loadingBackground?: string
}

interface WallpaperStyle {
  background?: string
  fade1?: string
  fade2?: string
  halo?: string
}

interface StyleDefinition {
  version?: number
  name?: string
  description?: string
  center?: [number, number]
  zoom?: number
  zNear?: number
  zFar?: number
  bearing?: number
  pitch?: number
  minzoom?: number
  maxzoom?: number
  minLatPosition?: number
  maxLatPosition?: number
  zoomOffset?: number
  noClamp?: boolean
  sources?: Sources
  'time-series'?: TimeSeriesStyle
  glyphs?: Glyphs
  fonts?: Fonts
  icons?: Icons
  skybox?: SkyboxStyle
  wallpaper?: WallpaperStyle
  layers?: LayerStyle[]
}

declare module 's2' {
  global {
    interface Window {
      S2WorkerPool: WorkerPool
      S2Map: typeof S2Map
    }
  }
}

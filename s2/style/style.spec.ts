/* eslint-env browser */

import type { Properties } from 's2/geometry/proj.spec'
import type { FilterFunction } from 's2/workers/process/util/parseFilter'

/** SOURCES **/
export type Format = 'zxy' | 'tzxy' | 'fzxy' | 'tfzxy'

// WM => Web Mercator
// S2 => Sphere
export type Projection = 'WM' | 'S2'

export interface LayerMetaData {
  [key: string]: { // layer
    minzoom: number
    maxzoom: number
    fields?: { [key: string]: Array<string | number | boolean> } // max fields size of 50
  }
}

export interface Attributions {
  [key: string]: string
}

// MUST have
export interface SourceMetadata {
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
export type Source = string | SourceMetadata
export interface Sources { [key: string]: Source } // address to source or source itself

/** GLYPHS, FONTS, AND ICONS */

export interface Glyphs {
  [key: string]: string | {
    path: string
    fallback?: string
  }
}
export interface Fonts extends Glyphs {}
export interface Icons extends Glyphs {}

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

export type Cursor = 'default' | 'pointer' | 'wait' | 'not-allowed' | 'crosshair' | 'none'

export type LayerWorkerFunction<U> = (code: number[], properties: Properties, zoom: number) => U

export type BuildCodeFunction = (zoom: number, properties: Properties) => [number[], number[]]
export type BuildCodeFunctionZoom = (zoom: number) => number[]

/** FILL **/
export interface FillPaintStyle {
  color?: string | any[]
  opacity?: number | any[]
}
export interface FillPaintDefinition {
  color: string | any[]
  opacity: number | any[]
}

/** POINT **/
export interface PointPaintStyle {
  color?: string | any[]
  radius?: number | any[]
  stroke?: string | any[]
  strokeWidth?: number | any[]
  opacity?: number | any[]
}
export interface PointPaintDefinition {
  color: string | any[]
  radius: number | any[]
  stroke: string | any[]
  strokeWidth: number | any[]
  opacity: number | any[]
}

/** HEATMAP **/
export interface HeatmapLayoutStyle {
  'color-ramp'?: 'sinebow' | 'sinebow-extended' | Array<number | string>
  weight?: number | any[]
}
export interface HeatmapLayoutDefinition {
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<number | string>
  weight: number | any[]
}
export interface HeatmapPaintStyle {
  radius?: number | any[]
  opacity?: number | any[]
  intensity?: number | any[]
}
export interface HeatmapPaintDefinition {
  radius: number | any[]
  opacity: number | any[]
  intensity: number | any[]
}

/** LINE **/
export type Cap = 'butt' | 'square' | 'round'
export type Join = 'bevel' | 'miter' | 'round'
export interface LineLayoutStyle {
  cap?: Cap
  join?: Join
  dasharray?: Array<[number, string]>
}
export interface LineLayoutDefinition {
  cap: Cap
  join: Join
  dasharray: number[] | any[]
}
export interface LinePaintStyle {
  color?: string | any[]
  opacity?: number | any[]
  width?: number | any[]
  gapwidth?: number | any[]
}
export interface LinePaintDefinition {
  color: string | any[]
  opacity: number | any[]
  width: number | any[]
  gapwidth: number | any[]
}

/** GLYPH **/
export type Anchor =
  'center' | 'left' | 'right' | 'top' | 'bottom' |
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type Alignment = 'center' | 'left' | 'right'
export interface GlyphLayoutStyle {
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
export interface GlyphLayoutDefinition {
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
export interface GlyphWorkerLayout {
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
export interface GlyphPaintStyle {
  'text-size'?: number | any[]
  'text-fill'?: string | any[]
  'text-stroke'?: string | any[]
  'text-stroke-width'?: number | any[]
  'icon-size'?: number | any[]
}
export interface GlyphPaintDefinition {
  textSize: number | any[]
  textFill: string | any[]
  textStroke: string | any[]
  textStrokeWidth: number | any[]
  iconSize: number | any[]
}

/** RASTER **/
export type Resampling = 'nearest' | 'linear'

export interface RasterPaintStyle {
  opacity?: number | any[]
  saturation?: number | any[]
  contrast?: number | any[]
  'fade-duration'?: number
  resampling?: Resampling
}
export interface RasterPaintDefinition {
  opacity: number | any[]
  saturation: number | any[]
  contrast: number | any[]
}
export interface RasterWorkerPaint {
  opacity: LayerWorkerFunction<number>
  saturation: LayerWorkerFunction<number>
  contrast: LayerWorkerFunction<number>
}

/** SENSOR DATA **/
export interface SensorPaintStyle {
  opacity?: number | any[]
  'fade-duration'?: number
}
export interface SensorPaintDefinition {
  opacity: number | any[]
}
export interface SensorLayoutStyle {
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<number | string>
}

/** TIME SERIES **/

export interface TimeSeriesStyle {
  'start-date'?: number | string // date formatted string or unix timestamp
  'end-date'?: 1631124000000 // date formatted string or unix timestamp
  speed?: 10800 // seconds in time series per second
  'pause-duration'?: 3 // in seconds
  'auto-play'?: true // if true, start playing automatically
  loop?: true // if true, loop the animation
}

/** Layer **/
export type LayerType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'sensor' | 'shade'
export type LayerDataType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'sensor'

// Found in style.json
export interface LayerStyleBase {
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
export interface LayerDefinitionBase {
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
export interface LayerWorkflowGuideBase {
  sourceName: string
  layerIndex: number
  layerCode: number[]
  lch: boolean
}
// worker takes the definition and creates a layer to prep input data for workflow (program/pipeline)
export interface LayerWorkerBase {
  type: LayerType
  name: string
  layerIndex: number
  source: string
  layer: string
  minzoom: number
  maxzoom: number
  filter: FilterFunction
}

export interface LayerWorkerBaseRaster {
  type: LayerType
  name: string
  layerIndex: number
  source: string
  layer: string
  minzoom: number
  maxzoom: number
}

export interface UnkownLayerStyle extends LayerStyleBase {}

export interface FillLayerStyle extends LayerStyleBase {
  type: 'fill'
  paint?: FillPaintStyle
  invert?: boolean
  interactive?: boolean
  cursor?: Cursor
  opaque?: boolean
}
export interface FillLayerDefinition extends LayerDefinitionBase {
  type: 'fill'
  paint: FillPaintDefinition
  invert: boolean
  interactive: boolean
  cursor: Cursor
  opaque: boolean
}
export interface FillWorkflowLayerGuide extends LayerWorkflowGuideBase {
  invert: boolean
  opaque: boolean
  interactive: boolean
  color?: LayerWorkerFunction<[number, number, number, number]>
  opacity?: LayerWorkerFunction<number[]>
}
export interface FillWorkerLayer extends LayerWorkerBase {
  type: 'fill'
  getCode: BuildCodeFunction
  invert: boolean
  interactive: boolean
  cursor: Cursor
  opaque: boolean
}

export interface GlyphLayerStyle extends LayerStyleBase {
  type: 'glyph'
  paint?: GlyphPaintStyle
  layout?: GlyphLayoutStyle
  overdraw?: boolean
  interactive?: boolean
  cursor?: Cursor
}
export interface GlyphLayerDefinition extends LayerDefinitionBase {
  type: 'glyph'
  paint: GlyphPaintDefinition
  layout: GlyphLayoutDefinition
  overdraw: boolean
  interactive: boolean
  cursor: Cursor
}
export interface GlyphWorkflowLayerGuide extends LayerWorkflowGuideBase {
  interactive: boolean
  cursor: Cursor
  overdraw: boolean
}
export interface GlyphWorkerLayer extends LayerWorkerBase {
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

export interface HeatmapLayerStyle extends LayerStyleBase {
  type: 'heatmap'
  paint?: HeatmapPaintStyle
  layout?: HeatmapLayoutStyle
}
export interface HeatmapLayerDefinition extends LayerDefinitionBase {
  type: 'heatmap'
  paint: HeatmapPaintDefinition
  layout: HeatmapLayoutDefinition
}
export interface HeatmapWorkflowLayerGuide extends LayerWorkflowGuideBase {
  colorRamp: WebGLTexture
}
export interface HeatmapWorkerLayer extends LayerWorkerBase {
  type: 'heatmap'
  getCode: BuildCodeFunction
  weight: LayerWorkerFunction<number>
}

export interface LineLayerStyle extends LayerStyleBase {
  type: 'line'
  paint?: LinePaintStyle
  layout?: LineLayoutStyle
  onlyLines?: boolean
  interactive?: boolean
  cursor?: Cursor
}
export interface LineLayerDefinition extends LayerDefinitionBase {
  type: 'line'
  paint: LinePaintDefinition
  layout: LineLayoutDefinition
  dashed: boolean
  onlyLines: boolean
  interactive: boolean
  cursor: Cursor
}
export interface LineWorkflowLayerGuide extends LayerWorkflowGuideBase {
  dashed: boolean
  dashTexture?: WebGLTexture
  interactive: boolean
  cursor: Cursor
}
export interface LineWorkerLayer extends LayerWorkerBase {
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

export interface PointLayerStyle extends LayerStyleBase {
  type: 'point'
  paint?: PointPaintStyle
  interactive?: boolean
  cursor?: Cursor
}
export interface PointLayerDefinition extends LayerDefinitionBase {
  type: 'point'
  paint: PointPaintDefinition
  interactive: boolean
  cursor: Cursor
}
export interface PointWorkflowLayerGuide extends LayerWorkflowGuideBase {
  interactive: boolean
  cursor: Cursor
}
export interface PointWorkerLayer extends LayerWorkerBase {
  type: 'point'
  getCode: BuildCodeFunction
  interactive: boolean
  cursor: Cursor
}

export interface RasterLayerStyle extends LayerStyleBase {
  type: 'raster'
  paint?: RasterPaintStyle
}
export interface RasterLayerDefinition extends LayerDefinitionBase {
  type: 'raster'
  paint: RasterPaintDefinition
}
export interface RasterWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
  resampling: Resampling
}
export interface RasterWorkerLayer extends LayerWorkerBaseRaster {
  type: 'raster'
  getCode: BuildCodeFunctionZoom
}

export interface SensorLayerStyle extends LayerStyleBase {
  type: 'sensor'
  paint?: SensorPaintStyle
  layout?: SensorLayoutStyle
  interactive?: boolean
  cursor?: Cursor
}
export interface SensorLayerDefinition extends LayerDefinitionBase {
  type: 'sensor'
  paint: SensorPaintDefinition
}
export interface SensorWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
  colorRamp: WebGLTexture
}
export interface SensorWorkerLayer extends LayerWorkerBaseRaster {
  type: 'sensor'
  getCode: BuildCodeFunctionZoom
}

export interface ShadeLayerStyle extends LayerStyleBase {
  type: 'shade'
}
export interface ShadeLayerDefinition extends LayerDefinitionBase {
  type: 'shade'
}
export interface ShadeWorkerLayer extends LayerWorkerBase {
  type: 'shade'
}

export type LayerStyle =
  UnkownLayerStyle | FillLayerStyle | GlyphLayerStyle | HeatmapLayerStyle |
  LineLayerStyle | PointLayerStyle | RasterLayerStyle | SensorLayerStyle |
  ShadeLayerStyle
export type LayerDefinition =
  FillLayerDefinition | GlyphLayerDefinition | HeatmapLayerDefinition |
  LineLayerDefinition | PointLayerDefinition | RasterLayerDefinition |
  SensorLayerDefinition | ShadeLayerDefinition
export type WorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | HeatmapWorkerLayer |
  LineWorkerLayer | PointWorkerLayer | RasterWorkerLayer |
  SensorWorkerLayer
export type VectorWorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | HeatmapWorkerLayer |
  LineWorkerLayer | PointWorkerLayer

export type InteractiveWorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | LineWorkerLayer |
  PointWorkerLayer

/**
 * WORKER PACKAGE: 
 * 1 -> WebGL1;
 * 2 -> WebGL2;
 * 3 -> WebGPU;
 */
export type GPUType = 1 | 2 | 3

export interface Analytics {
  gpu: string
  context: number
  language: string
  width: number
  height: number
}

export interface StylePackage {
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
export type SkyboxImageType = 'png' | 'jpg' | 'jpeg' | 'webp' | 'avic'

export interface SkyboxStyle {
  path: string
  size: number
  type: SkyboxImageType
  loadingBackground?: string
}

export interface WallpaperStyle {
  background?: string
  fade1?: string
  fade2?: string
  halo?: string
}

export interface StyleDefinition {
  version?: number
  name?: string
  projection?: Projection,
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

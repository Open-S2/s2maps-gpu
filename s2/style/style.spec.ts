/* eslint-env browser */

import type { Properties } from 'geometry/proj.spec'
import type { Filter, FilterFunction } from 'style/parseFilter'
import type { EaseType } from './easingFunctions'
import type { MapOptions } from 'ui/s2mapUI'

export type { Properties } from 'geometry/proj.spec'
export type { Filter } from './parseFilter'
export type { EaseType } from './easingFunctions'
export type { MapOptions } from 'ui/s2mapUI'

/** SOURCES **/
export type Format = 'zxy' | 'tzxy' | 'fzxy' | 'tfzxy'

// WM => Web Mercator
// S2 => Sphere
export type Projection = 'WM' | 'S2'

export type LayerMetaData = Record<string, { // layer
  minzoom: number
  maxzoom: number
  fields?: Record<string, Array<string | number | boolean>> // max fields size of 50
}>

export type Attributions = Record<string, string>

// MUST have
export interface SourceMetadata {
  path: string
  type: 'vector' | 'json' | 'raster' | 'raster-dem' | 'sensor'
  extension: string
  fileType?: 'json' | 's2json' | 'pbf' | 'png' | 'jpg' | 'webp'
  encoding?: 'gz' | 'br' | 'none'
  bounds?: [minX: number, minY: number, maxX: number, maxY: number]
  format?: Format
  size?: number // required by raster type sources
  attributions?: Attributions
  interval?: number
  minzoom?: number
  maxzoom?: number
  faces?: number[]
  layers?: LayerMetaData
  sourceName?: string // if you want to make requests without getting metadata, you need this
  // used by geojson sources
  data?: unknown
  cluster?: boolean
  clusterRadius?: number
  clusterMaxZoom?: number
  clusterMinPoints?: number
  clusterProperties?: Record<string, unknown>
}
export type Source = string | SourceMetadata
export type Sources = Record<string, Source> // address to source or source itself

/** GLYPHS, FONTS, SPRITES, AND ICONS */

export type Glyphs = Record<string, string | {
  path: string
  fallback?: string
}>
export interface Fonts extends Glyphs {}
export interface Icons extends Glyphs {}
export type SpriteFileType = 'png' | 'webp' | 'avif'
export type Sprites = Record<string, string | {
  path: string
  fallback?: string
  fileType?: SpriteFileType
}>

/** LAYER MANAGMENT

User defined layers are stored in the style.layers array.
To ensure proper ordering (future GPU use) and ensure valid data,
the layer data is sent to the appropriate program to process into a "Definition" version.
Style -> Definition

The next step deviates upon whether the layer is used for rendering (program), or for filtering (worker).

Worflow (program / pipeline):
Definition[paint + layout] ->
  webgl1: encodeLayerAttribute (stores "code" var)
  webgl2 + webgpu: encodeLayerAttribute (stores "code" var)

Worker:
Definition[paint + layout] -> parseFeatureFunction (updates all paint + layout properties to LayerFunction)

**/

export type Cursor = CSSStyleDeclaration['cursor']

export type LayerWorkerFunction<U> = (code: number[], properties: Properties, zoom: number) => U

export type BuildCodeFunction = (zoom: number, properties: Properties) => [number[], number[]]
export type BuildCodeFunctionZoom = (zoom: number) => number[]

export type Comparator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | '!in' | 'has' | '!has'

export interface DataCondition<T extends NotNullOrObject> {
  conditions: Array<{
    filter: Filter
    input: T | Property<T>
  }>
  fallback: T | Property<T>
}

// export type DataRange<T extends NotNullOrObject> = DataRangeStep<T> | DataRangeEase<T>

export interface DataRangeEase<T extends number | string> {
  key: string // the objects[key] -> value used as position on range
  ease?: EaseType
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface DataRangeStep<T extends NotNullOrObject> {
  key: string // the objects[key] -> value used as position on range
  ease: 'step'
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface InputRangeEase<T extends number | string> {
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch'
  ease?: EaseType
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface InputRangeStep<T extends NotNullOrObject> {
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch'
  ease: 'step'
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface FeatureState<T extends NotNullOrObject> {
  condition: 'default' /* (inactive) */ | 'active' | 'hover' | 'selected' | 'disabled'
  key: string
  value: T
  input: T | Property<T>
}

export type NotNullOrObject = string | number | boolean | bigint | Array<string | number | boolean | bigint>
export type ValueType<T> = T extends NotNullOrObject ? T : never
export type NumberColor<T> = T extends (number | string) ? T : never

export interface Property<T extends NotNullOrObject> {
  dataCondition?: DataCondition<ValueType<T>>
  dataRange?: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>>
  inputRange?: InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>
  featureState?: FeatureState<ValueType<T>>
  fallback?: T | Property<T>
}

/** Layer */
export type LayerType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor' | 'shade'
export type LayerDataType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor'

// Found in style.json
export interface LayerStyleBase {
  type?: LayerType
  name?: string
  source?: string
  layer?: string
  minzoom?: number
  maxzoom?: number
  filter?: Filter
  lch?: boolean
  metadata?: unknown
}
// refines the style.json to ensure all variables exist that need to
export interface LayerDefinitionBase {
  type: LayerType
  name: string
  layerIndex: number
  source: string
  layer: string
  minzoom: number
  maxzoom: number
  filter?: Filter
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

/** FILL **/

export interface FillLayerStyle extends LayerStyleBase {
  type: 'fill'
  // paint
  color?: string | Property<string>
  opacity?: number | Property<number>
  // properties
  invert?: boolean
  interactive?: boolean
  cursor?: Cursor
  opaque?: boolean
}
export interface FillLayerDefinition extends LayerDefinitionBase {
  type: 'fill'
  // paint
  color: string | Property<string>
  opacity: number | Property<number>
  // properties
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
export interface FillWorkflowLayerGuideGPU extends FillWorkflowLayerGuide {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
}
export interface FillWorkerLayer extends LayerWorkerBase {
  type: 'fill'
  getCode: BuildCodeFunction
  invert: boolean
  interactive: boolean
  cursor: Cursor
  opaque: boolean
}

/** GLYPH **/

// TODO: Add opacity
export type Anchor =
  'center' | 'left' | 'right' | 'top' | 'bottom' |
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type Alignment = 'auto' | 'center' | 'left' | 'right'
export interface GlyphLayerStyle extends LayerStyleBase {
  type: 'glyph'
  // paint
  textSize?: number | Property<number>
  textFill?: string | Property<string>
  textStroke?: string | Property<string>
  textStrokeWidth?: number | Property<number>
  iconSize?: number | Property<number>
  // layout
  textFamily?: string | Property<string>
  textField?: string | string[] | Property<string | string[]>
  textAnchor?: Anchor | Property<Anchor>
  textOffset?: [number, number] | Property<[number, number]>
  textPadding?: [number, number] | Property<[number, number]>
  textWordWrap?: number | Property<number>
  textAlign?: Alignment | Property<Alignment>
  textKerning?: number | Property<number>
  textLineHeight?: number | Property<number>
  iconFamily?: string | Property<string>
  iconField?: string | string[] | Property<string | string[]>
  iconAnchor?: Anchor | Property<Anchor>
  iconOffset?: [number, number] | Property<[number, number]>
  iconPadding?: [number, number] | Property<[number, number]>
  // properties
  overdraw?: boolean
  interactive?: boolean
  cursor?: Cursor
}
export interface GlyphLayerDefinition extends LayerDefinitionBase {
  type: 'glyph'
  // paint
  textSize: number | Property<number>
  textFill: string | Property<string>
  textStroke: string | Property<string>
  textStrokeWidth: number | Property<number>
  iconSize: number | Property<number>
  // layout
  textFamily: string | Property<string>
  textField: string | string[] | Property<string | string[]>
  textAnchor: Anchor | Property<Anchor>
  textOffset: [number, number] | Property<[number, number]>
  textPadding: [number, number] | Property<[number, number]>
  textWordWrap: number | Property<number>
  textAlign: Alignment | Property<Alignment>
  textKerning: number | Property<number>
  textLineHeight: number | Property<number>
  iconFamily: string | Property<string>
  iconField: string | string[] | Property<string | string[]>
  iconAnchor: Anchor | Property<Anchor>
  iconOffset: [number, number] | Property<[number, number]>
  iconPadding: [number, number] | Property<[number, number]>
  // properties
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
  // paint
  iconPaint?: number[]
  textSize: LayerWorkerFunction<number>
  iconSize: LayerWorkerFunction<number>
  // layout
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
  // properties
  overdraw: boolean
  interactive: boolean
  cursor: Cursor
}

/** HEATMAP **/

export interface HeatmapLayerStyle extends LayerStyleBase {
  type: 'heatmap'
  // paint
  radius?: number | Property<number>
  opacity?: number | Property<number>
  intensity?: number | Property<number>
  // layout
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  weight?: number | Property<number>
}
export interface HeatmapLayerDefinition extends LayerDefinitionBase {
  type: 'heatmap'
  // paint
  radius: number | Property<number>
  opacity: number | Property<number>
  intensity: number | Property<number>
  // layout
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  weight: number | Property<number>
}
export interface HeatmapWorkflowLayerGuide extends LayerWorkflowGuideBase {
  colorRamp: WebGLTexture
}
export interface HeatmapWorkflowLayerGuideGPU extends LayerWorkflowGuideBase {
  colorRamp: GPUTexture
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
  textureBindGroup: GPUBindGroup
  renderTarget: GPUTexture
  renderPassDescriptor: GPURenderPassDescriptor
}
export interface HeatmapWorkerLayer extends LayerWorkerBase {
  type: 'heatmap'
  getCode: BuildCodeFunction
  weight: LayerWorkerFunction<number>
}

/** LINE **/
export type Cap = 'butt' | 'square' | 'round'
export type Join = 'bevel' | 'miter' | 'round'
export interface LineLayerStyle extends LayerStyleBase {
  type: 'line'
  // paint
  color?: string | Property<string>
  opacity?: number | Property<number>
  width?: number | Property<number>
  gapwidth?: number | Property<number>
  // layout
  cap?: Cap | Property<Cap>
  join?: Join | Property<Join>
  dasharray?: Array<[number, string]>
  // properties
  onlyLines?: boolean
  interactive?: boolean
  cursor?: Cursor
}
export interface LineLayerDefinition extends LayerDefinitionBase {
  type: 'line'
  // paint
  color: string | Property<string>
  opacity: number | Property<number>
  width: number | Property<number>
  gapwidth: number | Property<number>
  // layout
  cap: Cap | Property<Cap>
  join: Join | Property<Join>
  dasharray: Array<[number, string]>
  // properties
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
export interface LineWorkflowLayerGuideGPU extends LineWorkflowLayerGuide {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
}
export interface LineWorkerLayer extends LayerWorkerBase {
  type: 'line'
  cap: LayerWorkerFunction<Cap>
  join: LayerWorkerFunction<Join>
  // properties
  getCode: BuildCodeFunction
  dashed: boolean
  onlyLines: boolean
  interactive: boolean
  cursor: Cursor
}

/** POINT **/

export interface PointLayerStyle extends LayerStyleBase {
  type: 'point'
  // paint
  color?: string | Property<string>
  radius?: number | Property<number>
  stroke?: string | Property<string>
  strokeWidth?: number | Property<number>
  opacity?: number | Property<number>
  // properties
  interactive?: boolean
  cursor?: Cursor
}
export interface PointLayerDefinition extends LayerDefinitionBase {
  type: 'point'
  // paint
  color: string | Property<string>
  radius: number | Property<number>
  stroke: string | Property<string>
  strokeWidth: number | Property<number>
  opacity: number | Property<number>
  // properties
  interactive: boolean
  cursor: Cursor
}
export interface PointWorkflowLayerGuide extends LayerWorkflowGuideBase {
  interactive: boolean
  cursor: Cursor
}
export interface PointWorkflowLayerGuideGPU extends PointWorkflowLayerGuide {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
}
export interface PointWorkerLayer extends LayerWorkerBase {
  type: 'point'
  getCode: BuildCodeFunction
  interactive: boolean
  cursor: Cursor
}

/** RASTER **/

export type Resampling = GPUFilterMode
export interface RasterLayerStyle extends LayerStyleBase {
  type: 'raster'
  // paint
  opacity?: number | Property<number>
  saturation?: number | Property<number>
  contrast?: number | Property<number>
  // layout
  resampling?: Resampling
  fadeDuration?: number
}
export interface RasterLayerDefinition extends LayerDefinitionBase {
  type: 'raster'
  // paint
  opacity: number | Property<number>
  saturation: number | Property<number>
  contrast: number | Property<number>
}
export interface RasterWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
  resampling: Resampling
}
export interface RasterWorkflowLayerGuideGPU extends RasterWorkflowLayerGuide {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
}
export interface RasterWorkerLayer extends LayerWorkerBaseRaster {
  type: 'raster'
  getCode: BuildCodeFunctionZoom
}

/** HILLSHADE **/

export interface HillshadeLayerStyle extends LayerStyleBase {
  type: 'hillshade'
  // paint
  opacity?: number | Property<number>
  exaggeration?: number | Property<number>
  color?: string | Property<string>
  highlightColor?: string | Property<string>
  accentColor?: string | Property<string>
  // layout
  illuminateDirection?: number | Property<number>
  fadeDuration?: number
}
export interface HillshadeLayerDefinition extends LayerDefinitionBase {
  type: 'hillshade'
  // paint
  opacity: number | Property<number>
  exaggeration: number | Property<number>
  color: string | Property<string>
  highlightColor: string | Property<string>
  accentColor: string | Property<string>
  // layout
  illuminateDirection: number | Property<number>
}
export interface HillshadeWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
}
export interface HillshadeWorkerLayer extends LayerWorkerBaseRaster {
  type: 'hillshade'
  getCode: BuildCodeFunctionZoom
}

/** SENSOR **/

export interface SensorLayerStyle extends LayerStyleBase {
  type: 'sensor'
  // paint
  opacity?: number | Property<number>
  // layout
  fadeDuration?: number
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  // properties
  interactive?: boolean
  cursor?: Cursor
}
export interface SensorLayerDefinition extends LayerDefinitionBase {
  type: 'sensor'
  // paint
  opacity: number | Property<number>
  // layout
  fadeDuration: number
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  // properties
  interactive: boolean
  cursor: Cursor
}
export interface SensorWorkflowLayerGuide extends LayerWorkflowGuideBase {
  // layout
  fadeDuration: number
  colorRamp: WebGLTexture
}
export interface SensorWorkerLayer extends LayerWorkerBaseRaster {
  type: 'sensor'
  getCode: BuildCodeFunctionZoom
}

export interface ShadeLayerStyle extends LayerStyleBase {
  type: 'shade'
  // layout
  color?: string | Property<string>
}
export interface ShadeLayerDefinition extends LayerDefinitionBase {
  type: 'shade'
  // layout
  color: string | Property<string>
}
export interface ShadeLayerDefinitionGPU extends ShadeLayerDefinition {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
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
  HillshadeLayerDefinition | SensorLayerDefinition | ShadeLayerDefinition
export type WorkerLayer =
  FillWorkerLayer | GlyphWorkerLayer | HeatmapWorkerLayer |
  LineWorkerLayer | PointWorkerLayer | RasterWorkerLayer |
  HillshadeWorkerLayer | SensorWorkerLayer
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
  projection: Projection
  gpuType: GPUType
  sources: Sources
  fonts: Fonts
  icons: Icons
  glyphs: Glyphs
  sprites: Sprites
  layers: LayerDefinition[]
  minzoom: number
  maxzoom: number
  analytics: Analytics
  apiKey?: string
}

/** WALLPAPER **/
export type SkyboxImageType = 'png' | 'jpg' | 'jpeg' | 'webp' | 'avif'

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

/** TIME SERIES **/

export interface TimeSeriesStyle {
  startDate?: number | string // date formatted string or unix timestamp
  endDate?: number | string // date formatted string or unix timestamp (e.g. 1631124000000)
  speed?: number // seconds in time series per second (e.g. 10800 seconds per second)
  pauseDuration?: number // in seconds (e.g. 3 seconds)
  autoPlay?: true // if true, start playing automatically
  loop?: true // if true, loop the animation
}

/** STYLE DEFINITION **/

export interface StyleDefinition {
  mapOptions?: Omit<MapOptions, 'canvas' | 'container' | 'style'>
  version?: number
  name?: string
  projection?: Projection
  description?: string
  center?: [number, number] | number[]
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
  timeSeries?: TimeSeriesStyle
  glyphs?: Glyphs
  fonts?: Fonts
  icons?: Icons
  sprites?: Sprites
  skybox?: SkyboxStyle
  wallpaper?: WallpaperStyle
  layers?: LayerStyle[]
}

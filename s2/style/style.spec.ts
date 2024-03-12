import type { JSONFeatures, Properties } from 'geometry/proj.spec'
import type { Filter, FilterFunction } from 'style/parseFilter'
import type { EaseType } from './easingFunctions'
import type { MapOptions } from 'ui/s2mapUI'
import type { JSONVTOptions } from 'workers/source/jsonVT'
import type { ClusterOptions } from 'workers/source/pointCluster'

export type { JSONVTOptions } from 'workers/source/jsonVT'
export type { ClusterOptions } from 'workers/source/pointCluster'
export type { Properties, JSONFeatures } from 'geometry/proj.spec'
export type { Filter, FilterFunction } from './parseFilter'
export type { EaseType } from './easingFunctions'
export type { MapOptions } from 'ui/s2mapUI'

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
export type FaceBounds = Record<number, Record<number, [number, number, number, number]>>
export type SourceType = 'vector' | 'json' | 'raster' | 'raster-dem' | 'sensor' | 'overlay'
export interface VectorLayer {
  id: string
  description: string
  minzoom?: number
  maxzoom?: number
}
export interface SourceMetadata extends JSONVTOptions, ClusterOptions {
  path?: string
  type: SourceType
  extension?: string
  fileType?: 'json' | 's2json' | 'pbf' | 'png' | 'jpg' | 'webp'
  encoding?: 'gz' | 'br' | 'none'
  bounds?: [minX: number, minY: number, maxX: number, maxY: number]
  faceBounds?: FaceBounds
  format?: Format | 'pbf'
  scheme?: 'xyz' | 'tms'
  size?: number // required by raster type sources
  attributions?: Attributions
  interval?: number
  minzoom?: number
  maxzoom?: number
  faces?: number[]
  layers?: LayerMetaData
  sourceName?: string // if you want to make requests without getting metadata, you need this
  // used by json sources
  data?: JSONFeatures
  cluster?: boolean
  // TODO: No idea why I have to add this manually when extending JSONVTOptions and ClusterOptions
  // missing cluster properties
  /** cluster radius in pixels */
  radius?: number
  /** tile extent (radius is calculated relative to it) */
  extent?: number
  /** size of the KD-tree leaf node, effects performance */
  nodeSize?: number
  // missing json-vt properties
  /** manually set the projection, otherwise it defaults to whatever the data type is */
  projection?: Projection
  /** tile buffer on each side in pixels */
  indexMaxzoom?: number
  /** max number of points per tile in the tile index */
  indexMaxPoints?: number
  /** simplification tolerance (higher means simpler) */
  tolerance?: number
  /** tile buffer on each side so lines and polygons don't get clipped */
  buffer?: number
  /** Other build engines place layer data inside a json string */
  json?: string
  vector_layers?: VectorLayer[]
}
export type Source = string | SourceMetadata
export type Sources = Record<string, Source> // address to source or source itself

/** GLYPHS, FONTS, SPRITES, AND ICONS */

/**  { fontName: url } */
export type Glyphs = Record<string, string>
export interface Fonts extends Glyphs {}
export interface Icons extends Glyphs {}
export type SpriteFileType = 'png' | 'webp' | 'avif'
export type Sprites = Record<string, string | {
  path: string
  fileType?: SpriteFileType
}>

// LAYER MANAGMENT
// User defined layers are stored in the style.layers array.
// To ensure proper ordering (future GPU use) and ensure valid data,
// the layer data is sent to the appropriate program to process into a "Definition" version.
// Style -> Definition
//
// The next step deviates upon whether the layer is used for rendering (program), or for filtering (worker).
//
// Worflow (program / pipeline):
// Definition[paint + layout] ->
//   webgl1: encodeLayerAttribute (stores "code" var)
//   webgl2 + webgpu: encodeLayerAttribute (stores "code" var)
//
// Worker:
// Definition[paint + layout] -> parseFeatureFunction (updates all paint + layout properties to LayerFunction)

/** Matches the `CSSStyleDeclaration['cursor']` property */
export type Cursor = CSSStyleDeclaration['cursor']

export type LayerWorkerFunction<U> = (code: number[], properties: Properties, zoom: number) => U

export type BuildCodeFunction = (zoom: number, properties: Properties) => [number[], number[]]
export type BuildCodeFunctionZoom = (zoom: number) => number[]

/**
 * One of `"==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "!in" | "has" | "!has"`
 * Used by the filter function to determine if a feature should be included in the render.
 *
 * NOTE: "in" means "in the array" and "has" means "has the key"
 *
 * ex.
 * ```json
 * { "filter": { "key": "type", "comparator": "in", "value": ["ocean", "lake"] } }
 * ```
 * this would be used to filter features where `feature.properties.type` is either "ocean" or "lake"
 *
 * ex.
 * ```json
 * { "filter": { "key": "type", "comparator": "has", "value": "ocean" } }
 * ```
 * this would be used to filter features where `feature.properties.type` is an array that has the key "ocean"
 */
export type Comparator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | '!in' | 'has' | '!has'

export interface NestedKey {
  /**
   * nested conditions are used to dive into nested properties
   * ex.
   * ```json
   * { "filter": { "nestedKey": "class", "key": { "key": "type", "comparator": "==", "value": "ocean" } } }
   * ```
   * this would be used to filter features where `feature.properties.class.type === 'ocean'`
   */
  nestedKey?: string
  /** If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'` */
  key: string | NestedKey
}

export interface InputValue<T extends NotNullOrObject> extends NestedKey {
  /** If the property search for a key turns up no value, the fallback is used. */
  fallback: T
}

export interface DataCondition<T extends NotNullOrObject> {
  /**
   * conditions is an array of `{ filter: Filter, input: T | Property<T> }`
   * If the filter passes, the input is used.
  */
  conditions: Array<{
    filter: Filter
    input: T | Property<T>
  }>
  /** If the conditional search fails, the fallback is used. */
  fallback: T | Property<T>
}

// export type DataRange<T extends NotNullOrObject> = DataRangeStep<T> | DataRangeEase<T>

export interface DataRangeEase<T extends number | string> {
  key: string | NestedKey // the objects[key] -> value used as position on range
  /**
   * "lin" | "expo" | "quad" | "cubic" | "step"
   *
   * @default "lin"
   */
  ease?: EaseType
  /**
   * Used by "expo", "quad", or "cubic" ease functions
   * Ranges from 0 -> 2
   * @default 1
   *
   * - 1 is the default and a linear ease
   * - 0 is the slowest ease early on
   * - 2 is the fastest ease
   */
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface DataRangeStep<T extends NotNullOrObject> {
  key: string | NestedKey // the objects[key] -> value used as position on range
  ease: 'step'
  /**
   * Used by "expo", "quad", or "cubic" ease functions
   * Ranges from 0 -> 2
   * @default 1
   *
   * - 1 is the default and a linear ease
   * - 0 is the slowest ease early on
   * - 2 is the fastest ease
   */
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface DataRangeStepOnlyStep<T extends NotNullOrObject> {
  key: string | NestedKey // the objects[key] -> value used as position on range
  ease: 'step'
  /** Unused by "step" ease functions. Kept to avoid errors in Typescript */
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | PropertyOnlyStep<T>
  }>
}

export interface InputRangeEase<T extends number | string> {
  /** "zoom" | "lon" | "lat" | "angle" | "pitch" */
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch'
  /**
   * "lin" | "expo" | "quad" | "cubic" | "step"
   *
   * @default "lin"
   */
  ease?: EaseType
  /**
   * Used by "expo", "quad", or "cubic" ease functions
   * Ranges from 0 -> 2
   * @default 1
   *
   * - 1 is the default and a linear ease
   * - 0 is the slowest ease early on
   * - 2 is the fastest ease
   */
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface InputRangeStep<T extends NotNullOrObject> {
  /** "zoom" | "lon" | "lat" | "angle" | "pitch" */
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch'
  ease: 'step'
  /** Unused by "step" ease functions. Kept to avoid errors in Typescript */
  base?: number // 0 -> 2
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface FeatureState<T extends NotNullOrObject> {
  condition: 'default' /* (inactive) */ | 'active' | 'hover' | 'selected' | 'disabled'
  key: string | NestedKey
  value: T
  input: T | Property<T>
}

export type NotNullOrObject = string | number | boolean | bigint | Array<string | number | boolean | bigint>
export type ValueType<T> = T extends NotNullOrObject ? T : never
export type NumberColor<T> = T extends (number | string) ? T : never

export interface Property<T extends NotNullOrObject> {
  /** Input values directly access properties data */
  inputValue?: InputValue<ValueType<T>>
  dataCondition?: DataCondition<ValueType<T>>
  dataRange?: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>>
  inputRange?: InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>
  featureState?: FeatureState<ValueType<T>>
  /**
   * Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
   * You will never directly call this at the top level but as an internal fallback for the other types.
   */
  fallback?: T | Property<T>
}

export interface PropertyOnlyStep<T extends NotNullOrObject> {
  inputValue?: InputValue<ValueType<T>>
  dataCondition?: DataCondition<ValueType<T>>
  dataRange?: DataRangeStepOnlyStep<ValueType<T>>
  inputRange?: InputRangeStep<ValueType<T>>
  featureState?: FeatureState<ValueType<T>>
  /**
   * Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
   * You will never directly call this at the top level but as an internal fallback for the other types.
   */
  fallback?: T | Property<T>
}

export type LayerType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor' | 'shade'
export type LayerDataType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor'

// Found in style.json
export interface LayerStyleBase<M = unknown> {
  type?: LayerType
  /** The name of the layer - useful for sorting a layer on insert or for removal */
  name?: string
  /** The source used to generate the layer */
  source?: string
  /** The source's layer. Default for JSON data */
  layer?: string
  /** The minimum zoom level at which the layer will be visible */
  minzoom?: number
  /** The maximum zoom level at which the layer will be visible */
  maxzoom?: number
  /**
   * A filter function to filter out features from the source layer.
   *
   * example:
   *
   * ```json
   * "filter": { "key": "class", "comparator": "==", "value": "ocean" }
   * ```
   *
   * another example:
   *
   * ```json
   * "filter": {
   *  "or": [
   *    { "key": "class", "comparator": "==", "value": "ocean" },
   *    { "key": "class", "comparator": "==", "value": "bay" }
   *  ]
   * }
   * ```
   *
   * another example:
   *
   * ```json
   * "filter": {
   *  "and": [
   *    { "key": "class", "comparator": "==", "value": "ocean" },
   *    { "key": "size", "comparator": "==", "value": "large" },
   *    { "key": "type", "comparator": "!=", "value": "pacific" }
   *  ]
   * }
   * ```
   */
  filter?: Filter
  /** Use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one */
  lch?: boolean
  /** Whether the layer is visible or not */
  visible?: boolean
  /** Additional metadata. Used by style generators. */
  metadata?: M
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
  visible: boolean
}
// uses definition to create a guide for the workflow (program/pipeline)
export interface LayerWorkflowGuideBase {
  sourceName: string
  layerIndex: number
  layerCode: number[]
  lch: boolean
  visible: boolean
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

// FILL //

export interface FillStyle extends LayerStyleBase {
  /**
   * Fill type
   *
   * Base Properties:
   * - `name` - the name of the layer, useful for sorting a layer on insert or for removal
   * - `source` - the source of the data use
   * - `layer` - the source's layer. Defaults to "default" for JSON data
   * - `minzoom` - the minimum zoom level at which the layer will be visible
   * - `maxzoom` - the maximum zoom level at which the layer will be visible
   * - `filter` - a filter function to filter out features from the source layer
   * - `lch` - use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
   * - `visible` - whether the layer is visible or not
   * - `metadata` - additional metadata. Used by style generators
   *
   * Optional paint properties:
   * - `color`
   * - `opacity`
   *
   * Optional layout properties:
   * - `pattern`
   * - `patternMovement`
   * - `patternFamily`
   *
   * Optional properties:
   * - `invert` - if true, invert where the fill is drawn to on the map
   * - `interactive` - if true, when hovering over the fill, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the fill
   * - `opaque` - if true, the fill will be drawn opaque and not allow transparency. Used for performance gains.
   */
  type: 'fill'
  // paint
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 1)"`
   *
   * ex.
   *
   * ```json
   * { "color": "rgba(240, 2, 5, 1)" } }
   * ```
   *
   * ex.
   *
   * ```json
   * { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
   * ```
   *
   * Your list of Property options are:
   * - `inputValue` - access value in feature properties
   * - `dataCondition` - filter based on feature property conditions
   * - `dataRange` - filter based on feature property ranges
   * - `inputRange` - filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
   * - `featureState` - filter based on feature state
   * - `fallback` - if all else fails, use this value
   */
  color?: string | Property<string>
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "opacity": 0.5 } }
   * ```
   *
   * ex.
   *
   * ```json
   * { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
   * ```
   *
   * Your list of Property options are:
   * - `inputValue` - access value in feature properties
   * - `dataCondition` - filter based on feature property conditions
   * - `dataRange` - filter based on feature property ranges
   * - `inputRange` - filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
   * - `featureState` - filter based on feature state
   * - `fallback` - if all else fails, use this value
   */
  opacity?: number | Property<number>
  // layout
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `undefined`
   *
   * ex.
   *
   * Setting up the style definition with an image:
   * ```ts
   * const style: StyleDefinition = {
   *  // ...
   *  images: { whale: '/images/whale.jpg' }
   * }
   * ```
   *
   * You can then add to the layer:
   *
   * ```json
   * { "type": "fill", "pattern": "whale" }
   * ```
   *
   * Your list of PropertyOnlyStep options are:
   * - `inputValue` - access value in feature properties
   * - `dataCondition` - filter based on feature property conditions
   * - `dataRange` - filter based on feature property ranges (but only allows an ease type of "step")
   * - `inputRange` - filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch" (but only allows an ease type of "step")
   * - `featureState` - filter based on feature state
   * - `fallback` - if all else fails, use this value
   */
  pattern?: string | PropertyOnlyStep<string>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `false`
   *
   * ex.
   *
   * ```json
   * { "type": "fill", "pattern": "whale", "patternMovement": true }
   * ```
   *
   * Your list of PropertyOnlyStep options are:
   * - `inputValue` - access value in feature properties
   * - `dataCondition` - filter based on feature property conditions
   * - `dataRange` - filter based on feature property ranges (but only allows an ease type of "step")
   * - `inputRange` - filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch" (but only allows an ease type of "step")
   * - `featureState` - filter based on feature state
   * - `fallback` - if all else fails, use this value
   */
  patternMovement?: boolean | PropertyOnlyStep<boolean>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `"__images"`
   *
   * If left as the default, the pattern will be searched within any images added to the style. Otherwise,
   * you're most likely using a sprite sheet and you'll need to specify the "family" of the pattern which is the name of the sprite sheet.
   *
   * ex.
   *
   * Setting up the style definition with an image:
   * ```ts
   * const style: StyleDefinition = {
   *    // ...
   *    sprites: { fishSprites: { path: 'http://...' } }
   * }
   * ```
   *
   * You can then add to the layer:
   *
   * ```json
   * { "type": "fill", "pattern": "whale", "patternFamily": "fishSprites" }
   * ```
   *
   * Your list of PropertyOnlyStep options are:
   * - `inputValue` - access value in feature properties
   * - `dataCondition` - filter based on feature property conditions
   * - `dataRange` - filter based on feature property ranges (but only allows an ease type of "step")
   * - `inputRange` - filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch" (but only allows an ease type of "step")
   * - `featureState` - filter based on feature state
   * - `fallback` - if all else fails, use this value
   */
  patternFamily?: string | PropertyOnlyStep<string>
  // properties
  /** If true, invert where the fill is drawn to on the map. Defaults to `false` */
  invert?: boolean
  /** If true, when hovering over the fill, the property data will be sent to the UI via an Event. Defaults to `false` */
  interactive?: boolean
  /** The cursor to use when hovering over the fill. Defaults to `default` */
  cursor?: Cursor
  /** If true, the fill will be drawn opaque and not allow transparency. Used for performance gains. Defaults to `false` */
  opaque?: boolean
}
export interface FillDefinition extends LayerDefinitionBase {
  type: 'fill'
  // paint
  color: string | Property<string>
  opacity: number | Property<number>
  // layout
  pattern?: string | PropertyOnlyStep<string>
  patternMovement: boolean | PropertyOnlyStep<boolean>
  patternFamily: string | PropertyOnlyStep<string>
  // properties
  invert: boolean
  interactive: boolean
  cursor: Cursor
  opaque: boolean
}
export interface FillWorkflowLayerGuide extends LayerWorkflowGuideBase {
  color?: LayerWorkerFunction<[number, number, number, number]>
  opacity?: LayerWorkerFunction<number[]>
  invert: boolean
  opaque: boolean
  interactive: boolean
  pattern: boolean
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
  pattern?: LayerWorkerFunction<string>
  patternFamily: LayerWorkerFunction<string>
  patternMovement: LayerWorkerFunction<boolean>
}

// GLYPH //

// TODO: Add opacity
export type Anchor =
  'center' | 'left' | 'right' | 'top' | 'bottom' |
  'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type Alignment = 'auto' | 'center' | 'left' | 'right'
export interface GlyphStyle extends LayerStyleBase {
  type: 'glyph'
  // paint
  textSize?: number | Property<number>
  textFill?: string | Property<string>
  textStroke?: string | Property<string>
  textStrokeWidth?: number | Property<number>
  iconSize?: number | Property<number>
  // layout
  textFamily?: string | string[] | Property<string | string[]>
  textField?: string | string[] | Property<string | string[]>
  textAnchor?: Anchor | Property<Anchor>
  textOffset?: [number, number] | Property<[number, number]>
  textPadding?: [number, number] | Property<[number, number]>
  textWordWrap?: number | Property<number>
  textAlign?: Alignment | Property<Alignment>
  textKerning?: number | Property<number>
  textLineHeight?: number | Property<number>
  iconFamily?: string | string[] | Property<string | string[]>
  iconField?: string | string[] | Property<string | string[]>
  iconAnchor?: Anchor | Property<Anchor>
  iconOffset?: [number, number] | Property<[number, number]>
  iconPadding?: [number, number] | Property<[number, number]>
  // properties
  onlyPoints?: boolean
  onlyLines?: boolean
  overdraw?: boolean
  interactive?: boolean
  viewCollisions?: boolean
  cursor?: Cursor
}
export interface GlyphDefinition extends LayerDefinitionBase {
  type: 'glyph'
  // paint
  textSize: number | Property<number>
  textFill: string | Property<string>
  textStroke: string | Property<string>
  textStrokeWidth: number | Property<number>
  iconSize: number | Property<number>
  // layout
  textFamily: string | string[] | Property<string | string[]>
  textField: string | string[] | Property<string | string[]>
  textAnchor: Anchor | Property<Anchor>
  textOffset: [number, number] | Property<[number, number]>
  textPadding: [number, number] | Property<[number, number]>
  textWordWrap: number | Property<number>
  textAlign: Alignment | Property<Alignment>
  textKerning: number | Property<number>
  textLineHeight: number | Property<number>
  iconFamily: string | string[] | Property<string | string[]>
  iconField: string | string[] | Property<string | string[]>
  iconAnchor: Anchor | Property<Anchor>
  iconOffset: [number, number] | Property<[number, number]>
  iconPadding: [number, number] | Property<[number, number]>
  // properties
  onlyPoints: boolean
  onlyLines: boolean
  overdraw: boolean
  interactive: boolean
  viewCollisions: boolean
  cursor: Cursor
}
export interface GlyphWorkflowLayerGuide extends LayerWorkflowGuideBase {
  interactive: boolean
  cursor: Cursor
  overdraw: boolean
  viewCollisions: boolean
}
export interface GlyphWorkflowLayerGuideGPU extends GlyphWorkflowLayerGuide {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
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
  textFamily: LayerWorkerFunction<string | string[]>
  textField: LayerWorkerFunction<string | string[]>
  textAnchor: LayerWorkerFunction<string>
  textOffset: LayerWorkerFunction<[number, number]>
  textPadding: LayerWorkerFunction<[number, number]>
  textWordWrap: LayerWorkerFunction<number>
  textAlign: LayerWorkerFunction<Alignment>
  textKerning: LayerWorkerFunction<number>
  textLineHeight: LayerWorkerFunction<number>
  iconFamily: LayerWorkerFunction<string | string[]>
  iconField: LayerWorkerFunction<string | string[]>
  iconAnchor: LayerWorkerFunction<Anchor>
  iconOffset: LayerWorkerFunction<[number, number]>
  iconPadding: LayerWorkerFunction<[number, number]>
  // properties
  onlyPoints: boolean
  onlyLines: boolean
  overdraw: boolean
  interactive: boolean
  cursor: Cursor
}

// HEATMAP //

export interface HeatmapStyle extends LayerStyleBase {
  type: 'heatmap'
  // paint
  radius?: number | Property<number>
  opacity?: number | Property<number>
  intensity?: number | Property<number>
  // layout
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  weight?: number | Property<number>
}
export interface HeatmapDefinition extends LayerDefinitionBase {
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

// LINE //
export type Cap = 'butt' | 'square' | 'round'
export type Join = 'bevel' | 'miter' | 'round'
export interface LineStyle extends LayerStyleBase {
  type: 'line'
  // paint
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 1)"`
   *
   * ex.
   *
   * ```json
   * { "color": "rgba(240, 2, 5, 1)" } }
   * ```
   *
   * ex.
   *
   * ```json
   * { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
   * ```
   *
   * Your list of Property options are:
   * - `inputValue` - access value in feature properties
   * - `dataCondition` - filter based on feature property conditions
   * - `dataRange` - filter based on feature property ranges
   * - `inputRange` - filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
   * - `featureState` - filter based on feature state
   * - `fallback` - if all else fails, use this value
   */
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
export interface LineDefinition extends LayerDefinitionBase {
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
  dashCount: number
  dashLength: number
  dashTexture: WebGLTexture
  interactive: boolean
  cursor: Cursor
}
export interface LineWorkflowLayerGuideGPU extends Omit<LineWorkflowLayerGuide, 'dashTexture'> {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
  dashTexture: GPUTexture
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

// POINT //

export interface PointStyle extends LayerStyleBase {
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
export interface PointDefinition extends LayerDefinitionBase {
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

// RASTER //

export type Resampling = GPUFilterMode
export interface RasterStyle extends LayerStyleBase {
  type: 'raster'
  // paint
  opacity?: number | Property<number>
  saturation?: number | Property<number>
  contrast?: number | Property<number>
  // layout
  resampling?: Resampling
  fadeDuration?: number
}
export interface RasterDefinition extends LayerDefinitionBase {
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

// HILLSHADE //

export interface UnpackDefinition {
  offset: number
  zFactor: number
  rMultiplier: number
  gMultiplier: number
  bMultiplier: number
  aMultiplier: number
}
export type UnpackData = [offset: number, zFactor: number, rMul: number, gMul: number, bMul: number, aMul: number]
export interface HillshadeStyle extends LayerStyleBase {
  type: 'hillshade'
  // paint
  opacity?: number | Property<number>
  azimuth?: number | Property<number>
  altitude?: number | Property<number>
  shadowColor?: string | Property<string>
  highlightColor?: string | Property<string>
  accentColor?: string | Property<string>
  // layout
  fadeDuration?: number
  unpack?: UnpackDefinition
}
export interface HillshadeDefinition extends LayerDefinitionBase {
  type: 'hillshade'
  // paint
  opacity: number | Property<number>
  azimuth: number | Property<number>
  altitude: number | Property<number>
  shadowColor: string | Property<string>
  highlightColor: string | Property<string>
  accentColor: string | Property<string>
  // layout
  unpack: UnpackDefinition
}
export interface HillshadeWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number
  unpack: UnpackData
}
export interface HillshadeWorkflowLayerGuideGPU extends Omit<HillshadeWorkflowLayerGuide, 'unpack'> {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
  unpackBuffer: GPUBuffer
}
export interface HillshadeWorkerLayer extends LayerWorkerBaseRaster {
  type: 'hillshade'
  getCode: BuildCodeFunctionZoom
}

// SENSOR **/

export interface SensorStyle extends LayerStyleBase {
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
export interface SensorDefinition extends LayerDefinitionBase {
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

export interface ShadeStyle extends LayerStyleBase {
  type: 'shade'
  // layout
  color?: string | Property<string>
}
export interface ShadeDefinition extends LayerDefinitionBase {
  type: 'shade'
  // layout
  color: string | Property<string>
}
export interface ShadeDefinitionGPU extends ShadeDefinition {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
}
export interface ShadeWorkerLayer extends LayerWorkerBase {
  type: 'shade'
}

export type LayerStyle =
  UnkownLayerStyle | FillStyle | GlyphStyle | HeatmapStyle |
  LineStyle | PointStyle | RasterStyle | SensorStyle |
  ShadeStyle | HillshadeStyle
export type LayerDefinition =
  FillDefinition | GlyphDefinition | HeatmapDefinition |
  LineDefinition | PointDefinition | RasterDefinition |
  HillshadeDefinition | SensorDefinition | ShadeDefinition
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
 * @1 -> WebGL1;
 * @2 -> WebGL2;
 * @3 -> WebGPU;
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
  images: Record<string, string>
  layers: LayerDefinition[]
  minzoom: number
  maxzoom: number
  analytics: Analytics
  experimental: boolean
  apiKey?: string
  urlMap?: Record<string, string>
}

/** WALLPAPER **/
export type SkyboxImageType = 'png' | 'jpg' | 'jpeg' | 'webp' | 'avif'

export interface SkyboxStyle {
  /** path to the skybox image folder */
  path: string
  /** size of the skybox image (the path's folder may support multiple) */
  size: number
  /** type of image (the path's folder may support multiple) */
  type: SkyboxImageType
  /** background color of the skybox while waiting for it to load images */
  loadingBackground?: string
}

export interface WallpaperStyle {
  /** background color is the most seen color zoomed out */
  background?: string
  /** color of the border around the sphere */
  fade1?: string
  /** second color of the border around the sphere (further away then fade1) */
  fade2?: string
  /** color of the border around the sphere (closest to the sphere and smallest fade factor) */
  halo?: string
}

// TIME SERIES //

export interface TimeSeriesStyle {
  /** date formatted string or unix timestamp */
  startDate?: number | string
  /** date formatted string or unix timestamp (e.g. 1631124000000) */
  endDate?: number | string
  /** seconds in time series per second (e.g. 10800 seconds per second) */
  speed?: number
  /** in seconds (e.g. 3 seconds) */
  pauseDuration?: number
  /** if true, start playing automatically */
  autoPlay?: true
  /** if true, loop the animation */
  loop?: true
}

// STYLE DEFINITION //

export interface StyleDefinition {
  /** options for the map, sometimes it's easier to setup some map options in the style */
  mapOptions?: Omit<MapOptions, 'canvas' | 'container' | 'style'>
  /** version of the style - not used for anything other than debugging */
  version?: number
  /** name of the style - not used for anything other than debugging */
  name?: string
  /** Use Either The Web Mercator (WM) or the "S2" Projection */
  projection?: Projection
  /** description of the style - not used for anything other than debugging */
  description?: string
  /** center of the map, number[] added for JSON parsing by Typescript */
  center?: [number, number] | number[]
  /** zoom level of the map */
  zoom?: number
  /** zNear is a parameter for the camera. Recommend not touching */
  zNear?: number
  /** zFar is a parameter for the camera. Recommend not touching */
  zFar?: number
  /** bearing/compass of the map camera */
  bearing?: number
  /** pitch/vertical-angle of the map camera */
  pitch?: number
  /** The furthest away from the planet you allow */
  minzoom?: number
  /** The closest you allow the camera to get to the planet */
  maxzoom?: number
  /** The minimum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms */
  minLatPosition?: number
  /** The maximum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms */
  maxLatPosition?: number
  /** Often times to improve the quality of raster data, you can apply a zoomOffset for tiles to render. */
  zoomOffset?: number
  /** Allow the camera to go past the max-min latitudes. Useful for animations. */
  noClamp?: boolean
  /** Where to fetch data and JSON guides on how to fetch them. If JSON data, it can be included directly in the source */
  sources?: Sources
  /** Time series data is a WIP. Is a guide on how to render &/ animate data at various timestamps */
  timeSeries?: TimeSeriesStyle
  /** Glyph Data and how to fetch */
  glyphs?: Glyphs
  /** Fonts and how to fetch */
  fonts?: Fonts
  /** Icons and how to fetch */
  icons?: Icons
  /** Sprites names and where to fetch */
  sprites?: Sprites
  /** Image names and where to fetch */
  images?: Record<string, string>
  /** Skybox is often used as a background feature for raster data. Uses a skybox image to render to the screen. */
  skybox?: SkyboxStyle
  /** Wallpaper is often used with vector data. Control the coloring of the background. */
  wallpaper?: WallpaperStyle
  /** Layers are the main way to render data on the map. */
  layers?: LayerStyle[]
  /** @beta Utilize WIP experimental data that still has bugs in them. */
  experimental?: boolean
}

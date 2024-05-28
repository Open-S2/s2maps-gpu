import type { BBox, FlatPoint, JSONFeatures, Properties } from 'geometry'
import type { Filter, FilterFunction } from 'style/parseFilter'
import type { EaseType } from './easingFunctions'
import type { JSONVTOptions } from 'workers/source/jsonVT'
import type { ClusterOptions } from 'workers/source/pointCluster'
import type { ColorArray } from './color'
import type { View } from 'ui/camera/projector'

export type { JSONVTOptions } from 'workers/source/jsonVT'
export type { ClusterOptions } from 'workers/source/pointCluster'
export type { BBox, JSONFeatures, Point, Properties } from 'geometry'
export type { Filter, FilterFunction } from './parseFilter'
export type { EaseType } from './easingFunctions'
export type { MapOptions } from 'ui/s2mapUI'
export type { ColorArray } from './color'
export type { View } from 'ui/camera/projector'

export type ImageFormats = 'raw' | 'png' | 'jpg' | 'jpeg' | 'jpe' | 'webp' | 'avif' | 'gif' | 'svg' | 'bmp' | 'tiff' | 'ico' | 'cur'

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
export type FaceBounds = Record<number, Record<number, BBox>>
export type SourceType = 'vector' | 'json' | 'raster' | 'raster-dem' | 'sensor' | 'overlay' | 'markers'
export interface VectorLayer {
  id: string
  description: string
  minzoom?: number
  maxzoom?: number
}
export interface SourceMetadata extends JSONVTOptions, ClusterOptions {
  path?: string
  type: SourceType
  /** The file extension of the source. e.g. `pbf`, `png`, etc. */
  extension?: 'geojson' | 'json' | 's2json' | 'pbf' | ImageFormats
  /** The file extension of the source. e.g. `pbf`, `png`, etc. */
  fileType?: 'geojson' | 'json' | 's2json' | 'pbf' | ImageFormats
  /** The encoding of the source. Helpful to let the server know when the source is compressed if said data is a large blob */
  encoding?: 'gz' | 'br' | 'none'
  /** Tile fetching bounds. Helpful to not make unecessary requests for tiles we know don't exist */
  bounds?: [minX: number, minY: number, maxX: number, maxY: number]
  /** The bounds of the source. Used to determine the bounds of an S2 source */
  faceBounds?: FaceBounds
  /** Useful to determine if its `time-series`, `S2`, or `WM` */
  format?: Format | 'pbf'
  /** Used by older tiling engines. Helps specify where the tile's [0,0] starts on the y-axis */
  scheme?: 'xyz' | 'tms'
  /** The size of the tile in pixels if some form of raster data */
  size?: number // required by raster type sources
  /**
   * The names and URLs of the data source
   *
   * ex.
   * ```json
   * "attributions": {
   *    "NASA": "https://www.nasa.gov/"
   * }
   * ```
   */
  attributions?: Attributions
  /**
   * The time interval in milliseconds each frame is.
   * Used by sensor sources.
   */
  interval?: number
  /** Specify the lower zoom limit at which the data exists in */
  minzoom?: number
  /** Specify the upper zoom limit at which the data exists in */
  maxzoom?: number
  /** Assuming S2 data, specify which faces the data exists in */
  faces?: number[]
  layers?: LayerMetaData
  /**
   * Specify the name of the source in order to access it.
   * This is useful if you want to make requests without first having to request the metadata
   */
  sourceName?: string
  /** If you want to directly inject the geojson or s2json data */
  data?: JSONFeatures
  /** If the data is filled with a huge collection of points, you can specify to cluster the data before displaying it. */
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
  /** A prebuilt tiling engine will have created this already */
  vector_layers?: VectorLayer[]
}
export type Source = string | SourceMetadata
export type Sources = Record<string, Source> // address to source or source itself

/** GLYPHS, FONTS, SPRITES, AND ICONS */

/** { fontName: url, iconName: url } */
export type Glyphs = Record<string, string>
/** { fontName: url } */
export interface Fonts extends Glyphs {}
/**  { iconName: url } */
export interface Icons extends Glyphs {}
/**
 * { spriteName: { path: url, fileType: 'png' | 'webp' | 'avif' | ... } }
*/
export type Sprites = Record<string, string | {
  /** The URL path to the sprite */
  path: string
  /** The file type of the sprite. e.g. `png`, `jpg`, `webp`, etc. */
  fileType?: ImageFormats
}>

// LAYER MANAGMENT
// User defined layers are stored in the style.layers array.
// To ensure proper ordering (future GPU use) and ensure valid data,
// the layer data is sent to the appropriate workflow to process into a "Definition" version.
// Style -> Definition
//
// The next step deviates upon whether the layer is used for rendering (workflow), or for filtering (worker).
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
 *
 * Used by the filter function to determine if a feature should be included in the render.
 *
 * `NOTE`: "in" means "in the array" and "has" means "has the key"
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

export interface InputValue<T extends NotNullOrObject> {
  /** If the property search for a key turns up no value, the fallback is used. */
  fallback: T
  /**
   * Access value in feature properties by either its key or a nested key.
   *
   * If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
   *
   * nested conditions are used to dive into nested properties
   * ex.
   * ```json
   * { "filter": { "nestedKey": "class", "key": { "key": "type", "comparator": "==", "value": "ocean" } } }
   * ```
   * this would be used to filter features where `feature.properties.class.type === 'ocean'`
   */
  key: string | NestedKey
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
  /**
   * Access value in feature properties by either its key or a nested key.
   *
   * If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
   *
   * nested conditions are used to dive into nested properties
   * ex.
   * ```json
   * { "filter": { "nestedKey": "class", "key": { "key": "type", "comparator": "==", "value": "ocean" } } }
   * ```
   * this would be used to filter features where `feature.properties.class.type === 'ocean'`
   */
  key: string | NestedKey // the objects[key] -> value used as position on range
  /**
   * `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
   */
  ease?: EaseType
  /**
   * Used by `expo`, `quad`, or `cubic` ease functions
   *
   * Ranges from 0 -> 2 [default: 1]
   *
   * - `1` is the default and a linear ease
   * - `0` is the slowest ease early on
   * - `2` is the fastest ease
   */
  base?: number // 0 -> 2
  /**
   * Set the range stops and the input values to apply at those stops.
   *
   * ex.
   * ```json
   * "ranges": [
   *   { "stop": 0, "input": 0 },
   *   { "stop": 5, "input": 0.5 },
   *   { "stop": 8, "input": 1 }
   * ]
   * ```
   */
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface DataRangeStep<T extends NotNullOrObject> {
  /**
   * Access value in feature properties by either its key or a nested key.
   *
   * If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
   *
   * nested conditions are used to dive into nested properties
   * ex.
   * ```json
   * { "filter": { "nestedKey": "class", "key": { "key": "type", "comparator": "==", "value": "ocean" } } }
   * ```
   * this would be used to filter features where `feature.properties.class.type === 'ocean'`
   */
  key: string | NestedKey // the objects[key] -> value used as position on range
  ease?: 'step'
  /** Unused by "step" ease functions. Kept to avoid errors in Typescript */
  base?: number // 0 -> 2
  /**
   * Set the range stops and the input values to apply at those stops.
   *
   * ex.
   * ```json
   * "ranges": [
   *   { "stop": 0, "input": 0 },
   *   { "stop": 5, "input": 0.5 },
   *   { "stop": 8, "input": 1 }
   * ]
   * ```
   */
  ranges: Array<{
    stop: number
    input: T | Property<T>
  }>
}

export interface InputRangeEase<T extends number | string> {
  /** `zoom` | `lon` | `lat` | `angle` | `pitch` */
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch'
  /**
   * `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
   */
  ease?: EaseType
  /**
   * Used by `expo`, `quad`, or `cubic` ease functions
   *
   * Ranges from 0 -> 2 [default: 1]
   *
   * - `1` is the default and a linear ease
   * - `0` is the slowest ease early on
   * - `2` is the fastest ease
   */
  base?: number // 0 -> 2
  /**
   * Set the range stops and the input values to apply at those stops.
   *
   * ex.
   * ```json
   * "ranges": [
   *   { "stop": 0, "input": "#f28cb1" },
   *   { "stop": 100, "input": "#f1f075" },
   *   { "stop": 750, "input": "#51bbd6" }
   * ]
   * ```
   */
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
  /**
   * Set the range stops and the input values to apply at those stops.
   *
   * ex.
   * ```json
   * "ranges": [
   *   { "stop": 0, "input": "#f28cb1" },
   *   { "stop": 100, "input": "#f1f075" },
   *   { "stop": 750, "input": "#51bbd6" }
   * ]
   * ```
   */
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
  /**
   * Input values directly access properties data from the feature.
   *
   * ex.
   *
   * Lets say you have a feature with the following properties:
   * ```ts
   * const properties = {
   *   class: {
   *     type: 'blue',
   *     subclass: 'deep'
   *   }
   * }
   * ```
   *
   * You can utilize/access the `type` property with the following:
   *
   * ```json
   * {
   *   "color": {
   *      "inputValue": {
   *         "key": {
   *            "nestedKey": "class",
   *            "key": "type"
   *         },
   *         "fallback": "blue"
   *      }
   *   }
   * }
   * ```
   *
   * another ex. to get a better understanding of the `nestedKey`: (this is a contrived example)
   *
   * Lets say you have a feature with the following properties:
   * ```ts
   * const properties = {
   *   a: {
   *     b: {
   *        c: '#fff'
   *     }
   *   }
   * }
   * ```
   *
   * You can utilize/access the `type` property with the following:
   *
   * ```json
   * {
   *   "color": {
   *      "inputValue": {
   *         "key": {
   *            "nestedKey": "a",
   *            "key": {
   *               "nestedKey": "b",
   *               "key": "c"
   *            }
   *         },
   *         "fallback": "blue"
   *       }
   *    }
   * }
   * ```
   */
  inputValue?: InputValue<ValueType<T>>
  /**
   * Data conditions are used to filter features based on what property values the feature has.
   * If the condition's filter passes, the input is used.
   * If all conditions fail, the fallback is used.
   *
   * ex.
   * ```json
   * "color": {
        "dataCondition": {
          "conditions": [
            {
              "filter": { "key": "country", "comparator": "==", "value": "US" },
              "input": "#007bfe"
            }
          ],
          "fallback": "#23374d"
        }
      }
   * ```
   *
   * ex.
   *
   * When using a cluster source you can access its sum:
   *
   * ```json
   * "color": {
        "dataCondition": {
          "conditions": [
            {
              "filter": { "key": "__sum", "comparator": ">", "value": 750 },
              "input": "#f28cb1"
            },
            {
              "filter": { "key": "__sum", "comparator": ">", "value": 100 },
              "input": "#f1f075"
            }
          ],
          "fallback": "#51bbd6"
        }
      }
   * ```
   */
  dataCondition?: DataCondition<ValueType<T>>
  /**
   * Data Range is used to group features based on a range of values and apply specific design attributes for those groups.
   * If the feature's value falls within the range, the fallback is used.
   *
   * ex.
   * ```json
   * "weight": {
   *   "dataRange": {
   *     "key": "mag",
   *     "ease": "expo",
   *     "base": 1.5,
   *     "ranges": [
   *       { "stop": 0, "input": 0 },
   *       { "stop": 8, "input": 1 }
   *     ]
   *   }
   * }
   * ```
   *
   * ex.
   * If the layer type is a LAYOUT, you are limited to using the `step` ease function.
   * ```json
   * "opacity": {
   *   "dataRange": {
   *     "key": "age",
   *     "ease": "step",
   *     "ranges": [
   *       { "stop": 0, "input": 0 },
   *       { "stop": 50, "input": 1 }
   *     ]
   *   }
   * }
   * ```
   */
  dataRange?: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>>
  /**
   * Input Range is used to group features based on a range of values based upon a `type` provided and apply specific design attributes for those groups.
   * If the feature's value falls within the range, the fallback is used.
   *
   * The types you can use are:
   * - `zoom`
   * - `lon`
   * - `lat`
   * - `angle`
   * - `pitch`
   *
   * ex.
   * ```json
   * "radius": {
   *   "inputRange": {
   *     "type": "zoom",
   *     "ease": "expo",
   *     "base": 1.5,
   *     "ranges": [
   *       { "stop": 0, "input": 3 },
   *       { "stop": 8, "input": 30 }
   *     ]
   *   }
   * }
   * ```
   *
   * ex.
   * If the layer type is a LAYOUT, you are limited to using the `step` ease function.
   * ```json
   * "opacity": {
   *   "inputRange": {
   *     "type": "zoom",
   *     "ease": "step",
   *     "ranges": [
   *       { "stop": 0, "input": 1 },
   *       { "stop": 5, "input": 0 }
   *     ]
   *   }
   * }
   * ```
   */
  inputRange?: InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>
  /** Feature State is still under construction and incomplete */
  featureState?: FeatureState<ValueType<T>>
  /**
   * Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
   * You will never directly call this at the top level but as an internal fallback for the other types.
   */
  fallback?: T | Property<T>
}

export interface PropertyOnlyStep<T extends NotNullOrObject> {
  /**
   * Input values directly access properties data from the feature.
   *
   * ex.
   *
   * Lets say you have a feature with the following properties:
   * ```ts
   * const properties = {
   *   class: {
   *     type: 'blue',
   *     subclass: 'deep'
   *   }
   * }
   * ```
   *
   * You can utilize/access the `type` property with the following:
   *
   * ```json
   * { "color": { "inputValue": { "nestedKey": "class", "key": "type", "fallback": "blue" } } }
   * ```
   *
   * another ex. to get a better understanding of the `nestedKey`: (this is a contrived example)
   *
   * Lets say you have a feature with the following properties:
   * ```ts
   * const properties = {
   *   a: {
   *     b: {
   *        c: '#fff'
   *     }
   *   }
   * }
   * ```
   *
   * You can utilize/access the `type` property with the following:
   *
   * ```json
   * { "color": { "inputValue": { "nestedKey": "a", "key": { "nestedKey": "b", "key": "c" }, "fallback": "blue" } } }
   * ```
   */
  inputValue?: InputValue<ValueType<T>>
  /**
   * Data conditions are used to filter features based on what property values the feature has.
   * If the condition's filter passes, the input is used.
   * If all conditions fail, the fallback is used.
   *
   * ex.
   * ```json
   * "color": {
        "dataCondition": {
          "conditions": [
            {
              "filter": { "key": "country", "comparator": "==", "value": "US" },
              "input": "#007bfe"
            }
          ],
          "fallback": "#23374d"
        }
      }
   * ```
   *
   * ex.
   *
   * When using a cluster source you can access its sum:
   *
   * ```json
   * "color": {
        "dataCondition": {
          "conditions": [
            {
              "filter": { "key": "__sum", "comparator": ">", "value": 750 },
              "input": "#f28cb1"
            },
            {
              "filter": { "key": "__sum", "comparator": ">", "value": 100 },
              "input": "#f1f075"
            }
          ],
          "fallback": "#51bbd6"
        }
      }
   * ```
   */
  dataCondition?: DataCondition<ValueType<T>>
  /**
   * Data Range is used to group features based on a range of values and apply specific design attributes for those groups.
   * If the feature's value falls within the range, the fallback is used.
   *
   * ex.
   * ```json
   * "weight": {
   *   "dataRange": {
   *     "key": "mag",
   *     "ease": "expo",
   *     "base": 1.5,
   *     "ranges": [
   *       { "stop": 0, "input": 0 },
   *       { "stop": 8, "input": 1 }
   *     ]
   *   }
   * }
   * ```
   *
   * ex.
   * If the layer type is a LAYOUT, you are limited to using the `step` ease function.
   * ```json
   * "opacity": {
   *   "dataRange": {
   *     "key": "age",
   *     "ease": "step",
   *     "ranges": [
   *       { "stop": 0, "input": 0 },
   *       { "stop": 50, "input": 1 }
   *     ]
   *   }
   * }
   * ```
   */
  dataRange?: DataRangeStep<ValueType<T>>
  /**
   * Input Range is used to group features based on a range of values based upon a `type` provided and apply specific design attributes for those groups.
   * If the feature's value falls within the range, the fallback is used.
   *
   * The types you can use are:
   * - `zoom`
   * - `lon`
   * - `lat`
   * - `angle`
   * - `pitch`
   *
   * ex.
   * ```json
   * "radius": {
   *   "inputRange": {
   *     "type": "zoom",
   *     "ease": "expo",
   *     "base": 1.5,
   *     "ranges": [
   *       { "stop": 0, "input": 3 },
   *       { "stop": 8, "input": 30 }
   *     ]
   *   }
   * }
   * ```
   *
   * ex.
   * If the layer type is a LAYOUT, you are limited to using the `step` ease function.
   * ```json
   * "opacity": {
   *   "inputRange": {
   *     "type": "zoom",
   *     "ease": "step",
   *     "ranges": [
   *       { "stop": 0, "input": 1 },
   *       { "stop": 5, "input": 0 }
   *     ]
   *   }
   * }
   * ```
   */
  inputRange?: InputRangeStep<ValueType<T>>
  /** Feature State is still under construction and incomplete */
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
  lch: boolean
  visible: boolean
  filter?: Filter
  interactive?: boolean
  opaque?: boolean
}
// uses definition to create a guide for the workflow (program/pipeline)
export interface LayerWorkflowGuideBase {
  sourceName: string
  layerIndex: number
  layerCode: number[]
  lch: boolean
  visible: boolean
  interactive: boolean
  opaque: boolean
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
   * { "color": "rgba(240, 2, 5, 1)" }
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
   * { "opacity": 0.5 }
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
  color?: LayerWorkerFunction<ColorArray>
  opacity?: LayerWorkerFunction<number[]>
  invert: boolean
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
export type Placement = 'point' | 'line' | 'line-center-point' | 'line-center-path'
export interface GlyphStyle extends LayerStyleBase {
  /**
   * Glyph type
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
   * - `textSize`
   * - `textFill`
   * - `textStroke`
   * - `textStrokeWidth`
   * - `iconSize`
   *
   * Optional layout properties:
   * - `placement`
   * - `spacing`
   * - `textFamily`
   * - `textField`
   * - `textAnchor`
   * - `textOffset`
   * - `textPadding`
   * - `textRotate`
   * - `textWordWrap`
   * - `textAlign`
   * - `textKerning`
   * - `textLineHeight`
   * - `iconFamily`
   * - `iconField`
   * - `iconAnchor`
   * - `iconOffset`
   * - `iconPadding`
   * - `iconRotate`
   *
   * Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn
   * - `overdraw` - if true, the layer will be drawn regardless of other glyph layers
   * - `interactive` - if true, when hovering over the glyph, the property data will be sent to the UI via an Event
   * - `viewCollisions` - if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not
   * - `cursor` - the cursor to use when hovering over the glyph
   */
  type: 'glyph'
  // paint
  /**
   * A PAINT `Property`.
   * @defaultValue `16`
   *
   * ex.
   *
   * ```json
   * { "textSize": 24 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textSize": { "inputValue": { "key": "size", "fallback": 36 } } }
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
  textSize?: number | Property<number>
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 1)"`
   *
   * ex.
   *
   * ```json
   * { "textFill": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textFill": { "inputValue": { "key": "size", "fallback": "blue" } } }
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
  textFill?: string | Property<string>
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 1)"`
   *
   * ex.
   *
   * ```json
   * { "textStroke": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textStroke": { "inputValue": { "key": "stroke", "fallback": "blue" } } }
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
  textStroke?: string | Property<string>
  /**
   * A PAINT `Property`.
   * @defaultValue `0`
   *
   * ex.
   *
   * ```json
   * { "textStrokeWidth": 2 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textStrokeWidth": { "inputValue": { "key": "strokeWidth", "fallback": 0 } } }
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
  textStrokeWidth?: number | Property<number>
  /**
   * A PAINT `Property`.
   * @defaultValue `16`
   *
   * ex.
   *
   * ```json
   * { "iconSize": 24 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "iconSize": { "inputValue": { "key": "size", "fallback": 42 } } }
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
  iconSize?: number | Property<number>
  // layout
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `"line"`
   *
   * Can be `point`, `line`, `line-center-path` or `line-center-point`.
   * Only relavent if geometry is not a point.
   * Line and Polygon geometries will use the `placement` type to determine
   * how the glyphs are drawn. Regardless of the placement type, the glyphs
   * will be drawn at `spacing` intervals.
   *
   * If set to `point`, the geometry will be simplified down to a set
   * of points of minimum distance `spacing` apart.
   *
   * If set to `line`, the glyphs will draw along the line path.
   *
   * If set to `line-center-path`, the geometry will resolve to a single point
   * at the center of the line. The `spacing` property will have no effect.
   * The starting point will be at the center of each line, and the glyphs will be drawn
   * along the line path.
   *
   * If set to `line-center-point`, the geometry will resolve to a single point
   * at the center of the line. The `spacing` property will have no effect.
   * The starting point will be at the center of each line, and the glyphs will be drawn
   * as points are (box shaped).
   *
   * ex.
   *
   * ```json
   * { "type": "glyph", "placement": "point" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "placement": { "inputValue": { "key": "placementType", "fallback": "point" } } }
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
  placement?: Placement | PropertyOnlyStep<Placement>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `325`
   *
   * The distance between glyphs. Only relavent if geometry is not a point.
   *
   * ex.
   *
   * ```json
   * { "spacing": 250 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "spacing": { "inputValue": { "key": "space-between", "fallback": 350 } } }
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
  spacing?: number | Property<number>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `""` (empty string)
   *
   * If applying an array, the first value will be used. If the first value is not found, the second value will be used, and so on.
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
   *    fonts: {
   *      robotoMedium: 'apiURL://glyphs-v2/RobotoMedium',
   *      notoMedium: 'apiURL://glyphs-v2/notoMedium'
   *    }
   * }
   * ```
   *
   * You can then add to the layer:
   *
   * ```json
   * { "type": "glyph", "textFamily": ["robotoMedium", "notoMedium"] }
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
  textFamily?: string | string[] | PropertyOnlyStep<string | string[]>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `""` (empty string)
   *
   * ex.
   *
   * ```json
   * { "textField": "?name" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textField": { "inputValue": { "key": "?abbreviation", "fallback": "?name" } } }
   * ```
   *
   * If using an array, it will merge the values into a single string. but apply the effects/transformations to each component first.
   *
   * an example of utilizing an array:
   * ```ts
   * // example 1
   * const properties = { abbr: 'U.S.', name: 'United States', ... }
   * const textField = ["\"", "?abbr,?name", "\""] // here we coallese to abbr if the property exists, otherwise we fallback on name
   * // cooalesced: returns "U.S." or "United States" depending on whether abbr exists
   *
   * // example 2
   * const properties = { type: 'airplane', ... }
   * const textField = ["?type", "-16"]
   * // // cooalesced: 'airplane-16'
   * ```
   *
   * Transforms:
   * - `"?"` - coalesce from properties
   * - `"!"` - transform the result
   * - `"U"` - uppercase
   * - `"L"` - lowercase
   * - `"C"` - capitalize
   * - `"P"` - language aquisition (e.g. "XX" -> "en"). Defined by navigator.language (browser)
   *
   * ex.
   * ```json
   * { "textField": ["?!Labbr", " - " "?!Uname"] }
   * // cooalesced: "u.s. - UNITED STATES"
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
  textField?: string | string[] | PropertyOnlyStep<string | string[]>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `"center"`
   *
   * Options are `"center"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`
   *
   * ex.
   *
   * ```json
   * { "textAnchor": "top-left" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textAnchor": { "inputValue": { "key": "anchor", "fallback": "center" } } }
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
  textAnchor?: Anchor | PropertyOnlyStep<Anchor>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `[0, 0]`
   *
   * ex.
   *
   * ```json
   * { "textOffset": [2, 2] }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textOffset": { "inputValue": { "key": "offset", "fallback": [0, 0] } } }
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
  textOffset?: FlatPoint | PropertyOnlyStep<FlatPoint>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `[0, 0]`
   *
   * ex.
   *
   * ```json
   * { "textPadding": [2, 2] }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textPadding": { "inputValue": { "key": "padding", "fallback": [0, 0] } } }
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
  textPadding?: FlatPoint | PropertyOnlyStep<FlatPoint>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `0`
   *
   * ex.
   *
   * ```json
   * { "textWordWrap": 8 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textWordWrap": { "inputValue": { "key": "wrapSize", "fallback": 6 } } }
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
  textWordWrap?: number | PropertyOnlyStep<number>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `"center"`
   *
   * Options are `"center"`, `"left"`, `"right"`, `"auto"`
   *
   * ex.
   *
   * ```json
   * { "textAlign": "left" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textAlign": { "inputValue": { "key": "align", "fallback": "center" } } }
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
  textAlign?: Alignment | PropertyOnlyStep<Alignment>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `0`
   *
   * ex.
   *
   * ```json
   * { "textKerning": 0.5 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textKerning": { "inputValue": { "key": "kerning", "fallback": 0 } } }
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
  textKerning?: number | PropertyOnlyStep<number>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `0`
   *
   * ex.
   *
   * ```json
   * { "textLineHeight": 1 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textLineHeight": { "inputValue": { "key": "lineHeight", "fallback": 0 } } }
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
  textLineHeight?: number | PropertyOnlyStep<number>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `""` (empty string)
   *
   * If applying an array, the first value will be used. If the first value is not found, the second value will be used, and so on.
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
   *    icons: {
   *      streets: 'apiURL://glyphs-v2/streets',
   *      base: 'apiURL://glyphs-v2/base'
   *    }
   * }
   * ```
   *
   * You can then add to the layer:
   *
   * ```json
   * { "type": "glyph", "iconFamily": ["streets", "base"] }
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
  iconFamily?: string | string[] | PropertyOnlyStep<string | string[]>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `""` (empty string)
   *
   * ex.
   *
   * ```json
   * { "iconField": "plane" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "iconField": { "inputValue": { "key": "aircraft", "fallback": "plane" } } }
   * ```
   *
   * If using an array, it will merge the values into a single string. but apply the effects/transformations to each component first.
   *
   * an example of utilizing an array:
   * ```ts
   * // example 1
   * const properties = { abbr: 'U.S.', name: 'United States', ... }
   * const iconField = ["\"", "?abbr,?name", "\""] // here we coallese to abbr if the property exists, otherwise we fallback on name
   * // cooalesced: returns "U.S." or "United States" depending on whether abbr exists
   *
   * // example 2
   * const properties = { type: 'airplane', ... }
   * const iconField = ["?type", "-16"]
   * // // cooalesced: 'airplane-16'
   * ```
   *
   * Transforms:
   * - `"?"` - coalesce from properties
   * - `"!"` - transform the result
   * - `"U"` - uppercase
   * - `"L"` - lowercase
   * - `"C"` - capitalize
   * - `"P"` - language aquisition (e.g. "XX" -> "en"). Defined by navigator.language (browser)
   *
   * ex.
   * ```json
   * { "iconField": ["?!Labbr", " - " "?!Uname"] }
   * // cooalesced: "u.s. - UNITED STATES"
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
  iconField?: string | string[] | PropertyOnlyStep<string | string[]>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `"center"`
   *
   * Options are `"center"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`
   *
   * ex.
   *
   * ```json
   * { "textOffset": "top-left" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "textOffset": { "inputValue": { "key": "positioning", "fallback": "center" } } }
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
  iconAnchor?: Anchor | PropertyOnlyStep<Anchor>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `[0, 0]`
   *
   * ex.
   *
   * ```json
   * { "iconOffset": [2, 2] }
   * ```
   *
   * ex.
   *
   * ```json
   * { "iconOffset": { "inputValue": { "key": "offset", "fallback": [0, 0] } } }
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
  iconOffset?: FlatPoint | PropertyOnlyStep<FlatPoint>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `[0, 0]`
   *
   * ex.
   *
   * ```json
   * { "iconPadding": [2, 2] }
   * ```
   *
   * ex.
   *
   * ```json
   * { "iconPadding": { "inputValue": { "key": "padding", "fallback": [0, 0] } } }
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
  iconPadding?: FlatPoint | PropertyOnlyStep<FlatPoint>
  // properties
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will support all geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to empty. */
  geoFilter?: Array<'point' | 'line' | 'poly'>
  /** if true, the layer will be drawn regardless of other glyph layers. Default false */
  overdraw?: boolean
  /** if true, when hovering over the glyph, the property data will be sent to the UI via an Event. Default false */
  interactive?: boolean
  /** if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not. Default false */
  viewCollisions?: boolean
  /** if true, it's assumed RTL text has been preshaped so do not apply RTL inversion again. Defaults to false */
  noShaping?: boolean
  /** the cursor to use when hovering over the glyph. Default "default" */
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
  placement: Placement | PropertyOnlyStep<Placement>
  spacing: number | Property<number>
  textFamily: string | string[] | PropertyOnlyStep<string | string[]>
  textField: string | string[] | PropertyOnlyStep<string | string[]>
  textAnchor: Anchor | PropertyOnlyStep<Anchor>
  textOffset: FlatPoint | PropertyOnlyStep<FlatPoint>
  textPadding: FlatPoint | PropertyOnlyStep<FlatPoint>
  textWordWrap: number | PropertyOnlyStep<number>
  textAlign: Alignment | PropertyOnlyStep<Alignment>
  textKerning: number | PropertyOnlyStep<number>
  textLineHeight: number | PropertyOnlyStep<number>
  iconFamily: string | string[] | PropertyOnlyStep<string | string[]>
  iconField: string | string[] | PropertyOnlyStep<string | string[]>
  iconAnchor: Anchor | PropertyOnlyStep<Anchor>
  iconOffset: FlatPoint | PropertyOnlyStep<FlatPoint>
  iconPadding: FlatPoint | PropertyOnlyStep<FlatPoint>
  // properties
  geoFilter: Array<'point' | 'line' | 'poly'>
  overdraw: boolean
  interactive: boolean
  noShaping: boolean
  viewCollisions: boolean
  cursor: Cursor
}
export interface GlyphWorkflowLayerGuide extends LayerWorkflowGuideBase {
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
  placement: LayerWorkerFunction<Placement>
  spacing: LayerWorkerFunction<number>
  textFamily: LayerWorkerFunction<string | string[]>
  textField: LayerWorkerFunction<string | string[]>
  textAnchor: LayerWorkerFunction<string>
  textOffset: LayerWorkerFunction<FlatPoint>
  textPadding: LayerWorkerFunction<FlatPoint>
  textWordWrap: LayerWorkerFunction<number>
  textAlign: LayerWorkerFunction<Alignment>
  textKerning: LayerWorkerFunction<number>
  textLineHeight: LayerWorkerFunction<number>
  iconFamily: LayerWorkerFunction<string | string[]>
  iconField: LayerWorkerFunction<string | string[]>
  iconAnchor: LayerWorkerFunction<Anchor>
  iconOffset: LayerWorkerFunction<FlatPoint>
  iconPadding: LayerWorkerFunction<FlatPoint>
  // properties
  geoFilter: Array<'point' | 'line' | 'poly'>
  overdraw: boolean
  interactive: boolean
  noShaping: boolean
  cursor: Cursor
}

// HEATMAP //

export interface HeatmapStyle extends LayerStyleBase {
  /**
   * Heatmap type
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
   * - `radius`
   * - `opacity`
   * - `intensity`
   *
   * Optional layout properties:
   * - `weight`
   *
   * Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn.
   * - `colorRamp` - the color ramp to use for the heatmap. Defaults to `sinebow`
   */
  type: 'heatmap'
  // paint
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "radius": 5 } }
   * ```
   *
   * ex.
   *
   * ```json
   * { "radius": { "inputValue": { "key": "size", "fallback": 3.5 } } }
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
  radius?: number | Property<number>
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "opacity": 0.5 }
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
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "intensity": 2.5 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "intensity": { "inputValue": { "key": "strength", "fallback": 1 } } }
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
  intensity?: number | Property<number>
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "weight": 2.5 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "weight": { "inputValue": { "key": "impact", "fallback": 1 } } }
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
  weight?: number | Property<number>
  // properties
  /**
   * Defaults to `sinebow`.
   *
   * ex.
   * ```json
   * {
   *  "colorRamp": [
        { "stop": 0, "color": "rgba(33,102,172,0)" },
        { "stop": 0.2, "color": "rgba(103,169,207, 0.85)" },
        { "stop": 0.4, "color": "rgb(209,229,240)" },
        { "stop": 0.6, "color": "rgb(253,219,199)" },
        { "stop": 0.8, "color": "rgb(239,138,98)" },
        { "stop": 1, "color": "rgb(178,24,43)" }
      ]
   * }
   * ```
   */
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will support all geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to `['line', 'poly']` (only points will be drawn).
   */
  geoFilter?: Array<'point' | 'line' | 'poly'>
}
export interface HeatmapDefinition extends LayerDefinitionBase {
  type: 'heatmap'
  // paint
  radius: number | Property<number>
  opacity: number | Property<number>
  intensity: number | Property<number>
  weight: number | Property<number>
  // properties
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  geoFilter: Array<'point' | 'line' | 'poly'>
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
  geoFilter: Array<'point' | 'line' | 'poly'>
}

// LINE //
export type Cap = 'butt' | 'square' | 'round'
export type Join = 'bevel' | 'miter' | 'round'
export interface LineStyle extends LayerStyleBase {
  /**
   * Line type
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
   * - `width`
   * - `gapwidth`
   *
   * Optional layout properties:
   * - `cap`
   * - `join`
   * - `dasharray`
   *
   * Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn.
   * - `interactive` - if true, when hovering over the line, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the line
   */
  type: 'line'
  // paint
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 1)"`
   *
   * ex.
   *
   * ```json
   * { "color": "rgba(240, 2, 5, 1)" }
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
   * { "opacity": 0.5 }
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
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "width": 5 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "width": { "inputValue": { "key": "roadWidth", "fallback": 3.5 } } }
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
  width?: number | Property<number>
  /**
   * A PAINT `Property`. Default value of `0`
   * To improve render performance, you can provide a gap width to not draw a portion inside the line.
   *
   * `NOTE`: This feature is currently not supported.
   *
   * ex.
   *
   * ```json
   * { "gapWidth": 3 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "gapWidth": { "inputValue": { "key": "partitionSize", "fallback": 1.5 } } }
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
  gapwidth?: number | Property<number>
  // layout
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `butt`
   *
   * can use `butt`, `square`, or `round`
   *
   * ex.
   *
   *
   * ```json
   * { "cap": "round" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "cap": { "inputValue": { "key": "capType", "fallback": "round" } } }
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
  cap?: Cap | PropertyOnlyStep<Cap>
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @defaultValue `miter`
   *
   * can use `bevel`, `miter`, or `round`
   *
   * ex.
   *
   * ```json
   * { "join": "round" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "join": { "inputValue": { "key": "joinType", "fallback": "round" } } }
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
  join?: Join | PropertyOnlyStep<Join>
  // properties
  /**
   * The line will be dashed between visible and invisible. Defaults to `[]` (empty array)
   *
   * ex.
   *
   * ```json
   * { "dasharray": [ [30, "#bbd3de"], [12, "rgba(255, 255, 255, 0)"] ] }
   * ```
   */
  dasharray?: Array<[number, string]>
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will supports both `line` & `polygon` geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to empty. */
  geoFilter?: Array<'line' | 'poly'>
  /** if true, when hovering over the line, the property data will be sent to the UI via an Event. Defaults to `false` */
  interactive?: boolean
  /** the cursor to use when hovering over the line. Defaults to "default" */
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
  cap: Cap | PropertyOnlyStep<Cap>
  join: Join | PropertyOnlyStep<Join>
  // properties
  dasharray: Array<[number, string]>
  dashed: boolean
  geoFilter: Array<'line' | 'poly'>
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
  geoFilter: Array<'line' | 'poly'>
  interactive: boolean
  cursor: Cursor
}

// POINT //

export interface PointStyle extends LayerStyleBase {
  /**
   * Point type
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
   * - `radius`
   * - `stroke`
   * - `strokeWidth`
   * - `opacity`
   *
   * Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn.
   * - `interactive` - if true, when hovering over the line, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the line
   */
  type: 'point'
  // paint
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 0)"`
   *
   * ex.
   *
   * ```json
   * { "color": "rgba(240, 2, 5, 1)" }
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
   * A PAINT `Property`.
   * @defaultValue `1`
   *
   * ex.
   *
   * ```json
   * { "radius": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "radius": { "inputValue": { "key": "size", "fallback": "blue" } } }
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
  radius?: number | Property<number>
  /**
   * A PAINT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 0)"`
   *
   * ex.
   *
   * ```json
   * { "stroke": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "stroke": { "inputValue": { "key": "stroke", "fallback": "blue" } } }
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
  stroke?: string | Property<string>
  /**
   * A PAINT `Property`.
   * @defaultValue `1`
   *
   * ex.
   *
   * ```json
   * { "strokeWidth": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "strokeWidth": { "inputValue": { "key": "strokeSize", "fallback": "blue" } } }
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
  strokeWidth?: number | Property<number>
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "opacity": 0.5 }
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
  // properties
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will support all geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to `['line', 'poly']`.
   */
  geoFilter?: Array<'point' | 'line' | 'poly'>
  /** if true, when hovering over the line, the property data will be sent to the UI via an Event. Defaults to `false` */
  interactive?: boolean
  /** the cursor to use when hovering over the line. Defaults to "default" */
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
  geoFilter: Array<'point' | 'line' | 'poly'>
  interactive: boolean
  cursor: Cursor
}
export interface PointWorkflowLayerGuide extends LayerWorkflowGuideBase {
  cursor: Cursor
}
export interface PointWorkflowLayerGuideGPU extends PointWorkflowLayerGuide {
  layerBuffer: GPUBuffer
  layerCodeBuffer: GPUBuffer
}
export interface PointWorkerLayer extends LayerWorkerBase {
  type: 'point'
  getCode: BuildCodeFunction
  geoFilter: Array<'point' | 'line' | 'poly'>
  interactive: boolean
  cursor: Cursor
}

// RASTER //

export type Resampling = GPUFilterMode
export interface RasterStyle extends LayerStyleBase {
  /**
   * Raster type
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
   * - `opacity`
   * - `saturation`
   * - `contrast`
   *
   * Optional layout properties:
   * - `resampling`
   * - `fadeDuration`
   */
  type: 'raster'
  // paint
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "opacity": 0.5 }
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
  /**
   * A PAINT `Property`. Default value of `0`
   *
   * ex.
   *
   * ```json
   * { "saturation": 0.5 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "saturation": { "inputValue": { "key": "saturation", "fallback": 0.5 } } }
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
  saturation?: number | Property<number>
  /**
   * A PAINT `Property`. Default value of `0`
   *
   * ex.
   *
   * ```json
   * { "contrast": 0.5 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "contrast": { "inputValue": { "key": "contrast", "fallback": 1 } } }
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
  contrast?: number | Property<number>
  // properties
  /**
   * Decide how the GPU samples the texture. Either `nearest` or `linear`. Linear is smoother but nearest has better performance.
   *
   * Defaults to `linear`.
   */
  resampling?: Resampling
  /** The duration of the fade in milliseconds. Defaults to `300` */
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
  /**
   * Hillshade type
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
   * - `opacity`
   * - `azimuth`
   * - `altitude`
   * - `shadowColor`
   * - `highlightColor`
   * - `accentColor`
   *
   * Optional layout properties:
   * - `fadeDuration`
   * - `unpack`
   */
  type: 'hillshade'
  // layout
  /**
   * A LAYOUT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "opacity": 0.5 }
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
  /**
   * A LAYOUT `Property`. Default value of `315`
   *
   * ex.
   *
   * ```json
   * { "azimuth": 115 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "azimuth": { "inputValue": { "key": "az", "fallback": 0 } } }
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
  azimuth?: number | Property<number>
  /**
   * A LAYOUT `Property`. Default value of `45`
   *
   * ex.
   *
   * ```json
   * { "altitude": 45 }
   * ```
   *
   * ex.
   *
   * ```json
   * { "altitude": { "inputValue": { "key": "alt", "fallback": 45 } } }
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
  altitude?: number | Property<number>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `"#000"`
   *
   * ex.
   *
   * ```json
   * { "shadowColor": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "shadowColor": { "inputValue": { "key": "shadow", "fallback": "black" } } }
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
  shadowColor?: string | Property<string>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `"#fff"`
   *
   * ex.
   *
   * ```json
   * { "highlightColor": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "highlightColor": { "inputValue": { "key": "accent", "fallback": "white" } } }
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
  highlightColor?: string | Property<string>
  /**
   * A LAYOUT `Property`.
   * @defaultValue `"#000"`
   *
   * ex.
   *
   * ```json
   * { "accentColor": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "accentColor": { "inputValue": { "key": "accent", "fallback": "black" } } }
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
  accentColor?: string | Property<string>
  // properties
  /** The duration of the fade in milliseconds. Defaults to `300` */
  fadeDuration?: number
  /**
   * A property to unpack the hillshade data via the GPU.
   *
   * The formula used by the GPU is as follow:
   * `(color.r * rMultiplier + color.g * gMultiplier + color.b * bMultiplier + color.a * aMultiplier) * zFactor + offset`
   *
   * The WebGPU code is as follows:
   *
   * ```wgsl
   * fn getElevation(
   *    uv: vec2<f32>,
   * ) -> f32 {
   *    var color = textureSample(demTexture, imageSampler, uv);
   *    return (
   *      (
   *        color.r * unpack.rMultiplier +
   *        color.g * unpack.gMultiplier +
   *        color.b * unpack.bMultiplier +
   *        color.a * unpack.aMultiplier
   *      )
   *      * unpack.zFactor
   *    ) + unpack.offset;
   *  }
   *  ```
   *
   * Default value (Mapbox encoding):
   *
   * ```json
   * {
   *   "offset": -10000,
   *   "zFactor": 0.1,
   *   "aMultiplier": 0,
   *   "bMultiplier": 1,
   *   "gMultiplier": 256,
   *   "rMultiplier": 65536 // 256 * 256
   * }
   * ```
   *
   * Should you need to use terrarium data, you can copy paste the following values:
   *
   * ```json
   * {
   *   // (color.r * 256. + color.g + color.b / 256.) - 32768.;
   *   "offset": -32768,
   *   "zFactor": 1,
   *   "aMultiplier": 0,
   *   "bMultiplier": 0.00390625, // 1 / 256
   *   "gMultiplier": 1,
   *   "rMultiplier": 256
   * }
   * ```
   */
  unpack?: UnpackDefinition
}
export interface HillshadeDefinition extends LayerDefinitionBase {
  type: 'hillshade'
  // layout
  opacity: number | Property<number>
  azimuth: number | Property<number>
  altitude: number | Property<number>
  shadowColor: string | Property<string>
  highlightColor: string | Property<string>
  accentColor: string | Property<string>
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

// SENSOR */

export interface SensorStyle extends LayerStyleBase {
  /**
   * Sensor type
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
   * - `opacity`
   *
   * Optional layout properties:
   * - `fadeDuration`
   * - `colorRamp`
   *
   * Optional properties:
   * - `interactive` - if true, when hovering over the fill, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the fill
   */
  type: 'sensor'
  // paint
  /**
   * A PAINT `Property`. Default value of `1`
   *
   * ex.
   *
   * ```json
   * { "opacity": 0.5 }
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
  // properties
  /** The duration of the fade in milliseconds. Defaults to `300` */
  fadeDuration?: number
  /**
   * Defaults to `sinebow`.
   *
   * ex.
   * ```json
   * {
   *  "colorRamp": [
        { "stop": 0, "color": "rgba(33,102,172,0)" },
        { "stop": 0.2, "color": "rgba(103,169,207, 0.85)" },
        { "stop": 0.4, "color": "rgb(209,229,240)" },
        { "stop": 0.6, "color": "rgb(253,219,199)" },
        { "stop": 0.8, "color": "rgb(239,138,98)" },
        { "stop": 1, "color": "rgb(178,24,43)" }
      ]
   * }
   * ```
   */
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  /** if true, when hovering over the fill, the property data will be sent to the UI via an Event. Defaults to false */
  interactive?: boolean
  /** the cursor to use when hovering over the fill. Defaults to "default" */
  cursor?: Cursor
}
export interface SensorDefinition extends LayerDefinitionBase {
  type: 'sensor'
  // paint
  opacity: number | Property<number>
  // properties
  fadeDuration: number
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>
  interactive: boolean
  cursor: Cursor
}
export interface SensorWorkflowLayerGuide extends LayerWorkflowGuideBase {
  // properties
  fadeDuration: number
  colorRamp: WebGLTexture
}
export interface SensorWorkflowLayerGuideGPU extends SensorWorkflowLayerGuide {
  colorRame: GPUTexture
}
export interface SensorWorkerLayer extends LayerWorkerBaseRaster {
  type: 'sensor'
  getCode: BuildCodeFunctionZoom
}

export interface ShadeStyle extends LayerStyleBase {
  /**
   * Shade type
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
   */
  type: 'shade'
  // layout
  /**
   * A LAYOUT `Property`.
   * @defaultValue `"rgba(0, 0, 0, 1)"`
   *
   * ex.
   *
   * ```json
   * { "color": "rgba(240, 2, 5, 1)" }
   * ```
   *
   * ex.
   *
   * ```json
   * { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
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
  color?: string | PropertyOnlyStep<string>
}
export interface ShadeDefinition extends LayerDefinitionBase {
  type: 'shade'
  // layout
  color: string | PropertyOnlyStep<string>
}
export interface ShadeWorkflowLayerGuide extends LayerWorkflowGuideBase {}
export interface ShadeWorkflowLayerGuideGPU extends ShadeWorkflowLayerGuide {
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
 * - `1` -> WebGL1
 * - `2` -> WebGL2
 * - `3` -> WebGPU
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
  tileSize: number
  analytics: Analytics
  experimental: boolean
  apiKey?: string
  urlMap?: Record<string, string>
}

/** WALLPAPER */
export interface SkyboxStyle {
  /** path to the skybox image folder */
  path: string
  /** size of the skybox image (the path's folder may support multiple) */
  size: number
  /** type of image (the path's folder may support multiple) */
  type: ImageFormats
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
  autoPlay?: boolean
  /** if true, loop the animation */
  loop?: boolean
}

// STYLE DEFINITION //

export interface StyleDefinition {
  /** version of the style - not used for anything other than debugging */
  version?: number
  /** name of the style - not used for anything other than debugging */
  name?: string
  /** Use Either The Web Mercator "WM" or the "S2" Projection */
  projection?: Projection
  /** description of the style - not used for anything other than debugging */
  description?: string
  /**
   * Set the camera view.
   * Properties include:
   * - `zoom`: the zoom level of the map
   * - `lon`: the longitude of the map
   * - `lat`: the latitude of the map
   * - `bearing`: the bearing/compass of the map camera
   * - `pitch`: the pitch/vertical-angle of the map camera
   */
  view?: View
  /** zNear is a parameter for the camera. Recommend not touching */
  zNear?: number
  /** zFar is a parameter for the camera. Recommend not touching */
  zFar?: number
  /** The furthest away from the planet you allow */
  minzoom?: number
  /** The closest you allow the camera to get to the planet */
  maxzoom?: number
  /**
   * Strictly a WM Projection property. Force the view to fill.
   * Defaults to `false`.
   */
  constrainZoomToFill?: boolean
  /**
   * Strictly a WM Projection property. Render the world map as necessary to fill the screen horizontally.
   * Defaults to `true`.
   */
  duplicateHorizontally?: boolean
  /** The minimum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms */
  minLatPosition?: number
  /** The maximum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms */
  maxLatPosition?: number
  /** Often times to improve the quality of raster data, you can apply a zoomOffset for tiles to render. */
  zoomOffset?: number
  /** Allow the camera to go past the max-min latitudes. Useful for animations. */
  noClamp?: boolean
  /**
   * Where to fetch data and JSON guides on how to fetch them. If JSON data, it can be included directly in the source
   *
   * ex.
   * ```json
   * "sources": {
        "countries": "/s2json/countriesHD.s2json",
        "earthquakes": "/s2json/earthquakes.s2json"
      }
   * ```
   */
  sources?: Sources
  /** Time series data is a WIP. Is a guide on how to render &/ animate data at various timestamps */
  timeSeries?: TimeSeriesStyle
  /**
   * Glyph Data (both fonts and icons) and how to fetch them
   *
   * ex.
   * ```json
   * "glyphs": {
   *  "robotoMedium": "/api/glyphs-v2/RobotoMedium",
   *  "streets": "/api/glyphs-v2/streets"
   * }
   * ```
   */
  glyphs?: Glyphs
  /**
   * Fonts and how to fetch them
   *
   * ex.
   * ```json
   * "fonts": {
   *  "robotoMedium": "/api/glyphs-v2/RobotoMedium"
   * }
   * ```
   */
  fonts?: Fonts
  /**
   * Icons and how to fetch them
   *
   * ex.
   * ```json
   * "icons": {
   *  "streets": "/api/glyphs-v2/streets"
   * }
   * ```
   */
  icons?: Icons
  /**
   * Sprites names and where to fetch
   * Sprites have a default expectancy of a `png` image.
   * If you want to use a different format, you can use an object instead of a string.
   *
   * ex.
   * ```json
   * "sprites": {
   *    "streets": "/sprites/streets/sprite@2x"
   * }
   * ```
   *
   * ex.
   * ```json
   * "sprites": {
   *    "streets": {
   *      "path": "/sprites/streets/sprite@2x",
   *      "fileType": "jpg"
   *    }
   * }
   * ```
   */
  sprites?: Sprites
  /**
   * Image names and where to fetch
   *
   * ex.
   * ```json
   * "images": {
   *   "pattern": "/images/pattern.jpg"
   * }
   */
  images?: Record<string, string>
  /**
   * Skybox is often used as a background feature for raster data. Uses a skybox image to render to the screen.
   *
   * ex.
   * ```json
   * "skybox": {
   *    "path": "baseURL://backgrounds/milkyway",
   *    "loadingBackground": "rgb(9, 8, 17)",
   *    "size": 2048,
   *    "type": "webp"
   * }
   * ```
   */
  skybox?: SkyboxStyle
  /**
   * Wallpaper is often used with vector data. Control the coloring of the background.
   *
   * ex.
   *
   * ```json
   * "wallpaper": {
   *   "background": "#030a2d",
   *   "fade1": "rgb(138, 204, 255)",
   *   "fade2": "rgb(217, 255, 255)",
   *   "halo": "rgb(230, 255, 255)"
   * }
   * ```
   */
  wallpaper?: WallpaperStyle
  /**
   * background color for sections where the painter doesn't draw to
   * Default is `rgba(0, 0, 0, 0)` (transparent)
   */
  clearColor?: ColorArray
  /** Layers are the main way to render data on the map. */
  layers?: LayerStyle[]
  /** @beta Utilize WIP experimental components that still have bugs in them. */
  experimental?: boolean
}

import type { ClusterOptions } from 'workers/source/pointCluster';
import type { ColorArray } from './color';
import type { EaseType } from './easingFunctions';
import type { View } from 'ui/camera/projector';
import type {
  Attributions,
  BBox,
  JSONCollection,
  Point,
  Projection,
  Properties,
  TileStoreOptions,
} from 'gis-tools';
import type {
  Center,
  Encoding,
  Extensions,
  Face,
  ImageExtensions,
  LayersMetaData,
  S2Bounds,
  Scheme,
  SourceType,
  TileStatsMetadata,
  VectorLayer,
  WMBounds,
} from 's2-tilejson';
import type { Filter, FilterFunction } from 'style/parseFilter';

export type { ClusterOptions } from 'workers/source/pointCluster';
export type {
  BBox,
  JSONCollection,
  VectorPoint,
  Properties,
  Projection,
  TileStoreOptions,
} from 'gis-tools';
export type { Filter, FilterFunction } from './parseFilter';
export type { EaseType } from './easingFunctions';
export type { MapOptions } from 'ui/s2mapUI';
export type { ColorArray } from './color';
export type { View } from 'ui/camera/projector';
export type * from 's2-tilejson';

/** Optionalized tile metadata. Helps source workers to parse malformed tilesets */
export interface OptionalizedTileMetadata {
  /** The version of the s2-tilejson spec */
  s2tilejson?: string;
  /** The type of the tileset */
  type?: SourceType;
  /** The extension when requesting a tile */
  extension?: Extensions;
  /** List of faces that have tileset */
  faces?: Face[];
  /** minzoom at which to request tiles. [default=0] */
  minzoom?: number;
  /** maxzoom at which to request tiles. [default=27] */
  maxzoom?: number;
  /** Track layer metadata */
  layers?: LayersMetaData;
  /** WM Tile fetching bounds. Helpful to not make unecessary requests for tiles we know don't exist */
  wmbounds?: WMBounds;
  /** S2 Tile fetching bounds. Helpful to not make unecessary requests for tiles we know don't exist */
  s2bounds?: S2Bounds;
  /** Floating point bounding box array [west, south, east, north]. */
  bounds?: BBox;
  /** { ['human readable string']: 'href' } */
  attributions?: Attributions;
  /** The version of the tileset. Matches the pattern: `\d+\.\d+\.\d+\w?[\w\d]*`. */
  version?: string;
  /** The name of the tileset */
  name?: string;
  /** The scheme of the tileset */
  scheme?: Scheme;
  /** The description of the tileset */
  description?: string;
  /** The encoding of the tileset */
  encoding?: Encoding;
  /** The center of the tileset */
  centerpoint?: Center;
  /** Track tile stats for each face and total overall */
  tilestats?: TileStatsMetadata;
  /** Allow additional properties */
  [key: string]: unknown;

  // old spec properties to hold for backwards compatibility

  /** track basic layer metadata */
  vector_layers?: VectorLayer[];
  /**
   * Version of the TileJSON spec used.
   * Matches the pattern: `\d+\.\d+\.\d+\w?[\w\d]*`.
   */
  tilejson?: string;
  /** Array of tile URL templates. */
  tiles?: string[];
  /** Attribution string. */
  attribution?: string;
  /** Center coordinate array [longitude, latitude, zoom]. */
  center?: [lon: number, lat: number, zoom: number];
  // NOTE: Data is rarely used by the old tilejson spec, and it conflicts with the data property
  // used by internal extra source types
  // /** Array of data source URLs. */
  // data?: string[];
  /** Fill zoom level. Must be between 0 and 30. */
  fillzoom?: number;
  /** Array of UTFGrid URL templates. */
  grids?: string[];
  /** Legend of the tileset. */
  legend?: string;
  /** Template for interactivity. */
  template?: string;
}

/** All source input objects contain these shapes */
export type SourceMetadata = OptionalizedTileMetadata &
  ClusterOptions &
  TileStoreOptions & {
    // TODO: Figure out if we need to remove this requirement
    /** Sometimes provided for to have easier access to fetch the source data */
    path?: string;

    /** The size of the tile in pixels if some form of raster data */
    size?: number; // required by raster type sources
    /**
     * The time interval in milliseconds each frame is.
     * Used by sensor sources.
     */
    interval?: number;
    /**
     * Specify the name of the source in order to access it.
     * This is useful if you want to make requests without first having to request the metadata
     */
    sourceName?: string;
    /** If you want to directly inject the geojson or s2json data */
    data?: JSONCollection;
    /** Other build engines place layer data inside a json string */
    json?: string;
  };
/** JSON Source allows inlined geometry in your style */
export interface JSONSource {
  type: 'json';
  data: JSONCollection;
}
/** Local Source has predefined geometry you can use */
export type LocalSource = '_local';
/** A Marker source is a local cache that specifically tracks and maintains markers */
export interface MarkerSource {
  type: 'markers';
  path: '_markers';
  data: JSONCollection;
}
/** List of all source inputs. A String is just a href to SourceMetadata */
export type Source = string | SourceMetadata | JSONSource | LocalSource | MarkerSource;
/**
 * Where to fetch data and JSON guides on how to fetch them. If JSON data, it can be included directly in the source
 *
 * ex.
 * ```json
 * "sources": {
 *   "countries": "/s2json/countriesHD.s2json",
 *   "earthquakes": "/s2json/earthquakes.s2json"
 * }
 * ```
 */
export type Sources = Record<string, Source>; // address to source or source itself

/** GLYPHS, FONTS, SPRITES, AND ICONS */

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
export type Glyphs = Record<string, string>;
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
export type Fonts = Glyphs;
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
export type Icons = Glyphs;
/**
 * Sprites names and where to fetch
 *
 * Sprites have a default expectancy of a `png` image.
 *
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
export type Sprites = Record<
  string,
  | string
  | {
      /** The URL path to the sprite */
      path: string;
      /** The file type of the sprite. e.g. `png`, `jpg`, `webp`, etc. */
      fileType?: ImageExtensions;
    }
>;

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
export type Cursor = CSSStyleDeclaration['cursor'];

/** The workflow takes a layer and builds a function that modifies a feature into renderable data */
export type LayerWorkerFunction<U> = (code: number[], properties: Properties, zoom: number) => U;
/** An workflow interpretor to create code for the GPU to translate into renderable data */
export type BuildCodeFunction = (zoom: number, properties: Properties) => [number[], number[]];
/** An workflow interpretor to create code for the GPU to translate into renderable data */
export type BuildCodeFunctionZoom = (zoom: number) => number[];

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
export type Comparator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | '!in' | 'has' | '!has';

/**
 *
 */
export interface NestedKey {
  /**
   * nested conditions are used to dive into nested properties
   * ex.
   * ```json
   * { "filter": { "nestedKey": "class", "key": { "key": "type", "comparator": "==", "value": "ocean" } } }
   * ```
   * this would be used to filter features where `feature.properties.class.type === 'ocean'`
   */
  nestedKey?: string;
  /** If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'` */
  key: string | NestedKey;
}

/**
 *
 */
export interface InputValue<T extends NotNullOrObject> {
  /** If the property search for a key turns up no value, the fallback is used. */
  fallback: T;
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
  key: string | NestedKey;
}

/**
 *
 */
export interface DataCondition<T extends NotNullOrObject> {
  /**
   * conditions is an array of `{ filter: Filter, input: T | Property<T> }`
   * If the filter passes, the input is used.
   */
  conditions: Array<{
    filter: Filter;
    input: T | Property<T>;
  }>;
  /** If the conditional search fails, the fallback is used. */
  fallback: T | Property<T>;
}

// export type DataRange<T extends NotNullOrObject> = DataRangeStep<T> | DataRangeEase<T>

/**
 *
 */
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
  key: string | NestedKey; // the objects[key] -> value used as position on range
  /**
   * `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
   */
  ease?: EaseType;
  /**
   * Used by `expo`, `quad`, or `cubic` ease functions
   *
   * Ranges from 0 -> 2 [default: 1]
   *
   * - `1` is the default and a linear ease
   * - `0` is the slowest ease early on
   * - `2` is the fastest ease
   */
  base?: number; // 0 -> 2
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
    stop: number;
    input: T | Property<T>;
  }>;
}

/**
 *
 */
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
  key: string | NestedKey; // the objects[key] -> value used as position on range
  ease?: 'step';
  /** Unused by "step" ease functions. Kept to avoid errors in Typescript */
  base?: number; // 0 -> 2
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
    stop: number;
    input: T | Property<T>;
  }>;
}

/**
 *
 */
export interface InputRangeEase<T extends number | string> {
  /** `zoom` | `lon` | `lat` | `angle` | `pitch` */
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch';
  /**
   * `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
   */
  ease?: EaseType;
  /**
   * Used by `expo`, `quad`, or `cubic` ease functions
   *
   * Ranges from 0 -> 2 [default: 1]
   *
   * - `1` is the default and a linear ease
   * - `0` is the slowest ease early on
   * - `2` is the fastest ease
   */
  base?: number; // 0 -> 2
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
    stop: number;
    input: T | Property<T>;
  }>;
}

/**
 *
 */
export interface InputRangeStep<T extends NotNullOrObject> {
  /** "zoom" | "lon" | "lat" | "angle" | "pitch" */
  type: 'zoom' | 'lon' | 'lat' | 'angle' | 'pitch';
  ease: 'step';
  /** Unused by "step" ease functions. Kept to avoid errors in Typescript */
  base?: number; // 0 -> 2
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
    stop: number;
    input: T | Property<T>;
  }>;
}

/**
 *
 */
export interface FeatureState<T extends NotNullOrObject> {
  condition: 'default' /* (inactive) */ | 'active' | 'hover' | 'selected' | 'disabled';
  key: string | NestedKey;
  value: T;
  input: T | Property<T>;
}

/** A value that is not null or an object */
export type NotNullOrObject =
  | string
  | number
  | boolean
  | bigint
  | Array<string | number | boolean | bigint>;
/** An object that is not null. Helper to define what a value actually is */
export type ValueType<T> = T extends NotNullOrObject ? T : never;
/** The input must be either a number or a color */
export type NumberColor<T> = T extends number | string ? T : never;

/**
 *
 */
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
  inputValue?: InputValue<ValueType<T>>;
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
  dataCondition?: DataCondition<ValueType<T>>;
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
  dataRange?: DataRangeEase<NumberColor<T>> | DataRangeStep<ValueType<T>>;
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
  inputRange?: InputRangeEase<NumberColor<T>> | InputRangeStep<ValueType<T>>;
  /** Feature State is still under construction and incomplete */
  featureState?: FeatureState<ValueType<T>>;
  /**
   * Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
   * You will never directly call this at the top level but as an internal fallback for the other types.
   */
  fallback?: T | Property<T>;
}

/**
 *
 */
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
  inputValue?: InputValue<ValueType<T>>;
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
  dataCondition?: DataCondition<ValueType<T>>;
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
  dataRange?: DataRangeStep<ValueType<T>>;
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
  inputRange?: InputRangeStep<ValueType<T>>;
  /** Feature State is still under construction and incomplete */
  featureState?: FeatureState<ValueType<T>>;
  /**
   * Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
   * You will never directly call this at the top level but as an internal fallback for the other types.
   */
  fallback?: T | Property<T>;
}

/** The layer type's that can be used. */
export type LayerType =
  | 'fill'
  | 'glyph'
  | 'heatmap'
  | 'line'
  | 'point'
  | 'raster'
  | 'hillshade'
  | 'sensor'
  | 'shade';
/** Layer types that require data to render */
export type LayerDataType =
  | 'fill'
  | 'glyph'
  | 'heatmap'
  | 'line'
  | 'point'
  | 'raster'
  | 'hillshade'
  | 'sensor';

/** The base layer style. Used by almost all layers to define how a layer should be rendered */
export interface LayerStyleBase<M = unknown> {
  type?: LayerType;
  /** The name of the layer - useful for sorting a layer on insert or for removal */
  name?: string;
  /** The source used to generate the layer */
  source?: string;
  /** The source's layer. Default for JSON data */
  layer?: string;
  /** The minimum zoom level at which the layer will be visible */
  minzoom?: number;
  /** The maximum zoom level at which the layer will be visible */
  maxzoom?: number;
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
  filter?: Filter;
  /** Use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one */
  lch?: boolean;
  /** Whether the layer is visible or not */
  visible?: boolean;
  /** Additional metadata. Used by style generators. */
  metadata?: M;
}
/** refines the style.json to ensure all variables exist that need to */
export interface LayerDefinitionBase {
  type: LayerType;
  name: string;
  layerIndex: number;
  source: string;
  layer: string;
  minzoom: number;
  maxzoom: number;
  lch: boolean;
  visible: boolean;
  filter?: Filter;
  interactive?: boolean;
  opaque?: boolean;
}
/** uses definition to create a guide for the workflow (program/pipeline) */
export interface LayerWorkflowGuideBase {
  sourceName: string;
  layerIndex: number;
  layerCode: number[];
  lch: boolean;
  visible: boolean;
  interactive: boolean;
  opaque: boolean;
}
/** worker takes the definition and creates a layer to prep input data for workflow (program/pipeline) */
export interface LayerWorkerBase {
  type: LayerType;
  name: string;
  layerIndex: number;
  source: string;
  layer: string;
  minzoom: number;
  maxzoom: number;
  filter: FilterFunction;
}
/** worker takes the definition and creates a layer to prep input data for workflow (program/pipeline) */
export interface LayerWorkerBaseRaster {
  type: LayerType;
  name: string;
  layerIndex: number;
  source: string;
  layer: string;
  minzoom: number;
  maxzoom: number;
}
/** Default case for unknown layer types, should never be used */
export type UnkownLayerStyle = LayerStyleBase;

// FILL //

/**
 * # Fill Style Guide
 *
 * ## Description
 *
 * A Fill layer guide defines how polygons should be colored, if they include patterns,
 * are inverted, interactive, etc.
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `color`
 * - `opacity`
 *
 * ### Optional layout properties:
 * - `pattern`
 * - `patternMovement`
 * - `patternFamily`
 *
 * ### Optional properties:
 * - `invert` - if true, invert where the fill is drawn to on the map
 * - `interactive` - if true, when hovering over the fill, the property data will be sent to the UI via an Event
 * - `cursor` - the cursor to use when hovering over the fill
 * - `opaque` - if true, the fill will be drawn opaque and not allow transparency. Used for performance gains.
 */
export interface FillStyle extends LayerStyleBase {
  /**
   * # Fill Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `color`
   * - `opacity`
   *
   * ### Optional layout properties:
   * - `pattern`
   * - `patternMovement`
   * - `patternFamily`
   *
   * ### Optional properties:
   * - `invert` - if true, invert where the fill is drawn to on the map
   * - `interactive` - if true, when hovering over the fill, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the fill
   * - `opaque` - if true, the fill will be drawn opaque and not allow transparency. Used for performance gains.
   */
  type: 'fill';
  // paint
  /**
   * A PAINT `Property`.
   * @default `"rgba(0, 0, 0, 1)"`
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
  color?: string | Property<string>;
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
  opacity?: number | Property<number>;
  // layout
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `undefined`
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
  pattern?: string | PropertyOnlyStep<string>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `false`
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
  patternMovement?: boolean | PropertyOnlyStep<boolean>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `"__images"`
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
  patternFamily?: string | PropertyOnlyStep<string>;
  // properties
  /** If true, invert where the fill is drawn to on the map. Defaults to `false` */
  invert?: boolean;
  /** If true, when hovering over the fill, the property data will be sent to the UI via an Event. Defaults to `false` */
  interactive?: boolean;
  /** The cursor to use when hovering over the fill. Defaults to `default` */
  cursor?: Cursor;
  /** If true, the fill will be drawn opaque and not allow transparency. Used for performance gains. Defaults to `false` */
  opaque?: boolean;
}
/** Parsed Fill Layer used by a Fill workflow */
export interface FillDefinition extends LayerDefinitionBase {
  type: 'fill';
  // paint
  color: string | Property<string>;
  opacity: number | Property<number>;
  // layout
  pattern?: string | PropertyOnlyStep<string>;
  patternMovement: boolean | PropertyOnlyStep<boolean>;
  patternFamily: string | PropertyOnlyStep<string>;
  // properties
  invert: boolean;
  interactive: boolean;
  cursor: Cursor;
  opaque: boolean;
}
/** Parsed Fill Layer used by a Fill Tile Worker */
export interface FillWorkflowLayerGuide extends LayerWorkflowGuideBase {
  color?: LayerWorkerFunction<ColorArray>;
  opacity?: LayerWorkerFunction<number[]>;
  invert: boolean;
  pattern: boolean;
}
/** Expanded Fill Workflow for WebGPU */
export interface FillWorkflowLayerGuideGPU extends FillWorkflowLayerGuide {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
}
/** Parsed Fill Layer used by a Fill Tile Worker */
export interface FillWorkerLayer extends LayerWorkerBase {
  type: 'fill';
  getCode: BuildCodeFunction;
  invert: boolean;
  interactive: boolean;
  cursor: Cursor;
  opaque: boolean;
  pattern?: LayerWorkerFunction<string>;
  patternFamily: LayerWorkerFunction<string>;
  patternMovement: LayerWorkerFunction<boolean>;
}

// GLYPH //

// TODO: Add opacity
/** Anchor position for a glyph layer */
export type Anchor =
  | 'center'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
/** Alignment for a glyph layer */
export type Alignment = 'auto' | 'center' | 'left' | 'right';
/** Placement for a glyph layer */
export type Placement = 'point' | 'line' | 'line-center-point' | 'line-center-path';
/**
 * # Glyph Style Guide
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `textSize` - size of the glyphs in pixels
 * - `textFill` - fill color for glyphs
 * - `textStroke` - stroke color for glyphs
 * - `textStrokeWidth` - stroke width for glyphs in pixels
 * - `iconSize` - size of the icons in pixels
 *
 * ### Optional layout properties:
 * - `placement` - Can be `point`, `line`, `line-center-path` or `line-center-point`. Only relavent if geometry is not a point.
 * - `spacing` - The distance between glyphs in pixels. Only relavent if geometry is not a point.
 * - `textFamily` - The font family to use for the glyphs. Can be multiple options, first is default with each proceeding option as a fallback.
 * - `textField` - The description of the content to be rendered. Can be the text itself, or can be a transfromation input that uses the features properties to build a text string.
 * - `textAnchor` - The anchor position for the text being rendered. An example is "center" or "bottom-left"
 * - `textOffset` - The x and y offset of the text relative to the anchor in pixels
 * - `textPadding` - The width and height padding around the rendered glyphs to ensure stronger filtering of other text/icons nearby
 * - `textRotate` - The rotation of the glyphs relative to the anchor
 * - `textWordWrap` - Wrapping size in pixels. This ensures a max width of the box containing the words.
 * - `textAlign` - Alignment tool to build the words from the `left`, `middle` or `right` positions. Only noticable if words are wrapping.
 * - `textKerning` - Excess kerning for each glyph for individual glyph spacing between eachother.
 * - `textLineHeight` - Adjust the lineheight of glyphs to improve vertical spacing.
 * - `iconFamily` - The source family name to use for the icons. Can be multiple options, first is default with each proceeding option as a fallback.
 * - `iconField` - The name of the icon to render. Can be multiple options, first is default with each proceeding option as a fallback.
 * - `iconAnchor` - The anchor position for the icon to be rendered relative to the centerpoint of the icon. An example is "center" or "bottom-left"
 * - `iconOffset` - The x and y offset of the icon relative to the anchor in pixels
 * - `iconPadding` - The width and height padding around the rendered icon to ensure stronger filtering of other text/icons nearby
 * - `iconRotate` - The rotation of the icons relative to the anchor
 *
 * ### Optional properties:
 * - `geoFilter` - filter the geometry types that will be drawn. Options are `point`, `line`, `poly`
 * - `overdraw` - if true, the layer will be drawn regardless of other glyph layers
 * - `interactive` - if true, when hovering over the glyph, the property data will be sent to the UI via an Event
 * - `viewCollisions` - if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not
 * - `cursor` - the cursor to use when hovering over the glyph
 */
export interface GlyphStyle extends LayerStyleBase {
  /**
   * # Glyph Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `textSize` - size of the glyphs in pixels
   * - `textFill` - fill color for glyphs
   * - `textStroke` - stroke color for glyphs
   * - `textStrokeWidth` - stroke width for glyphs in pixels
   * - `iconSize` - size of the icons in pixels
   *
   * ### Optional layout properties:
   * - `placement` - Can be `point`, `line`, `line-center-path` or `line-center-point`. Only relavent if geometry is not a point.
   * - `spacing` - The distance between glyphs in pixels. Only relavent if geometry is not a point.
   * - `textFamily` - The font family to use for the glyphs. Can be multiple options, first is default with each proceeding option as a fallback.
   * - `textField` - The description of the content to be rendered. Can be the text itself, or can be a transfromation input that uses the features properties to build a text string.
   * - `textAnchor` - The anchor position for the text being rendered. An example is "center" or "bottom-left"
   * - `textOffset` - The x and y offset of the text relative to the anchor in pixels
   * - `textPadding` - The width and height padding around the rendered glyphs to ensure stronger filtering of other text/icons nearby
   * - `textRotate` - The rotation of the glyphs relative to the anchor
   * - `textWordWrap` - Wrapping size in pixels. This ensures a max width of the box containing the words.
   * - `textAlign` - Alignment tool to build the words from the `left`, `middle` or `right` positions. Only noticable if words are wrapping.
   * - `textKerning` - Excess kerning for each glyph for individual glyph spacing between eachother.
   * - `textLineHeight` - Adjust the lineheight of glyphs to improve vertical spacing.
   * - `iconFamily` - The source family name to use for the icons. Can be multiple options, first is default with each proceeding option as a fallback.
   * - `iconField` - The name of the icon to render. Can be multiple options, first is default with each proceeding option as a fallback.
   * - `iconAnchor` - The anchor position for the icon to be rendered relative to the centerpoint of the icon. An example is "center" or "bottom-left"
   * - `iconOffset` - The x and y offset of the icon relative to the anchor in pixels
   * - `iconPadding` - The width and height padding around the rendered icon to ensure stronger filtering of other text/icons nearby
   * - `iconRotate` - The rotation of the icons relative to the anchor
   *
   * ### Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn. Options are `point`, `line`, `poly`
   * - `overdraw` - if true, the layer will be drawn regardless of other glyph layers
   * - `interactive` - if true, when hovering over the glyph, the property data will be sent to the UI via an Event
   * - `viewCollisions` - if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not
   * - `cursor` - the cursor to use when hovering over the glyph
   */
  type: 'glyph';
  // paint
  /**
   * A PAINT `Property`.
   * @default `16`
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
  textSize?: number | Property<number>;
  /**
   * A PAINT `Property`.
   * @default `"rgba(0, 0, 0, 1)"`
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
  textFill?: string | Property<string>;
  /**
   * A PAINT `Property`.
   * @default `"rgba(0, 0, 0, 1)"`
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
  textStroke?: string | Property<string>;
  /**
   * A PAINT `Property`.
   * @default `0`
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
  textStrokeWidth?: number | Property<number>;
  /**
   * A PAINT `Property`.
   * @default `16`
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
  iconSize?: number | Property<number>;
  // layout
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `"line"`
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
  placement?: Placement | PropertyOnlyStep<Placement>;
  /**
   * A LAYOUT `Property`.
   * @default `325`
   *
   * The distance between glyphs in pixels. Only relavent if geometry is not a point.
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
  spacing?: number | Property<number>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `""` (empty string)
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
  textFamily?: string | string[] | PropertyOnlyStep<string | string[]>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `""` (empty string)
   *
   * The description of the content to be rendered. Can be the text itself, or can be a transfromation
   * input that uses the features properties to build a text string.
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
  textField?: string | string[] | PropertyOnlyStep<string | string[]>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `"center"`
   *
   * The anchor position for the text being rendered.
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
  textAnchor?: Anchor | PropertyOnlyStep<Anchor>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `[0, 0]`
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
  textOffset?: Point | PropertyOnlyStep<Point>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `[0, 0]`
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
  textPadding?: Point | PropertyOnlyStep<Point>;
  /**
   * A LAYOUT `Property`.
   * @default `0`
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
  textWordWrap?: number | PropertyOnlyStep<number>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `"center"`
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
  textAlign?: Alignment | PropertyOnlyStep<Alignment>;
  /**
   * A LAYOUT `Property`.
   * @default `0`
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
  textKerning?: number | PropertyOnlyStep<number>;
  /**
   * A LAYOUT `Property`.
   * @default `0`
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
  textLineHeight?: number | PropertyOnlyStep<number>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `""` (empty string)
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
  iconFamily?: string | string[] | PropertyOnlyStep<string | string[]>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `""` (empty string)
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
  iconField?: string | string[] | PropertyOnlyStep<string | string[]>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `"center"`
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
  iconAnchor?: Anchor | PropertyOnlyStep<Anchor>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `[0, 0]`
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
  iconOffset?: Point | PropertyOnlyStep<Point>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `[0, 0]`
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
  iconPadding?: Point | PropertyOnlyStep<Point>;
  // properties
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will support all geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to empty.
   */
  geoFilter?: Array<'point' | 'line' | 'poly'>;
  /** if true, the layer will be drawn regardless of other glyph layers. Default false */
  overdraw?: boolean;
  /** if true, when hovering over the glyph, the property data will be sent to the UI via an Event. Default false */
  interactive?: boolean;
  /** if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not. Default false */
  viewCollisions?: boolean;
  /** if true, it's assumed RTL text has been preshaped so do not apply RTL inversion again. Defaults to false */
  noShaping?: boolean;
  /** the cursor to use when hovering over the glyph. Default "default" */
  cursor?: Cursor;
}
/** Parsed Glyph Layer used by a Glyph workflow */
export interface GlyphDefinition extends LayerDefinitionBase {
  type: 'glyph';
  // paint
  textSize: number | Property<number>;
  textFill: string | Property<string>;
  textStroke: string | Property<string>;
  textStrokeWidth: number | Property<number>;
  iconSize: number | Property<number>;
  // layout
  placement: Placement | PropertyOnlyStep<Placement>;
  spacing: number | Property<number>;
  textFamily: string | string[] | PropertyOnlyStep<string | string[]>;
  textField: string | string[] | PropertyOnlyStep<string | string[]>;
  textAnchor: Anchor | PropertyOnlyStep<Anchor>;
  textOffset: Point | PropertyOnlyStep<Point>;
  textPadding: Point | PropertyOnlyStep<Point>;
  textWordWrap: number | PropertyOnlyStep<number>;
  textAlign: Alignment | PropertyOnlyStep<Alignment>;
  textKerning: number | PropertyOnlyStep<number>;
  textLineHeight: number | PropertyOnlyStep<number>;
  iconFamily: string | string[] | PropertyOnlyStep<string | string[]>;
  iconField: string | string[] | PropertyOnlyStep<string | string[]>;
  iconAnchor: Anchor | PropertyOnlyStep<Anchor>;
  iconOffset: Point | PropertyOnlyStep<Point>;
  iconPadding: Point | PropertyOnlyStep<Point>;
  // properties
  geoFilter: Array<'point' | 'line' | 'poly'>;
  overdraw: boolean;
  interactive: boolean;
  noShaping: boolean;
  viewCollisions: boolean;
  cursor: Cursor;
}
/** Glyph Layer used by a Glyph Tile Worker */
export interface GlyphWorkflowLayerGuide extends LayerWorkflowGuideBase {
  cursor: Cursor;
  overdraw: boolean;
  viewCollisions: boolean;
}
/** Extended Glyph Layer used by WebGPU */
export interface GlyphWorkflowLayerGuideGPU extends GlyphWorkflowLayerGuide {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
}
/** Glyph Layer used by a Glyph Tile Worker */
export interface GlyphWorkerLayer extends LayerWorkerBase {
  type: 'glyph';
  textGetCode: BuildCodeFunction;
  iconGetCode: BuildCodeFunction;
  // paint
  iconPaint?: number[];
  textSize: LayerWorkerFunction<number>;
  iconSize: LayerWorkerFunction<number>;
  // layout
  placement: LayerWorkerFunction<Placement>;
  spacing: LayerWorkerFunction<number>;
  textFamily: LayerWorkerFunction<string | string[]>;
  textField: LayerWorkerFunction<string | string[]>;
  textAnchor: LayerWorkerFunction<string>;
  textOffset: LayerWorkerFunction<Point>;
  textPadding: LayerWorkerFunction<Point>;
  textWordWrap: LayerWorkerFunction<number>;
  textAlign: LayerWorkerFunction<Alignment>;
  textKerning: LayerWorkerFunction<number>;
  textLineHeight: LayerWorkerFunction<number>;
  iconFamily: LayerWorkerFunction<string | string[]>;
  iconField: LayerWorkerFunction<string | string[]>;
  iconAnchor: LayerWorkerFunction<Anchor>;
  iconOffset: LayerWorkerFunction<Point>;
  iconPadding: LayerWorkerFunction<Point>;
  // properties
  geoFilter: Array<'point' | 'line' | 'poly'>;
  overdraw: boolean;
  interactive: boolean;
  noShaping: boolean;
  cursor: Cursor;
}

// HEATMAP //

/**
 * # Heatmap Layer Guide
 *
 * ### Base Properties:
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
 * - `radius` - the radius of the heatmap in pixels
 * - `opacity` - the opacity of the heatmap. Between 0 and 1 inclusive
 * - `intensity` - the intensity of the heatmap
 *
 * ### Optional layout properties:
 * - `weight` - A weight multiplier to apply to each of the heatmap's points
 *
 * ### Optional properties:
 * - `geoFilter` - filter the geometry types that will be drawn.
 * - `colorRamp` - Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
 */
export interface HeatmapStyle extends LayerStyleBase {
  /**
   * # Heatmap Layer Guide
   *
   * # Base Properties:
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
   * ### Optional paint properties:
   * - `radius` - the radius of the heatmap in pixels
   * - `opacity` - the opacity of the heatmap. Between 0 and 1 inclusive
   * - `intensity` - the intensity of the heatmap
   *
   * ### Optional layout properties:
   * - `weight` - A weight multiplier to apply to each of the heatmap's points
   *
   * ### Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn. Options are `point`, `line`, `poly`.
   * - `colorRamp` - Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
   */
  type: 'heatmap';
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
  radius?: number | Property<number>;
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
  opacity?: number | Property<number>;
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
  intensity?: number | Property<number>;
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
  weight?: number | Property<number>;
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
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number; color: string }>;
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will support all geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to `['line', 'poly']` (only points will be drawn).
   */
  geoFilter?: Array<'point' | 'line' | 'poly'>;
}
/** A parsed heatmap guide that injects defaults for missing properties */
export interface HeatmapDefinition extends LayerDefinitionBase {
  type: 'heatmap';
  // paint
  radius: number | Property<number>;
  opacity: number | Property<number>;
  intensity: number | Property<number>;
  weight: number | Property<number>;
  // properties
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number; color: string }>;
  geoFilter: Array<'point' | 'line' | 'poly'>;
}
/** A built heatmap guide used by the heatmap workflow. */
export interface HeatmapWorkflowLayerGuide extends LayerWorkflowGuideBase {
  colorRamp: WebGLTexture;
}
/** An extended heatmap guide used by the heatmap workflow for WebGPU */
export interface HeatmapWorkflowLayerGuideGPU extends LayerWorkflowGuideBase {
  colorRamp: GPUTexture;
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
  textureBindGroup: GPUBindGroup;
  renderTarget: GPUTexture;
  renderPassDescriptor: GPURenderPassDescriptor;
}
/** A heatmap Tile Worker layer */
export interface HeatmapWorkerLayer extends LayerWorkerBase {
  type: 'heatmap';
  getCode: BuildCodeFunction;
  weight: LayerWorkerFunction<number>;
  geoFilter: Array<'point' | 'line' | 'poly'>;
}

// LINE //

/** Line cap options */
export type Cap = 'butt' | 'square' | 'round';
/** Line join options */
export type Join = 'bevel' | 'miter' | 'round';
/**
 * Line Style Guide
 *
 * # Base Properties:
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
 * ### Optional paint properties:
 * - `color` - the color of the line
 * - `opacity` - the opacity of the line
 * - `width` - the width of the line in pixels
 * - `gapwidth` - split the line into two segments to reduce rendering artifacts
 *
 * ### Optional layout properties:
 * - `cap` - the cap of the line. Either `butt`, `square`, or `round`
 * - `join` - the joiner used for the line. Either `bevel`, `miter`, or `round`
 * - `dasharray` - A sequence of lengths and gaps that describe the pattern of dashes and gaps used to draw the line
 *
 * ### Optional properties:
 * - `geoFilter` - filter the geometry types that will be drawn.
 * - `interactive` - if true, when hovering over the line, the property data will be sent to the UI via an Event
 * - `cursor` - the cursor to use when hovering over the line
 */
export interface LineStyle extends LayerStyleBase {
  /**
   * # Line Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `color` - the color of the line
   * - `opacity` - the opacity of the line
   * - `width` - the width of the line in pixels
   * - `gapwidth` - split the line into two segments to reduce rendering artifacts
   *
   * ### Optional layout properties:
   * - `cap` - the cap of the line. Either `butt`, `square`, or `round`
   * - `join` - the joiner used for the line. Either `bevel`, `miter`, or `round`
   * - `dasharray` - A sequence of lengths and gaps that describe the pattern of dashes and gaps used to draw the line
   *
   * ### Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn. Options are `point`, `line`, `poly`.
   * - `interactive` - if true, when hovering over the line, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the line
   */
  type: 'line';
  // paint
  /**
   * A PAINT `Property`.
   * @default `"rgba(0, 0, 0, 1)"`
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
  color?: string | Property<string>;
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
  opacity?: number | Property<number>;
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
  width?: number | Property<number>;
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
  gapwidth?: number | Property<number>;
  // layout
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `butt`
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
  cap?: Cap | PropertyOnlyStep<Cap>;
  /**
   * A LAYOUT `PropertyOnlyStep`.
   * @default `miter`
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
  join?: Join | PropertyOnlyStep<Join>;
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
  dasharray?: Array<[number, string]>;
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will supports both `line` & `polygon` geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to empty.
   */
  geoFilter?: Array<'line' | 'poly'>;
  /** if true, when hovering over the line, the property data will be sent to the UI via an Event. Defaults to `false` */
  interactive?: boolean;
  /** the cursor to use when hovering over the line. Defaults to "default" */
  cursor?: Cursor;
}
/** A parsed user defined layer guide that replaced undefined values with defaults */
export interface LineDefinition extends LayerDefinitionBase {
  type: 'line';
  // paint
  color: string | Property<string>;
  opacity: number | Property<number>;
  width: number | Property<number>;
  gapwidth: number | Property<number>;
  // layout
  cap: Cap | PropertyOnlyStep<Cap>;
  join: Join | PropertyOnlyStep<Join>;
  // properties
  dasharray: Array<[number, string]>;
  dashed: boolean;
  geoFilter: Array<'line' | 'poly'>;
  interactive: boolean;
  cursor: Cursor;
}
/** A Line layer guide setup for the workflow to build layer feature data */
export interface LineWorkflowLayerGuide extends LayerWorkflowGuideBase {
  dashed: boolean;
  dashCount: number;
  dashLength: number;
  dashTexture: WebGLTexture;
  interactive: boolean;
  cursor: Cursor;
}
/** An extension to the line workflow layer guide for WebGPU */
export interface LineWorkflowLayerGuideGPU extends Omit<LineWorkflowLayerGuide, 'dashTexture'> {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
  dashTexture: GPUTexture;
}
/** Line Worker Layer guide to help process line feature data to be rendered */
export interface LineWorkerLayer extends LayerWorkerBase {
  type: 'line';
  cap: LayerWorkerFunction<Cap>;
  join: LayerWorkerFunction<Join>;
  // properties
  getCode: BuildCodeFunction;
  dashed: boolean;
  geoFilter: Array<'line' | 'poly'>;
  interactive: boolean;
  cursor: Cursor;
}

// POINT //

/**
 * # Point Style Guide
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `color`
 * - `radius`
 * - `stroke`
 * - `strokeWidth`
 * - `opacity`
 *
 * ### Optional properties:
 * - `geoFilter` - filter the geometry types that will be drawn.
 * - `interactive` - if true, when hovering over the line, the property data will be sent to the UI via an Event
 * - `cursor` - the cursor to use when hovering over the line
 */
export interface PointStyle extends LayerStyleBase {
  /**
   * # Point Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `color`
   * - `radius`
   * - `stroke`
   * - `strokeWidth`
   * - `opacity`
   *
   * ### Optional properties:
   * - `geoFilter` - filter the geometry types that will be drawn. Options are `point`, `line`, `poly`.
   * - `interactive` - if true, when hovering over the line, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the line
   */
  type: 'point';
  // paint
  /**
   * A PAINT `Property`.
   * @default `"rgba(0, 0, 0, 0)"`
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
  color?: string | Property<string>;
  /**
   * A PAINT `Property`.
   * @default `1`
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
  radius?: number | Property<number>;
  /**
   * A PAINT `Property`.
   * @default `"rgba(0, 0, 0, 0)"`
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
  stroke?: string | Property<string>;
  /**
   * A PAINT `Property`.
   * @default `1`
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
  strokeWidth?: number | Property<number>;
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
  opacity?: number | Property<number>;
  // properties
  /**
   * Filter the geometry types that will be drawn.
   * An empty array will support all geometry types.
   * Ex. `["line"]` - only draw lines
   * Defaults to `['line', 'poly']`.
   */
  geoFilter?: Array<'point' | 'line' | 'poly'>;
  /** if true, when hovering over the line, the property data will be sent to the UI via an Event. Defaults to `false` */
  interactive?: boolean;
  /** the cursor to use when hovering over the line. Defaults to "default" */
  cursor?: Cursor;
}
/** Internal interface that builds a point layer with defaults for properties that were not defined by the user */
export interface PointDefinition extends LayerDefinitionBase {
  type: 'point';
  // paint
  color: string | Property<string>;
  radius: number | Property<number>;
  stroke: string | Property<string>;
  strokeWidth: number | Property<number>;
  opacity: number | Property<number>;
  // properties
  geoFilter: Array<'point' | 'line' | 'poly'>;
  interactive: boolean;
  cursor: Cursor;
}
/** Internal interface acting as a WebGL(1|2) draw guide for Points */
export interface PointWorkflowLayerGuide extends LayerWorkflowGuideBase {
  cursor: Cursor;
}
/** Internal interface acting as a WebGPU draw guide for Points */
export interface PointWorkflowLayerGuideGPU extends PointWorkflowLayerGuide {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
}
/** Internal interface using user defined layer guide via a Tile Worker to prepare data for rendering */
export interface PointWorkerLayer extends LayerWorkerBase {
  type: 'point';
  getCode: BuildCodeFunction;
  geoFilter: Array<'point' | 'line' | 'poly'>;
  interactive: boolean;
  cursor: Cursor;
}

// RASTER //

/** Raster resampling method. Either `nearest` or `linear` */
export type Resampling = GPUFilterMode;
/**
 * # Raster Style Guide
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `opacity`
 * - `saturation`
 * - `contrast`
 *
 * ### Optional layout properties:
 * - `resampling` - The resampling method. Either `nearest` or `linear`
 * - `fadeDuration` - The time it takes for each raster tile to fade in and out of view in milliseconds
 */
export interface RasterStyle extends LayerStyleBase {
  /**
   * # Raster Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `opacity`
   * - `saturation`
   * - `contrast`
   *
   * ### Optional layout properties:
   * - `resampling` - The resampling method. Either `nearest` or `linear`
   * - `fadeDuration` - The time it takes for each raster tile to fade in and out of view in milliseconds
   */
  type: 'raster';
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
  opacity?: number | Property<number>;
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
  saturation?: number | Property<number>;
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
  contrast?: number | Property<number>;
  // properties
  /**
   * Decide how the GPU samples the texture. Either `nearest` or `linear`. Linear is smoother but nearest has better performance.
   *
   * Defaults to `linear`.
   */
  resampling?: Resampling;
  /** The duration of the fade in milliseconds. Defaults to `300` */
  fadeDuration?: number;
}
/** A Raster layer guide parsed from a user defined layer guide, replacing undefined values with defaults */
export interface RasterDefinition extends LayerDefinitionBase {
  type: 'raster';
  // paint
  opacity: number | Property<number>;
  saturation: number | Property<number>;
  contrast: number | Property<number>;
}
/** A worflow layer guide parsed from a user defined layer guide, designed to help shape raster feature data into renderable targets */
export interface RasterWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number;
  resampling: Resampling;
}
/** An extension to the raster workflow layer guide for WebGPU */
export interface RasterWorkflowLayerGuideGPU extends RasterWorkflowLayerGuide {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
}
/** A worker layer guide parsed from a user defined layer guide for the Tile Raster Workers to prepare data for rendering */
export interface RasterWorkerLayer extends LayerWorkerBaseRaster {
  type: 'raster';
  getCode: BuildCodeFunctionZoom;
}

// HILLSHADE //

/** Hillshade unpacking guide to convert RGBA encoded values into a f32 */
export interface UnpackDefinition {
  offset: number;
  zFactor: number;
  rMultiplier: number;
  gMultiplier: number;
  bMultiplier: number;
  aMultiplier: number;
}
/** Hillshade unpacking guide to convert RGBA encoded values into a f32 */
export type UnpackData = [
  offset: number,
  zFactor: number,
  rMul: number,
  gMul: number,
  bMul: number,
  aMul: number,
];
/**
 * # Hillshade Style Guide
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `opacity`
 * - `azimuth`
 * - `altitude`
 * - `shadowColor`
 * - `highlightColor`
 * - `accentColor`
 *
 * ### Optional layout properties:
 * - `fadeDuration` - The time it takes for each raster tile to fade in and out of view in milliseconds
 * - `unpack` - Descriptor to help the GPU know how to unpack the incoming RGBA data into a f32.
 */
export interface HillshadeStyle extends LayerStyleBase {
  /**
   * # Hillshade Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `opacity`
   * - `azimuth`
   * - `altitude`
   * - `shadowColor`
   * - `highlightColor`
   * - `accentColor`
   *
   * ### Optional layout properties:
   * - `fadeDuration` - The time it takes for each raster tile to fade in and out of view in milliseconds
   * - `unpack` - Descriptor to help the GPU know how to unpack the incoming RGBA data into a f32.
   */
  type: 'hillshade';
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
  opacity?: number | Property<number>;
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
  azimuth?: number | Property<number>;
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
  altitude?: number | Property<number>;
  /**
   * A LAYOUT `Property`.
   * @default `"#000"`
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
  shadowColor?: string | Property<string>;
  /**
   * A LAYOUT `Property`.
   * @default `"#fff"`
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
  highlightColor?: string | Property<string>;
  /**
   * A LAYOUT `Property`.
   * @default `"#000"`
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
  accentColor?: string | Property<string>;
  // properties
  /** The duration of the fade in milliseconds. Defaults to `300` */
  fadeDuration?: number;
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
   *      unpack.zFactor
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
  unpack?: UnpackDefinition;
}
/** Parsed user hillshade layer guide that replaced undefined values with defaults */
export interface HillshadeDefinition extends LayerDefinitionBase {
  type: 'hillshade';
  // layout
  opacity: number | Property<number>;
  azimuth: number | Property<number>;
  altitude: number | Property<number>;
  shadowColor: string | Property<string>;
  highlightColor: string | Property<string>;
  accentColor: string | Property<string>;
  unpack: UnpackDefinition;
}
/** A worflow layer guide parsed from a user defined layer guide, designed to help shape hillshade feature data into renderable targets */
export interface HillshadeWorkflowLayerGuide extends LayerWorkflowGuideBase {
  fadeDuration: number;
  unpack: UnpackData;
}
/** An extension to the hillshade workflow layer guide for WebGPU */
export interface HillshadeWorkflowLayerGuideGPU
  extends Omit<HillshadeWorkflowLayerGuide, 'unpack'> {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
  unpackBuffer: GPUBuffer;
}
/** A worker layer guide parsed from a user defined layer guide for the Tile Raster Workers to prepare data for rendering */
export interface HillshadeWorkerLayer extends LayerWorkerBaseRaster {
  type: 'hillshade';
  getCode: BuildCodeFunctionZoom;
}

// SENSOR */

/**
 * # Sensor Style Guide
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `opacity`
 *
 * ### Optional layout properties:
 * - `fadeDuration` - The time it takes for each raster tile to fade in and out of view in milliseconds
 * - `colorRamp` - Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
 *
 * ### Optional properties:
 * - `interactive` - if true, when hovering over the fill, the property data will be sent to the UI via an Event
 * - `cursor` - the cursor to use when hovering over the fill
 */
export interface SensorStyle extends LayerStyleBase {
  /**
   * # Sensor Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `opacity`
   *
   * ### Optional layout properties:
   * - `fadeDuration` - The time it takes for each raster tile to fade in and out of view in milliseconds
   * - `colorRamp` - Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
   *
   * ### Optional properties:
   * - `interactive` - if true, when hovering over the fill, the property data will be sent to the UI via an Event
   * - `cursor` - the cursor to use when hovering over the fill
   */
  type: 'sensor';
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
  opacity?: number | Property<number>;
  // properties
  /** The duration of the fade in milliseconds. Defaults to `300` */
  fadeDuration?: number;
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
  colorRamp?: 'sinebow' | 'sinebow-extended' | Array<{ stop: number; color: string }>;
  /** if true, when hovering over the fill, the property data will be sent to the UI via an Event. Defaults to false */
  interactive?: boolean;
  /** the cursor to use when hovering over the fill. Defaults to "default" */
  cursor?: Cursor;
}
/** A Raster layer guide parsed from a user defined layer guide, replacing undefined values with defaults */
export interface SensorDefinition extends LayerDefinitionBase {
  type: 'sensor';
  // paint
  opacity: number | Property<number>;
  // properties
  fadeDuration: number;
  colorRamp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number; color: string }>;
  interactive: boolean;
  cursor: Cursor;
}
/** A worflow layer guide parsed from a user defined layer guide, designed to help shape sensor feature data into renderable targets */
export interface SensorWorkflowLayerGuide extends LayerWorkflowGuideBase {
  // properties
  fadeDuration: number;
  colorRamp: WebGLTexture;
}
/** An extension to the sensor workflow layer guide for WebGPU */
export interface SensorWorkflowLayerGuideGPU extends SensorWorkflowLayerGuide {
  colorRame: GPUTexture;
}
/** A worker layer guide parsed from a user defined layer guide for the Tile Sensor Workers to prepare data for rendering */
export interface SensorWorkerLayer extends LayerWorkerBaseRaster {
  type: 'sensor';
  getCode: BuildCodeFunctionZoom;
}

/**
 * # Shade Style Guide
 *
 * ### Base Properties:
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
 * ### Optional paint properties:
 * - `color` - Color of the shade
 */
export interface ShadeStyle extends LayerStyleBase {
  /**
   * # Shade Style Guide
   *
   * ### Base Properties:
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
   * ### Optional paint properties:
   * - `color` - Color of the shade
   */
  type: 'shade';
  // layout
  /**
   * A LAYOUT `Property`.
   * @default `"rgba(0, 0, 0, 1)"`
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
  color?: string | PropertyOnlyStep<string>;
}
/** Parsed user shade layer guide that replaced undefined values with defaults */
export interface ShadeDefinition extends LayerDefinitionBase {
  type: 'shade';
  // layout
  color: string | PropertyOnlyStep<string>;
}
/** A worflow layer guide parsed from a user defined layer guide, designed to help shape shade feature data into renderable targets */
export type ShadeWorkflowLayerGuide = LayerWorkflowGuideBase;
/** An extension to the shade workflow layer guide for WebGPU */
export interface ShadeWorkflowLayerGuideGPU extends ShadeWorkflowLayerGuide {
  layerBuffer: GPUBuffer;
  layerCodeBuffer: GPUBuffer;
}
/** A worker layer guide parsed from a user defined layer guide for the Tile Workers to prepare data for rendering */
export interface ShadeWorkerLayer extends LayerWorkerBase {
  type: 'shade';
}

/** All possible layer styles to use */
export type LayerStyle =
  | UnkownLayerStyle
  | FillStyle
  | GlyphStyle
  | HeatmapStyle
  | LineStyle
  | PointStyle
  | RasterStyle
  | SensorStyle
  | ShadeStyle
  | HillshadeStyle;
/** All layer definitions that are used by the painter workflows */
export type LayerDefinition =
  | FillDefinition
  | GlyphDefinition
  | HeatmapDefinition
  | LineDefinition
  | PointDefinition
  | RasterDefinition
  | HillshadeDefinition
  | SensorDefinition
  | ShadeDefinition;
/** Tile Worker layer processors */
export type WorkerLayer =
  | FillWorkerLayer
  | GlyphWorkerLayer
  | HeatmapWorkerLayer
  | LineWorkerLayer
  | PointWorkerLayer
  | RasterWorkerLayer
  | HillshadeWorkerLayer
  | SensorWorkerLayer;
/** Tile Worker layer processors that are Vector Geometry specific */
export type VectorWorkerLayer =
  | FillWorkerLayer
  | GlyphWorkerLayer
  | HeatmapWorkerLayer
  | LineWorkerLayer
  | PointWorkerLayer;
/** Layer types that can be interactive */
export type InteractiveWorkerLayer =
  | FillWorkerLayer
  | GlyphWorkerLayer
  | LineWorkerLayer
  | PointWorkerLayer;

/**
 * GPU Context Type
 * - `1` -> WebGL1
 * - `2` -> WebGL2
 * - `3` -> WebGPU
 */
export const GPUType = {
  WebGL1: 1,
  WebGL2: 2,
  WebGPU: 3,
} as const;
/** colorblind mode */
export type GPUType = (typeof GPUType)[keyof typeof GPUType];

/** Basic analytics information sent to servers */
export interface Analytics {
  gpu: string;
  context: number;
  language: string;
  width: number;
  height: number;
}

/** Style package is an internal tool to ship information about the map to the workers */
export interface StylePackage {
  projection: Projection;
  gpuType: GPUType;
  sources: Sources;
  fonts: Fonts;
  icons: Icons;
  glyphs: Glyphs;
  sprites: Sprites;
  images: Record<string, string>;
  layers: LayerDefinition[];
  minzoom: number;
  maxzoom: number;
  tileSize: number;
  analytics: Analytics;
  experimental: boolean;
  apiKey?: string;
  urlMap?: Record<string, string>;
}

/** WALLPAPER */
export interface SkyboxStyle {
  /** path to the skybox image folder */
  path: string;
  /** size of the skybox image (the path's folder may support multiple) */
  size: number;
  /** type of image (the path's folder may support multiple) */
  type: ImageExtensions;
  /** background color of the skybox while waiting for it to load images */
  loadingBackground?: string;
}

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
export interface WallpaperStyle {
  /** background color is the most seen color zoomed out */
  background?: string;
  /** color of the border around the sphere */
  fade1?: string;
  /** second color of the border around the sphere (further away then fade1) */
  fade2?: string;
  /** color of the border around the sphere (closest to the sphere and smallest fade factor) */
  halo?: string;
}

// TIME SERIES //

/**
 * # Time Series Style
 *
 * Temporal data is a series of gridded tiles that can be visualized as an animation.
 * Describe the time series beginning and end dates, speed, and pause duration.
 *
 * ### Properties
 * - `startDate`: Date formatted string or unix timestamp (e.g. 1631124000000)
 * - `endDate`: Date formatted string or unix timestamp (e.g. 1631124000000)
 * - `speed`: Seconds in time series per second (e.g. 10800 seconds per second)
 * - `pauseDuration`: Time to wait before animating in seconds (e.g. 3 seconds)
 * - `autoPlay`: If true, start playing automatically
 * - `loop`: If true, loop the animation
 */
export interface TimeSeriesStyle {
  /** Date formatted string or unix timestamp (e.g. 1631124000000) */
  startDate?: number | string;
  /** Date formatted string or unix timestamp (e.g. 1631124000000) */
  endDate?: number | string;
  /** Seconds in time series per second (e.g. 10800 seconds per second) */
  speed?: number;
  /** Time to wait before animating in seconds (e.g. 3 seconds) */
  pauseDuration?: number;
  /** If true, start playing automatically */
  autoPlay?: boolean;
  /** If true, loop the animation */
  loop?: boolean;
}

// STYLE DEFINITION //

/**
 * # STYLE DEFINITION
 *
 * ### Description
 * This is the user defined guide for how to render the map. This definition includes directions of what data
 * to render, where to get said data, and how to style each data as layers.
 *
 * ### Rendering Properties
 * - `projection`: `"S2"` (Spherical Geometry) or `"WG"` (Web Mercator). Defaults to S2
 * - `sources`: Most critical, a list of source data, how to fetch for rendering
 * - `timeSeries`: Time series data is a WIP. Is a guide on how to render &/ animate data at various timestamps
 * - `layers`: array of layer definitions, describing how to render the scene
 * - `glyphs`: Glyph Data (both fonts and icons) and how to fetch them
 * - `icons`: Icon sources and how to fetch them
 * - `fonts`: Font sources and how to fetch them
 * - `sprites`: Sprites sources, where to fetch, can be a string or an object
 * - `images`: Image names and where to fetch them
 * - `skybox`: Skybox is often used as a background feature for raster data. Uses a skybox image to render to the screen.
 * - `wallpaper`: Wallpaper is often used with vector data. Control the coloring of the background.
 * - `clearColor`: Background color for sections where the painter doesn't draw to. Defaults to `rgba(0, 0, 0, 0)`
 *
 * ### Camera Properties
 * - `view`: `zoom`, `lon`, `lat`, `bearing`, `pitch`. Defaults to 0 for all.
 * - `zNear`: zNear is a parameter for the camera. Recommend not touching.
 * - `zFar`: zFar is a parameter for the camera. Recommend not touching.
 * - `minzoom`: The furthest away from the planet you allow
 * - `maxzoom`: The closest to the planet you allow
 * - `minLatPosition`: The minimum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms
 * - `maxLatPosition`: The maximum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms
 * - `zoomOffset`: Often times to improve the quality of raster data, you can apply a zoomOffset for tiles to render.
 *
 * ### Base Properties
 * - `version`: version of the style - not used for anything other than debugging
 * - `name`: name of the style - not used for anything other than debugging
 * - `description`: description of the style - not used for anything other than debugging
 *
 * ### Flags
 * - `constrainZoomToFill`: Strictly a WG Projection property. Force the view to fill. Defaults to `false`
 * - `duplicateHorizontally`: Strictly a WG Projection property. Render the world map as necessary to fill the screen horizontally. Defaults to `true`
 * - `noClamp`: Allow the camera to go past the max-min latitudes. Useful for animations. Defaults to `false`
 * - `experimental`: Enable experimental features
 */
export interface StyleDefinition {
  /** version of the style - not used for anything other than debugging */
  version?: number;
  /** name of the style - not used for anything other than debugging */
  name?: string;
  /** Use Either The Web Mercator "WG" or the "S2" Projection */
  projection?: Projection;
  /** description of the style - not used for anything other than debugging */
  description?: string;
  /**
   * Set the camera view.
   * Properties include:
   * - `zoom`: the zoom level of the map
   * - `lon`: the longitude of the map
   * - `lat`: the latitude of the map
   * - `bearing`: the bearing/compass of the map camera
   * - `pitch`: the pitch/vertical-angle of the map camera
   */
  view?: View;
  /** zNear is a parameter for the camera. Recommend not touching */
  zNear?: number;
  /** zFar is a parameter for the camera. Recommend not touching */
  zFar?: number;
  /** The furthest away from the planet you allow */
  minzoom?: number;
  /** The closest you allow the camera to get to the planet */
  maxzoom?: number;
  /**
   * Strictly a WG Projection property. Force the view to fill.
   * Defaults to `false`.
   */
  constrainZoomToFill?: boolean;
  /**
   * Strictly a WG Projection property. Render the world map as necessary to fill the screen horizontally.
   * Defaults to `true`.
   */
  duplicateHorizontally?: boolean;
  /** The minimum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms */
  minLatPosition?: number;
  /** The maximum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms */
  maxLatPosition?: number;
  /** Often times to improve the quality of raster data, you can apply a zoomOffset for tiles to render. */
  zoomOffset?: number;
  /** Allow the camera to go past the max-min latitudes. Useful for animations. */
  noClamp?: boolean;
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
  sources?: Sources;
  /** Time series data is a WIP. Is a guide on how to render &/ animate data at various timestamps */
  timeSeries?: TimeSeriesStyle;
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
  glyphs?: Glyphs;
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
  fonts?: Fonts;
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
  icons?: Icons;
  /**
   * Sprites names and where to fetch
   *
   * Sprites have a default expectancy of a `png` image.
   *
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
  sprites?: Sprites;
  /**
   * Image names and where to fetch
   *
   * ex.
   * ```json
   * "images": {
   *   "pattern": "/images/pattern.jpg"
   * }
   */
  images?: Record<string, string>;
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
  skybox?: SkyboxStyle;
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
  wallpaper?: WallpaperStyle;
  /**
   * background color for sections where the painter doesn't draw to
   * Default is `rgba(0, 0, 0, 0)` (transparent)
   */
  clearColor?: ColorArray;
  /**
   * Layers are the main way to render data on the map.
   * Your layer options are:
   * - fill - Draw polygons with a fill color, outline, and opacity
   * - glyph - Draw text, icons, sprites, etc.
   * - heatmap - Takes lots of points as an input and produces a heatmap
   * - hillshade - Draw hillshading on the map given an input elevation tile.
   * - line - Lines with variable width, cap, and join types
   * - point - Draw individual points, even if they're clustered, deconstruct lines and polygons, etc.
   * - raster - RGBA encoded tile data
   * - sensor - Sensor data is a temporal construct that takes gridded data and draws it on the map using a color ramp.
   * - shade - Draw a nice "shade" gradient on the globe to give it depth if you're using the S2 Projection. Usually only want one.
   */
  layers?: LayerStyle[];
  /** @experimental Utilize WIP experimental components that still have bugs in them. */
  experimental?: boolean;
}

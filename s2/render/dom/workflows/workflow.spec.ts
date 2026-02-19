import type { ColorMode } from 's2/s2Map.js';
import type { DOMContext } from '../context.js';
import type { RasterData } from 's2/workers/worker.spec.js';
import type { BBox, VectorPoint } from 's2/gis-tools/index.js';
import type { FaceST, TileDOM as Tile } from 's2/source/tile.spec.js';
import type {
  LayerDefinitionBase,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuide,
} from 's2/style/style.spec.js';

/** Generic Workflow specification used by most workflows */
export interface WorkflowSpec {
  radii: boolean;
  context: DOMContext;
  type: 0;
  updateColorBlindMode: null | ColorMode;
  updateMatrix: null | Float32Array;
  updateInputs: null | Float32Array;
  updateAspect: null | VectorPoint;
  LCH?: boolean;

  delete: () => void;
  use: () => void;
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: VectorPoint) => void;
  flush: () => void;
  // set uniforms:
  setTileUniforms: (tile: Tile, parent?: Tile) => void;
  setDevicePixelRatio: (ratio: number) => void;
  setColorBlindMode: (colorMode: ColorMode) => void;
  setMatrix: (matrix: Float32Array) => void;
  setInputs: (inputs: Float32Array) => void;
  setAspect: (aspect: VectorPoint) => void;
  setFaceST: (faceST: FaceST) => void;
  setTilePos: (bottomTop: Float32Array) => void;
  setLayerCode: (layerIndex: number, layerCode: number[], lch: boolean) => void;
  setInteractive: (interactive: boolean) => void;
  setFeatureCode: (featureCode: number[]) => void;
  setMode: (mode: number) => void;
}

/** Workflow keys */
export type WorkflowKey = keyof Workflows;
/** Workflow types */
export type WorkflowType =
  | 'fill'
  | 'glyph'
  | 'heatmap'
  | 'line'
  | 'point'
  | 'raster'
  | 'hillshade'
  | 'skybox'
  | 'shade'
  | 'sensor'
  | 'wallpaper';

/** List of all workflows that can draw features or internal states */
export interface Workflows {
  fill?: undefined;
  // fill?: FillWorkflow;
  glyphFilter?: undefined;
  // glyphFilter?: GlyphFilterWorkflow;
  glyph?: undefined;
  // glyph?: GlyphWorkflow;
  heatmap?: undefined;
  // heatmap?: HeatmapWorkflow;
  line?: undefined;
  // line?: LineWorkflow;
  point?: undefined;
  // point?: PointWorkflow;
  raster?: RasterWorkflow;
  hillshade?: undefined;
  // hillshade?: HillshadeWorkflow;
  skybox?: undefined;
  shade?: undefined;
  sensor?: undefined;
}

/** Base Feature. Used by all features */
export interface FeatureBase {
  workflow: Workflow;
  tile: Tile;
  parent?: Tile;
  layerGuide: LayerGuides;
  featureCode: number[];
  bounds?: BBox;
  draw: (interactive?: boolean) => void;
  destroy: () => void;
  duplicate?: (tile: Tile, parent?: Tile, bounds?: BBox) => FeatureBase;
}

/** List of all feature sources */
export type FeatureSource =
  // | MaskSource
  // | FillSource
  // | LineSource
  // | PointSource
  // | HeatmapSource
  RasterSource;
// | GlyphSource;
/** List of all layer guides */
export type LayerGuides =
  // | FillWorkflowLayerGuide
  // | GlyphWorkflowLayerGuide
  // | HeatmapWorkflowLayerGuide
  // | LineWorkflowLayerGuide
  // | PointWorkflowLayerGuide
  RasterWorkflowLayerGuide;
// | HillshadeWorkflowLayerGuide;
/** List of all features that can be rendered */
export type Features =
  // | FillFeature
  // | GlyphFeature
  // | HeatmapFeature
  // | LineFeature
  // | PointFeature
  RasterFeature;
/** List of all workflows that can draw features for the DOM Renderer */
export type Workflow =
  // | FillWorkflow
  // | GlyphFilterWorkflow
  // | GlyphWorkflow
  // | LineWorkflow
  // | PointWorkflow
  RasterWorkflow;

/** Tile Mask Source */
export interface TileMaskSource {
  tile: Tile;
  container: HTMLElement;
  draw: () => void;
  destroy: () => void;
}

// ** RASTER **

/** Raster Source */
export interface RasterSource {
  type: 'raster';
  texture: HTMLImageElement;
  size: number;
}

/** Raster Feature */
export interface RasterFeature extends FeatureBase {
  type: 'raster';
  source: RasterSource;
  layerGuide: RasterWorkflowLayerGuide;
  fadeStartTime: number;
  opacity?: number;
  contrast?: number;
  saturation?: number;
}

/**
 * Raster Workflow
 *
 * Draws rasters for the DOM Renderer
 */
export interface RasterWorkflow extends WorkflowSpec {
  label: 'raster';
  curSample: 'none' | 'linear' | 'nearest';
  layerGuides: Map<number, RasterWorkflowLayerGuide>;

  buildSource: (rasterData: RasterData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterStyle) => RasterDefinition;
}

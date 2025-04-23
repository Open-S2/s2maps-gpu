import type { ColorArray } from 'style/color/index.js';
import type { ColorMode } from 's2/s2Map.js';
import type Context from '../context/context.js';
import type { Projector } from 'ui/camera/projector/index.js';
import type S2MapUI from 'ui/s2mapUI.js';
import type { SensorTextureDefinition } from 'ui/camera/timeCache.js';
import type { TileGL as Tile } from 'source/tile.spec.js';
import type TimeCache from 'ui/camera/timeCache.js';
import type { UrlMap } from 'util/index.js';
import type { WallpaperScheme } from './wallpaperWorkflow.js';
import type { BBox, VectorPoint } from 'gis-tools/index.js';
import type {
  FillData,
  GlyphData,
  HeatmapData,
  HillshadeData,
  LineData,
  PointData,
  RasterData,
  SensorData,
} from 'workers/worker.spec.js';
import type {
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuide,
  GlyphDefinition,
  GlyphStyle,
  GlyphWorkflowLayerGuide,
  HeatmapDefinition,
  HeatmapStyle,
  HeatmapWorkflowLayerGuide,
  HillshadeDefinition,
  HillshadeStyle,
  HillshadeWorkflowLayerGuide,
  LayerDefinitionBase,
  LineDefinition,
  LineStyle,
  LineWorkflowLayerGuide,
  PointDefinition,
  PointStyle,
  PointWorkflowLayerGuide,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuide,
  SensorDefinition,
  SensorStyle,
  SensorWorkflowLayerGuide,
  ShadeDefinition,
  ShadeStyle,
  ShadeWorkflowLayerGuide,
  StyleDefinition,
} from 'style/style.spec.js';

/** A collection of uniforms and their names in the shaders */
export type Uniforms = Record<string, string>;

/** A collection of attributes and their names in the shaders */
export type Attributes = Record<string, string>;
/** A collection of attribute locations { name: location } */
export type AttributeLocations = Record<string, number>;

/* SOURCES */

/** Shader Source */
export interface ShaderSource {
  source: string;
  uniforms: Uniforms;
  attributes: Attributes;
}

/** Mask Source */
export interface MaskSource {
  type: 'mask';
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  count: number;
  offset: number;
  vao: WebGLVertexArrayObject;
}

/** Tile Mask Source */
export interface TileMaskSource extends MaskSource {
  tile: Tile;
  draw: () => void;
  destroy: () => void;
}

/** Fill Source */
export interface FillSource {
  type: 'fill';
  vertexBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  idBuffer: WebGLBuffer;
  codeTypeBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
}

/** Glyph Source */
export interface GlyphSource {
  type: 'glyph';
  filterVAO: WebGLVertexArrayObject;
  vao: WebGLVertexArrayObject; // quad vao
  glyphFilterBuffer: WebGLBuffer;
  glyphFilterIDBuffer: WebGLBuffer;
  glyphQuadBuffer: WebGLBuffer;
  glyphQuadIDBuffer: WebGLBuffer;
  glyphColorBuffer: WebGLBuffer;
}

/** Heatmap Source */
export interface HeatmapSource {
  type: 'heatmap';
  vertexBuffer: WebGLBuffer;
  weightBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
}

/** Line Source */
export interface LineSource {
  type: 'line';
  // idBuffer: WebGLBuffer
  vertexBuffer: WebGLBuffer;
  lengthSoFarBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
}

/** Point Source */
export interface PointSource {
  type: 'point';
  vertexBuffer: WebGLBuffer;
  idBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
}

/** Raster Source */
export interface RasterSource {
  type: 'raster';
  texture: WebGLTexture;
  size: number;
}

/** Sensor Source */
export interface SensorSource {
  texture?: WebGLTexture;
  delete?: undefined;
}

/** List of all feature sources */
export type FeatureSource =
  | MaskSource
  | FillSource
  | LineSource
  | PointSource
  | HeatmapSource
  | RasterSource
  | GlyphSource;
/** List of all layer guides */
export type LayerGuides =
  | FillWorkflowLayerGuide
  | GlyphWorkflowLayerGuide
  | HeatmapWorkflowLayerGuide
  | LineWorkflowLayerGuide
  | PointWorkflowLayerGuide
  | RasterWorkflowLayerGuide
  | HillshadeWorkflowLayerGuide
  | SensorWorkflowLayerGuide
  | ShadeWorkflowLayerGuide;

/* FEATURE GUIDES */

/** Base Feature. Used by all features */
export interface FeatureBase {
  workflow: Workflow;
  tile: Tile;
  parent?: Tile;
  layerGuide: LayerGuides;
  featureCode: number[]; // webgl2
  bounds?: BBox;
  draw: (interactive?: boolean) => void;
  destroy: () => void;
  duplicate?: (tile: Tile, parent?: Tile, bounds?: BBox) => FeatureBase;
}

// ** FILL **
/** Fill Feature */
export interface FillFeature extends FeatureBase {
  type: 'fill';
  maskLayer: boolean;
  workflow: FillWorkflow;
  source: FillSource | TileMaskSource;
  layerGuide: FillWorkflowLayerGuide;
  count: number;
  offset: number;
  patternXY: VectorPoint;
  patternWH: [w: number, h: number];
  patternMovement: number;
  color?: number[]; // webgl1
  opacity?: number[]; // webgl1
  mode: number;
  duplicate: (tile: Tile, parent?: Tile) => FillFeature;
}

// ** GLYPH + GLYPH FILTER **
/** Glyph Type */
export type GlyphType = 'text' | 'icon';
/** Glyph Feature */
export interface GlyphFeature extends FeatureBase {
  type: 'glyph';
  source: GlyphSource;
  layerGuide: GlyphWorkflowLayerGuide;
  count: number;
  offset: number;
  filterCount: number;
  filterOffset: number;
  isIcon: boolean;
  textureName?: string;
  size?: number; // webgl1
  fill?: ColorArray; // webgl1
  stroke?: ColorArray; // webgl1
  strokeWidth?: number; // webgl1
}

// ** HEATMAP **
/** Heatmap Feature */
export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap';
  source: HeatmapSource;
  layerGuide: HeatmapWorkflowLayerGuide;
  count: number;
  offset: number;
  radiusLo?: number; // webgl1
  opacityLo?: number; // webgl1
  intensityLo?: number; // webgl1
  radiusHi?: number; // webgl1
  opacityHi?: number; // webgl1
  intensityHi?: number; // webgl1
  drawTexture: () => void;
}

// ** LINE **
/** Line Feature */
export interface LineFeature extends FeatureBase {
  type: 'line';
  source: LineSource;
  layerGuide: LineWorkflowLayerGuide;
  count: number;
  offset: number;
  cap: number;
  color?: ColorArray; // webgl1
  opacity?: number; // webgl1
  width?: number; // webgl1
  gapwidth?: number; // webgl1
}

// ** POINT **
/** Point Feature */
export interface PointFeature extends FeatureBase {
  type: 'point';
  source: PointSource;
  layerGuide: PointWorkflowLayerGuide;
  count: number;
  offset: number;
  color?: ColorArray; // webgl1
  radius?: number; // webgl1
  stroke?: ColorArray; // webgl1
  strokeWidth?: number; // webgl1
  opacity?: number; // webgl1
}

// ** RASTER **
/** Raster Feature */
export interface RasterFeature extends FeatureBase {
  type: 'raster';
  source: RasterSource;
  layerGuide: RasterWorkflowLayerGuide;
  fadeStartTime: number;
  opacity?: number; // webgl1
  contrast?: number; // webgl1
  saturation?: number; // webgl1
}

// ** HILLSHADE **
/** Hillshade Feature */
export interface HillshadeFeature extends FeatureBase {
  type: 'hillshade';
  source: RasterSource;
  layerGuide: HillshadeWorkflowLayerGuide;
  fadeStartTime: number;
  opacity?: number; // webgl1
  shadowColor?: ColorArray; // webgl1
  accentColor?: ColorArray; // webgl1
  highlightColor?: ColorArray; // webgl1
  azimuth?: number; // webgl1
  altitude?: number; // webgl1
}

// ** SENSOR **
/** Sensor Feature */
export interface SensorFeature extends FeatureBase {
  type: 'sensor';
  fadeStartTime: number;
  layerGuide: SensorWorkflowLayerGuide;
  getTextures: () => SensorTextureDefinition;
  opacity?: number; // webgl1
}

/** Shade Feature */
export interface ShadeFeature extends FeatureBase {
  type: 'shade';
  maskLayer: boolean;
  source: MaskSource;
  layerGuide: ShadeWorkflowLayerGuide;
}

/** List of all features that can be rendered */
export type Features =
  | FillFeature
  | GlyphFeature
  | HeatmapFeature
  | LineFeature
  | PointFeature
  | RasterFeature
  | SensorFeature
  | ShadeFeature
  | HillshadeFeature;

/** List of all workflows that can draw features or internal states */
export interface Workflows {
  fill?: FillWorkflow;
  glyphFilter?: GlyphFilterWorkflow;
  glyph?: GlyphWorkflow;
  heatmap?: HeatmapWorkflow;
  line?: LineWorkflow;
  point?: PointWorkflow;
  raster?: RasterWorkflow;
  hillshade?: HillshadeWorkflow;
  sensor?: SensorWorkflow;
  shade?: ShadeWorkflow;
  wallpaper?: WallpaperWorkflow;
  skybox?: SkyboxWorkflow;
  background?: WallpaperWorkflow | SkyboxWorkflow;
}

/** List of all workflows that can draw features */
export interface WorkflowImports {
  fill: () => Promise<FillWorkflow>;
  glyphFilter: () => Promise<GlyphFilterWorkflow>;
  glyph: () => Promise<GlyphWorkflow>;
  heatmap: () => Promise<HeatmapWorkflow>;
  hillshade: () => Promise<HillshadeWorkflow>;
  line: () => Promise<LineWorkflow>;
  point: () => Promise<PointWorkflow>;
  raster: () => Promise<RasterWorkflow>;
  sensor: () => Promise<{ default: (context: Context) => Promise<SensorWorkflow> }>;
  shade: () => Promise<ShadeWorkflow>;
  skybox: () => Promise<SkyboxWorkflow>;
  wallpaper: () => Promise<WallpaperWorkflow>;
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
  | 'sensor'
  | 'shade'
  | 'skybox'
  | 'wallpaper';

/** Generic Workflow specification used by most workflows */
export interface WorkflowSpec {
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  radii: boolean;
  context: Context;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  type: 1 | 2;
  glProgram: WebGLProgram;
  updateColorBlindMode: null | ColorMode;
  updateMatrix: null | Float32Array;
  updateInputs: null | Float32Array;
  updateAspect: null | VectorPoint;
  curMode: number;
  LCH?: boolean;

  buildShaders: (
    vertex: ShaderSource,
    fragment: ShaderSource,
    attributeLocations?: AttributeLocations,
  ) => void;
  setupUniforms: (uniforms: Uniforms) => void;
  setupAttributes: (attributes: Attributes, attributeLocations: AttributeLocations) => void;
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
  setFaceST: (faceST: number[]) => void;
  setTilePos: (bottomTop: Float32Array) => void;
  setLayerCode: (layerIndex: number, layerCode: number[], lch: boolean) => void;
  setInteractive: (interactive: boolean) => void;
  setFeatureCode: (featureCode: number[]) => void;
  setMode: (mode: number) => void;
}

/**
 * Fill Workflow
 *
 * Draws fills and masks for WebGL(1|2)
 */
export interface FillWorkflow extends WorkflowSpec {
  label: 'fill';
  uniforms: { [key in FillWorkflowUniforms]: WebGLUniformLocation };
  layerGuides: Map<number, FillWorkflowLayerGuide>;

  buildMaskFeature: (maskLayer: FillDefinition, tile: Tile) => void;
  buildSource: (fillData: FillData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillStyle) => FillDefinition;
  draw: (featureGuide: FillFeature, interactive?: boolean) => void;
  drawMask: (mask: TileMaskSource) => void;
}

/**
 * Glyph Filter Workflow
 *
 * Compute glyph filter data to know which glyphs to render or skip
 */
export interface GlyphFilterWorkflow extends WorkflowSpec {
  label: 'glyphFilter';
  quadTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  quadFramebuffer: WebGLFramebuffer;
  resultFramebuffer: WebGLFramebuffer;
  indexOffset: number;
  mode: 1 | 2;
  uniforms: { [key in GlyphFilterUniforms]: WebGLUniformLocation };

  resize: () => void;
  setMode: (mode: number) => void;
  bindResultTexture: () => void;
  bindQuadFrameBuffer: () => void;
  bindResultFramebuffer: () => void;
  draw: (featureGuide: GlyphFeature, interactive: boolean) => void;
}

/**
 * Glyph Workflow
 *
 * Draws glyphs for WebGL(1|2)
 */
export interface GlyphWorkflow extends WorkflowSpec {
  label: 'glyph';
  stepBuffer?: WebGLBuffer;
  uvBuffer?: WebGLBuffer;
  glyphFilterWorkflow: GlyphFilterWorkflow;
  layerGuides: Map<number, GlyphWorkflowLayerGuide>;
  uniforms: { [key in GlyphWorkflowUniforms]: WebGLUniformLocation };

  injectFilter: (glyphFilterWorkflow: GlyphFilterWorkflow) => void;
  buildSource: (glyphData: GlyphData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphStyle) => GlyphDefinition;
  computeFilters: (glyphFeatures: GlyphFeature[]) => void;
  draw: (featureGuide: GlyphFeature, interactive: boolean) => void;
}

/**
 * Heatmap Workflow
 *
 * Draws heatmaps for WebGL(1|2)
 */
export interface HeatmapWorkflow extends WorkflowSpec {
  label: 'heatmap';
  texture: WebGLTexture;
  nullTextureA: WebGLTexture;
  nullTextureB: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  extentBuffer?: WebGLBuffer;
  layerGuides: Map<number, HeatmapWorkflowLayerGuide>;
  uniforms: { [key in HeatmapWorkflowUniforms]: WebGLUniformLocation };

  buildSource: (heatmapData: HeatmapData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapStyle) => HeatmapDefinition;
  setupTextureDraw: () => void;
  resize: () => void;
  textureDraw: (featureGuides: HeatmapFeature[]) => HeatmapFeature[] | undefined;
  drawToTexture: (featureGuide: HeatmapFeature) => void;
  draw: (featureGuide: HeatmapFeature) => void;
}

/**
 * Line Workflow
 *
 * Draws lines for WebGL(1|2)
 */
export interface LineWorkflow extends WorkflowSpec {
  label: 'line';
  curTexture: number;
  typeBuffer?: WebGLBuffer;
  layerGuides: Map<number, LineWorkflowLayerGuide>;
  uniforms: { [key in LineWorkflowUniforms]: WebGLUniformLocation };

  buildSource: (lineData: LineData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineStyle) => LineDefinition;
  draw: (featureGuide: LineFeature, interactive: boolean) => void;
}

/**
 * Point Workflow
 *
 * Draws points for WebGL(1|2)
 */
export interface PointWorkflow extends WorkflowSpec {
  label: 'point';
  extentBuffer?: WebGLBuffer;
  layerGuides: Map<number, PointWorkflowLayerGuide>;
  uniforms: { [key in PointWorkflowUniforms]: WebGLUniformLocation };

  buildSource: (pointData: PointData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointStyle) => PointDefinition;
  draw: (featureGuide: PointFeature, interactive: boolean) => void;
}

/**
 * Raster Workflow
 *
 * Draws rasters for WebGL(1|2)
 */
export interface RasterWorkflow extends WorkflowSpec {
  label: 'raster';
  curSample: 'none' | 'linear' | 'nearest';
  layerGuides: Map<number, RasterWorkflowLayerGuide>;
  uniforms: { [key in RasterWorkflowUniforms]: WebGLUniformLocation };

  buildSource: (rasterData: RasterData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterStyle) => RasterDefinition;
  draw: (featureGuide: RasterFeature, interactive?: boolean) => void;
}

/**
 * Hillshade Workflow
 *
 * Draws hillshades for WebGL(1|2)
 */
export interface HillshadeWorkflow extends WorkflowSpec {
  label: 'hillshade';
  layerGuides: Map<number, HillshadeWorkflowLayerGuide>;
  uniforms: { [key in HillshadeWorkflowUniforms]: WebGLUniformLocation };

  buildSource: (hillshadeData: HillshadeData, tile: Tile) => void;
  buildLayerDefinition: (
    layerBase: LayerDefinitionBase,
    layer: HillshadeStyle,
  ) => HillshadeDefinition;
  draw: (featureGuide: HillshadeFeature, interactive: boolean) => void;
}

/**
 * Sensor Workflow
 *
 * Draws sensors for WebGL(1|2)
 */
export interface SensorWorkflow extends WorkflowSpec {
  label: 'sensor';
  nullTexture: WebGLTexture;
  timeCache?: TimeCache;
  layerGuides: Map<number, SensorWorkflowLayerGuide>;
  uniforms: { [key in SensorWorkflowUniforms]: WebGLUniformLocation };

  buildSource: (sensorData: SensorData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorStyle) => SensorDefinition;
  injectTimeCache: (timeCache: TimeCache) => void;
  draw: (featureGuide: SensorFeature, interactive: boolean) => void;
}

/**
 * Shade Workflow
 *
 * Draws shadings for WebGL(1|2)
 */
export interface ShadeWorkflow extends WorkflowSpec {
  label: 'shade';
  uniforms: { [key in ShadeWorkflowUniforms]: WebGLUniformLocation };

  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeStyle) => ShadeDefinition;
  buildMaskFeature: (maskLayer: ShadeDefinition, tile: Tile) => void;
  draw: (feature: ShadeFeature) => void;
}

/**
 * Skybox Workflow
 *
 * Draws a skybox for WebGL(1|2)
 */
export interface SkyboxWorkflow extends Omit<WorkflowSpec, 'draw'> {
  label: 'skybox';
  cubeMap: WebGLTexture;
  facesReady: number;
  ready: boolean;
  fov: number;
  angle: number;
  matrix: Float32Array;
  uniforms: { [key in SkyboxWorkflowUniforms]: WebGLUniformLocation };

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI, urlMap?: UrlMap) => void;
  draw: (projector: Projector) => void;
}

/**
 * Wallpaper Workflow
 *
 * Draws a wallpaper for WebGL(1|2)
 */
export interface WallpaperWorkflow extends Omit<WorkflowSpec, 'draw'> {
  label: 'wallpaper';
  scheme: WallpaperScheme;
  tileSize: number;
  scale: VectorPoint;
  uniforms: { [key in WallpaperWorkflowUniforms]: WebGLUniformLocation };

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI) => void;
  draw: (projector: Projector) => void;
}

/** List of all workflows that can draw features for WebGL(1|2) */
export type Workflow =
  | FillWorkflow
  | GlyphFilterWorkflow
  | GlyphWorkflow
  | HeatmapWorkflow
  | LineWorkflow
  | PointWorkflow
  | RasterWorkflow
  | HillshadeWorkflow
  | SensorWorkflow
  | ShadeWorkflow
  | SkyboxWorkflow
  | WallpaperWorkflow;

/** List of common uniforms for all workflows in WebGL(1|2) */
export enum WorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uMode = 'uMode',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
}

/** List of Fill uniforms for WebGL(1|2) */
export enum FillWorkflowUniforms {
  uMatrix = 'uMatrix',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uCBlind = 'uCBlind',
  uTexSize = 'uTexSize',
  uPatternXY = 'uPatternXY',
  uPatternWH = 'uPatternWH',
  uPatternMovement = 'uPatternMovement',
  uColors = 'uColors', // WEBGL1
  uOpacity = 'uOpacity', // WEBGL1
}

/** List of GlyphFilter uniforms for WebGL(1|2) */
export enum GlyphFilterUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uMode = 'uMode',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uIndexOffset = 'uIndexOffset',
  uSize = 'uSize', // WEBGL1
}

/** List of Glyph uniforms for WebGL(1|2) */
export enum GlyphWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uOverdraw = 'uOverdraw',
  uTexSize = 'uTexSize',
  uIsIcon = 'uIsIcon',
  uBounds = 'uBounds',
  uIsStroke = 'uIsStroke',
  uFeatures = 'uFeatures',
  uGlyphTex = 'uGlyphTex',
  uSize = 'uSize', // WEBGL1
  uFill = 'uFill', // WEBGL1
  uStroke = 'uStroke', // WEBGL1
  uSWidth = 'uSWidth', // WEBGL1
}

/** List of Heatmap uniforms for WebGL(1|2) */
export enum HeatmapWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uIntensityHi = 'uIntensityHi',
  uDrawState = 'uDrawState',
  uImage = 'uImage',
  uColorRamp = 'uColorRamp',
  uBounds = 'uBounds',
  uRadiusLo = 'uRadiusLo', // WEBGL1
  uOpacityLo = 'uOpacityLo', // WEBGL1
  uIntensityLo = 'uIntensityLo', // WEBGL1
  uRadiusHi = 'uRadiusHi', // WEBGL1
  uOpacityHi = 'uOpacityHi', // WEBGL1
}

/** List of Line uniforms for WebGL(1|2) */
export enum LineWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uCap = 'uCap',
  uDashed = 'uDashed',
  uDashCount = 'uDashCount',
  uDashArray = 'uDashArray',
  uSize = 'uSize', // WEBGL1
  uColor = 'uColor', // WEBGL1
  uOpacity = 'uOpacity', // WEBGL1
  uWidth = 'uWidth', // WEBGL1
  uTexLength = 'uTexLength', // WEBGL1
}

/** List of Point uniforms for WebGL(1|2) */
export enum PointWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uMode = 'uMode',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uColor = 'uColor',
  uRadius = 'uRadius',
  uStroke = 'uStroke',
  uSWidth = 'uSWidth',
  uOpacity = 'uOpacity',
  uBounds = 'uBounds',
}

/** List of Raster uniforms for WebGL(1|2) */
export enum RasterWorkflowUniforms {
  uMatrix = 'uMatrix',
  uInputs = 'uInputs',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uCBlind = 'uCBlind',
  uFade = 'uFade',
  uTexture = 'uTexture',
  uOpacity = 'uOpacity', // WEBGL1
  uSaturation = 'uSaturation', // WEBGL1
  uContrast = 'uContrast', // WEBGL1
}

/** List of Hillshade uniforms for WebGL(1|2) */
export enum HillshadeWorkflowUniforms {
  uMatrix = 'uMatrix',
  uInputs = 'uInputs',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uCBlind = 'uCBlind',
  uFade = 'uFade',
  uTexture = 'uTexture',
  uUnpack = 'uUnpack',
  uOpacity = 'uOpacity', // WEBGL1
  uShadowColor = 'uShadowColor', // WEBGL1
  uHighlightColor = 'uHighlightColor', // WEBGL1
  uAccentColor = 'uAccentColor', // WEBGL1
  uAzimuth = 'uAzimuth', // WEBGL1
  uAltitude = 'uAltitude', // WEBGL1
  uTexLength = 'uTexLength', // WEBGL1
}

/** List of Sensor uniforms for WebGL(1|2) */
export enum SensorWorkflowUniforms {
  uBottom = 'uBottom',
  uCBlind = 'uCBlind',
  uFaceST = 'uFaceST',
  uFeatureCode = 'uFeatureCode',
  uInputs = 'uInputs',
  uLCH = 'uLCH',
  uLayerCode = 'uLayerCode',
  uMatrix = 'uMatrix',
  uTop = 'uTop',
  uColorRamp = 'uColorRamp',
  uImage = 'uImage',
  uNextImage = 'uNextImage',
  uTime = 'uTime',
  uOpacity = 'uOpacity', // WEBGL1
}

/** List of Shade uniforms for WebGL(1|2) */
export enum ShadeWorkflowUniforms {
  uAspect = 'uAspect',
  uMatrix = 'uMatrix',
  uFaceST = 'uFaceST',
  uInputs = 'uInputs',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uBottom = 'uBottom',
  uTop = 'uTop',
}

/** List of Skybox uniforms for WebGL(1|2) */
export enum SkyboxWorkflowUniforms {
  uMatrix = 'uMatrix',
  uSkybox = 'uSkybox',
}

/** List of Wallpaper uniforms for WebGL(1|2) */
export enum WallpaperWorkflowUniforms {
  uScale = 'uScale',
  uBackground = 'uBackground',
  uHalo = 'uHalo',
  uFade1 = 'uFade1',
  uFade2 = 'uFade2',
}

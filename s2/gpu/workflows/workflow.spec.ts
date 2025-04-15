import type { BBox } from 'gis-tools';
import type Projector from 'ui/camera/projector';
import type S2MapUI from 'ui/s2mapUI';
import type { SensorTextureDefinition } from 'ui/camera/timeCache';
import type { TileGPU as Tile } from 'source/tile.spec';
import type TimeCache from 'ui/camera/timeCache';
import type { WebGPUContext } from '../context';
import type {
  FillData,
  GlyphData,
  HeatmapData,
  HillshadeData,
  LineData,
  PainterData,
  PointData,
  RasterData,
  SensorData,
} from 'workers/worker.spec';
import type {
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuideGPU,
  GlyphDefinition,
  GlyphStyle,
  GlyphWorkflowLayerGuideGPU,
  HeatmapDefinition,
  HeatmapStyle,
  HeatmapWorkflowLayerGuideGPU,
  HillshadeDefinition,
  HillshadeStyle,
  HillshadeWorkflowLayerGuideGPU,
  LayerDefinitionBase,
  LineDefinition,
  LineStyle,
  LineWorkflowLayerGuideGPU,
  PointDefinition,
  PointStyle,
  PointWorkflowLayerGuideGPU,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuideGPU,
  SensorDefinition,
  SensorStyle,
  SensorWorkflowLayerGuideGPU,
  ShadeDefinition,
  ShadeStyle,
  ShadeWorkflowLayerGuideGPU,
  StyleDefinition,
} from 'style/style.spec';

// SOURCES

/** Mask Source */
export interface MaskSource {
  type: 'mask';
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  codeTypeBuffer: GPUBuffer;
  count: number;
  offset: number;
}

/** Tile Mask Source */
export interface TileMaskSource extends MaskSource {
  bindGroup: GPUBindGroup;
  fillPatternBindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  positionBuffer: GPUBuffer;
  draw: () => void;
  destroy: () => void;
}

/** Fill Source */
export interface FillSource {
  type: 'fill';
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  idBuffer: GPUBuffer;
  codeTypeBuffer: GPUBuffer;
  destroy: () => void;
}

/** Glyph Source */
export interface GlyphSource {
  type: 'glyph';
  glyphFilterBuffer: GPUBuffer;
  glyphQuadBuffer: GPUBuffer;
  glyphQuadIndexBuffer: GPUBuffer;
  glyphColorBuffer: GPUBuffer;
  indexOffset: number; // tracks the offset of the glyphFilterBuffer relative to all sources being processed
  filterLength: number; // tracks the length of the glyphFilterBuffer
  destroy: () => void;
}

/** Heatmap Source */
export interface HeatmapSource {
  type: 'heatmap';
  vertexBuffer: GPUBuffer;
  weightBuffer: GPUBuffer;
  destroy: () => void;
}

/** Line Source */
export interface LineSource {
  type: 'line';
  vertexBuffer: GPUBuffer;
  lengthSoFarBuffer: GPUBuffer;
  destroy: () => void;
}

/** Point Source */
export interface PointSource {
  type: 'point';
  vertexBuffer: GPUBuffer;
  idBuffer: GPUBuffer;
  destroy: () => void;
}

/** Raster Source */
export interface RasterSource {
  type: 'raster';
  texture: GPUTexture;
  // pulled from maskSource
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  count: number;
  offset: number;
  destroy: () => void;
}

/** Sensor Source */
export interface SensorSource {
  texture?: GPUTexture;
  delete?: undefined;
  destroy: () => void;
}

/** All possible feature Sources */
export type FeatureSource =
  | MaskSource
  | FillSource
  | LineSource
  | PointSource
  | HeatmapSource
  | RasterSource
  | GlyphSource;
/** All possible Layer Guides */
export type LayerGuides =
  | FillWorkflowLayerGuideGPU
  | GlyphWorkflowLayerGuideGPU
  | HeatmapWorkflowLayerGuideGPU
  | HillshadeWorkflowLayerGuideGPU
  | LineWorkflowLayerGuideGPU
  | PointWorkflowLayerGuideGPU
  | RasterWorkflowLayerGuideGPU
  | SensorWorkflowLayerGuideGPU
  | ShadeWorkflowLayerGuideGPU;

// Features

/** Base Feature used by all features */
export interface FeatureBase {
  tile: Tile;
  parent?: Tile;
  layerGuide: LayerGuides;
  featureCode: number[];
  bindGroup: GPUBindGroup;
  bounds?: BBox;
  draw: () => void;
  destroy: () => void;
  duplicate?: (tile: Tile, parent?: Tile, bounds?: BBox) => FeatureBase;
  compute?: () => void;
  updateSharedTexture?: () => void;
}

// ** FILL **
/** Fill Feature */
export interface FillFeature extends FeatureBase {
  workflow: FillWorkflow;
  type: 'fill';
  maskLayer: boolean;
  source: FillSource | MaskSource;
  layerGuide: FillWorkflowLayerGuideGPU;
  count: number;
  offset: number;
  featureCodeBuffer: GPUBuffer;
  fillTexturePositions: GPUBuffer;
  fillPatternBindGroup: GPUBindGroup;
  fillInteractiveBindGroup?: GPUBindGroup;
  duplicate: (tile: Tile, parent?: Tile) => FillFeature;
}

// ** GLYPH + GLYPH FILTER **
/** Glyph Type */
export type GlyphType = 'text' | 'icon';
/** Glyph Feature */
export interface GlyphFeature extends FeatureBase {
  type: 'glyph';
  source: GlyphSource;
  layerGuide: GlyphWorkflowLayerGuideGPU;
  count: number;
  offset: number;
  filterCount: number;
  filterOffset: number;
  isPath: boolean;
  isIcon: boolean;
  glyphBindGroup: GPUBindGroup;
  glyphStrokeBindGroup: GPUBindGroup;
  glyphFilterBindGroup: GPUBindGroup;
  glyphInteractiveBindGroup: GPUBindGroup;
  glyphUniformBuffer: GPUBuffer;
  duplicate: (tile: Tile, parent?: Tile, bounds?: BBox) => GlyphFeature;
}

// ** HEATMAP **
/** Heatmap Feature */
export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap';
  source: HeatmapSource;
  layerGuide: HeatmapWorkflowLayerGuideGPU;
  count: number;
  offset: number;
  heatmapBindGroup: GPUBindGroup;
  duplicate: (tile: Tile, parent?: Tile, bounds?: BBox) => HeatmapFeature;
}

// ** LINE **
/** Line Feature */
export interface LineFeature extends FeatureBase {
  type: 'line';
  source: LineSource;
  layerGuide: LineWorkflowLayerGuideGPU;
  count: number;
  offset: number;
  cap: number;
  lineBindGroup: GPUBindGroup;
  duplicate: (tile: Tile, parent?: Tile) => LineFeature;
}

// ** POINT **
/** Point Feature */
export interface PointFeature extends FeatureBase {
  type: 'point';
  source: PointSource;
  layerGuide: PointWorkflowLayerGuideGPU;
  count: number;
  offset: number;
  pointBindGroup: GPUBindGroup;
  pointInteractiveBindGroup: GPUBindGroup;
  duplicate: (tile: Tile, parent?: Tile, bounds?: BBox) => PointFeature;
}

// ** RASTER **
/** Raster Feature */
export interface RasterFeature extends FeatureBase {
  type: 'raster';
  source: RasterSource;
  layerGuide: RasterWorkflowLayerGuideGPU;
  fadeStartTime: number;
  rasterBindGroup: GPUBindGroup;
  duplicate: (tile: Tile, parent?: Tile) => RasterFeature;
}

// ** SENSOR **
/** Sensor Feature */
export interface SensorFeature extends FeatureBase {
  type: 'sensor';
  layerGuide: SensorWorkflowLayerGuideGPU;
  fadeStartTime: number;
  colorRamp: WebGLTexture;
  getTextures: () => SensorTextureDefinition;
  duplicate: (tile: Tile, parent?: Tile) => SensorFeature;
}

// ** HILLSHADE **
/** Hillshade Feature */
export interface HillshadeFeature extends FeatureBase {
  type: 'hillshade';
  source: RasterSource;
  layerGuide: HillshadeWorkflowLayerGuideGPU;
  fadeStartTime: number;
  hillshadeBindGroup: GPUBindGroup;
  duplicate: (tile: Tile, parent?: Tile) => HillshadeFeature;
}

/** Shade Feature */
export interface ShadeFeature extends FeatureBase {
  tile: Tile;
  type: 'shade';
  maskLayer: boolean;
  source: MaskSource;
  layerGuide: ShadeWorkflowLayerGuideGPU;
  count: number;
  offset: number;
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

// WORKFLOWS

/** List of all workflows that can draw features */
export interface Workflows {
  fill?: FillWorkflow;
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

/** Import tool for workflows that can be loaded dynamically */
export interface WorkflowImports {
  fill: () => FillWorkflow;
  glyph: () => GlyphWorkflow;
  heatmap: () => HeatmapWorkflow;
  line: () => LineWorkflow;
  point: () => PointWorkflow;
  raster: () => RasterWorkflow;
  hillshade: () => HillshadeWorkflow;
  // TODO: Set actual sensor
  sensor: () => RasterWorkflow;
  // sensor: () => Promise<{ default: (context: WebGPUContext) => Promise<SensorWorkflow> }>
  shade: () => ShadeWorkflow;
  wallpaper: () => WallpaperWorkflow;
  skybox: () => SkyboxWorkflow;
}
/** Workflow keys */
export type WorkflowKey = keyof Workflow<PainterData>;
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

/** Global workflow wrapper. All workflows share this interface. */
export interface Workflow<T = PainterData> {
  context: WebGPUContext;

  setup: () => Promise<void>;
  buildSource?: (data: T, tile: Tile) => void;
  destroy: () => void;
  resize?: (width: number, height: number) => void;
}

/**
 * Fill Workflow
 *
 * Draws fills, masks for WebGPU
 * Computes interactive features
 */
export interface FillWorkflow extends Workflow<FillData> {
  layerGuides: Map<number, FillWorkflowLayerGuideGPU>;
  interactivePipeline: GPUComputePipeline;
  maskPipeline: GPURenderPipeline;
  fillPipeline: GPURenderPipeline;
  maskFillPipeline: GPURenderPipeline;
  invertPipeline: GPURenderPipeline;
  fillInteractiveBindGroupLayout: GPUBindGroupLayout;

  draw: (feature: FillFeature) => void;
  drawMask: (maskSource: TileMaskSource, feature?: FillFeature) => void;
  buildSource: (fillData: FillData, tile: Tile) => void;
  buildMaskFeature: (maskLayer: FillDefinition, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillStyle) => FillDefinition;
  computeInteractive: (feature: FillFeature) => void;
}

/**
 * Glyph Workflow
 *
 * Draws glyphs for WebGPU
 * Computes interactive features
 */
export interface GlyphWorkflow extends Workflow<GlyphData> {
  module: GPUShaderModule;
  layerGuides: Map<number, GlyphWorkflowLayerGuideGPU>;
  pipeline: GPURenderPipeline;
  testRenderPipeline: GPURenderPipeline;
  bboxPipeline: GPUComputePipeline;
  testFiltersPipeline: GPUComputePipeline;
  interactivePipeline: GPUComputePipeline;
  glyphBindGroupLayout: GPUBindGroupLayout;
  glyphPipelineLayout: GPUPipelineLayout;
  glyphFilterBindGroupLayout: GPUBindGroupLayout;
  glyphFilterPipelineLayout: GPUPipelineLayout;
  glyphInteractiveBindGroupLayout: GPUBindGroupLayout;
  glyphInteractivePiplineLayout: GPUPipelineLayout;
  glyphBBoxesBuffer: GPUBuffer;
  glyphFilterResultBuffer: GPUBuffer;

  buildSource: (glyphData: GlyphData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphStyle) => GlyphDefinition;
  computeInteractive: (feature: GlyphFeature) => void;
  computeFilters: (features: GlyphFeature[]) => void;
  draw: (feature: GlyphFeature) => void;
}

/**
 * Heatmap Workflow
 *
 * Draws heatmaps for WebGPU
 */
export interface HeatmapWorkflow extends Workflow<HeatmapData> {
  layerGuides: Map<number, HeatmapWorkflowLayerGuideGPU>;
  pipeline: GPURenderPipeline;
  module: GPUShaderModule;
  texturePipeline: GPURenderPipeline;
  heatmapBindGroupLayout: GPUBindGroupLayout;
  heatmapTextureBindGroupLayout: GPUBindGroupLayout;

  buildSource: (heatmapData: HeatmapData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapStyle) => HeatmapDefinition;
  textureDraw: (features: HeatmapFeature[]) => HeatmapFeature[] | undefined;
  draw: (feature: HeatmapFeature) => void;
}

/**
 * Line Workflow
 *
 * Draws lines for WebGPU
 */
export interface LineWorkflow extends Workflow<LineData> {
  layerGuides: Map<number, LineWorkflowLayerGuideGPU>;
  pipeline: GPURenderPipeline;
  lineBindGroupLayout: GPUBindGroupLayout;

  buildSource: (lineData: LineData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineStyle) => LineDefinition;
  draw: (feature: LineFeature) => void;
}

/**
 * Point Workflow
 *
 * Draws points for WebGPU
 */
export interface PointWorkflow extends Workflow<PointData> {
  layerGuides: Map<number, PointWorkflowLayerGuideGPU>;
  pipeline: GPURenderPipeline;
  interactivePipeline: GPUComputePipeline;
  pointInteractiveBindGroupLayout: GPUBindGroupLayout;
  pointBindGroupLayout: GPUBindGroupLayout;
  module: GPUShaderModule;

  buildSource: (pointData: PointData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointStyle) => PointDefinition;
  computeInteractive: (feature: PointFeature) => void;
  draw: (feature: PointFeature) => void;
}

/**
 * Raster Workflow
 *
 * Draws rasters for WebGPU
 */
export interface RasterWorkflow extends Workflow<RasterData> {
  layerGuides: Map<number, RasterWorkflowLayerGuideGPU>;
  pipeline: GPURenderPipeline;
  rasterBindGroupLayout: GPUBindGroupLayout;

  buildSource: (rasterData: RasterData, tile: Tile) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterStyle) => RasterDefinition;
  draw: (feature: RasterFeature) => void;
}

/**
 * Hillshade Workflow
 *
 * Draws hillshades for WebGPU
 */
export interface HillshadeWorkflow extends Workflow<HillshadeData> {
  layerGuides: Map<number, HillshadeWorkflowLayerGuideGPU>;
  pipeline: GPURenderPipeline;
  hillshadeBindGroupLayout: GPUBindGroupLayout;

  buildSource: (rasterData: HillshadeData, tile: Tile) => void;
  buildLayerDefinition: (
    layerBase: LayerDefinitionBase,
    layer: HillshadeStyle,
  ) => HillshadeDefinition;
  draw: (feature: HillshadeFeature) => void;
}

/**
 * Sensor Workflow
 *
 * Draws sensors for WebGPU
 */
export interface SensorWorkflow extends Workflow<SensorData> {
  buildSource: (sensorData: SensorData, tile: Tile) => void;
  injectTimeCache: (timeCache: TimeCache) => void;
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorStyle) => SensorDefinition;
  draw: (feature: SensorFeature) => void;
}

/**
 * Shade Workflow
 *
 * Draws shadings for WebGPU
 */
export interface ShadeWorkflow extends Workflow<unknown> {
  layerGuide?: ShadeWorkflowLayerGuideGPU;
  pipeline: GPURenderPipeline;

  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeStyle) => ShadeDefinition;
  buildMaskFeature: (maskLayer: ShadeDefinition, tile: Tile) => void;
  draw: (feature: ShadeFeature) => void;
}

/**
 * Wallpaper Workflow
 *
 * Draws wallpapers for WebGPU
 */
export interface WallpaperWorkflow extends Workflow<unknown> {
  draw: (feature: Projector) => void;
}

/**
 * Skybox Workflow
 *
 * Draws skyboxes for WebGPU
 */
export interface SkyboxWorkflow extends Workflow<unknown> {
  facesReady: number;
  ready: boolean;

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI, urlMap?: Record<string, string>) => void;
  draw: (feature: Projector) => void;
}

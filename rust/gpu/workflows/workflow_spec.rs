// import type { BBox } from 'gis-tools/index.js';
// import type { Projector } from 'ui/camera/projector/index.js';
// import type S2MapUI from 'ui/s2mapUI.js';
// import type { SensorTextureDefinition } from 'ui/camera/timeCache.js';
// import type { TileGPU as Tile } from 'source/tile.spec.js';
// import type TimeCache from 'ui/camera/timeCache.js';
// import type { UrlMap } from 'util/index.js';
// import type { WebGPUContext } from '../context/index.js';
// import type {
//   FillData,
//   GlyphData,
//   HeatmapData,
//   HillshadeData,
//   LineData,
//   PainterData,
//   PointData,
//   RasterData,
//   SensorData,
// } from 'workers/worker.spec.js';
// import type {
//   FillDefinition,
//   FillStyle,
//   FillWorkflowLayerGuideGPU,
//   GlyphDefinition,
//   GlyphStyle,
//   GlyphWorkflowLayerGuideGPU,
//   HeatmapDefinition,
//   HeatmapStyle,
//   HeatmapWorkflowLayerGuideGPU,
//   HillshadeDefinition,
//   HillshadeStyle,
//   HillshadeWorkflowLayerGuideGPU,
//   LayerDefinitionBase,
//   LineDefinition,
//   LineStyle,
//   LineWorkflowLayerGuideGPU,
//   PointDefinition,
//   PointStyle,
//   PointWorkflowLayerGuideGPU,
//   RasterDefinition,
//   RasterStyle,
//   RasterWorkflowLayerGuideGPU,
//   SensorDefinition,
//   SensorStyle,
//   SensorWorkflowLayerGuideGPU,
//   ShadeDefinition,
//   ShadeStyle,
//   ShadeWorkflowLayerGuideGPU,
//   StyleDefinition,
// } from 'style/style.spec.js';

// SOURCES

use crate::{
    gpu::{FillFeature, FillWorkflow, WallpaperWorkflow},
    source::Tile,
    workers::PainterData,
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;

// /** Glyph Source */
// export interface GlyphSource {
//   type: 'glyph';
//   glyphFilterBuffer: WebGPUBuffer,
//   glyphQuadBuffer: WebGPUBuffer,
//   glyphQuadIndexBuffer: WebGPUBuffer,
//   glyphColorBuffer: WebGPUBuffer,
//   indexOffset: number; // tracks the offset of the glyphFilterBuffer relative to all sources being processed
//   filterLength: number; // tracks the length of the glyphFilterBuffer
//   destroy: () => void;
// }

// /** Heatmap Source */
// export interface HeatmapSource {
//   type: 'heatmap';
//   vertex_buffer: WebGPUBuffer,
//   weightBuffer: WebGPUBuffer,
//   destroy: () => void;
// }

// /** Line Source */
// export interface LineSource {
//   type: 'line';
//   vertex_buffer: WebGPUBuffer,
//   lengthSoFarBuffer: WebGPUBuffer,
//   destroy: () => void;
// }

// /** Point Source */
// export interface PointSource {
//   type: 'point';
//   vertex_buffer: WebGPUBuffer,
//   id_buffer: WebGPUBuffer,
//   destroy: () => void;
// }

// /** Raster Source */
// export interface RasterSource {
//   type: 'raster';
//   texture: GPUTexture;
//   // pulled from maskSource
//   vertex_buffer: WebGPUBuffer,
//   index_buffer: WebGPUBuffer,
//   count: number;
//   offset: number;
//   destroy: () => void;
// }

// /** Sensor Source */
// export interface SensorSource {
//   texture?: GPUTexture;
//   delete?: undefined;
//   destroy: () => void;
// }

// /** All possible feature Sources */
// export type FeatureSource =
//   | MaskSource
//   | FillSource
//   | LineSource
//   | PointSource
//   | HeatmapSource
//   | RasterSource
//   | GlyphSource;
// /** All possible Layer Guides */
// export type LayerGuides =
//   | FillWorkflowLayerGuideGPU
//   | GlyphWorkflowLayerGuideGPU
//   | HeatmapWorkflowLayerGuideGPU
//   | HillshadeWorkflowLayerGuideGPU
//   | LineWorkflowLayerGuideGPU
//   | PointWorkflowLayerGuideGPU
//   | RasterWorkflowLayerGuideGPU
//   | SensorWorkflowLayerGuideGPU
//   | ShadeWorkflowLayerGuideGPU;

// // Features

// /** Base Feature used by all features */
// export interface FeatureBase {
//   tile: Tile;
//   parent?: Tile;
//   layerGuide: LayerGuides;
//   featureCode: number[];
//   bind_group: wgpu::BindGroup;
//   bounds?: BBox;
//   draw: () => void;
//   destroy: () => void;
//   duplicate?: (tile: Tile, parent?: Tile, bounds?: BBox) => FeatureBase;
//   compute?: () => void;
//   updateSharedTexture?: () => void;
// }

// // ** FILL **
// /** Fill Feature */
// export interface FillFeature extends FeatureBase {
//   workflow: FillWorkflow;
//   type: 'fill';
//   maskLayer: boolean;
//   source: FillSource | MaskSource;
//   layerGuide: FillWorkflowLayerGuideGPU;
//   count: number;
//   offset: number;
//   featureCodeBuffer: WebGPUBuffer,
//   fillTexturePositions: WebGPUBuffer,
//   fill_pattern_bind_group: wgpu::BindGroup;
//   fillInteractiveBindGroup?: wgpu::BindGroup;
//   duplicate: (tile: Tile, parent?: Tile) => FillFeature;
// }

// // ** GLYPH + GLYPH FILTER **
// /** Glyph Type */
// export type GlyphType = 'text' | 'icon';
// /** Glyph Feature */
// export interface GlyphFeature extends FeatureBase {
//   type: 'glyph';
//   source: GlyphSource;
//   layerGuide: GlyphWorkflowLayerGuideGPU;
//   count: number;
//   offset: number;
//   filterCount: number;
//   filterOffset: number;
//   isPath: boolean;
//   isIcon: boolean;
//   glyphBindGroup: wgpu::BindGroup;
//   glyphStrokeBindGroup: wgpu::BindGroup;
//   glyphFilterBindGroup: wgpu::BindGroup;
//   glyphInteractiveBindGroup: wgpu::BindGroup;
//   glyphUniformBuffer: WebGPUBuffer,
//   duplicate: (tile: Tile, parent?: Tile, bounds?: BBox) => GlyphFeature;
// }

// // ** HEATMAP **
// /** Heatmap Feature */
// export interface HeatmapFeature extends FeatureBase {
//   type: 'heatmap';
//   source: HeatmapSource;
//   layerGuide: HeatmapWorkflowLayerGuideGPU;
//   count: number;
//   offset: number;
//   heatmapBindGroup: wgpu::BindGroup;
//   duplicate: (tile: Tile, parent?: Tile, bounds?: BBox) => HeatmapFeature;
// }

// // ** LINE **
// /** Line Feature */
// export interface LineFeature extends FeatureBase {
//   type: 'line';
//   source: LineSource;
//   layerGuide: LineWorkflowLayerGuideGPU;
//   count: number;
//   offset: number;
//   cap: number;
//   lineBindGroup: wgpu::BindGroup;
//   duplicate: (tile: Tile, parent?: Tile) => LineFeature;
// }

// // ** POINT **
// /** Point Feature */
// export interface PointFeature extends FeatureBase {
//   type: 'point';
//   source: PointSource;
//   layerGuide: PointWorkflowLayerGuideGPU;
//   count: number;
//   offset: number;
//   pointBindGroup: wgpu::BindGroup;
//   pointInteractiveBindGroup: wgpu::BindGroup;
//   duplicate: (tile: Tile, parent?: Tile, bounds?: BBox) => PointFeature;
// }

// // ** RASTER **
// /** Raster Feature */
// export interface RasterFeature extends FeatureBase {
//   type: 'raster';
//   source: RasterSource;
//   layerGuide: RasterWorkflowLayerGuideGPU;
//   fadeStartTime: number;
//   rasterBindGroup: wgpu::BindGroup;
//   duplicate: (tile: Tile, parent?: Tile) => RasterFeature;
// }

// // ** SENSOR **
// /** Sensor Feature */
// export interface SensorFeature extends FeatureBase {
//   type: 'sensor';
//   layerGuide: SensorWorkflowLayerGuideGPU;
//   fadeStartTime: number;
//   colorRamp: WebGLTexture;
//   getTextures: () => SensorTextureDefinition;
//   duplicate: (tile: Tile, parent?: Tile) => SensorFeature;
// }

// // ** HILLSHADE **
// /** Hillshade Feature */
// export interface HillshadeFeature extends FeatureBase {
//   type: 'hillshade';
//   source: RasterSource;
//   layerGuide: HillshadeWorkflowLayerGuideGPU;
//   fadeStartTime: number;
//   hillshadeBindGroup: wgpu::BindGroup;
//   duplicate: (tile: Tile, parent?: Tile) => HillshadeFeature;
// }

// /** Shade Feature */
// export interface ShadeFeature extends FeatureBase {
//   tile: Tile;
//   type: 'shade';
//   maskLayer: boolean;
//   source: MaskSource;
//   layerGuide: ShadeWorkflowLayerGuideGPU;
//   count: number;
//   offset: number;
// }

/// List of all features that can be rendered
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum Features {
    Fill(FillFeature),
    // Glyph(GlyphFeature),
    // Heatmap(HeatmapFeature),
    // Line(LineFeature),
    // Point(PointFeature),
    // Raster(RasterFeature),
    // Sensor(SensorFeature),
    // Shade(ShadeFeature),
    // Hillshade(HillshadeFeature),
}
impl From<FillFeature> for Features {
    fn from(f: FillFeature) -> Self {
        Features::Fill(f)
    }
}
impl Features {
    /// Get the layer index
    pub fn layer_index(&self) -> u32 {
        match self {
            Features::Fill(f) => f.layer_guide.borrow().guide.base.layer_index,
            // Features::Glyph(f) => f.layerGuide.layer_index,
            // Features::Heatmap(f) => f.layerGuide.layer_index,
            // Features::Line(f) => f.layerGuide.layer_index,
            // Features::Point(f) => f.layerGuide.layer_index,
            // Features::Raster(f) => f.layerGuide.layer_index,
            // Features::Sensor(f) => f.layerGuide.layer_index,
            // Features::Shade(f) => f.layerGuide.layer_index,
            // Features::Hillshade(f) => f.layerGuide.layer_index,
        }
    }
    /// Get the parent of the feature
    pub fn parent(&self) -> Option<Rc<RefCell<Tile>>> {
        match self {
            Features::Fill(f) => f.parent.clone(),
            // Features::Glyph(f) => f.parent,
            // Features::Heatmap(f) => f.parent,
            // Features::Line(f) => f.parent,
            // Features::Point(f) => f.parent,
            // Features::Raster(f) => f.parent,
            // Features::Sensor(f) => f.parent,
            // Features::Shade(f) => f.parent,
            // Features::Hillshade(f) => f.parent,
        }
    }
    /// Get a reference to the feature_code
    pub fn feature_code(&self) -> &Vec<f32> {
        match self {
            Features::Fill(f) => &f.feature_code,
            // Features::Glyph(f) => &f.feature_code,
            // Features::Heatmap(f) => &f.feature_code,
            // Features::Line(f) => &f.feature_code,
            // Features::Point(f) => &f.feature_code,
            // Features::Raster(f) => &f.feature_code,
            // Features::Sensor(f) => &f.feature_code,
            // Features::Shade(f) => &f.feature_code,
            // Features::Hillshade(f) => &f.feature_code,
        }
    }
    /// Update the shared texture if the feature has a reference to it
    pub fn update_shared_texture(&mut self) {
        todo!()
    }
}

// WORKFLOWS

#[derive(Debug)]
#[allow(missing_docs)]
pub enum Workflow {
    Fill(Rc<RefCell<FillWorkflow>>),
    // Glyph,
    // Heatmap,
    // Line,
    // Point,
    // Raster,
    // Hillshade,
    // Sensor,
    // Shade,
    Wallpaper(WallpaperWorkflow),
}
impl From<FillWorkflow> for Workflow {
    fn from(fill: FillWorkflow) -> Workflow {
        Workflow::Fill(Rc::new(RefCell::new(fill)))
    }
}
impl From<WallpaperWorkflow> for Workflow {
    fn from(wallpaper: WallpaperWorkflow) -> Workflow {
        Workflow::Wallpaper(wallpaper)
    }
}
impl Workflow {
    /// Build the source given the correct data type
    pub fn build_source(&self, tile: Rc<RefCell<Tile>>, data: &PainterData) {
        match (self, data) {
            // Workflow::Wallpaper(w) => w.build_source(tile, data),
            // Workflow::Glyph(w) => w.build_source(tile, data),
            // Workflow::Heatmap(w) => w.build_source(tile, data),
            // Workflow::Line(w) => w.build_source(tile, data),
            // Workflow::Point(w) => w.build_source(tile, data),
            // Workflow::Raster(w) => w.build_source(tile, data),
            // Workflow::Hillshade(w) => w.build_source(tile, data),
            // Workflow::Sensor(w) => w.build_source(tile, data),
            // Workflow::Shade(w) => w.build_source(tile, data),
            (Workflow::Fill(w), PainterData::Fill(p)) => {
                FillWorkflow::build_source(w.clone(), tile, p)
            }
            _ => {}
        }
    }
    /// Run a resize for the workflows that need it
    pub fn resize(&self) {
        match self {
            // only heatmap requires a resize
            // Workflow::Heatmap(w) => w.resize(),
            _ => {}
        }
    }
}

/** List of all workflows that can draw features */
#[derive(Debug)]
#[allow(missing_docs)]
pub struct Workflows {
    pub workflows: BTreeMap<String, Workflow>,
}
impl Workflows {
    /// Create a new list of workflows
    pub fn new() -> Workflows {
        Workflows { workflows: BTreeMap::new() }
    }
    /// Add a new workflow
    pub fn add(&mut self, name: String, workflow: Workflow) {
        self.workflows.insert(name, workflow);
    }
    /// Get a workflow
    pub fn get(&self, name: &str) -> Option<&Workflow> {
        // If "background" -> try "wallpaper" then "skybox"
        if name == "background" {
            return self.workflows.get("wallpaper").or_else(|| self.workflows.get("skybox"));
        }
        self.workflows.get(name)
    }
    /// Get the values
    pub fn values(&self) -> impl Iterator<Item = &Workflow> {
        self.workflows.values()
    }
    /// Get from a WorkflowType
    pub fn get_from_type(&self, workflow_type: WorkflowType) -> Option<&Workflow> {
        self.workflows.get(workflow_type.into())
    }
}

/** Workflow types */
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum WorkflowType {
    Fill,
    Glyph,
    Heatmap,
    Line,
    Point,
    Raster,
    Hillshade,
    Sensor,
    Shade,
    Skybox,
    Wallpaper,
}
impl From<&PainterData> for WorkflowType {
    fn from(data: &PainterData) -> WorkflowType {
        match data {
            PainterData::Raster(_) => WorkflowType::Raster,
            PainterData::Hillshade(_) => WorkflowType::Hillshade,
            PainterData::Sensor(_) => WorkflowType::Sensor,
            PainterData::Fill(_) => WorkflowType::Fill,
            PainterData::Line(_) => WorkflowType::Line,
            PainterData::Point(_) => WorkflowType::Point,
            PainterData::Heatmap(_) => WorkflowType::Heatmap,
            PainterData::Glyph(_) => WorkflowType::Glyph,
        }
    }
}
impl From<WorkflowType> for &'static str {
    fn from(wt: WorkflowType) -> &'static str {
        match wt {
            WorkflowType::Fill => "fill",
            WorkflowType::Glyph => "glyph",
            WorkflowType::Heatmap => "heatmap",
            WorkflowType::Line => "line",
            WorkflowType::Point => "point",
            WorkflowType::Raster => "raster",
            WorkflowType::Hillshade => "hillshade",
            WorkflowType::Sensor => "sensor",
            WorkflowType::Shade => "shade",
            WorkflowType::Skybox => "skybox",
            WorkflowType::Wallpaper => "wallpaper",
        }
    }
}

// /** Global workflow wrapper. All workflows share this interface. */
// export interface Workflow<T = PainterData> {
//   context: WebGPUContext;

//   setup: () => Promise<void>;
//   build_source?: (data: T, tile: Tile) => void;
//   destroy: () => void;
//   resize?: (width: number, height: number) => void;
// }

// /**
//  * Fill Workflow
//  *
//  * Draws fills, masks for WebGPU
//  * Computes interactive features
//  */
// export interface FillWorkflow extends Workflow<FillData> {
//   layerGuides: Map<number, FillWorkflowLayerGuideGPU>;
//   interactivePipeline: GPUComputePipeline;
//   maskPipeline: GPURenderPipeline;
//   fillPipeline: GPURenderPipeline;
//   maskFillPipeline: GPURenderPipeline;
//   invertPipeline: GPURenderPipeline;
//   fillInteractiveBindGroupLayout: wgpu::BindGroupLayout;

//   draw: (feature: FillFeature) => void;
//   drawMask: (maskSource: TileMaskSource, feature?: FillFeature) => void;
//   build_source: (fillData: FillData, tile: Tile) => void;
//   buildMaskFeature: (maskLayer: FillDefinition, tile: Tile) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillStyle) => FillDefinition;
//   computeInteractive: (feature: FillFeature) => void;
// }

// /**
//  * Glyph Workflow
//  *
//  * Draws glyphs for WebGPU
//  * Computes interactive features
//  */
// export interface GlyphWorkflow extends Workflow<GlyphData> {
//   module: GPUShaderModule;
//   layerGuides: Map<number, GlyphWorkflowLayerGuideGPU>;
//   pipeline: GPURenderPipeline;
//   testRenderPipeline: GPURenderPipeline;
//   bboxPipeline: GPUComputePipeline;
//   testFiltersPipeline: GPUComputePipeline;
//   interactivePipeline: GPUComputePipeline;
//   glyphBindGroupLayout: wgpu::BindGroupLayout;
//   glyphPipelineLayout: GPUPipelineLayout;
//   glyphFilterBindGroupLayout: wgpu::BindGroupLayout;
//   glyphFilterPipelineLayout: GPUPipelineLayout;
//   glyphInteractiveBindGroupLayout: wgpu::BindGroupLayout;
//   glyphInteractivePiplineLayout: GPUPipelineLayout;
//   glyphBBoxesBuffer: WebGPUBuffer,
//   glyphFilterResultBuffer: WebGPUBuffer,

//   build_source: (glyphData: GlyphData, tile: Tile) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphStyle) => GlyphDefinition;
//   computeInteractive: (feature: GlyphFeature) => void;
//   computeFilters: (features: GlyphFeature[]) => void;
//   draw: (feature: GlyphFeature) => void;
// }

// /**
//  * Heatmap Workflow
//  *
//  * Draws heatmaps for WebGPU
//  */
// export interface HeatmapWorkflow extends Workflow<HeatmapData> {
//   layerGuides: Map<number, HeatmapWorkflowLayerGuideGPU>;
//   pipeline: GPURenderPipeline;
//   module: GPUShaderModule;
//   texturePipeline: GPURenderPipeline;
//   heatmapBindGroupLayout: wgpu::BindGroupLayout;
//   heatmapTextureBindGroupLayout: wgpu::BindGroupLayout;

//   build_source: (heatmapData: HeatmapData, tile: Tile) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapStyle) => HeatmapDefinition;
//   textureDraw: (features: HeatmapFeature[]) => HeatmapFeature[] | undefined;
//   draw: (feature: HeatmapFeature) => void;
// }

// /**
//  * Line Workflow
//  *
//  * Draws lines for WebGPU
//  */
// export interface LineWorkflow extends Workflow<LineData> {
//   layerGuides: Map<number, LineWorkflowLayerGuideGPU>;
//   pipeline: GPURenderPipeline;
//   lineBindGroupLayout: wgpu::BindGroupLayout;

//   build_source: (lineData: LineData, tile: Tile) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineStyle) => LineDefinition;
//   draw: (feature: LineFeature) => void;
// }

// /**
//  * Point Workflow
//  *
//  * Draws points for WebGPU
//  */
// export interface PointWorkflow extends Workflow<PointData> {
//   layerGuides: Map<number, PointWorkflowLayerGuideGPU>;
//   pipeline: GPURenderPipeline;
//   interactivePipeline: GPUComputePipeline;
//   pointInteractiveBindGroupLayout: wgpu::BindGroupLayout;
//   pointBindGroupLayout: wgpu::BindGroupLayout;
//   module: GPUShaderModule;

//   build_source: (pointData: PointData, tile: Tile) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointStyle) => PointDefinition;
//   computeInteractive: (feature: PointFeature) => void;
//   draw: (feature: PointFeature) => void;
// }

// /**
//  * Raster Workflow
//  *
//  * Draws rasters for WebGPU
//  */
// export interface RasterWorkflow extends Workflow<RasterData> {
//   layerGuides: Map<number, RasterWorkflowLayerGuideGPU>;
//   pipeline: GPURenderPipeline;
//   rasterBindGroupLayout: wgpu::BindGroupLayout;

//   build_source: (rasterData: RasterData, tile: Tile) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterStyle) => RasterDefinition;
//   draw: (feature: RasterFeature) => void;
// }

// /**
//  * Hillshade Workflow
//  *
//  * Draws hillshades for WebGPU
//  */
// export interface HillshadeWorkflow extends Workflow<HillshadeData> {
//   layerGuides: Map<number, HillshadeWorkflowLayerGuideGPU>;
//   pipeline: GPURenderPipeline;
//   hillshadeBindGroupLayout: wgpu::BindGroupLayout;

//   build_source: (rasterData: HillshadeData, tile: Tile) => void;
//   buildLayerDefinition: (
//     layerBase: LayerDefinitionBase,
//     layer: HillshadeStyle,
//   ) => HillshadeDefinition;
//   draw: (feature: HillshadeFeature) => void;
// }

// /**
//  * Sensor Workflow
//  *
//  * Draws sensors for WebGPU
//  */
// export interface SensorWorkflow extends Workflow<SensorData> {
//   build_source: (sensorData: SensorData, tile: Tile) => void;
//   injectTimeCache: (timeCache: TimeCache) => void;
//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorStyle) => SensorDefinition;
//   draw: (feature: SensorFeature) => void;
// }

// /**
//  * Shade Workflow
//  *
//  * Draws shadings for WebGPU
//  */
// export interface ShadeWorkflow extends Workflow<unknown> {
//   layerGuide?: ShadeWorkflowLayerGuideGPU;
//   pipeline: GPURenderPipeline;

//   buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeStyle) => ShadeDefinition;
//   buildMaskFeature: (maskLayer: ShadeDefinition, tile: Tile) => void;
//   draw: (feature: ShadeFeature) => void;
// }

// /**
//  * Wallpaper Workflow
//  *
//  * Draws wallpapers for WebGPU
//  */
// export interface WallpaperWorkflow extends Workflow<unknown> {
//   draw: (feature: Projector) => void;
// }

// /**
//  * Skybox Workflow
//  *
//  * Draws skyboxes for WebGPU
//  */
// export interface SkyboxWorkflow extends Workflow<unknown> {
//   facesReady: number;
//   ready: boolean;

//   updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI, urlMap?: UrlMap) => void;
//   draw: (feature: Projector) => void;
// }

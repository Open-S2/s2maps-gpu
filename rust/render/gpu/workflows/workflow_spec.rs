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
    render::{
        ContextSpec, FeatureSpec, FillFeature, FillWorkflow, MaskSourceSpec, SensorWorkflow,
        SkyboxWorkflow, WallpaperWorkflow, WorkflowSpec, WorkflowType,
    },
    source::Tile,
    style::{LayerDefinition, LayerDefinitionBase, LayerStyle, StyleMaskLayer},
    workers::PainterData,
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::{RefCell, RefMut};
use s2json::BBox;

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
impl FeatureSpec for Features {
    fn source_name(&self) -> String {
        match self {
            Features::Fill(f) => f.layer_guide.borrow().guide.base.source_name.clone(),
            // Features::Glyph(f) => f.layerGuide.sourceName,
            // Features::Heatmap(f) => f.layerGuide.sourceName,
            // Features::Line(f) => f.layerGuide.sourceName,
            // Features::Point(f) => f.layerGuide.sourceName,
            // Features::Raster(f) => f.layerGuide.sourceName,
            // Features::Sensor(f) => f.layerGuide.sourceName,
            // Features::Shade(f) => f.layerGuide.sourceName,
            // Features::Hillshade(f) => f.layerGuide.sourceName,
        }
    }
    fn layer_index(&self) -> u32 {
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
    fn set_layer_index(&mut self, index: u32) {
        match self {
            Features::Fill(f) => f.layer_guide.borrow_mut().guide.base.layer_index = index,
            // Features::Glyph(f) => f.layerGuide.layer_index = index,
            // Features::Heatmap(f) => f.layerGuide.layer_index = index,
            // Features::Line(f) => f.layerGuide.layer_index = index,
            // Features::Point(f) => f.layerGuide.layer_index = index,
            // Features::Raster(f) => f.layerGuide.layer_index = index,
            // Features::Sensor(f) => f.layerGuide.layer_index = index,
            // Features::Shade(f) => f.layerGuide.layer_index = index,
            // Features::Hillshade(f) => f.layerGuide.layer_index = index,
        }
    }
    fn interactive(&self) -> bool {
        match self {
            Features::Fill(f) => f.layer_guide.borrow().guide.base.interactive,
            // Features::Glyph(f) => f.layerGuide.interactive,
            // Features::Heatmap(f) => f.layerGuide.interactive,
            // Features::Line(f) => f.layerGuide.interactive,
            // Features::Point(f) => f.layerGuide.interactive,
            // Features::Raster(f) => f.layerGuide.interactive,
            // Features::Sensor(f) => f.layerGuide.interactive,
            // Features::Shade(f) => f.layerGuide.interactive,
            // Features::Hillshade(f) => f.layerGuide.interactive,
        }
    }
    fn parent(&self) -> Option<Rc<RefCell<Tile>>> {
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
    fn feature_code(&self) -> &Vec<f32> {
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
    fn update_shared_texture(&mut self) {
        todo!()
    }
    fn mask_layer(&self) -> bool {
        match self {
            Features::Fill(f) => f.mask_layer,
            _ => false,
        }
    }
    fn bounds(&self) -> BBox {
        match self {
            Features::Fill(_) => BBox::default(),
            // Features::Glyph(f) => f.bounds,
            // Features::Heatmap(f) => f.bounds,
            // Features::Line(f) => f.bounds,
            // Features::Point(f) => f.bounds,
            // Features::Raster(f) => f.bounds,
            // Features::Sensor(f) => f.bounds,
            // Features::Shade(f) => f.bounds,
            // Features::Hillshade(f) => f.bounds,
        }
    }
    fn inverted(&self) -> bool {
        match self {
            Features::Fill(f) => f.layer_guide.borrow().guide.invert,
            // Features::Glyph(f) => f.inverted,
            // Features::Heatmap(f) => f.inverted,
            // Features::Line(f) => f.inverted,
            // Features::Point(f) => f.inverted,
            // Features::Raster(f) => f.inverted,
            // Features::Sensor(f) => f.inverted,
            // Features::Shade(f) => f.inverted,
            // Features::Hillshade(f) => f.inverted,
        }
    }
    fn duplicate(
        &self,
        tile: Rc<RefCell<Tile>>,
        parent: Option<Rc<RefCell<Tile>>>,
        bounds: BBox,
    ) -> Self {
        match self {
            Features::Fill(f) => Features::Fill(f.duplicate(tile, parent)),
            // Features::Glyph(f) => Features::Glyph(f.duplicate(tile, parent, bounds)),
            // Features::Heatmap(f) => Features::Heatmap(f.duplicate(tile, parent, bounds)),
            // Features::Line(f) => Features::Line(f.duplicate(tile, parent, bounds)),
            // Features::Point(f) => Features::Point(f.duplicate(tile, parent, bounds)),
            // Features::Raster(f) => Features::Raster(f.duplicate(tile, parent, bounds)),
            // Features::Sensor(f) => Features::Sensor(f.duplicate(tile, parent, bounds)),
            // Features::Shade(f) => Features::Shade(f.duplicate(tile, parent, bounds)),
            // Features::Hillshade(f) => Features::Hillshade(f.duplicate(tile, parent, bounds)),
        }
    }
}

// WORKFLOWS

#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum Workflow {
    Fill(Rc<RefCell<FillWorkflow>>),
    // Glyph,
    // Heatmap,
    // Line,
    // Point,
    // Raster,
    // Hillshade,
    Sensor(Rc<RefCell<SensorWorkflow>>),
    // Shade,
    Skybox(SkyboxWorkflow),
    Wallpaper(WallpaperWorkflow),
}
impl From<FillWorkflow> for Workflow {
    fn from(fill: FillWorkflow) -> Workflow {
        Workflow::Fill(Rc::new(RefCell::new(fill)))
    }
}
impl From<SensorWorkflow> for Workflow {
    fn from(sensor: SensorWorkflow) -> Workflow {
        Workflow::Sensor(Rc::new(RefCell::new(sensor)))
    }
}
impl From<SkyboxWorkflow> for Workflow {
    fn from(skybox: SkyboxWorkflow) -> Workflow {
        Workflow::Skybox(skybox)
    }
}
impl From<WallpaperWorkflow> for Workflow {
    fn from(wallpaper: WallpaperWorkflow) -> Workflow {
        Workflow::Wallpaper(wallpaper)
    }
}
impl WorkflowSpec for Workflow {
    /// Build the source given the correct data type
    fn build_source(&self, tile: Rc<RefCell<Tile>>, data: &PainterData) {
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
    fn build_layer_definition(
        &self,
        base: LayerDefinitionBase,
        layer_style: &LayerStyle,
    ) -> LayerDefinition {
        match (self, layer_style) {
            // TODO:
            // Workflow::Wallpaper(w) => w.build_source(tile, data),
            // Workflow::Glyph(w) => w.build_source(tile, data),
            // Workflow::Heatmap(w) => w.build_source(tile, data),
            // Workflow::Line(w) => w.build_source(tile, data),
            // Workflow::Point(w) => w.build_source(tile, data),
            // Workflow::Raster(w) => w.build_source(tile, data),
            // Workflow::Hillshade(w) => w.build_source(tile, data),
            // Workflow::Sensor(w) => w.build_source(tile, data),
            // Workflow::Shade(w) => w.build_source(tile, data),
            (Workflow::Fill(w), LayerStyle::Fill(f)) => {
                w.borrow_mut().build_layer_definition(base, f).into()
            }
            _ => todo!(),
        }
    }
    fn build_mask_feature(&self, mask_layer: &StyleMaskLayer, tile: Rc<RefCell<Tile>>) {
        match (self, mask_layer) {
            // TODO:
            // Workflow::Sensor(w) => w.build_mask_feature(mask_layer),
            (Workflow::Fill(w), StyleMaskLayer::Fill(f)) => {
                FillWorkflow::build_mask_feature(w.clone(), f, tile.clone())
            }
            _ => {}
        }
    }
    /// Run a resize for the workflows that need it
    fn resize(&self, width: u32, height: u32) {
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
    /// Get from a style mask definition
    pub fn get_from_mask(&self, mask: &StyleMaskLayer) -> Option<&Workflow> {
        match mask {
            StyleMaskLayer::Fill(_) => self.workflows.get("fill"),
            StyleMaskLayer::Shade(_) => self.workflows.get("shade"),
        }
    }
    /// Get the sensor workflow
    pub fn get_sensor(&self) -> Option<Rc<RefCell<SensorWorkflow>>> {
        self.workflows.get("sensor").and_then(|w| match w {
            Workflow::Sensor(w) => Some(w.clone()),
            _ => None,
        })
    }
    /// Get the values
    pub fn values(&self) -> impl Iterator<Item = &Workflow> {
        self.workflows.values()
    }
    /// Get from a WorkflowType
    pub fn get_from_type(&self, workflow_type: WorkflowType) -> Option<&Workflow> {
        self.workflows.get(workflow_type.into())
    }
    /// Get from a WorkflowType mutable
    pub fn get_from_type_mut(&mut self, workflow_type: WorkflowType) -> Option<&mut Workflow> {
        self.workflows.get_mut(workflow_type.into())
    }
}

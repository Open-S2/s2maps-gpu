use crate::{
    s2map::ColorMode,
    source::Tile,
    style::{LayerDefinition, LayerDefinitionBase, LayerStyle, LayerType, StyleMaskLayer},
    ui::{MapOptions, Projector, TimeCache},
    workers::{GlyphImages, PainterData, SpriteImageMessage},
};
use alloc::{collections::BTreeSet, fmt::Debug, rc::Rc};
use core::cell::RefCell;
use s2json::BBox;

/** Workflow types */
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
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
impl From<LayerType> for WorkflowType {
    fn from(lt: LayerType) -> WorkflowType {
        match lt {
            LayerType::Fill => WorkflowType::Fill,
            LayerType::Glyph => WorkflowType::Glyph,
            LayerType::Heatmap => WorkflowType::Heatmap,
            LayerType::Line => WorkflowType::Line,
            LayerType::Point => WorkflowType::Point,
            LayerType::Raster => WorkflowType::Raster,
            LayerType::Hillshade => WorkflowType::Hillshade,
            LayerType::Sensor => WorkflowType::Sensor,
        }
    }
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
impl<M: Clone + Default> From<&LayerStyle<M>> for WorkflowType {
    fn from(style: &LayerStyle<M>) -> WorkflowType {
        match style {
            LayerStyle::Fill(_) => WorkflowType::Fill,
            LayerStyle::Line(_) => WorkflowType::Line,
            LayerStyle::Point(_) => WorkflowType::Point,
            LayerStyle::Heatmap(_) => WorkflowType::Heatmap,
            LayerStyle::Glyph(_) => WorkflowType::Glyph,
            LayerStyle::Raster(_) => WorkflowType::Raster,
            LayerStyle::Hillshade(_) => WorkflowType::Hillshade,
            LayerStyle::Sensor(_) => WorkflowType::Sensor,
            LayerStyle::Shade(_) => WorkflowType::Shade,
            LayerStyle::Unknown(_) => WorkflowType::Fill,
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

/// Mask Source trait
pub trait MaskSourceSpec: Debug + Clone {}

/// Feature trait
pub trait FeatureSpec: Debug + Clone {
    /// Get the source name from the feature
    fn source_name(&self) -> String;
    /// Get the layer index
    fn layer_index(&self) -> u32;
    /// Set the layer index
    fn set_layer_index(&mut self, index: u32);
    /// Check if the feature is interactive or not
    fn interactive(&self) -> bool;
    /// Get the parent of the feature
    fn parent(&self) -> Option<Rc<RefCell<Tile>>>;
    /// Get a reference to the feature_code
    fn feature_code(&self) -> &Vec<f32>;
    /// Update the shared texture if the feature has a reference to it
    fn update_shared_texture(&mut self);
    /// Run a computation. Most features do not need this
    fn compute(&self) {}
    /// Check if a mask layer
    fn mask_layer(&self) -> bool;
    /// Get the bounds of the feature
    fn bounds(&self) -> BBox;
    /// Is inverted (only applies to some features. Returns false by default)
    fn inverted(&self) -> bool;
    /// duplicate the feature
    fn duplicate(
        &self,
        tile: Rc<RefCell<Tile>>,
        parent: Option<Rc<RefCell<Tile>>>,
        bounds: BBox,
    ) -> Self;
}

/// The Context trait
pub trait ContextSpec: Debug {}

/// A workflow is a draw type for the GPU
pub trait WorkflowSpec: Debug + Clone {
    /// Build the source given the correct data type
    fn build_source(&self, tile: Rc<RefCell<Tile>>, data: &PainterData);
    /// Build the layer definition
    fn build_layer_definition(
        &self,
        base: LayerDefinitionBase,
        layer_style: &LayerStyle,
    ) -> LayerDefinition;
    /// Build the mask feature if it exists
    fn build_mask_feature(&self, mask_layer: &StyleMaskLayer, tile: Rc<RefCell<Tile>>);
    /// Run a resize for the workflows that need it
    fn resize(&self, width: u32, height: u32);
}

/// WebGPU Painter interface
pub trait PainterSpec: Debug {
    /// Create the painter
    /// - `context`: the GPU context wrapper
    /// - `options`: map options to pull out the options that impact the painter and GPU
    fn new(window: &winit::window::Window, options: &MapOptions) -> impl Future<Output = Self>;
    /// update the painter's state as dirty
    fn set_dirty(&mut self);
    /// Check the state of the painter.
    fn dirty(&self) -> bool;
    /// Given a tile, build the feature data associated with it
    /// - `tile`: the tile to inject the features into
    /// - `data`: the collection of data to sift through and build features
    fn build_feature_data(&self, tile: Rc<RefCell<Tile>>, data: &PainterData);
    /// Build all workflows used by the style layers
    /// - `buildSet`: the set of workflows to build
    fn build_workflows(&mut self, build_set: BTreeSet<WorkflowType>);
    /// Get a screen capture
    ///
    /// ## Returns
    /// A `Vec<u8>` screen capture
    fn get_screen(&self) -> impl Future<Output = Vec<u8>>;
    /// Set the colorblind mode
    /// - `mode`: colorblind mode to set
    fn set_color_mode(&mut self, mode: ColorMode);
    /// Inject a glyph image to the GPU
    /// - `max_height`: the maximum height of the texture
    /// - `images`: the glyph images
    /// - `tiles`: the tiles to update
    fn inject_glyph_images(
        &self,
        max_height: u32,
        images: GlyphImages,
        tiles: &[Rc<RefCell<Tile>>],
    );
    /// Inject a sprite image to the GPU
    /// - `data`: the raw image data of the sprite
    /// - `tiles`: the tiles to update
    fn inject_sprite_image(&mut self, data: SpriteImageMessage, tiles: &[Rc<RefCell<Tile>>]);
    /// Inject a time cache for the sensor workflow
    /// - time_cache - the time cache to inject
    fn inject_time_cache(&self, time_cache: &TimeCache);
    /// Resize the canvas
    /// - `width`: new width
    /// - `height`: new height
    fn resize(&mut self, width: u32, height: u32);
    /// Paint all the tiles in view
    /// - `projector`: the camera and what it currently sees
    /// - `tiles`: all the tiles in view to paint
    fn paint(&mut self, projector: &Projector, tiles: &[Rc<RefCell<Tile>>]);
    /// Compute the interactive features in current view
    /// - `tiles`: current view tiles that we need to sift through for interactive features
    fn compute_interactive(&self, tiles: &[Rc<RefCell<Tile>>]);
}

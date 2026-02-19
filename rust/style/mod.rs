/// Coalesce Field's to parsed strings
pub mod coalesce_field;
/// Color styling
pub mod color;
/// Easing Functions
pub mod easing_functions;
/// Encoding Layer Attributes for the GPU
pub mod encode_layer_attribute;
/// Parse Feature Data (Used by Workers)
pub mod parse_feature;
/// Filter Parsing
pub mod parse_filter;
/// Style Specification
pub mod style_spec;

use crate::{
    render::{PainterSpec, Presentation, Workflow, WorkflowSpec, WorkflowType},
    source::Tile,
    ui::{Camera, MapOptions},
    util::UrlMap,
    workers::{
        MapGLToSourceMessage, MapGLToSourceMessages, RequestStyleMessage, StyleMessage,
        TileRequest, TileRequestMessage, WorkerPool,
    },
};
use alloc::{collections::BTreeSet, rc::Rc, string::String, vec::Vec};
pub use coalesce_field::*;
pub use color::*;
use core::cell::RefCell;
pub use easing_functions::*;
pub use encode_layer_attribute::*;
pub use parse_feature::*;
pub use parse_filter::*;
pub use style_spec::*;

/// # Style Mask Layer
#[derive(Debug, Clone)]
pub enum StyleMaskLayer {
    /// Fill Definition
    Fill(FillDefinition),
    /// Shade Definition
    Shade(ShadeDefinition),
}
impl From<FillDefinition> for StyleMaskLayer {
    fn from(f: FillDefinition) -> Self {
        StyleMaskLayer::Fill(f)
    }
}
impl From<ShadeDefinition> for StyleMaskLayer {
    fn from(f: ShadeDefinition) -> Self {
        StyleMaskLayer::Shade(f)
    }
}

/// # Style Engine
///
/// The Style Engine is responsible for:
/// - PRE) If style is a string (url), ship it off to Source Worker to fetch the style
/// - 1) Build workflows necessary to render the style
/// - 2) Build out the layers
/// - 3) Ship off appropriate style params to Tile Workers so they know how to build the tiles
/// - 4) Build the layers for the painter
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct Style {
    pub camera: Rc<RefCell<Camera>>,
    pub api_key: Option<String>,
    pub url_map: UrlMap,
    pub mask_layers: Vec<StyleMaskLayer>,
    pub layers: Vec<LayerDefinition>,
    pub interactive: bool,
    pub dirty: bool,
}
impl Style {
    /// Setup a new Style manager
    pub fn new(camera: Rc<RefCell<Camera>>, options: &MapOptions) -> Self {
        Self {
            camera,
            api_key: options.api_key.clone(),
            url_map: options.url_map.clone().unwrap_or_default(),
            mask_layers: vec![],
            layers: vec![],
            interactive: false,
            dirty: true,
        }
    }

    /// Build the style, preparing it for rendering and tile/source processing
    ///
    /// ## Parameters
    /// - `style`: style definition
    /// - `ignore_position`: if true, we want to leave the position of the camera unchanged.
    ///
    /// ## Returns
    /// True if we can start rendering
    pub async fn build_style(
        &mut self,
        style: MapStyleInput,
        ignore_position: Option<bool>,
    ) -> bool {
        let ignore_position = ignore_position.unwrap_or(false);
        match style {
            MapStyleInput::Href(style) => {
                self._request_style(style).await;
                false
            }
            MapStyleInput::Style(style) => {
                self.dirty = true;
                // build workflows that don't exist yet (depends on projection)
                self._build_workflows(style.clone()).await;
                // build layer definitions
                self._build_layers(style.layers.clone());
                // prep the camera
                let camera = &mut self.camera.borrow_mut();
                // inform the projection
                camera
                    .painter
                    .context
                    .borrow_mut()
                    .set_projection(style.projection.unwrap_or(Projection::S2));
                // set the clear color if present
                if let Some(clear_color) = style.clear_color {
                    camera.painter.context.borrow_mut().set_clear_color(clear_color);
                }
                // built layers let us know if we have an interactive layer or not (depends on layers)
                camera.painter.context.borrow_mut().set_interactive(self.interactive);
                // build time series if exists
                if let Some(time_series) = style.time_series {
                    camera.build_time_cache(time_series);
                }
                // update the projector with our style
                camera.projector.set_style_parameters(&style, ignore_position);
                // ship to Tile Workers
                self._send_style_data_to_workers(style).await;
                // return we can start rendering
                true
            }
        }
    }

    /// Inject mask layers
    ///
    /// ## Parameters
    /// - `tile`: tile to inject the mask layers for
    pub fn inject_mask_layers(&self, tile: Rc<RefCell<Tile>>) {
        let camera = &self.camera.borrow();
        for mask_layer in &self.mask_layers {
            if let Some(workflow) = camera.painter.workflows.get_from_mask(mask_layer) {
                workflow.build_mask_feature(mask_layer, tile.clone());
            }
        }
    }

    /// Request the style if the input style was an href pointing to the style object
    ///
    /// ## Parameters
    /// - `style`: style href
    async fn _request_style(&self, style: String) {
        let api_key = self.api_key.clone();
        let url_map = self.url_map.clone();
        let Camera { id, worker, .. } = &*self.camera.borrow();
        let analytics = self._build_analytics();

        if let Some(worker) = worker {
            worker
                .send(MapGLToSourceMessages {
                    map_id: *id,
                    message: MapGLToSourceMessage::RequestStyle(RequestStyleMessage {
                        style,
                        analytics,
                        api_key,
                        url_map: Some(url_map),
                    }),
                })
                .await;
        } else {
            let worker_pool = WorkerPool::get();
            worker_pool.request_style(*id, style, analytics, api_key, Some(url_map));
        }
    }

    /// Build workflows
    ///
    /// ## Parameters
    /// - `style`: input style object
    async fn _build_workflows(&mut self, style: StyleDefinition) {
        let mut workflows: BTreeSet<WorkflowType> = BTreeSet::from([WorkflowType::Fill]);
        // setup appropriate background if it exists
        if style.skybox.is_some() {
            workflows.insert(WorkflowType::Skybox);
        }
        if style.wallpaper.is_some() {
            workflows.insert(WorkflowType::Wallpaper);
        }
        // iterate layers and add workflows
        if let Some(layers) = &style.layers {
            for layer in layers {
                workflows.insert(layer.into());
            }
        }
        // build workflows
        self.camera.borrow_mut().painter.build_workflows(workflows);
        // inject styles into workflows
        if let Some(Workflow::Skybox(skybox)) =
            self.camera.borrow_mut().painter.workflows.get_from_type_mut(WorkflowType::Skybox)
        {
            skybox.update_style(&style, self.camera.clone(), &mut self.url_map).await;
        }
        if let Some(Workflow::Wallpaper(wallpaper)) =
            self.camera.borrow_mut().painter.workflows.get_from_type_mut(WorkflowType::Wallpaper)
        {
            wallpaper.update_style(&style);
        }
    }

    /// Build layer definitions
    /// - 1) ensure "bad" layers are removed (missing important keys or subkeys)
    /// - 2) ensure the order is correct for when WebGL eventually parses the encodings
    ///
    /// ## Parameters
    /// - `layers`: layers to build
    fn _build_layers(&mut self, layers: Option<Vec<LayerStyle>>) {
        let layers = layers.unwrap_or(vec![]);
        let mut layer_definitions: Vec<LayerDefinition> = vec![];
        let mut layer_index = 0;
        for layer_style in layers {
            if let Some(layer_definition) = self._build_layer(layer_style, layer_index) {
                if layer_definition.base().interactive.unwrap_or(false) {
                    self.interactive = true;
                }
                if layer_definition.source() == "mask" {
                    match &layer_definition {
                        LayerDefinition::Fill(f) => {
                            self.mask_layers.push(StyleMaskLayer::Fill(f.clone()))
                        }
                        LayerDefinition::Shade(f) => {
                            self.mask_layers.push(StyleMaskLayer::Shade(f.clone()))
                        }
                        _ => (),
                    }
                }
                layer_definitions.push(layer_definition);
                layer_index += 1;
            }
        }
        self.layers = layer_definitions;
    }

    /// Build layer definition
    ///
    /// ## Parameters
    /// - `layer_style`: layer style to build
    /// - `layer_index`: position of the layer in the style layers array
    ///
    /// ## Returns
    /// A layer definition if successful
    fn _build_layer(&self, layer_style: LayerStyle, layer_index: u32) -> Option<LayerDefinition> {
        // setup definition
        let r#type = layer_style.base().r#type.unwrap_or_default();
        let base = LayerDefinitionBase::from_layer(layer_style.base(), layer_index);
        // store the layer definition
        if let Some(workflow) =
            self.camera.borrow_mut().painter.workflows.get_from_type_mut(r#type.into())
        {
            return Some(workflow.build_layer_definition(base, &layer_style));
        }
        None
    }

    /// Request tiles. The projector will forward requests throug this class so it can build the
    /// tile requests with style specific data before forwarding it to the worker pool
    ///
    /// ## Parameters
    /// - `tiles`: tiles to request data for
    pub async fn request_tiles(&self, tiles: &[Rc<RefCell<Tile>>]) {
        if tiles.is_empty() {
            return;
        }
        let Camera { id, worker, .. } = &*self.camera.borrow();
        let mut tile_requests: Vec<TileRequest> = vec![];
        for tile in tiles {
            tile_requests.push((&*tile.borrow()).into());
        }
        // send the tiles over to the worker pool manager to split the workload
        if let Some(worker) = worker {
            worker
                .send(MapGLToSourceMessages {
                    map_id: *id,
                    message: MapGLToSourceMessage::TileRequest(TileRequestMessage {
                        tiles: tile_requests,
                        sources: vec![],
                    }),
                })
                .await;
        } else {
            let worker_pool = WorkerPool::get();
            worker_pool.tile_request(*id, tile_requests, None);
        }
    }

    /// Send style data to workers
    ///
    /// ## Parameters
    /// - `style`: style definition to forward
    async fn _send_style_data_to_workers(&self, style: StyleDefinition) {
        let analytics = self._build_analytics();
        let Self { api_key, url_map, layers, .. } = self;
        let Camera { id, worker, painter, projector, .. } = &*self.camera.borrow();
        let context = &painter.context.borrow();
        let r#type = context.r#type;
        let tile_size = projector.tile_size;
        let StyleDefinition {
            projection,
            sources,
            glyphs,
            fonts,
            icons,
            sprites,
            images,
            minzoom,
            maxzoom,
            experimental,
            ..
        } = &style;
        // now that we have various source data, package up the style objects we need and send it off:
        let style_package = StylePackage {
            projection: projection.unwrap_or(Projection::S2),
            gpu_type: r#type,
            sources: sources.clone().unwrap_or_default(),
            glyphs: glyphs.clone().unwrap_or_default(),
            fonts: fonts.clone().unwrap_or_default(),
            icons: icons.clone().unwrap_or_default(),
            sprites: sprites.clone().unwrap_or_default(),
            images: images.clone().unwrap_or_default(),
            layers: layers.iter().filter(|l| l.source() != "mask").map(|l| l.clone()).collect(),
            minzoom: minzoom.unwrap_or(0.),
            maxzoom: maxzoom.unwrap_or(20.),
            tile_size,
            analytics,
            api_key: api_key.clone(),
            url_map: Some(url_map.clone()),
            experimental: experimental.unwrap_or(false),
        };
        // If the map engine is running on the main thread, directly send the style_package to the worker pool.
        // Otherwise perhaps this map instance is a web worker and has a global instance of postMessage
        if let Some(worker) = worker {
            worker
                .send(MapGLToSourceMessages {
                    map_id: *id,
                    message: MapGLToSourceMessage::Style(StyleMessage { style: style_package }),
                })
                .await;
        } else {
            let worker_pool = WorkerPool::get();
            worker_pool.inject_style(*id, style_package);
        }
    }

    /// This is a helper function to build the analytics object. Useful for servers to know what kind
    /// of GPU or limitations this browser has
    ///
    /// ## Returns
    /// The analytics object
    fn _build_analytics(&self) -> S2MapsAnalytics {
        let camera = &self.camera.borrow();
        let context = &camera.painter.context.borrow();
        let Presentation { width, height, .. } = context.presentation;
        S2MapsAnalytics {
            gpu: context.renderer.clone(),
            context: context.r#type,
            language: language(),
            width,
            height,
        }
    }
}

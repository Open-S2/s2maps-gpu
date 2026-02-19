use crate::{
    render::{
        FeatureSpec, Features, FillWorkflow, PainterSpec, Presentation, RenderContext,
        SensorWorkflow, WorkflowSpec, WorkflowType, Workflows,
    },
    s2map::ColorMode,
    source::Tile,
    ui::{MapOptions, Projector, TimeCache},
    workers::{GlyphImages, PainterData, SpriteImageMessage},
};
use alloc::{collections::BTreeSet, rc::Rc};
use core::{cell::RefCell, cmp::Ordering};

/// # GPU Painter
///
/// ## Description
/// The GPU painter is the main entry point to the GPU features.
#[derive(Debug)]
#[allow(missing_docs)]
pub struct Painter {
    pub context: Rc<RefCell<RenderContext>>,
    pub workflows: Workflows,
    pub dirty: bool,
}
impl PainterSpec for Painter {
    /**
     * @param context - the GPU context wrapper
     * @param options - map options to pull out the options that impact the painter and GPU
     */
    async fn new(window: &winit::window::Window, options: &MapOptions) -> Self {
        Self {
            context: Rc::new(RefCell::new(RenderContext::new(window, options).await)),
            workflows: Workflows::new(),
            dirty: true,
        }
    }

    fn set_dirty(&mut self) {
        self.dirty = true
    }

    fn dirty(&self) -> bool {
        self.dirty
    }

    /**
     * Given a tile, build the feature data associated with it
     * @param tile - the tile to inject the features into
     * @param data - the collection of data to sift through and build features
     */
    fn build_feature_data(&self, tile: Rc<RefCell<Tile>>, data: &PainterData) {
        if let Some(workflow) = self.workflows.get_from_type(data.into()) {
            workflow.build_source(tile, data);
        }
    }

    /**
     * Build all workflows used by the style layers
     * @param buildSet - the set of workflows to build
     */
    fn build_workflows(&mut self, build_set: BTreeSet<WorkflowType>) {
        // Note: Look to [[Workflows::get]] for how "background" case is handled
        for workflow_type in build_set {
            match workflow_type {
                WorkflowType::Fill => self
                    .workflows
                    .add("fill".into(), FillWorkflow::new(self.context.clone()).into()),
                WorkflowType::Sensor => self
                    .workflows
                    .add("sensor".into(), SensorWorkflow::new(self.context.clone()).into()),
                _ => todo!(),
            }
        }
    }

    /** @returns a Uint8ClampedArray screen capture */
    async fn get_screen(&self) -> Vec<u8> {
        self.context.borrow().get_render_data()
    }

    /**
     * Set the colorblind mode
     * @param mode - colorblind mode to set
     */
    fn set_color_mode(&mut self, mode: ColorMode) {
        self.dirty = true;
        self.context.borrow_mut().set_color_blind_mode(mode);
    }

    /**
     * Inject a glyph image to the GPU
     * @param max_height - the maximum height of the texture
     * @param images - the glyph images
     * @param tiles - the tiles to update
     */
    fn inject_glyph_images(
        &self,
        max_height: u32,
        images: GlyphImages,
        tiles: &[Rc<RefCell<Tile>>],
    ) {
        if self.context.borrow_mut().inject_images(max_height, images) {
            for tile in tiles.iter() {
                for feature in tile.borrow().feature_guides.iter() {
                    feature.borrow_mut().update_shared_texture();
                }
            }
        }
    }

    /**
     * Inject a sprite image to the GPU
     * @param data - the raw image data of the sprite
     * @param tiles - the tiles to update
     */
    fn inject_sprite_image(&mut self, data: SpriteImageMessage, tiles: &[Rc<RefCell<Tile>>]) {
        if self.context.borrow_mut().inject_sprite_image(data) {
            for tile in tiles.iter() {
                for feature in tile.borrow().feature_guides.iter() {
                    feature.borrow_mut().update_shared_texture();
                }
            }
        }
    }

    /**
     * Inject a time cache for the sensor workflow
     * @param time_cache - the time cache to inject
     */
    fn inject_time_cache(&self, time_cache: &TimeCache) {
        if let Some(sensor) = self.workflows.get_sensor() {
            sensor.borrow_mut().inject_time_cache(time_cache);
        }
    }

    /**
     * Resize the canvas
     * @param width - new width
     * @param height - new height
     */
    fn resize(&mut self, width: u32, height: u32) {
        // notify that the painter is dirty
        self.dirty = true;
        // Add the resize call to the context
        self.context.borrow_mut().resize_next_frame =
            Some(Presentation { width, height, depth_or_array_layers: 1 });
        // update the workflows
        for workflow in self.workflows.values() {
            workflow.resize(width, height);
        }
    }

    /**
     * Paint all the tiles in view
     * @param projector - the camera and what it currently sees
     * @param tiles - all the tiles in view to paint
     */
    fn paint(&mut self, projector: &Projector, tiles: &[Rc<RefCell<Tile>>]) {
        //     const { context, workflows } = this;
        // setup for the next frame
        self.context.borrow_mut().new_scene(&projector.view, projector.matrices.meters().unwrap());
        // prep mask id's
        tiles.iter().enumerate().for_each(|(index, tile)| {
            let tile = &mut tile.borrow_mut();
            tile.tmp_mask_id = (index as u32) + 1;
        });

        //     const all_features = tiles.flatMap((tile) => tile.featureGuides);
        //     // Mercator: the tile needs to update it's matrix at all zooms.
        //     // S2: all features tiles past zoom 12 must set screen positions
        //     let feature_tiles = all_features.flatMap(({ parent, tile }) =>
        //       parent !== undefined ? [parent, tile] : [tile],
        //     );
        //     // remove all duplicates of tiles by their id
        //     feature_tiles = feature_tiles.filter(
        //       (tile, index) => feature_tiles.findIndex((t) => t.id === tile.id) === index,
        //     );
        //     for (const tile of feature_tiles) tile.set_screen_positions(projector, context);

        //     // prep all tile's features to draw
        //     const features: Features[] = all_features.filter((f) => f.type !== 'heatmap');
        //     // draw heatmap data if applicable, and a singular feature for the main render thread to draw the texture to the screen
        //     const heatmapFeatures = all_features.filter((f): f is HeatmapFeature => f.type === 'heatmap');

        //     // compute heatmap data
        //     const heatmapFeature = workflows.heatmap?.textureDraw(heatmapFeatures);
        //     if (heatmapFeature !== undefined) features.push(...heatmapFeature);
        //     // sort features
        //     features.sort(feature_sort);
        //     // prep glyph features for drawing box filters
        //     const glyphFeatures = features.filter((f): f is GlyphFeature => f.type === 'glyph');
        //     workflows.glyph?.computeFilters(glyphFeatures);

        //     // DRAW PHASE
        //     // draw masks
        //     for (const { mask } of tiles) mask.draw();
        //     // draw the wallpaper
        //     workflows.background?.draw(projector);
        //     // paint opaque fills
        //     const opaqueFillFeatures = features.filter((f) => f.layer_guide.opaque).reverse();
        //     for (const feature of opaqueFillFeatures) feature.draw();
        //     // paint features that are potentially transparent
        //     const residualFeatures = features.filter((f) => !(f.layer_guide.opaque ?? false));
        //     for (const feature of residualFeatures) feature.draw();

        //     // finish
        //     context.finish();
        todo!()
    }

    /**
     * Compute the interactive features in current view
     * @param tiles - current view tiles that we need to sift through for interactive features
     */
    fn compute_interactive(&self, tiles: &[Rc<RefCell<Tile>>]) {
        // Grab the interactive features
        let mut interactive_features: Vec<Rc<RefCell<Features>>> = tiles
            .iter()
            .flat_map(|tile| tile.borrow().feature_guides.clone())
            .filter(|f| f.borrow().interactive())
            .collect();
        // sort
        interactive_features.sort_by(|a, b| {
            let a_borrow = a.borrow();
            let b_borrow = b.borrow();
            // Assuming feature_sort is a function that compares &Features
            feature_sort(&a_borrow, &b_borrow)
        });
        // reverse
        interactive_features.reverse();
        // compute
        if interactive_features.len() > 0 {
            // prepare & compute
            self.context.borrow().clear_interact_buffer();
            self._compute_interactive(&interactive_features);
        }
    }
}
impl Painter {
    /**
     * Compute the interactive features via the GPU
     * @param features - input features that need to be computed
     */
    fn _compute_interactive(&self, features: &[Rc<RefCell<Features>>]) {
        let context = &mut self.context.borrow_mut();
        // prepare
        let mut c_e =
            context.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        context.new_compute(&mut c_e);
        let c_p = &mut context.compute_pass.as_ref().unwrap().borrow_mut();
        c_p.set_bind_group(0, context.frame_buffer_bind_group.as_ref(), &[]);
        // compute
        for feature in features {
            feature.borrow().compute();
        }
        // finish
        context.queue.submit([c_e.finish()]);
    }
}

/**
 * Sort the features
 * @param a - first feature
 * @param b - comparison feature
 * @returns a negative value if a < b, 0 if a === b, and a positive value if a > b
 */
fn feature_sort(a: &Features, b: &Features) -> Ordering {
    // first check if the layer is the same
    let mut diff = a.layer_index().cmp(&b.layer_index());
    if diff != Ordering::Equal {
        return diff;
    }
    // check for zoom difference
    let zoom_diff = (if a.parent().is_some() { Ordering::Greater } else { Ordering::Equal })
        .cmp(if b.parent().is_some() { &Ordering::Greater } else { &Ordering::Equal });
    if zoom_diff != Ordering::Equal {
        return zoom_diff;
    }
    // lastlye try to sort by feature code
    let mut index = 0;
    let a_feature_code = a.feature_code();
    let b_feature_code = b.feature_code();
    let max_size = usize::min(a_feature_code.len(), b_feature_code.len());
    while diff == Ordering::Equal && index < max_size {
        diff = a_feature_code[index].partial_cmp(&b_feature_code[index]).unwrap_or(Ordering::Equal);
        index += 1;
    }

    diff
}

// import { WebGPUContext } from './context/index.js';
// import {
//   FillWorkflow,
//   GlyphWorkflow,
//   HeatmapWorkflow,
//   HillshadeWorkflow,
//   LineWorkflow,
//   PointWorkflow,
//   RasterWorkflow,
//   ShadeWorkflow,
//   SkyboxWorkflow,
//   WallpaperWorkflow,
// } from './workflows/index.js';

// import type { ColorMode } from 's2/s2Map.js';
// import type { GlyphImages } from 'workers/source/glyphSource.js';
// import type { MapOptions } from 'ui/s2mapUI.js';
// import type { Projector } from 'ui/camera/projector/index.js';
// import type { TileGPU as Tile } from 'source/tile.spec.js';
// import type TimeCache from 'ui/camera/time_cache.js';
// import type {
//   Features,
//   GlyphFeature,
//   HeatmapFeature,
//   Workflow,
//   WorkflowImports,
//   WorkflowType,
//   Workflows,
// } from './workflows/workflow.spec.js';
// import type { PainterData, SpriteImageMessage } from 'workers/worker.spec.js';

use crate::{
    gpu::{Features, FillWorkflow, WebGPUContext, WorkflowType, Workflows},
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
    pub context: Rc<RefCell<WebGPUContext>>,
    pub workflows: Workflows,
    pub dirty: bool,
}
impl Painter {
    /**
     * @param context - the GPU context wrapper
     * @param options - map options to pull out the options that impact the painter and GPU
     */
    pub fn new(window: &winit::window::Window, options: &MapOptions) -> Self {
        Self {
            context: Rc::new(RefCell::new(WebGPUContext::new(window, options))),
            workflows: Workflows::new(),
            dirty: true,
        }
    }

    /**
     * Given a tile, build the feature data associated with it
     * @param tile - the tile to inject the features into
     * @param data - the collection of data to sift through and build features
     */
    pub fn build_feature_data(&self, tile: Rc<RefCell<Tile>>, data: &PainterData) {
        if let Some(workflow) = self.workflows.get_from_type(data.into()) {
            workflow.build_source(tile, data);
        }
    }

    /**
     * Build all workflows used by the style layers
     * @param buildSet - the set of workflows to build
     */
    pub fn build_workflows(&mut self, build_set: BTreeSet<WorkflowType>) {
        // Note: Look to [[Workflows::get]] for how "background" case is handled
        for workflow_type in build_set {
            match workflow_type {
                WorkflowType::Fill => self
                    .workflows
                    .add("fill".into(), FillWorkflow::new(self.context.clone()).into()),
                _ => todo!(),
            }
        }
    }

    /** @returns a Uint8ClampedArray screen capture */
    pub async fn get_screen(&self) -> Vec<u8> {
        self.context.borrow().get_render_data()
    }

    /**
     * Set the colorblind mode
     * @param mode - colorblind mode to set
     */
    pub fn set_color_mode(&mut self, mode: ColorMode) {
        self.dirty = true;
        self.context.borrow_mut().set_color_blind_mode(mode);
    }

    /**
     * Inject a glyph image to the GPU
     * @param max_height - the maximum height of the texture
     * @param images - the glyph images
     * @param tiles - the tiles to update
     */
    pub fn inject_glyph_images(
        &self,
        max_height: u32,
        images: GlyphImages,
        tiles: &[Rc<RefCell<Tile>>],
    ) {
        if self.context.borrow_mut().inject_images(max_height, images) {
            for tile in tiles.iter() {
                for feature in tile.borrow_mut().feature_guides.iter_mut() {
                    feature.update_shared_texture();
                }
            }
        }
    }

    /**
     * Inject a sprite image to the GPU
     * @param data - the raw image data of the sprite
     * @param tiles - the tiles to update
     */
    pub fn inject_sprite_image(&mut self, data: SpriteImageMessage, tiles: &[Rc<RefCell<Tile>>]) {
        if self.context.borrow_mut().inject_sprite_image(data) {
            for tile in tiles.iter() {
                for feature in tile.borrow_mut().feature_guides.iter_mut() {
                    feature.update_shared_texture();
                }
            }
        }
    }

    /**
     * Inject a time cache for the sensor workflow
     * @param time_cache - the time cache to inject
     */
    pub fn inject_time_cache(&self, time_cache: &TimeCache) {
        // if let Some(sensor) = self.workflows.get_from_type(WorkflowType::Sensor) {
        //     sensor.inject_time_cache(time_cache);
        // }
        todo!("uncomment when sensor is ready")
    }

    /**
     * Resize the canvas
     * @param width - new width
     * @param height - new height
     */
    pub fn resize(&mut self, width: u32, height: u32) {
        // TODO: Figure out how to ensure the resize call only happens when the context is ready.
        // notify that the painter is dirty
        self.dirty = true;
        for workflow in self.workflows.values() {
            workflow.resize();
        }
    }

    /**
     * Paint all the tiles in view
     * @param projector - the camera and what it currently sees
     * @param tiles - all the tiles in view to paint
     */
    pub fn paint(&mut self, projector: &Projector, tiles: &[Tile]) {
        //     const { context, workflows } = this;
        // setup for the next frame
        // self.context.borrow_mut().new_scene(&projector.view, projector.matrices.meters());
        //     // prep mask id's
        //     tiles.forEach((tile, index) => {
        //       tile.tmpMaskID = index + 1;
        //     });

        //     const allFeatures = tiles.flatMap((tile) => tile.featureGuides);
        //     // Mercator: the tile needs to update it's matrix at all zooms.
        //     // S2: all features tiles past zoom 12 must set screen positions
        //     let featureTiles = allFeatures.flatMap(({ parent, tile }) =>
        //       parent !== undefined ? [parent, tile] : [tile],
        //     );
        //     // remove all duplicates of tiles by their id
        //     featureTiles = featureTiles.filter(
        //       (tile, index) => featureTiles.findIndex((t) => t.id === tile.id) === index,
        //     );
        //     for (const tile of featureTiles) tile.setScreenPositions(projector);

        //     // prep all tile's features to draw
        //     const features: Features[] = allFeatures.filter((f) => f.type !== 'heatmap');
        //     // draw heatmap data if applicable, and a singular feature for the main render thread to draw the texture to the screen
        //     const heatmapFeatures = allFeatures.filter((f): f is HeatmapFeature => f.type === 'heatmap');

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
        //     const opaqueFillFeatures = features.filter((f) => f.layerGuide.opaque).reverse();
        //     for (const feature of opaqueFillFeatures) feature.draw();
        //     // paint features that are potentially transparent
        //     const residualFeatures = features.filter((f) => !(f.layerGuide.opaque ?? false));
        //     for (const feature of residualFeatures) feature.draw();

        //     // finish
        //     context.finish();
        todo!()
    }

    /**
     * Compute the interactive features in current view
     * @param tiles - current view tiles that we need to sift through for interactive features
     */
    pub fn compute_interactive(&self, tiles: &[Tile]) {
        //     const interactiveFeatures = tiles
        //       .flatMap((tile) => tile.featureGuides)
        //       .filter(({ layerGuide }) => layerGuide.interactive)
        //       .sort(feature_sort)
        //       .reverse();
        //     if (interactiveFeatures.length > 0) {
        //       // prepare & compute
        //       this.context.clearInteractBuffer();
        //       this._compute_interactive(interactiveFeatures);
        //     }
        todo!()
    }

    /**
     * Compute the interactive features via the GPU
     * @param features - input features that need to be computed
     */
    fn _compute_interactive(&self, features: &[Features]) {
        //     const { device, frameBufferBindGroup } = this.context;
        //     // prepare
        //     const commandEncoder = device.createCommandEncoder();
        //     const computePass = (this.context.computePass = commandEncoder.beginComputePass());
        //     computePass.setBindGroup(0, frameBufferBindGroup);
        //     // compute
        //     for (const feature of features) feature.compute?.();
        //     // finish
        //     computePass.end();
        //     device.queue.submit([commandEncoder.finish()]);
        todo!()
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

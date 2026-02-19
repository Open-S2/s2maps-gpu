// /** STYLE */
// import Style from 'style/index.js';
// /** GEOMETRY / PROJECTIONS */
// import { idParent } from 'gis-tools/index.js';
// import { Projector, mod } from './projector/index.js';
// /** SOURCES */
// import Animator from './animator.js';
// import Cache from './cache.js';
// import DragPan from './drag_pan.js';
// import TimeCache from './time_cache.js';
// import { createTile } from 'source/index.js';
// /** PAINT */
// import type { Painter as DOMPainter } from 'dom/painter.spec.js';
// import type { Painter as GLPainter } from 'gl/painter.spec.js';
// import type { Painter as GPUPainter } from 'gpu/painter.spec.js';
// import type { MapOptions } from '../s2mapUI.js';

// import type { ClickEvent } from './drag_pan.js';
// import type S2Map from 's2/s2Map.js';
// import type { TileInView } from './projector/index.js';
// import type { Combine, TileShared as Tile } from 'source/tile.spec.js';
// import type {
//   InteractiveObject,
//   MapGLMessage,
//   MouseClickMessage,
//   MouseEnterMessage,
//   MouseLeaveMessage,
//   ReadyMessageGL,
//   SourceFlushMessage,
//   TileFlushMessage,
//   TileRequest,
//   TileWorkerMessage,
//   ViewMessage,
// } from 'workers/worker.spec.js';
// import type { CellId, VectorPoint } from 'gis-tools/index.js';
// import type { StyleDefinition, TimeSeriesStyle } from 'style/style.spec.js';

/// Animation Mechanism
pub mod animator;
/// Tile Cache system
pub mod cache;
/// Drag Pan Tooling
pub mod drag_pan;
/// Projection Tooling
pub mod projector;
/// Time Cache
pub mod time_cache;

use crate::{
    render::Painter,
    s2map::S2Map,
    source::Tile,
    style::{MapStyleInput, Style, TimeSeriesStyle},
    ui::MapOptions,
    util::MsgSender,
    workers::{
        FlushMessage, InteractiveObject, MapGLToSourceMessages, MapID, NavControl, ResizeMessage,
        TileRequest, TileWorkerMessage, TileWorkerMessageOutput,
    },
};
use alloc::{
    collections::BTreeMap,
    rc::{Rc, Weak},
    vec::Vec,
};
pub use animator::*;
pub use cache::*;
use core::cell::RefCell;
pub use drag_pan::*;
use gistools::geometry::CellId;
pub use projector::*;
use s2json::Point;
pub use time_cache::*;

/// Resize dimensions
#[derive(Debug, Clone, PartialEq)]
pub struct ResizeDimensions {
    /// Width of the canvas
    pub width: usize,
    /// Height of the canvas
    pub height: usize,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum FeatureChangeType {
    MouseEnter,
    MouseLeave,
}

/// # Camera
///
/// The camera of the map. Maintains local cache, manages the painter, projector, and handles
/// the rendering of the map.
///
/// The Camera also handles user interactions, map states, each frame,
/// along with any animations that might be in progress.
///
/// Any updates that are required are sent to the Style container and any data that shipped here is
/// forwarded to the Painter.
#[derive(Debug)]
#[allow(missing_docs)]
pub struct Camera {
    //   readonly parent?: S2Map;
    parent: RefCell<Option<Weak<S2Map>>>,
    pub id: MapID,
    //   readonly #canvas: HTMLCanvasElement;
    pub _can_draw: bool, // = false; // let the render sequence know if the painter is ready to paint
    pub _interactive: bool, // = false; // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
    pub scroll_zoom: bool,  // allow the user to scroll over the canvas and cause a zoom change
    pub style: Style,
    pub projector: Projector,
    pub painter: Painter,
    pub tile_cache: Cache<CellId, Rc<RefCell<Tile>>>, // = new Cache<CellId, Tile>();
    pub time_cache: Option<TimeCache>,
    pub tiles_in_view: Vec<TileID>, // T[] = []; // S2CellIDs of the tiles
    pub last_tile_view_state: Vec<u64>, // number[] = [];
    pub request_queue: Vec<TileID>, // T[] = [];
    pub was_dirty_last_frame: bool, // = false;
    /// Denote this mapUI is running in a separate thread
    // TODO: Replace worker with an actual thread ship mechanic
    pub worker: Option<MsgSender<MapGLToSourceMessages>>,
    pub can_move: bool,        // = true;
    pub can_zoom: bool,        // = true;
    pub drag_pan: DragPan,     // = new DragPan();
    pub mouse_moved: bool,     // = true;
    pub mouse_position: Point, // VectorPoint = { x: 0, y: 0 };
    //   curr_anim_function?: (now: number) => void;
    pub _resize_queued: Option<ResizeDimensions>,
    pub curr_features: BTreeMap<u64, InteractiveObject>, // = new Map<number, InteractiveObject>();
    // Come from S2MapUI (No Inheretance in Rust):
    /// if true, renders the next frame
    pub render_next_frame: bool, //  = false;
    /// If non-empty, inject a message into the map.
    pub injection_queue: Vec<TileWorkerMessage>, // = [];
    /// Resize message
    pub resize_queued: Option<ResizeMessage>,
}
impl Camera {
    /**
     * Initialize the mapUI
     * @param options - Map options
     * @param canvas - Canvas element we are rendering to
     * @param id - Unique identifier for the mapUI
     * @param parent - Parent mapUI means this is running on the main thread so we can make direct calls to the parent
     */
    pub fn new(
        options: MapOptions,
        canvas: &winit::window::Window,
        id: MapID,
        parent: RefCell<Option<Weak<S2Map>>>,
    ) -> Self {
        //     this.#canvas = canvas;
        //     // setup options
        //     const { style, interactive, scroll_zoom, can_move, can_zoom } = options;
        //     // assign worker if applicable
        //     this.worker = parent === undefined;
        //     // check if we can interact with the camera
        //     this._interactive = interactive ?? true;
        //     this.#scroll_zoom = scroll_zoom ?? true;
        //     this.can_move = can_move ?? true;
        //     this.can_zoom = can_zoom ?? true;
        //     // create style
        //     this.style = new Style(this, options);
        //     // setup projector
        //     this.projector = new Projector(options, this);
        //     this.id = id;
        //     this.parent = parent;
        //     // build the painter and style
        //     void this._build_paint(options, style);
        todo!()
    }

    /**
     * Given an user defined time series, build the time cache
     * @param time_series - the time series to build the cache for
     */
    pub fn build_time_cache(&self, time_series: TimeSeriesStyle) {
        //     const { worker, painter } = this;
        //     this.time_cache = new TimeCache(this, worker, time_series);
        //     painter.injectTimeCache(this.time_cache);
        todo!()
    }

    /**
     * Setup funciton to prepare the painter for rendering. Notify the main thread that the painter is ready.
     * @param options - the map options to use for the painter
     * @param style - the style to use for the painter
     */
    pub async fn _build_paint(&self, options: &MapOptions, style: MapStyleInput) {
        //     const isBuilt = await this._create_painter(options);
        //     if (!isBuilt) throw new Error('Could not build painter');
        //     // now we setup canvas interaction
        //     this._setup_canvas();
        //     // setup the style - this goes AFTER creation of the painter, because the
        //     // style will tell the painter what programs/pipelines it will be using
        //     await this._set_style(style, false);
        //     // explain we are ready to paint
        //     const msg: ReadyMessageGL = { type: 'ready', mapID: this.id };
        //     if (this.worker) postMessage(msg);
        //     else this.parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        todo!()
    }

    /**
     * Set the style for the map
     * @param style - the style to use for the painter
     * @param ignore_position - whether to ignore the position set in the style (keep the map where it is)
     */
    async fn _set_style(&self, style: MapStyleInput, ignore_position: bool) {
        //     // ensure we don't draw for a sec
        //     this._can_draw = false;
        //     // incase style was imported, clear cache
        //     this.tile_cache.deleteAll();
        //     // build style for the map, painter, and workers
        //     this._can_draw = await this.style.build_style(style, ignore_position);
        //     // render our first pass
        //     this.render();
        todo!()
    }

    /** Setup the canvas for the map adding listeners and the size of the canvas */
    fn _setup_canvas(&self) {
        //     const { _interactive, drag_pan } = this;
        //     // setup listeners
        //     this.#canvas.addEventListener(
        //       'webglcontextlost',
        //       this.#contextLost.bind(this) as EventListener,
        //     );
        //     this.#canvas.addEventListener(
        //       'webglcontextrestored',
        //       this._context_restored.bind(this) as EventListener,
        //     );
        //     // if we allow the user to interact with map, we add events
        //     if (_interactive) {
        //       // let drag_pan know if we can zoom
        //       if (this.#scroll_zoom) drag_pan.zoomActive = true;
        //       // listen to drag_pans updates
        //       drag_pan.addEventListener('move', this._on_movement.bind(this) as EventListener);
        //       drag_pan.addEventListener('swipe', this._on_swipe.bind(this) as EventListener);
        //       drag_pan.addEventListener('zoom', () => {
        //         this.on_zoom(drag_pan.zoom);
        //       });
        //       drag_pan.addEventListener('click', ((e: CustomEvent) => {
        //         this._on_click(e);
        //       }) as EventListener);
        //       drag_pan.addEventListener('doubleClick', ((e: CustomEvent) => {
        //         this._on_double_click(e);
        //       }) as EventListener);
        //     }
        //     // setup camera
        //     this._resize_camera(this.#canvas.width, this.#canvas.height);
        todo!()
    }

    /**
     * Create the painter is the first step in building the map.
     * We figure out which context we can use before pulling in GL or GPU.
     * After we have the appropriate context, we build the painter and then the
     * @param options - map options
     * @returns whether or not the painter was built
     */
    async fn _create_painter(&self, options: &MapOptions) -> bool {
        //     const { contextType } = options;
        //     let context: null | GPUCanvasContext | WebGL2RenderingContext | WebGLRenderingContext = null;
        //     // first try webGPU
        //     if (contextType === 3) {
        //       context = this.#canvas.getContext('webgpu') as unknown as GPUCanvasContext; // GPUCanvasContext
        //       if (context === null) return false;
        //       const Painter = await import('gpu/index.js').then((m) => m.Painter);
        //       this.painter = new Painter(context, options) as unknown as P;
        //       await this.painter.prepare();
        //     } else if (contextType === 2 || contextType === 1) {
        //       let type: 1 | 2 = 1;
        //       // prep webgl style options
        //       const webglOptions = {
        //         antialias: false,
        //         premultipliedAlpha: true,
        //         preserveDrawingBuffer: true,
        //         alpha: true,
        //         stencil: true,
        //       };
        //       // than try webgl2
        //       if (contextType === 2) {
        //         context = this.#canvas.getContext('webgl2', webglOptions) as WebGL2RenderingContext;
        //         type = 2;
        //       }
        //       // last effort, webgl1
        //       if (context === null) {
        //         webglOptions.premultipliedAlpha = true;
        //         context = this.#canvas.getContext('webgl', webglOptions) as WebGLRenderingContext;
        //       }
        //       if (context === null) return false;
        //       const Painter = await import('gl/index.js').then((m) => m.Painter);
        //       this.painter = new Painter(context, type, options) as unknown as P;
        //     } else {
        //       const Painter = await import('dom/index.js').then((m) => m.Painter);
        //       this.painter = new Painter(this.#canvas, options) as unknown as P;
        //     }

        //     return true;
        todo!()
    }

    /**
     * Update the compass position if camera changes were made internally, like an animation or functional update
     * @param bearing - The bearing angle in degrees.
     * @param pitch - The pitch angle in degrees.
     */
    fn _update_compass(&self, bearing: f64, pitch: f64) {
        // if (this.worker) postMessage({ type: 'updateCompass', bearing, pitch });
        // else this.parent?._updateCompass(bearing, pitch);
        todo!()
    }

    /**
     * Resize the camera and update the projector and painter to the change
     * @param width - The new width of the camera.
     * @param height - The new height of the camera.
     */
    fn _resize_camera(&self, width: u32, height: u32) {
        //     // ensure minimum is 1px for both
        //     width = u32::max(width, 1);
        //     height = u32::max(height, 1);
        //     // update the projector and painter
        //     this.projector.resize(width, height);
        //     this.painter.resize(width, height);
        todo!()
    }

    /**
     * Reset the tile cache for the given sources.
     * @param source_names - The names of the sources to reset the tile cache for.
     * @param keep_cache - Whether to keep the cache or not. don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
     * @param await_replace - Whether to await the replacement of tiles or not. to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
     * @returns An array of tile requests that need to be processed to complete the reset for the tile cache for the given sources.
     */
    fn _reset_tile_cache(
        &self,
        source_names: &[String],
        keep_cache: bool,
        await_replace: bool,
    ) -> Vec<TileRequest> {
        //     // TODO:
        //     // get tiles in view, prep request for said tiles
        //     const tiles_in_view = this.get_tiles();
        //     const tile_ids = tiles_in_view.map((tile) => tile.id);
        //     const tileRequests: TileRequest[] = [];
        //     // delete all tiles not in view, add to tileRequests for those that are,
        //     // and delete source data from tile
        //     this.tile_cache.forEach((tile, key) => {
        //       if (!keep_cache && !tile_ids.includes(key)) {
        //         // just remove the tile for simplicity
        //         this.tile_cache.delete(key);
        //       } else {
        //         // add to tileRequests
        //         const { id, face, zoom, i, j, bbox, type, division } = tile;
        //         tileRequests.push({ id, face, zoom, i, j, bbox, type, division });
        //         if (!await_replace) tile.deleteSources(source_names);
        //       }
        //     });

        //     return tileRequests;
        todo!()
    }

    /** Resize the camera and canvas, cleaning up animations */
    fn _resize(&self) {
        //     const { resize_queued } = this;
        //     if (resize_queued !== undefined) {
        //       // remove any prexisting animations
        //       this.curr_anim_function = undefined;
        //       // grab width and height
        //       const { width, height } = resize_queued;
        //       this.#canvas.width = width;
        //       this.#canvas.height = height;
        //       this._resize_camera(width, height);
        //       this.resize_queued = undefined;
        //     }
        todo!()
    }

    /**
     * Set the new mouse position
     * @param pos_x - The x-coordinate of the mouse position
     * @param pos_y - The y-coordinate of the mouse position
     */
    fn _set_mouse_position(&self, pos_x: f64, pos_y: f64) {
        //     this.mouse_position = { x: pos_x, y: pos_y };
        //     this.projector.setMousePosition(pos_x, pos_y);
        //     // NOTE: Sometimes mouse positions update before the painter is ready, so discard them
        //     if (this._can_draw) this.painter.dirty = true;
        todo!()
    }

    /**
     * Process a click event
     * @param event - The click event
     */
    fn _on_click(&self, event: ClickEvent) {
        //     const { id: mapID, projector, curr_features, parent, worker } = this;
        //     // get lon lat of cursor
        //     const { pos_x, pos_y } = event.detail;
        //     const lonLat = projector.cursorToLonLat(pos_x, pos_y);
        //     if (lonLat === undefined) return;
        //     const { x: lon, y: lat } = lonLat;
        //     // send off the information
        //     const msg: MouseClickMessage = {
        //       type: 'click',
        //       mapID,
        //       features: [...curr_features.values()],
        //       lon,
        //       lat,
        //     };
        //     if (worker) postMessage(msg);
        //     else parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        todo!()
    }

    /**
     * Process a double click event
     * @param event - The double click event
     */
    fn _on_double_click(&self, event: ClickEvent) {
        //     const { pos_x, pos_y } = event.detail;
        //     const lonLat = this.projector.cursorToLonLat(pos_x, pos_y);
        //     if (lonLat === undefined) return;
        //     const { x: lon, y: lat } = lonLat;
        //     this._nav_event('zoomIn', lon, lat);
        todo!()
    }

    /**
     * Handle a navigation event
     * @param ctrl - The navigation control
     * @param lon - The longitude change if provided
     * @param lat - The latitude change if provided
     */
    pub fn _nav_event(&self, ctrl: NavControl, lon: Option<f64>, lat: Option<f64>) {
        //     const { projector } = this;
        //     const startZoom = projector.zoom;
        //     const endZoom = startZoom + (ctrl === 'zoomIn' ? 1 : -1);
        //     // build animation
        //     const animator = new Animator(projector, { duration: 1.5, zoom: endZoom, lon, lat });
        //     animator.zoomTo();
        //     /**
        //      * Set a new animation function
        //      * @param now - The current time in milliseconds since the animation started
        //      */
        //     this.curr_anim_function = (now: number) => {
        //       this._animate(animator, now * 0.001);
        //     };
        //     // render
        //     this.render();
        todo!()
    }

    /** Handle a view change */
    fn _on_view_update(&self) {
        //     const { id: mapID, projector, worker, parent } = this;
        //     const { zoom, lon, lat, bearing, pitch } = projector;
        //     const msg: ViewMessage = { type: 'view', mapID, view: { zoom, lon, lat, bearing, pitch } };
        //     if (worker) postMessage(msg);
        //     else parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        todo!()
    }

    /** Handle a mouse move event that occurs on the canvas */
    async fn _on_canvas_mouse_move(&self) {
        //     const {
        //       style,
        //       mouse_position: { x, y },
        //       painter,
        //       curr_features,
        //       tile_cache,
        //     } = this;
        //     if (!style.interactive) return;
        //     const foundObjects = new Map<number, InteractiveObject>();
        //     const featureIDs = await painter.context.getFeatureAtMousePosition(x, y);
        //     // if we found an ID and said feature is not the same as the current, we dive down
        //     for (const featureID of featureIDs) {
        //       // first check if we already have the feature
        //       const hasFeature = curr_features.get(featureID);
        //       if (hasFeature !== undefined) {
        //         foundObjects.set(featureID, hasFeature);
        //         continue;
        //       }
        //       // otherwise, we check the tiles in our store
        //       for (const tile of tile_cache.getAll()) {
        //         const feature = tile.getInteractiveFeature(featureID);
        //         if (feature !== undefined) {
        //           foundObjects.set(featureID, feature);
        //           break;
        //         }
        //       }
        //     }
        //     this._handle_feature_change(foundObjects);
        todo!()
    }

    /**
     * Handle a change in interactive features.
     * @param found_features - the features that are under the cursor
     */
    fn _handle_feature_change(&self, found_features: BTreeMap<u64, InteractiveObject>) {
        //     const previousFrameFeatures = this.curr_features;
        //     // ensure currFeature is up-to-date
        //     this.curr_features = found_features;
        //     const current_features = [...found_features.values()];

        //     // find all the new features found this frame compared to the previous frame
        //     const newFeatures: InteractiveObject[] = [];
        //     for (const [id, feature] of found_features) {
        //       if (!previousFrameFeatures.has(id)) newFeatures.push(feature);
        //     }
        //     this._submit_feature_changes('mouseenter', newFeatures, current_features);
        //     // find all the old features found in the previous frame compared to the current frame
        //     const oldFeatures: InteractiveObject[] = [];
        //     for (const [id, feature] of previousFrameFeatures) {
        //       if (!found_features.has(id)) oldFeatures.push(feature);
        //     }
        //     this._submit_feature_changes('mouseleave', oldFeatures, current_features);

        //     // due to a potential change in feature draw properties (change in color/size/etc.) we draw again
        //     this.render();
        todo!()
    }

    /**
     * Submit to the main thread a mouse enter/leave event for a set of features
     * @param type - The event type
     * @param features - The "new" feature states that need updating
     * @param current_features - The "current" features states whose state has changed
     */
    fn _submit_feature_changes(
        &self,
        r#type: FeatureChangeType,
        features: &[InteractiveObject],
        current_features: &[InteractiveObject],
    ) {
        //     if (features.length === 0) return;
        //     const { id: mapID, worker, parent } = this;
        //     const msg: MouseEnterMessage | MouseLeaveMessage = { type, mapID, features, current_features };
        //     if (worker) postMessage(msg);
        //     else parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        todo!()
    }

    /** When the map has moved, this handles the current frames updates pre-render */
    fn _on_movement(&self) {
        //     const { projector, drag_pan, can_move } = this;
        //     if (!can_move) return;
        //     const { movementX, movementY } = drag_pan;
        //     // update projector
        //     projector.onMove(movementX, movementY);
        //     this.render();
        todo!()
    }

    /** Handle a swipe event's impact on the map frame */
    fn _on_swipe(&self) {
        //     const { projector, drag_pan, can_move } = this;
        //     const { movementX, movementY } = drag_pan;
        //     if (!can_move) return;
        //     // build animation
        //     const animator = new Animator(projector, { duration: 1.75 });
        //     animator.swipeTo(movementX, movementY);
        //     /**
        //      * Set the current animation function
        //      * @param now - The current time in milliseconds since the animation started
        //      */
        //     this.curr_anim_function = (now: number) => {
        //       this._animate(animator, now * 0.001);
        //     };
        //     // render
        //     this.render();
        todo!()
    }

    /**
     * Animation function for a frame
     * @param animator - The animator we pull the current position from
     * @param cur_time - The current time
     */
    fn _animate(&self, animator: &Animator, cur_time: f64) {
        //     // ensure new render is queued
        //     this.render();
        //     // tell the animator to increment frame
        //     const done = animator.increment(cur_time);
        //     // continue animation if not done and no mouse/touch events
        //     if (done || this.drag_pan.mouseActive) this.curr_anim_function = undefined;
        todo!()
    }

    /** Signal to the painter that it needs to be updated */
    fn _update_painter(&self) {
        //     const { painter } = this;
        //     painter.dirty = true;
        //     this.render();
        todo!()
    }

    /**
     * Inject data into the painter
     * @param data - The data to inject
     */
    fn _inject_data(&self, data: TileWorkerMessageOutput) {
        //     const { painter, tile_cache } = this;
        //     const { type } = data;

        //     if (type === 'interactive')
        //       this._inject_interactive_data(
        //         data.tile_id,
        //         data.interactive_guide_buffer,
        //         data.interactive_data_buffer,
        //       );
        //     else if (type === 'flush') this._inject_flush(data);
        //     else if (type === 'glyphimages')
        //       painter.injectGlyphImages(data.maxHeight, data.images, tile_cache.getAll());
        //     else if (type === 'spriteimage') painter.injectSpriteImage(data, tile_cache.getAll());
        //     else if (type === 'timesource') this._add_time_source(data.source_name, data.interval);
        //     else {
        //       // 1) grab the tile
        //       const tile = tile_cache.get(data.tile_id);
        //       if (tile === undefined) return;
        //       // 2) Build features via the painter. Said workflow will add to the tile's feature list
        //       painter.buildFeatureData(tile, data);
        //     }

        //     // new 'paint', so painter is dirty
        //     painter.dirty = true;
        //     this.render();
        todo!()
    }

    /**
     * Inject a flush command into a tile
     * @param data - the flush command (either a tile flush or source flush)
     */
    fn _inject_flush(&self, data: FlushMessage) {
        //     const { tile_id } = data;
        //     const tile = this.tile_cache.get(tile_id);
        //     tile?.flush(data);
        todo!()
    }

    /**
     * Add a time series source
     * @param source_name - the name of the temporal source
     * @param interval - the interval position in the source
     */
    fn _add_time_source(&self, source_name: String, interval: f64) {
        //     this.time_cache?.addSource(source_name, interval);
        todo!()
    }

    /**
     * Inject interactive data to their respective tiles
     * @param tile_id - the id of the tile to inject features properties into
     * @param interactive_guide_buffer - the guide buffer for decoding the feature's properties
     * @param interactive_data_buffer - the raw data to pull the properties from
     */
    fn _inject_interactive_data(
        &self,
        tile_id: TileID,
        interactive_guide_buffer: Vec<u32>,
        interactive_data_buffer: Vec<u8>,
    ) {
        //     const { tile_cache } = this;
        //     if (tile_cache.has(tile_id)) {
        //       const tile = tile_cache.get(tile_id);
        //       if (tile === undefined) return;
        //       tile.injectInteractiveData(
        //         new Uint32Array(interactive_guide_buffer),
        //         new Uint8Array(interactive_data_buffer),
        //       );
        //     }
        todo!()
    }

    /**
     * Get a tile from the cache given an CellId
     * @param tile_id - the id of the tile
     * @returns the tile if the cache has it
     */
    fn get_tile(&self, tile_id: TileID) -> Option<Tile> {
        //     return this.tile_cache.get(tile_id);
        todo!()
    }

    /// @returns the tiles in the current view */
    pub fn get_tiles(&mut self) -> Vec<Tile> {
        //     const { tile_cache, projector, painter, style } = this;
        //     if (projector.dirty) {
        //       painter.dirty = true; // to avoid re-requesting get_tiles (which is expensive), we set painter.dirty to true
        //       let tiles_in_view: TileInView[] = [];
        //       // no matter what we need to update what's in view
        //       const newTiles: Tile[] = [];
        //       // update tiles in view
        //       tiles_in_view = projector.get_tilesInView();
        //       // check if any of the tiles don't exist in the cache. If they don't create a new tile
        //       for (const foundTile of tiles_in_view) {
        //         if (!tile_cache.has(foundTile.id)) {
        //           // tile not found, so we create it
        //           const createdTiles = this._create_tiles(foundTile);
        //           // store reference for the style to request from worker(s)
        //           newTiles.push(...createdTiles);
        //         }
        //       }
        //       // if new tiles exist, ensture the worker and painter are updated
        //       // do not request out of bounds tiles because they just reference
        //       // the "wrapped" real world tiles
        //       const newTilesWithoutOutofBounds = newTiles.filter((tile) => tile.wrappedID === undefined);
        //       if (newTilesWithoutOutofBounds.length > 0) style.requestTiles(newTilesWithoutOutofBounds);
        //       // given the S2CellID, find them in cache and return them
        //       this.tiles_in_view = tile_cache.getBatch(tiles_in_view.map((tile) => tile.id));
        //     }
        //     return this.tiles_in_view;
        todo!()
    }

    /**
     * Given a list of S2CellIDs, create the tiles necessary to render those IDs for future requests
     * @param tile_ids - the list of S2CellIDs
     */
    pub fn create_future_tiles(&mut self, tile_ids: &[TileInView]) {
        // const { tile_cache, painter, style } = this;
        // const newTiles: Tile[] = [];
        // // create the tiles
        // for (const tile of tile_ids) {
        //   if (!tile_cache.has(tile.id)) {
        //     const createdTiles = this._create_tiles(tile);
        //     newTiles.push(...createdTiles);
        //   }
        // }
        // // tell the style to make the requests
        // painter.dirty = true;
        // style.requestTiles(newTiles);
        todo!()
    }

    /**
     * Given an S2CellID, create the tiles necessary to render that ID.
     * Although steriotypical, we only create a single tile from the S2CellID or WMID,
     * if the tile is out of bounds, we may need to create a second tile that
     * it references (the "wrapped" tile). Often times the tile already exists
     * @param t_in_view - information on tile in view
     * @returns an array of tiles for the given S2CellID
     */
    fn _create_tiles(&self, t_in_view: TileInView) -> Vec<Tile> {
        //     const res: Tile[] = [];
        //     const { style, painter, tile_cache, projector } = this;
        //     // create tile
        //     const tile = createTile(projector.projection, painter.context, t_in_view);
        //     res.push(tile);
        //     // should our style have mask layers, let's add them
        //     style.injectMaskLayers(tile);
        //     // inject parent should one exist
        //     const s2ID = tile.wrappedID ?? tile.id;
        //     if (t_in_view.zoom > 0) {
        //       // get closest parent S2CellID. If actively zooming, the parent tile will pass along
        //       // it's parent tile (and so forth) if its own data has not been processed yet.
        //       const pID = idParent(s2ID);
        //       // check if parent tile exists, if so inject
        //       const parent = tile_cache.get(pID);
        //       if (parent !== undefined) tile.injectParentTile(parent, style.layers);
        //     }
        //     if (tile.wrappedID !== undefined) {
        //       // This is a WM only case. Inject "wrapped" tile's featureGuides as a reference
        //       if (!tile_cache.has(tile.wrappedID)) {
        //         const size = 1 << tile.zoom;
        //         res.push(
        //           ...this._create_tiles({
        //             id: tile.wrappedID,
        //             face: tile.face,
        //             x: mod(tile.i, size),
        //             y: mod(tile.j, size),
        //             zoom: tile.zoom,
        //           }),
        //         );
        //       }
        //       const wrappedTile = tile_cache.get(tile.wrappedID);
        //       if (wrappedTile !== undefined) tile.injectWrappedTile(wrappedTile);
        //     }
        //     // store the tile, if an out of bounds tile, store it's own WMID
        //     tile_cache.set(t_in_view.id, tile);

        //     return res;
        todo!()
    }

    /**
     * Internal Draw handler.
     * - Get the tiles needed for the current frame
     * - If any state changes happened since last frame, update the style, painter, and projector as needed
     * - Paint the scene
     * - If there was movement/zoom change, compute the interactive elements
     * - cleanup for the next frame
     */
    fn _draw(&self) {
        //     const { style, painter, projector } = this;
        //     // prep tiles
        //     const tiles = this.get_tiles();
        //     // if any changes, we paint new scene
        //     if (style.dirty || painter.dirty || projector.dirty) {
        //       // store for future draw that it was a "dirty" frame
        //       this.was_dirty_last_frame = true;
        //       // paint scene
        //       painter.paint(projector, tiles);
        //     }
        //     // draw the interactive elements if there was no movement/zoom change
        //     if (style.interactive && !projector.dirty && this.was_dirty_last_frame) {
        //       this.was_dirty_last_frame = false;
        //       painter.computeInteractive(tiles);
        //     }
        //     // cleanup
        //     painter.dirty = false;
        //     style.dirty = false;
        //     projector.dirty = false;
        todo!()
    }
}

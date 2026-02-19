// import Animator from './camera/animator.js';
// import Camera from './camera/index.js';

// import type { ColorMode } from 's2/s2Map.js';
// import type { UrlMap } from 'util/index.js';
// import type { UserTouchEvent } from './camera/drag_pan.js';
// import type { AnimationDirections, AnimationType } from './camera/animator.js';
// import type { Attributions, GPUType, LayerStyle, StyleDefinition, View } from 'style/style.spec.js';
// import type {
//   MapGLMessage,
//   RenderedMessageGL,
//   ScreenshotMessageGL,
//   SourceFlushMessage,
//   TileRequestMessage,
//   TileWorkerMessage,
// } from 'workers/worker.spec.js';
use crate::{
    s2map::ColorMode,
    style::{GPUType, LayerStyle, MapStyleInput, Projection, StyleDefinition},
    ui::{AnimationDirections, AnimationType, Camera, UserTouchEvent, View},
    util::UrlMap,
    workers::{
        MapID, NameIndex, NavControl, ResizeMessage, SourceName, TileWorkerMessage,
        TileWorkerMessageOutput,
    },
};
use alloc::{collections::BTreeMap, string::String, vec::Vec};
use s2_tilejson::Attributions;
use serde::{Deserialize, Serialize};
use wgpu::Surface;

/// # Map MapOptions
///
/// ## Description
///
/// User defined configuration options for the map.
///
/// At a minimum, you probably want to define a {@link StyleDefinition} and an HTML element `container`.
///
/// ex.
/// ```ts
/// import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
/// import type { MapOptions, StyleDefinition } from 's2maps-gpu';
///
/// // build a style guide of sources to fetch and layers to render
/// const style: StyleDefinition = { ... };
/// // setup options for the map
/// const options: MapOptions = {
///   container: 'map', // the ID of the HTML element to render the map into
///   // reference a canvas instead of a container:
///   // canvas: userPulledCanvasElement
///   style,
/// }
/// // Build the map
/// const map = new S2Map(options);
/// ```
///
/// ### Rendering Options
/// - `contextType`: [See {@link GPUType}] Forces the use of specific GPU Context:
///   - `1`: WebGL
///   - `2`: WebGL2
///   - `3`: WebGPU
/// - `offscreen`: Support OffscreenCanvas
/// - `canvas`: Reference a canvas instead of a container
/// - `container`: Can be a reference to an ID (string) or an HTMLElement
/// - `style`: See [`StyleDefinition`] Either the style definition or a string URL pointing to the location of the style definition
/// - `canvasMultiplier`: Control the number of fragments per pixel. [default: window.devicePixelRatio]
/// - `darkMode`: boolean flag. Enable dark mode. [default: false]
///
/// ### Control Options
/// - `interactive`: boolean flag.  If true, the map will be interactive with user mouse/keyboard/finger inputs; [default: true]
/// - `scrollZoom`: boolean flag. If true, allow user to use scroll wheel to zoom. [default: true]
/// - `positionalZoom`: boolean flag. If true, cursor position impacts zoom's x & y directions. [default: true]
/// - `controls`: boolean flag. If true, enable default controls; [default: true]
/// - `zoomController`: boolean flag. Display zoom controller state. [default: true]
/// - `compassController`: boolean flag. Display compass controller state. [default: true]
/// - `colorblindController`: boolean flag. Display colorblind controller state. [default: true]
/// - `can_zoom`: boolean flag. Enable zooming functionality. [default: true]
/// - `can_move`: boolean flag. Enable panning/moving functionality. [default: true]
/// - `noClamp`: boolean flag. Allow latitude and longitude to pass their limits (-90, 90) and (-180, 180) respectively [default: false]
///
/// ### Additional Options
/// - `hash`: If true, the map will update the URL Hash with it's current View. [default: false]
/// - `apiKey`: string. API key for the map service.
/// - `urlMap`: [See {@link UrlMap}] An API URL that remaps any source strings that start with "example://" to whatever example is
///    - example: `{ "apiURL": "https://api.opens2.com" }`
/// - `attributions`: Set additional attributions to be displayed on the map.
///    - example: `{ "OpenS2": "https://opens2.com/data" }`
/// - `attributionOff`: boolean flag. Disable attribution display. [default: false]
/// - `watermarkOff`: boolean flag. Disable watermark display. [default: false]
///
/// ### Required Options for rendering
/// - `style`: Use a [`StyleDefinition`] or href pointing to a JSON object [`StyleDefinition`].
/// - One of `canvas` or `container`
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct MapOptions {
    /**
     * Forces the use of specific GPU Context:
     * - `1`: WebGL
     * - `2`: WebGL2
     * - `3`: WebGPU
     */
    #[serde(rename = "contextType", skip_serializing_if = "Option::is_none")]
    pub context_type: Option<GPUType>,
    /** Support OffscreenCanvas. Defaults to false */
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offscreen: Option<bool>,
    /** Reference a canvas instead of a container */
    // TODO: How do we handle this?
    //   pub canvas?: HTMLCanvasElement;
    /** Can be a reference to an ID (string) or an HTMLElement */
    // TODO: How do we handle this?
    //   pub container?: string | HTMLElement;
    /** If true, the map will be interactive with user mouse/keyboard/finger inputs; [default: true] */
    pub interactive: Option<bool>,
    /**
     * If true, the map will update the URL Hash with it's current View.
     * e.g. `https://opens2.com/example/map#lon=0&lat=0&zoom=0&pitch=0&bearing=0`
     * [default: false]
     */
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<bool>,
    /** An API key will ensure control and ownership over data */
    #[serde(rename = "apiKey", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /**
     * An API URL that remaps any source strings that start with "apiURL://" to whatever apiURL is
     *
     * ex.
     *
     * ```json
     * {
     *  "apiURL": "https://api.opens2.com",
     *  "baseURL": "https://opens2.com"
     * }
     * ```
     */
    #[serde(rename = "urlMap", skip_serializing_if = "Option::is_none")]
    pub url_map: Option<UrlMap>,
    /** Either the style definition or a string URL pointing to the location of the style definition */
    pub style: MapStyleInput,
    /** If true, allow user to use scroll wheel to zoom. [default: true] */
    #[serde(rename = "scrollZoom", skip_serializing_if = "Option::is_none")]
    pub scroll_zoom: Option<bool>,
    /** If true, cursor position impacts zoom's x & y directions. [default: true] */
    #[serde(rename = "positionalZoom", skip_serializing_if = "Option::is_none")]
    pub positional_zoom: Option<bool>,
    /** Control the number of fragments per pixel. [default: window.devicePixelRatio] */
    #[serde(rename = "canvasMultiplier", skip_serializing_if = "Option::is_none")]
    pub canvas_multiplier: Option<f64>,
    /**
     * Set attributions for data. { [name: string]: URL string }
     *
     * ex.
     * ```json
     * {
     *   "OpenS2": "https://opens2.com/data"
     * }
     * ```
     */
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attributions: Option<Attributions>,
    /** Hide the attribution tag. [default: false] */
    #[serde(rename = "attributionOff", skip_serializing_if = "Option::is_none")]
    pub attribution_off: Option<bool>,
    /** Hide the logo. [default: false] */
    #[serde(rename = "watermarkOff", skip_serializing_if = "Option::is_none")]
    pub watermark_off: Option<bool>,
    /** zoom, compass, and colorblind turned on or off. [default: true] */
    #[serde(skip_serializing_if = "Option::is_none")]
    pub controls: Option<bool>,
    /** Display a zoom controller state. [default: true] */
    #[serde(rename = "zoomController", skip_serializing_if = "Option::is_none")]
    pub zoom_controller: Option<bool>,
    /** Display a compass controller state. [default: true] */
    #[serde(rename = "compassController", skip_serializing_if = "Option::is_none")]
    pub compass_controller: Option<bool>,
    /** Display a colorblind controller state. [default: true] */
    #[serde(rename = "colorblindController", skip_serializing_if = "Option::is_none")]
    pub colorblind_controller: Option<bool>,
    /** allow the user to zoom the map. [default: true] */
    #[serde(rename = "canZoom", skip_serializing_if = "Option::is_none")]
    pub can_zoom: Option<bool>,
    /** allow the user to move the map. [default: true] */
    #[serde(rename = "canMove", skip_serializing_if = "Option::is_none")]
    pub can_move: Option<bool>,
    /** display controls, info icon, etc. in a dark style. [default: false] */
    #[serde(rename = "darkMode", skip_serializing_if = "Option::is_none")]
    pub dark_mode: Option<bool>,
    /** Alow latitude and longitude to pass their limits (-90, 90) and (-180, 180) respectively. [default: false] */
    #[serde(rename = "noClamp", skip_serializing_if = "Option::is_none")]
    pub no_clamp: Option<bool>, // lat and lon can be any number
}

/**
 * # S2 Map UI
 *
 * Internal wrapper for the Camera.
 * Manages user APIs and inputs for user interactions to the map
 */
pub type S2MapUI = Camera;
impl S2MapUI {
    // API //

    /** Delete all tile cache, painter, and draw method */
    pub fn delete(&self) {
        //     // delete all tiles
        //     this.tileCache.deleteAll();
        //     // to ensure no more draws, set the draw method to a noop
        //     /** empty the draw method */
        //     this._draw = () => {
        //       /* noop */
        //     };
        //     // tell the painter to cleanup
        //     this.painter.delete();
        todo!()
    }

    /**
     * Jump to a specific location and zoom level
     * @param view - View to jump to
     */
    pub fn jump_to(&self, view: View) {
        //     // update the projectors position and render the update
        //     this.projector.set_view(view);
        //     this.render();
        todo!()
    }

    /**
     * Animate the map to a specific location and zoom level
     * @param type - Type of animation to perform
     * @param directions - Directions for the animation
     */
    pub fn animate_to(&self, r#type: AnimationType, directions: Option<AnimationDirections>) {
        //     // build animator
        //     const animator = new Animator(this.projector, directions);
        //     const render = type === 'flyTo' ? animator.flyTo() : animator.easeTo();
        //     if (!render) return;
        //     /**
        //      * set an animation function
        //      * @param now - Current time in milliseconds from start
        //      */
        //     this.curr_anim_function = (now: number): void => {
        //       this._animate(animator, now * 0.001);
        //     };
        //     // render it out
        //     this.render();
        todo!()
    }

    /**
     * Set the style of the map
     * @param style - Style to set
     * @param ignore_position - Ignore the current position of the map
     */
    pub async fn set_style(&self, style: MapStyleInput, ignore_position: bool) {
        //     await this._set_style(style, ignore_position);
        todo!()
    }

    /**
     * Update the style of the map
     * 1) update_style from the style object. return a list of "from->to" for tiles and "layerIDs" for webworkers
     * 2) remove tiles from tileCache not in view
     * 3) update the tileCache tiles using "from->to"
     * 4) if a layer "source", "layer", or "filter" change it will be in "webworkers". Tell webworkers to rebuild
     * @param _style - Style to update to
     */
    pub fn update_style(&self, _style: StyleDefinition) {
        // // build style for the map, painter, and webworkers
        // Style.update_style(style)
        // remove any tiles outside of view
        // this._resetTileCache([], false, true)
        // // update tileCache
        // this.tileCache.forEach(tile => { tile.update_style(Style) })
        // // inject minzoom and maxzoom
        // this._set_style(style, true)
        // // render our first pass
        // this.render()
        todo!()
    }

    /**
     * Clear the source data from all tiles
     * @param source_names - Names of sources to clear
     */
    pub fn clear_source(&self, source_names: Vec<String>) {
        //     // delete source data from all tiles
        //     this.tileCache.forEach((tile) => {
        //       tile.deleteSources(source_names);
        //     });
        //     // let the renderer know the painter is "dirty"
        //     this.painter.dirty = true;
        //     // rerender
        //     this.render();
        todo!()
    }

    /**
     * Reset the source data for all tiles
     * @param sources - Array of [sourceName, href] pairs
     * @param keep_cache - Whether to keep the tile cache
     * @param await_replace - Whether to await the replacement of the source data or clear the cache immediately
     */
    pub fn reset_source(
        &self,
        sources: Vec<SourceName>,
        keep_cache: Option<bool>,    // = false,
        await_replace: Option<bool>, // = false,
    ) {
        let keep_cache = keep_cache.unwrap_or(false);
        let await_replace = await_replace.unwrap_or(false);
        //     const { id: mapID, painter, webworker, parent } = this;
        //     const tileRequests = this._resetTileCache(
        //       sources.map((s) => s[0]),
        //       keep_cache,
        //       await_replace,
        //     );
        //     // Send off the tile request (by including source_names we are letting the
        //     // source worker know we only need to update THIS source)
        //     if (tileRequests.length > 0) {
        //       const msg: TileRequestMessage = { mapID, type: 'tilerequest', tiles: tileRequests, sources };
        //       if (webworker) postMessage(msg);
        //       else parent?.onMessage({ data: msg } as MessageEvent<TileRequestMessage>);
        //     }
        //     // let the renderer know the painter is "dirty"
        //     painter.dirty = true;
        //     // rerender
        //     this.render();
        todo!()
    }

    /**
     * Add a new style layer to the map
     * @param _layer - the style layer to add
     * @param _name_index - the index position to add the layer
     */
    pub fn add_layer(&self, _layer: LayerStyle, _name_index: Option<NameIndex>) {
        // TODO
        // // remove all tiles outside of view
        // const tileRequests = this._resetTileCache([], false, true)
        // // style needs to be updated on the change
        // Style.add_layer(layer, nameIndex, tileRequests)
        // // rerender
        // this.render()
        todo!()
    }

    /**
     * Delete a style layer from the map
     * @param _name_index - the index position to delete the layer
     */
    pub fn delete_layer(&self, _name_index: NameIndex) {
        // TODO
        // // style needs to be updated on the change
        // const index = Style.delete_layer(nameIndex)
        // // remove all instances of the layer in each tile
        // this.tileCache.forEach(tile => { tile.delete_layer(index) })
        // // rerender
        // this.render()
    }

    /**
     * Reorder style layers on the map
     * @param _layer_changes - the layer changes to make, their starting and end positions { [start]: end }
     */
    pub fn reorder_layers(&self, _layer_changes: BTreeMap<u32, u32>) {
        // TODO
        // // style needs to updated on the change
        // this.style.reorder_layers(layerChanges)
        // // update every tile
        // this.tileCache.forEach(tile => { tile.reorder_layers(layerChanges) })
        // // rerender
        // this.render()
        todo!()
    }

    /**
     * Update a style layer on the map
     * @param _layer - the layer to update
     * @param _name_index - the index position to update the layer
     * @param full_update - whether to update the layer completely or just the style
     */
    pub fn update_layer(
        &self,
        _layer: LayerStyle,
        _name_index: NameIndex,
        full_update: Option<bool>,
    ) {
        let full_update = full_update.unwrap_or(false);
        // TODO
    }

    /**
     * Set the move state (if true user can edit move, otherwise current move is locked in)
     * @param state - new state
     */
    pub fn set_move_state(&mut self, state: bool) {
        self.can_move = state;
    }

    /**
     * Set the zoom state (if true user can edit zoom, otherwise current zoom is locked in)
     * @param state - new state
     */
    pub fn set_zoom_state(&mut self, state: bool) {
        self.can_zoom = state;
    }

    /**
     * Handle on zoom case
     * @param delta_z - The change in zoom level
     * @param delta_x - The change in x position
     * @param delta_y - The change in y position
     */
    pub fn on_zoom(&mut self, delta_z: f64, delta_x: Option<f64>, delta_y: Option<f64>) {
        let delta_x = delta_x.unwrap_or(0.);
        let delta_y = delta_y.unwrap_or(0.);
        self.drag_pan.clear();
        if !self.can_zoom {
            return;
        }
        // TODO:
        // // remove any prexisting animations
        // self.curr_anim_function = None;
        // update projector
        self.projector.on_zoom(delta_z, delta_x, delta_y);
        // render
        self.render();
        todo!()
    }

    /**
     * Update bearing and/or pitch from compass change
     * @param bearing - the bearing avlue to update
     * @param pitch - the pitch value to update
     */
    pub fn update_compass(&self, bearing: f64, pitch: f64) {
        //     const { projector } = this;
        //     this.curr_anim_function = undefined;
        //     projector.set_view({
        //       bearing: projector.bearing + bearing,
        //       pitch: projector.pitch + pitch,
        //     });
        //     this.render();
        todo!()
    }

    /** Handle compass on mouseup. Snap to north or south if close enough */
    pub fn mouseup_compass(&self) {
        //     const { projector } = this;
        //     const { bearing } = projector;
        //     if (bearing === 0) return;
        //     const newBearing =
        //       bearing >= -10 && bearing <= 10
        //         ? 0
        //         : bearing <= -167.5
        //           ? -180
        //           : bearing >= 167.5
        //             ? 180
        //             : undefined;
        //     if (newBearing !== undefined) {
        //       const animator = new Animator(projector, { duration: 1, bearing: newBearing });
        //       animator.compassTo();
        //       /**
        //        * Set the current animation function
        //        * @param now - current time since start
        //        */
        //       this.curr_anim_function = (now: number) => {
        //         this._animate(animator, now * 0.001);
        //       };
        //       this.render();
        //     }
        todo!()
    }

    /** Reset the compass to north */
    pub fn reset_compass(&self) {
        //     const { projector } = this;
        //     const { bearing, pitch } = projector;
        //     // create the animator
        //     const duration = bearing !== 0 ? (bearing > 90 ? 1.75 : 1) : 1;
        //     const animator = new Animator(projector, {
        //       duration,
        //       bearing: 0,
        //       pitch: bearing !== 0 ? bearing : pitch,
        //     });
        //     animator.compassTo();
        //     /**
        //      * Set the current animation function
        //      * @param now - current time since start
        //      */
        //     this.curr_anim_function = (now: number): void => {
        //       this._animate(animator, now * 0.001);
        //     };
        //     // send off a render
        //     this.render();
        todo!()
    }

    /**
     * Resize the canvas
     * @param width - new width
     * @param height - new height
     */
    pub fn resize(&mut self, resize: ResizeMessage) {
        self.resize_queued = Some(resize);
        self.render();
    }

    /** Takes a screenshot and ships the uint8 buffer back to the parent */
    pub fn screenshot() {
        //     const { id: mapID, painter, parent, webworker } = this;
        //     requestAnimationFrame(() => {
        //       if (this._fully_rendered_screen()) {
        //         // assuming the screen is ready for a screen shot we ask for a draw
        //         void painter.getScreen().then((data) => {
        //           const screen = data.buffer;
        //           const msg: ScreenshotMessageGL = { mapID, type: 'screenshot', screen };
        //           if (webworker) postMessage(msg, [screen]);
        //           else parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        //         });
        //       } else {
        //         this.screenshot();
        //       }
        //     });
        todo!()
    }

    /**
     * Call this function to wait until the screen is fully rendered. A "rendered" message will be
     * sent back to the parent when the screen is fully rendered
     */
    pub fn await_fully_rendered(&self) {
        //     const { id: mapID, parent, webworker } = this;
        //     requestAnimationFrame(() => {
        //       if (this._fully_rendered_screen()) {
        //         const msg: RenderedMessageGL = { mapID, type: 'rendered' };
        //         if (webworker) postMessage({ type: 'rendered' });
        //         parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        //       } else {
        //         this.await_fully_rendered();
        //       }
        //     });
        todo!()
    }

    /**
     * Called when the screen is fully rendered with all source/layer data
     * @returns true if the screen is fully rendered
     */
    fn _fully_rendered_screen(&self) -> bool {
        //     // check tiles
        //     const tiles = this.getTiles();
        //     let fullyRendered = true;
        //     for (const tile of tiles) {
        //       if (tile.state === 'loading') {
        //         fullyRendered = false;
        //         break;
        //       }
        //     }
        //     // if the painter has a skybox, check it
        //     fullyRendered = this.painter.workflows.skybox?.ready ?? fullyRendered;

        //     return fullyRendered;
        todo!()
    }

    /**
     * some cases we can just do the work immediately, otherwise we do one job per frame
     * to improve performance. Data is stored in the injection queue while it waits for it's frame.
     * @param data - data to inject. Tile data resuls or a flush command (useful for clearing parent data or inverted fills, etc.)
     * (TileWorkerMessage | SourceFlushMessage)
     */
    pub fn inject_data(&self, data: TileWorkerMessageOutput) {
        //     if (data.type === 'flush') this._inject_data(data);
        //     else this.injection_queue.push(data);
        //     this.render();
        todo!()
    }

    // INPUT EVENTS //

    /**
     * set the colorblind mode
     * @param mode - colorblind mode
     */
    pub fn color_mode(&self, mode: ColorMode) {
        //     this.painter.setColorMode(mode);
        //     // force a re-render
        //     this.render();
        todo!()
    }

    /**
     * for interaction with features on the screen
     * @param x - x mouse position
     * @param y - y mouse position
     */
    pub fn on_canvas_mouse_move(&self, x: u32, y: u32) {
        //     if (!this._interactive) return;
        //     this._setMousePosition(x, y);
        //     this.mouseMoved = true;
        //     this.render();
        todo!()
    }

    /**
     * action when the user touches the screen
     * @param touches - collection of touch events
     */
    pub fn on_touch_start(&self, touches: UserTouchEvent) {
        //     this.drag_pan.on_touch_start(touches);
        //     if (!this._interactive || touches.length > 1) return;
        //     const { x, y } = touches[0];
        //     this._setMousePosition(x, y);
        //     this.mouseMoved = true;
        //     this.render();
        todo!()
    }

    /**
     * builtin navigation controller inputs
     * @param ctrl - 'zoomIn' | 'zoomOut'
     * @param lon - optional longitude
     * @param lat - optional latitude
     */
    pub fn nav_event(&self, ctrl: NavControl, lon: Option<f64>, lat: Option<f64>) {
        self._nav_event(ctrl, lon, lat);
    }

    // DRAW //

    /**
     * we don't want to over request rendering, so we render with a limiter to
     * safely call render as many times as we like
     */
    pub fn render(&mut self) {
        //     if (!this._canDraw) return;
        //     if (this.render_next_frame) return;
        //     this.render_next_frame = true;
        //     requestAnimationFrame((now: number) => {
        //       this.render_next_frame = false;
        //       // if timeCache exists, run animation function
        //       this.timeCache?.animate(now, this._updatePainter.bind(this) as () => void);
        //       // if animation currently exists, run it
        //       this.curr_anim_function?.(now);
        //       // if resize has been queued, we do so now
        //       if (this.resize_queued !== undefined) this._resize();
        //       // if there is data to 'inject', we make sure to render another frame later
        //       if (this.injection_queue.length > 0) {
        //         // pull out the latest data we received (think about it, the newest data is the most constructive)
        //         const data = this.injection_queue.pop();
        //         // tell the camera to inject data
        //         if (data !== undefined) this._inject_data(data);
        //         // setup another render queue
        //         this.render();
        //       }
        //       // get state of scene
        //       const projectorDirty = this.projector.dirty;
        //       // if the projector was dirty (zoom or movement) we run render again just incase
        //       if (projectorDirty) {
        //         this.render();
        //         this._onViewUpdate();
        //       }
        //       // run a draw, it will repaint framebuffers as necessary
        //       try {
        //         this._draw();
        //       } catch (e) {
        //         this._canDraw = false;
        //         throw e;
        //       }
        //       // if mouse movement, check feature at position
        //       if (this.mouseMoved && !projectorDirty) {
        //         this.mouseMoved = false;
        //         void this._onCanvasMouseMove();
        //       }
        //     });
        todo!()
    }
}

// import { isSafari, parseHash, setHash } from './util/index.js';

// import type { AnimationDirections } from './ui/camera/animator.js';
// import type { MapOptions } from './ui/s2mapUI.js';
// import type { MarkerDefinition } from './workers/source/markerSource.js';
// import type S2MapUI from './ui/s2mapUI.js';
// import type { UserTouchEvent } from './ui/camera/dragPan.js';
// import type {
//   Attributions,
//   GPUType,
//   LayerStyle,
//   StyleDefinition,
//   View,
// } from './style/style.spec.js';
// import type {
//   MapGLMessage,
//   MouseClickMessage,
//   MouseEnterMessage,
//   MouseLeaveMessage,
//   ResetSourceMessage,
//   SourceWorkerMessage,
//   TileWorkerMessage,
//   ViewMessage,
// } from './workers/worker.spec.js';

// export type * from './ui/s2mapUI.js';
// export type { MarkerDefinition } from './workers/source/markerSource.js';
// export type { AnimationDirections } from './ui/camera/animator.js';
// export type { UserTouchEvent } from './ui/camera/dragPan.js';

use crate::{
    style::{LayerStyle, StyleDefinition},
    ui::{AnimationDirections, MapOptions, RequiredView, S2MapUI, TouchEvent, TouchType, View},
    workers::{
        MapGLMessage, MapID, MapWorker, MarkerDefinition, NameIndex, NavControl, SourceName,
        TileWorkerMessageOutput,
    },
};
use alloc::collections::BTreeMap;
use s2json::{Attributions, Point};

/**
 * Color blind states
 * - 0: None
 * - 1: Protanopia
 * - 2: Deuteranopia
 * - 3: Tritanopia
 * - 4: Greyscale
 */
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq)]
pub enum ColorMode {
    /// None
    #[default]
    None = 0,
    /// Protanopia
    Protanopia = 1,
    /// Deuteranopia
    Deuteranopia = 2,
    /// Tritanopia
    Tritanopia = 3,
    /// Greyscale
    Greyscale = 4,
}

/**
 * # The S2 Map GPU Engine 🌎 🗺️
 *
 * ```text
 *   ad88888ba   ad888888b,    88b           d88
 *  d8"     "8b d8"     "88    888b         d888
 *  Y8,                 a8P    88`8b       d8'88
 *  `Y8aaaaa,        ,d8P"     88 `8b     d8' 88 ,adPPYYba, 8b,dPPYba,  ,adPPYba,
 *    `"""""8b,    a8P"        88  `8b   d8'  88 ""     `Y8 88P'    "8a I8[    ""
 *          `8b  a8P'          88   `8b d8'   88 ,adPPPPP88 88       d8  `"Y8ba,
 *  Y8a     a8P d8"            88    `888'    88 88,    ,88 88b,   ,a8" aa    ]8I
 *   "Y88888P"  88888888888    88     `8'     88 `"8bbdP"Y8 88`YbbdP"'  `"YbbdP"'
 *                                                          88
 *                                                          88
 * ```
 *
 * ## Description
 *
 * Both an **S2** and **WM** Projection Map Engine Powered by `WebGL1`, `WebGL2`, and `WebGPU`.
 *
 * ### Basic JS/TS example:
 * Note that the most important components to build a map are the {@link MapOptions} and the {@link StyleDefinition}.
 * ```ts
 * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
 * import type { MapOptions, StyleDefinition } from 's2maps-gpu';
 *
 * // build a style guide of sources to fetch and layers to render
 * const style: StyleDefinition = { ... };
 * // setup options for the map
 * const options: MapOptions = {
 *   container: 'map', // the ID of the HTML element to render the map into
 *   // You can reference a canvas instead of a container:
 *   // canvas: userPulledCanvasElement
 *   style,
 * };
 * // Build the map
 * const map = new S2Map(options);
 * ```
 *
 * ### HTML Example
 * ```html
 * <!DOCTYPE html>
 * <html lang="en">
 *   <head>
 *     <meta charset="utf-8" />
 *     <title>Display a map</title>
 *     <meta name="viewport" content="initial-scale=1,width=device-width" />
 *     <!-- import s2maps-gpu. BE SURE TO CHECK AND UPDATE TO LATEST VERSION -->
 *     <script src="https://opens2.com/s2maps-gpu/v0.18.0/s2maps-gpu.min.js" crossorigin="anonymous"></script>
 *     <link rel="stylesheet" href="https://opens2.com/s2maps-gpu/v0.18.0/s2maps-gpu.min.css" />
 *   </head>
 *   <body>
 *     <div id="map"></div>
 *     <script>
 *       // grab container div
 *       const container = document.getElementById('map');
 *       // setup map style
 *       const style = { ... };
 *       // create the map
 *       const map = new S2Map({ style, container });
 *     </script>
 *   </body>
 * </html>
 * ```
 *
 * ## Events
 * - `ready`: fired when the map is ready to be interacted with / make API calls. Ships this map {@link S2Map}
 * - `mouseleave`: fired when the mouse leaves the map. Ships {@link MouseLeaveMessage}
 * - `mouseenter`: fired when the mouse enters the map. Ships {@link MouseEnterMessage}
 * - `click`: fired when the user clicks on the map. Ships {@link MouseClickMessage}
 * - `view`: fired when the map view changes. Ships {@link ViewMessage}
 * - `screenshot`: fired as a result of a screenshot that was requested. Ships a `Uint8ClampedArray`
 * - `rendered`: fired when the map is fully rendered.
 * - `delete`: fired to ping that the map is deleting itself.
 *
 * ## API
 * - {@link S2Map.set_dark_mode}: Update the state of the map's UI mode. True for dark-mode, false for light-mode
 * - {@link S2Map.get_container}: Get the HTML element that the map is rendered into
 * - {@link S2Map.get_canvas_container}: Get the HTML element that the map's canvas is rendered into
 * - {@link S2Map.get_container_dimensions}: Get the dimensions of the map's container as a `[width, height]` tuple
 * - {@link S2Map.set_style}: Set a new style, replacing the current one if it exists
 * - {@link S2Map.update_style}: Update the map's current style with new attributes, by checking for changes and updating accordingly
 * - {@link S2Map.set_move_state}: Update the users ability to move the map around or not.
 * - {@link S2Map.set_zoom_state}: Update the users ability to zoom the map in and out or not.
 * - {@link S2Map.get_view}: Get the current projector's view of the world
 * - {@link S2Map.jump_to}: Jump to a specific location's longitude, latitude, and optionally zoom
 * - {@link S2Map.ease_to}: Use an easing function to travel to a specific location's longitude, latitude, and optionally zoom
 * - {@link S2Map.fly_to}: Use an easing function to fly to a specific location's longitude, latitude, and optionally zoom
 * - {@link S2Map.add_source}: Add a new source to the map. Sources are references to data and how to fetch it.
 * - {@link S2Map.update_source}: Update a source already added to the map and control the method the map updates the source
 * - {@link S2Map.reset_source}: Reset a source's data already added to the map and control the method the map updates the source
 * - {@link S2Map.delete_source}: Delete a source's data from the map
 * - {@link S2Map.add_layer}: Add a new style layer to the map
 * - {@link S2Map.update_layer}: Update the an existing style layer in a map given the layer's name or index
 * - {@link S2Map.delete_layer}: Delete an existing style layer in a map given the layer's name or index
 * - {@link S2Map.reorder_layers}: Reorder layers in the map.
 * - {@link S2Map.add_marker}: Add new marker(s) to the map
 * - {@link S2Map.remove_marker}: Delete a marker or collection of markers from the map
 * - {@link S2Map.screenshot}: Take a screenshot of the current state of the map. Returns the screenshot as a `Uint8ClampedArray`
 * - {@link S2Map.await_fully_rendered}: Async function to wait for the map to have all source and layer data rendered to the screen
 * - {@link S2Map.delete}: Delete the map instance and cleanup all it's resources
 *
 * ## Future API
 * - `getBounds` & `setBounds`
 * - `setProjection` & `getProjection`
 * - `getStyle`
 *
 * ## Converters
 * - MapLibre Map Options Converter: See {@link plugins.convertMaplibreOptions}
 * - MapLibre Style Converter: See {@link plugins.convertMaplibreStyle}
 *
 * ## Plugins
 * - Sync map movements between multiple maps: See {@link plugins.syncMove}
 */
#[derive(Debug)]
pub struct S2Map {
    // extends EventTarget {
    //   readonly _container?: HTMLElement;
    //   _canvas_container!: HTMLElement;
    canvas_multiplier: f64,
    //   readonly _canvas: HTMLCanvasElement;
    //   _attribution_popup?: HTMLDivElement;
    //   _compass?: HTMLElement;
    //   _color_blind?: HTMLElement;
    attributions: Attributions,
    /// Bearing in degrees
    pub bearing: f64, // = 0; // degrees
    /// Pitch in degrees
    pub pitch: f64, // = 0; // degrees
    /// Color mode
    pub color_mode: ColorMode, // = 0;
    map: Option<S2MapUI>,
    hash: bool, // = false;
    offscreen: Option<MapWorker>,
    /// The id of the map
    pub id: MapID,
    is_native: bool, // = false;
    is_ready: bool,  // = false;
}
impl S2Map {
    /** @param options - map options */
    pub fn new(
        window: &winit::window::Window,
        options: Option<MapOptions>,
        //     options: MapOptions = {
        //       canvas_multiplier: window.devicePixelRatio ?? 2,
        //       interactive: true,
        //       style: {},
        //     },
    ) -> Self {
        //     super();
        //     options.canvas_multiplier = this._canvas_multiplier = Math.max(2, options.canvas_multiplier ?? 2);
        //     // set hash if necessary
        //     if (options.hash === true) {
        //       this.hash = true;
        //       // TODO: get this working even if style is a string
        //       if (typeof options.style === 'object')
        //         options.style.view = { ...options.style.view, ...parseHash() };
        //     }
        //     // get the container if we don't already have a canvas instance
        //     if (options.canvas === undefined) {
        //       if (typeof options.container === 'string') {
        //         const container = window.document.getElementById(options.container);
        //         if (container === null) throw new Error('Container not found.');
        //         this._container = container;
        //       } else if (options.container instanceof HTMLElement) {
        //         this._container = options.container;
        //       } else if (options.canvas === undefined) {
        //         throw new Error('Invalid type: "container" must be a String or HTMLElement.');
        //       }
        //     }
        //     // we now remove container from options for potential webworker
        //     delete options.container;
        //     // prep container, creating the canvas
        //     this._canvas = options.canvas ?? this._setup_container(options);
        //     if ('node' in this._canvas) this.is_native = true;
        //     // create map via a webworker if possible, otherwise just load it in directly
        //     void this._setup_canvas(this._canvas, options);
        todo!()
    }

    //   /**
    //    * Add an event listener overriding the original
    //    * @param type - type of event called
    //    * @param listener - event listener
    //    * @param options - event listener options
    //    */
    //   override addEventListener(
    // &self
    //     type: string,
    //     listener: EventListenerOrEventListenerObject,
    //     options?: boolean | AddEventListenerOptions,
    //   ): void {
    //     const { is_ready } = this;
    //     // Call the original addEventListener method
    //     super.addEventListener(type, listener, options);
    //     // there are cases where the map loads so quickly that the ready event is missed
    //     // before the listener is added, so we need to check if the map was already ready
    //     if (type === 'ready' && is_ready) {
    //       this.dispatchEvent(new CustomEvent('ready', { detail: this }));
    //     }
    //   }

    // BUILD/CONSTRUCTION FUNCTIONS //

    /** Interal ready function. Let the user know that the map is ready. */
    fn _ready(&self) {
        //     this.is_ready = true;
        //     this._on_canvas_ready();
        //     this.dispatchEvent(new CustomEvent('ready', { detail: this }));
        todo!()
    }

    //   /**
    //    * Setup the container
    //    * @param options - MapOptions
    //    * @returns the canvas container element
    //    */
    //   _setup_container(&self, options: MapOptions) -> HTMLCanvasElement {
    //     if (this._container === undefined) throw new Error('Container not found.');
    //     // prep container
    //     const container = this._container;
    //     container.classList.add('s2-map');
    //     this.set_dark_mode(options.darkMode);
    //     // build canvas-container
    //     const canvasContainer = (this._canvas_container = window.document.createElement('div'));
    //     canvasContainer.className = 's2-canvas-container';
    //     container.prepend(canvasContainer);
    //     // build canvas
    //     const canvas = window.document.createElement('canvas');
    //     canvas.className = 's2-canvas';
    //     canvas.setAttribute('tabindex', '0');
    //     canvas.setAttribute('aria-label', 'S2Map');
    //     canvas.width = container.clientWidth * this._canvas_multiplier;
    //     canvas.height = container.clientHeight * this._canvas_multiplier;
    //     canvasContainer.appendChild(canvas);

    //     return canvas;
    //   }

    /**
     * Setup the canvas, workers, etc.
     * @param canvas - HTMLCanvasElement
     * @param options - MapOptions
     */
    async fn _setup_canvas(&self, canvas: wgpu::Surface<'static>, options: MapOptions) {
        //     const isBrowser = options.canvas === undefined;
        //     // prep the ready function should it exist
        //     // prep webgpu/webgl type
        //     if (isBrowser && options.contextType === undefined) options.contextType = getContext();
        //     // if browser supports it, create an instance of the mapWorker
        //     // TODO: Safari offscreenCanvas sucks currently. It's so janky. Leave this here for when it's fixed.
        //     if (
        //       options.offscreen !== false &&
        //       options.contextType !== 0 &&
        //       !isSafari(window) &&
        //       typeof canvas.transferControlToOffscreen === 'function'
        //     ) {
        //       const offscreenCanvas = canvas.transferControlToOffscreen();
        //       const mapWorker = (this.offscreen = new Worker(
        //         new URL('./workers/map.worker', import.meta.url),
        //         { name: 'map-worker', type: 'module' },
        //       ));
        //       mapWorker.onmessage = this.on_message.bind(this);
        //       mapWorker.postMessage({ type: 'canvas', options, canvas: offscreenCanvas, id: this.id }, [
        //         offscreenCanvas,
        //       ]);
        //     } else {
        //       const Map = await import('./ui/s2mapUI.js').then((m) => m.default);
        //       this.map = new Map(options, canvas, this.id, this);
        //     }
        //     // now that canvas is setup, add control containers as necessary
        //     this._setup_control_container(options);
        //     // if we interact with the map, we need to both allow interaction with styling
        //     // and watch how the mouse moves on the canvas
        //     const canvasContainer = this._canvas_container;
        //     if (options.interactive ?? true) {
        //       canvasContainer.classList.add('s2-interactive');
        //       canvasContainer.addEventListener(
        //         'mousemove',
        //         this.#onCanvasMouseMove.bind(this) as (e: MouseEvent) => void,
        //       );
        //       canvasContainer.addEventListener(
        //         'contextmenu',
        //         this.#onCompassMouseDown.bind(this) as (e: MouseEvent) => void,
        //       );
        //       canvasContainer.addEventListener(
        //         'mouseleave',
        //         this._on_canvas_mouse_leave.bind(this) as () => void,
        //       );
        //       if (options.scrollZoom ?? true)
        //         canvasContainer.addEventListener(
        //           'wheel',
        //           this.#onScroll.bind(this) as (e: WheelEvent) => void,
        //         );
        //       canvasContainer.addEventListener(
        //         'mousedown',
        //         this.#onMouseDown.bind(this) as (e: MouseEvent) => void,
        //       );
        //       canvasContainer.addEventListener('touchstart', (e: TouchEvent) => {
        //         this._on_touch(e, 'touchstart');
        //       });
        //       canvasContainer.addEventListener('touchend', (e: TouchEvent) => {
        //         this._on_touch(e, 'touchend');
        //       });
        //       canvasContainer.addEventListener('touchmove', (e: TouchEvent) => {
        //         this._on_touch(e, 'touchmove');
        //       });
        //     }
        todo!()
    }

    /** If mouse leaves the canvas, clear out any features considered "active" */
    fn _on_canvas_mouse_leave(&self) {
        //     this._canvas.style.cursor = 'default';
        //     this.dispatchEvent(new CustomEvent('mouseleave', { detail: null }));
        todo!()
    }

    /**
     * Internal setup the control containers
     * @param options - map options
     */
    fn _setup_control_container(&self, options: &MapOptions) {
        //     const {
        //       attributions,
        //       controls,
        //       zoomController,
        //       compassController,
        //       colorblindController,
        //       attributionOff,
        //       watermarkOff,
        //     } = options;
        //     if (this.is_native) return;
        //     // add info bar with our jollyRoger
        //     if (attributionOff !== true) {
        //       const attribution = window.document.createElement('div');
        //       attribution.id = 's2-attribution';
        //       const info = window.document.createElement('div');
        //       info.className = info.id = 's2-info';
        //       /** Handle click on info bar */
        //       info.onclick = function () {
        //         attribution.classList.toggle('show');
        //       };
        //       const popup = (this._attribution_popup = window.document.createElement('div'));
        //       popup.className = 's2-popup-container';
        //       popup.innerHTML =
        //         '<div>Rendered with ❤ by</div><a href="https://opens2.com" target="popup"><div class="s2-jolly-roger"></div></a>';
        //       // add attributions
        //       if (attributions !== undefined) {
        //         for (const name in attributions) {
        //           if (this.#attributions[name] === undefined) {
        //             this.#attributions[name] = attributions[name];
        //             popup.innerHTML += `<div><a href="${attributions[name]}" target="_popup">${name}</a></div>`;
        //           }
        //         }
        //       }
        //       attribution.appendChild(info);
        //       attribution.appendChild(popup);
        //       // add watermark
        //       if (watermarkOff !== true) {
        //         const watermark = window.document.createElement('a');
        //         watermark.className = 's2-watermark';
        //         watermark.href = 'https://opens2.com';
        //         watermark.target = '_popup';
        //         attribution.appendChild(watermark);
        //       }
        //       this._container?.appendChild(attribution);
        //     }
        //     // if zoom or compass controllers, add
        //     if (controls !== false) {
        //       let navSep;
        //       let firstNavCompSet = false;
        //       // first create the container
        //       const navigationContainer = window.document.createElement('div');
        //       navigationContainer.className = 's2-nav-container';
        //       this._container?.appendChild(navigationContainer);
        //       if (zoomController !== false) {
        //         // plus
        //         const zoomPlus = window.document.createElement('button');
        //         zoomPlus.className = 's2-control-button s2-zoom-plus';
        //         zoomPlus.setAttribute('aria-hidden', '');
        //         zoomPlus.tabIndex = -1;
        //         navigationContainer.appendChild(zoomPlus);
        //         zoomPlus.addEventListener('click', () => {
        //           this._nav_event('zoomIn');
        //         });
        //         // seperator
        //         firstNavCompSet = true;
        //         navSep = window.document.createElement('div');
        //         navSep.className = 's2-nav-sep';
        //         navigationContainer.appendChild(navSep);
        //         // minus
        //         const zoomMinus = window.document.createElement('button');
        //         zoomMinus.className = 's2-control-button s2-zoom-minus';
        //         zoomMinus.setAttribute('aria-hidden', '');
        //         zoomMinus.tabIndex = -1;
        //         navigationContainer.appendChild(zoomMinus);
        //         zoomMinus.addEventListener('click', () => {
        //           this._nav_event('zoomOut');
        //         });
        //       }
        //       if (compassController !== false) {
        //         if (!firstNavCompSet) {
        //           firstNavCompSet = true;
        //         } else {
        //           // seperator
        //           navSep = window.document.createElement('div');
        //           navSep.className = 's2-nav-sep';
        //           navigationContainer.appendChild(navSep);
        //         }
        //         // compass button
        //         const compassContainer = window.document.createElement('button');
        //         compassContainer.className = 's2-control-button';
        //         compassContainer.setAttribute('aria-hidden', '');
        //         compassContainer.tabIndex = -1;
        //         navigationContainer.appendChild(compassContainer);
        //         const compass = (this._compass = window.document.createElement('div'));
        //         compass.className = 's2-compass';
        //         compass.setAttribute('aria-hidden', '');
        //         compass.tabIndex = -1;
        //         compassContainer.appendChild(compass);
        //         compassContainer.addEventListener(
        //           'mousedown',
        //           this.#onCompassMouseDown.bind(this) as (e: MouseEvent) => void,
        //         );
        //       }
        //       if (colorblindController !== false) {
        //         if (!firstNavCompSet) {
        //           firstNavCompSet = true;
        //         } else {
        //           // seperator
        //           navSep = window.document.createElement('div');
        //           navSep.className = 's2-nav-sep';
        //           navigationContainer.appendChild(navSep);
        //         }
        //         // colorblind button
        //         const colorBlind = (this._color_blind = window.document.createElement('button'));
        //         colorBlind.className = 's2-control-button s2-colorblind-button';
        //         colorBlind.id = 's2-colorblind-default';
        //         colorBlind.setAttribute('aria-hidden', '');
        //         colorBlind.tabIndex = -1;
        //         navigationContainer.appendChild(colorBlind);
        //         colorBlind.addEventListener('click', () => {
        //           this._set_color_mode();
        //         });
        //       }
        //     }
        todo!()
    }

    // INTERNAL API //

    /**
     * Inject data into the map
     * Used by the WorkerPool.
     * Anytime a Source worker or Tile Worker has data to inject into the map,
     * it will call this function.
     * @param data - The data to inject (SourceWorkerMessage | TileWorkerMessage)
     * @internal
     */
    pub fn inject_data(&self, data: TileWorkerMessageOutput) {
        //     const { type } = data;
        //     const { map, offscreen } = this;
        //     if (type === 'attributions') {
        //       this._add_attributions(data.attributions);
        //     } else if (type === 'set_style') {
        //       void this.set_style(data.style, data.ignore_position);
        //     } else if (offscreen !== undefined) {
        //       if (type === 'fill')
        //         offscreen.postMessage(data, [
        //           data.vertexBuffer,
        //           data.indexBuffer,
        //           data.idBuffer,
        //           data.codeTypeBuffer,
        //           data.featureGuideBuffer,
        //         ]);
        //       else if (type === 'line')
        //         offscreen.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer]);
        //       else if (type === 'glyph')
        //         offscreen.postMessage(data, [
        //           data.glyphFilterBuffer,
        //           data.glyphFilterIDBuffer,
        //           data.glyphQuadBuffer,
        //           data.glyphQuadIDBuffer,
        //           data.glyphColorBuffer,
        //           data.featureGuideBuffer,
        //         ]);
        //       else if (type === 'glyphimages')
        //         offscreen.postMessage(data, data.images.map((i) => i.data) as Transferable[]);
        //       else if (type === 'spriteimage') offscreen.postMessage(data, [data.image as Transferable]);
        //       else if (type === 'raster') offscreen.postMessage(data, [data.image as Transferable]);
        //       else if (type === 'point')
        //         offscreen.postMessage(data, [data.vertexBuffer, data.idBuffer, data.featureGuideBuffer]);
        //       else if (type === 'heatmap')
        //         offscreen.postMessage(data, [
        //           data.vertexBuffer,
        //           data.weightBuffer,
        //           data.featureGuideBuffer,
        //         ]);
        //       else if (type === 'interactive')
        //         offscreen.postMessage(data, [data.interactiveGuideBuffer, data.interactiveDataBuffer]);
        //       else offscreen.postMessage(data);
        //     } else if (map !== undefined) {
        //       map.inject_data(data);
        //     }
        todo!()
    }

    /**
     * Used by the MapUI either from a thread or directly. to either
     * send messages to Source/Tile Workers or to the user.
     * @param message - The message to process
     * @internal
     */
    pub fn on_message(&self, message: MapGLMessage) {
        //     const { data } = message;
        //     const { mapID, type } = data;
        //     if (type === 'tilerequest') {
        //       window.S2WorkerPool.tileRequest(mapID, data.tiles, data.sources);
        //     } else if (type === 'timerequest') {
        //       window.S2WorkerPool.timeRequest(mapID, data.tiles, data.source_names);
        //     } else if (type === 'mouseenter') {
        //       const { features } = data;
        //       this._canvas.style.cursor = features[0]?.__cursor ?? 'default';
        //       this.dispatchEvent(new CustomEvent('mouseenter', { detail: data as MouseEnterMessage }));
        //     } else if (type === 'mouseleave') {
        //       const { currentFeatures } = data;
        //       if (currentFeatures.length === 0) this._canvas.style.cursor = 'default';
        //       this.dispatchEvent(new CustomEvent('mouseleave', { detail: data as MouseLeaveMessage }));
        //     } else if (type === 'click') {
        //       this.dispatchEvent(new CustomEvent('click', { detail: data as MouseClickMessage }));
        //     } else if (type === 'view') {
        //       if (this.hash) setHash(data.view);
        //       this.dispatchEvent(new CustomEvent('view', { detail: data as ViewMessage }));
        //     } else if (type === 'requestStyle') {
        //       window.S2WorkerPool.requestStyle(mapID, data.style, data.analytics, data.apiKey);
        //     } else if (type === 'style') {
        //       window.S2WorkerPool.injectStyle(mapID, data.style);
        //     } else if (type === 'updateCompass') {
        //       this._updateCompass(data.bearing, data.pitch);
        //     } else if (type === 'add_layer') {
        //       window.S2WorkerPool.add_layer(mapID, data.layer, data.index, data.tileRequest);
        //     } else if (type === 'delete_layer') {
        //       window.S2WorkerPool.delete_layer(mapID, data.index);
        //     } else if (type === 'reorder_layers') {
        //       window.S2WorkerPool.reorder_layers(mapID, data.layer_changes);
        //     } else if (type === 'screenshot') {
        //       this.dispatchEvent(
        //         new CustomEvent('screenshot', { detail: new Uint8ClampedArray(data.screen) }),
        //       );
        //     } else if (type === 'rendered') {
        //       this.dispatchEvent(new Event('rendered'));
        //     } else if (type === 'ready') {
        //       this._ready();
        //     }
        todo!()
    }

    // INTERNAL FUNCTIONS //

    /** internal function to handle canvas ready */
    fn _on_canvas_ready(&self) {
        //     // set color mode
        //     const mode = parseInt(localStorage.getItem('s2maps:gpu:colorBlindMode') ?? '0') as ColorMode;
        //     this._set_color_mode(mode);
        //     // now that canvas is setup, support resizing
        //     if (this._container !== undefined && 'ResizeObserver' in window) {
        //       new ResizeObserver(this.#resize.bind(this) as () => void).observe(this._container);
        //     } else window.addEventListener('resize', this.#resize.bind(this) as () => void);
        //     // let the S2WorkerPool know of this maps existance
        //     window.S2WorkerPool.addMap(this);
        todo!()
    }

    /**
     * Internal function to add missing attribution data.
     * @param attributions - Attributions object to inject into grouped attributions container
     */
    fn _add_attributions(&self, attributions: Option<Attributions>) {
        let attributions = attributions.unwrap_or_default();
        //     if (this._attribution_popup !== undefined) {
        //       for (const name in attributions) {
        //         if (this.#attributions[name] === undefined) {
        //           this.#attributions[name] = attributions[name];
        //           this._attribution_popup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`;
        //         }
        //       }
        //     }
        todo!()
    }

    /**
     * Internal function to handle touch events
     * @param event - touch event
     * @param type - type of touch event
     */
    fn _on_touch(&self, event: TouchEvent, r#type: TouchType) {
        //     const { map, offscreen } = this;
        //     const canvasContainer = this._canvas_container;
        //     event.preventDefault();
        //     const { touches } = event;
        //     const { length } = touches;
        //     const touchEvent: UserTouchEvent = { length };

        //     for (let i = 0; i < length; i++) {
        //       const { clientX, clientY, pageX, pageY } = touches[i];
        //       const x = (pageX - canvasContainer.offsetLeft) * this._canvas_multiplier;
        //       const y = (pageY - canvasContainer.offsetTop) * this._canvas_multiplier;
        //       touchEvent[i] = { clientX, clientY, x, y };
        //     }
        //     offscreen?.postMessage({ type, touchEvent });
        //     if (map !== undefined) {
        //       if (type === 'touchstart') map.onTouchStart(touchEvent);
        //       else if (type === 'touchend') map.dragPan.onTouchEnd(touchEvent);
        //       else if (type === 'touchmove') map.dragPan.onTouchMove(touchEvent);
        //     }
        todo!()
    }

    //   /**
    //    * Internal function to handle scroll events
    //    * @param event - wheel event
    //    */
    //   #onScroll(&self, event: WheelEvent): void {
    //     event.preventDefault();
    //     const { map, offscreen } = this;
    //     const { clientX, clientY, deltaY } = event;
    //     const rect = this._canvas.getBoundingClientRect();
    //     offscreen?.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY });
    //     map?.onZoom(deltaY, clientX - rect.left, clientY - rect.top);
    //   }

    //   /**
    //    * Internal function to handle mouse down event
    //    * @param event - mouse down event
    //    */
    //   #onMouseDown(&self, event: MouseEvent): void {
    //     if (event.button !== 0) return;
    //     const { map, offscreen } = this;
    //     // send off a mousedown
    //     offscreen?.postMessage({ type: 'mousedown' });
    //     map?.dragPan.onMouseDown();
    //     // build a listener to mousemovement
    //     const mouseMoveFunc: (e: MouseEvent) => void = this.#onMouseMove.bind(this);
    //     window.addEventListener('mousemove', mouseMoveFunc);
    //     // upon eventual mouseup, let the map know
    //     window.addEventListener(
    //       'mouseup',
    //       (e) => {
    //         const rect = this._canvas.getBoundingClientRect();
    //         const { clientX, clientY } = e;
    //         window.removeEventListener('mousemove', mouseMoveFunc);
    //         offscreen?.postMessage({ type: 'mouseup', clientX, clientY, rect });
    //         map?.dragPan.onMouseUp(
    //           clientX - rect.left - rect.width / 2,
    //           rect.height / 2 - clientY - rect.top,
    //         );
    //       },
    //       { once: true },
    //     );
    //   }

    //   /**
    //    * Internal function to handle mouse move
    //    * @param event - mouse move event
    //    */
    //   #onMouseMove(&self, event: MouseEvent): void {
    //     const { map, offscreen } = this;
    //     let { movementX, movementY } = event;
    //     movementX *= this._canvas_multiplier;
    //     movementY *= this._canvas_multiplier;
    //     offscreen?.postMessage({ type: 'mousemove', movementX, movementY });
    //     map?.dragPan.onMouseMove(movementX, movementY);
    //   }

    //   /**
    //    * Internal function to handle mouse move event inside the canvas
    //    * @param event - mouse move event
    //    */
    //   #onCanvasMouseMove(&self, event: MouseEvent): void {
    //     const { map, offscreen } = this;
    //     const { layerX, layerY } = getLayerCoordinates(event);
    //     const x = layerX * this._canvas_multiplier;
    //     const y = layerY * this._canvas_multiplier;

    //     offscreen?.postMessage({ type: 'canvasmousemove', x, y });
    //     map?.onCanvasMouseMove(x, y);
    //   }

    //   /**
    //    * Internal function to handle compass update. Expands upon camera compass update
    //    * @param bearing - compass bearing
    //    * @param pitch - compass pitch
    //    * @internal
    //    */
    //   _updateCompass(&self, bearing: number, pitch: number): void {
    //     this.bearing = -bearing;
    //     this.pitch = pitch;
    //     if (this._compass !== undefined) {
    //       this._compass.style.transform = `translate(-50%, -50%) rotate(${this.bearing}deg)`;
    //     }
    //   }

    //   /**
    //    * Internal function to handle mouse pressed down on the compass
    //    * @param event - mouse down event
    //    */
    //   #onCompassMouseDown(&self, event: MouseEvent): void {
    //     event.preventDefault();
    //     const { map, offscreen } = this;
    //     const { abs } = Math;
    //     let totalMovementX = 0;
    //     let totalMovementY = 0;
    //     /**
    //      * Temp function to handle mouse movement while mouse is pressed on the compass
    //      * @param mEvent - mouse move event
    //      */
    //     const mouseMoveFunc = (mEvent: MouseEvent): void => {
    //       const { movementX, movementY } = mEvent;
    //       if (movementX !== 0) {
    //         totalMovementX += abs(movementX);
    //         totalMovementY += abs(movementY);
    //         offscreen?.postMessage({ type: 'updateCompass', bearing: movementX, pitch: movementY });
    //         map?.updateCompass(movementX, movementY);
    //       }
    //     };
    //     window.addEventListener('mousemove', mouseMoveFunc);
    //     window.addEventListener(
    //       'mouseup',
    //       () => {
    //         window.removeEventListener('mousemove', mouseMoveFunc);
    //         if (totalMovementX === 0 && totalMovementY === 0) {
    //           offscreen?.postMessage({ type: 'resetCompass' });
    //           map?.resetCompass();
    //         } else {
    //           offscreen?.postMessage({ type: 'mouseupCompass' });
    //           map?.mouseupCompass();
    //         }
    //       },
    //       { once: true },
    //     );
    //   }

    //   // #onCompassClick (): void {
    //   //   const { map, offscreen } = this
    //   //   offscreen?.postMessage({ type: 'resetCompass' })
    //   //   map?.resetCompass()
    //   // }

    /** resize the map */
    fn _resize(&self) {
        // const { map, offscreen } = this;
        // const container = this._container;
        // if (container === undefined) return;
        // const canvas_multiplier = this._canvas_multiplier;
        // // rebuild the proper width and height using the container as a guide
        // offscreen?.postMessage({
        //   type: 'resize',
        //   width: container.clientWidth * canvas_multiplier,
        //   height: container.clientHeight * canvas_multiplier,
        // });
        // map?.resize(
        //   container.clientWidth * canvas_multiplier,
        //   container.clientHeight * canvas_multiplier,
        // );
        todo!()
    }

    /**
     * Internal function to handle zoom in and zoom out events
     * @param ctrl - 'zoomIn' | 'zoomOut'
     */
    fn _nav_event(&self, ctrl: NavControl) {
        //     const { map, offscreen } = this;
        //     offscreen?.postMessage({ type: 'nav', ctrl });
        //     map?.navEvent(ctrl);
        todo!()
    }

    /**
     * Internal function to set the colorblind mode
     * @param mode - colorblind mode
     */
    fn _set_color_mode(&self, mode: Option<ColorMode>) {
        //     const { map, offscreen } = this;
        //     if (mode !== undefined) this.color_mode = mode;
        //     else this.color_mode++;
        //     if (this.color_mode > 4) this.color_mode = 0;
        //     localStorage.setItem('s2maps:gpu:colorBlindMode', String(this.color_mode));
        //     // update the icon
        //     const cM = this.color_mode;
        //     if (this._color_blind !== undefined)
        //       this._color_blind.id = `s2-colorblind${cM === 0 ? '-default' : cM === 1 ? '-proto' : cM === 2 ? '-deut' : cM === 3 ? '-trit' : '-grey'}`;
        //     // tell the map to update
        //     offscreen?.postMessage({ type: 'color_mode', mode: cM });
        //     map?.color_mode(cM);
        todo!()
    }

    // API //

    /**
     * Update the state of the map's UI mode.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., darkMode: false };
     * const map = new S2Map(options);
     * // do something with the map
     * map.set_dark_mode(true);
     * ```
     * @param state - which UI mode to set the map to. `true` for dark-mode, `false` for light-mode
     */
    pub fn set_dark_mode(&self, state: Option<bool>) {
        let state = state.unwrap_or(false);
        //     const classList = this._container?.classList;
        //     if (state) classList?.add('dark-mode');
        //     else classList?.remove('dark-mode');
        todo!()
    }

    //   /**
    //    * Get the HTML element that the map is rendered into
    //    * @returns The HTML element
    //    */
    //   pub fn get_container(&self) -> Option<HTMLElement> {
    //     return this._container;
    //   }

    //   /**
    //    * Get the HTML element that the map's canvas is rendered into
    //    * @returns The HTML element
    //    */
    //   pub fn get_canvas_container(&self): HTMLElement {
    //     return this._canvas_container;
    //   }

    /**
     * Get the dimensions of the map's container
     * @returns The dimensions of the map's container Point(width, height)
     */
    pub fn get_container_dimensions(&self) -> Point {
        //     return [this._container?.clientWidth ?? 0, this._container?.clientHeight ?? 0];
        todo!()
    }

    /**
     * Set a new style, replacing the current one if it exists
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions, StyleDefinition } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // setup and set a new style
     * const style: StyleDefinition = { ... };
     * await map.set_style(style);
     * ```
     * @param style - The user defined style of how data should be rendered
     * @param ignore_position - if set to true, don't update the map's position to the style's view guide [Default=`true`]
     */
    pub async fn set_style(&self, style: StyleDefinition, ignore_position: Option<bool>) {
        let ignore_position = ignore_position.unwrap_or(true);
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'set_style', style, ignore_position });
        //     await map?.set_style(style, ignore_position);
        todo!()
    }

    /**
     * Update the map's current style with new attributes, by checking for changes and updating accordingly
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions, StyleDefinition } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., style: { ... } };
     * const map = new S2Map(options);
     * // Update the style with new attributes
     * const newStyle: StyleDefinition = { ... };
     * map.update_style(newStyle);
     * ```
     * @param style - The new style to update the old style with
     */
    pub fn update_style(&self, style: StyleDefinition) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'update_style', style });
        //     map?.update_style(style);
        todo!()
    }

    /**
     * Update the users ability to move the map around or not.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., canMove: false };
     * const map = new S2Map(options);
     * // Update the move state so the user can move around
     * const screen = map.set_move_state(true);
     * ```
     * @param state - Sets the move state. If `true`, the user can move the map.
     */
    pub fn set_move_state(&self, state: bool) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'moveState', state });
        //     map?.set_move_state(state);
        todo!()
    }

    /**
     * Update the users ability to zoom the map in and out or not.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., canZoom: false };
     * const map = new S2Map(options);
     * // Update the zoom state so the user can update the zoom position
     * const screen = map.set_zoom_state(true);
     * ```
     * @param state - Sets the zoom state. If `true`, the user can zoom the map in and out.
     */
    pub fn set_zoom_state(&self, state: bool) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'zoomState', state });
        //     map?.set_zoom_state(state);
        todo!()
    }

    /**
     * Get the current projector's view of the world
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions, View } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., view: { lon: 0, lat: 0, zoom: 0 } };
     * const map = new S2Map(options);
     * // Get a filled in view object
     * const view: Required<View> = await map.get_view();
     * ```
     * @returns A filled in {@link View} object
     */
    pub async fn get_view(&self) -> RequiredView {
        //     const { offscreen, map } = this;
        //     if (map !== undefined) {
        //       const { zoom, lon, lat, bearing, pitch } = map.projector;
        //       return { zoom, lon, lat, bearing, pitch };
        //     }
        //     return await new Promise((resolve): void => {
        //       /**
        //        * Setup a listener for when the view to be shipped back
        //        * @param event - the response with the view
        //        */
        //       const listener = (event: CustomEvent<Required<View>>): void => {
        //         resolve(event?.detail);
        //       };
        //       this.addEventListener('view', listener as EventListener, { once: true });
        //       // TODO: Does an empty jump to work? I think I remember no view changes don't cause a new render or updates
        //       offscreen?.postMessage({ type: 'jump_to', view: {} }); // use an empty jump to not edit anything
        //     });
        todo!()
    }

    /**
     * Jump to a specific location's longitude, latitude, and optionally zoom, bearing, and pitch.
     * Takes a {@link View} object as an input.
     *
     * NOTE: If either the `lon` or `lat` are not set, it will assume the map's current position
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., view: { lon: 0, lat: 0, zoom: 0 } };
     * const map = new S2Map(options);
     * // wait for map to load, then jump to a specific location
     * await map.awaitFullLoaded();
     * map.jump_to({ lon: -120, lat: 60, zoom: 7 });
     * ```
     * @param view - The view to jump to
     */
    pub fn jump_to(&self, view: View) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'jump_to', view });
        //     map?.jump_to(view);
        todo!()
    }

    /**
     * Use an easing function to travel to a specific location's longitude, latitude, and optionally zoom
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., view: { lon: 0, lat: 0, zoom: 0 } };
     * const map = new S2Map(options);
     * // wait for map to load, then jump to a specific location
     * await map.awaitFullLoaded();
     * map.ease_to(-120, 60, 7);
     * ```
     * @param directions - animation guide for travel directions, speed, and easing
     */
    pub fn ease_to(&self, directions: Option<AnimationDirections>) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'ease_to', directions });
        //     map?.animateTo('ease_to', directions);
        todo!()
    }

    /**
     * Use an easing function to fly to a specific location's longitude, latitude, and optionally zoom
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ..., view: { lon: 0, lat: 0, zoom: 0 } };
     * const map = new S2Map(options);
     * // wait for map to load, then jump to a specific location
     * await map.awaitFullLoaded();
     * map.fly_to(-120, 60, 7);
     * ```
     * @param directions - animation guide for travel directions, speed, and easing
     */
    pub fn fly_to(&self, directions: Option<AnimationDirections>) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'fly_to', directions });
        //     map?.animateTo('fly_to', directions);
        todo!()
    }

    /**
     * Add a new source to the map. Sources are references to data and how to fetch it.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Add a new source to the map
     * map.add_source('TheFreakinMoon', 'http://yup-im-the-moon.com/');
     * ```
     * @param source_name - Name of the source
     * @param href - the location of the source data
     */
    pub fn add_source(&self, source_name: String, href: String) {
        self.update_source(source_name, href, Some(false), Some(false));
    }

    /**
     * Update a source already added to the map and control the method the map updates the source
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Add a new source to the map
     * map.add_source('TheFreakinMoon', 'http://yup-im-the-moon.com/');
     * // change the location of the moon
     * map.update_source('TheFreakinMoon', 'http://now-im-the-moon.com/', false, true);
     * ```
     * @param source_name - Name of the source
     * @param href - the new location of the source
     * @param keep_cache - Whether to keep the cache or not. don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
     * @param await_replace - Whether to await the replacement of tiles or not. to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
     */
    pub fn update_source(
        &self,
        source_name: String,
        href: String,
        keep_cache: Option<bool>,
        await_replace: Option<bool>,
    ) {
        let keep_cache = keep_cache.unwrap_or(true);
        let await_replace = await_replace.unwrap_or(true);
        self.reset_source(
            vec![SourceName::new(source_name, Some(href))],
            Some(keep_cache),
            Some(await_replace),
        );
    }

    /**
     * Reset a source's data already added to the map and control the method the map updates the source
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Add a new source to the map
     * map.add_source('TheFreakinMoon', 'http://yup-im-the-moon.com/');
     * // change the location of the moon
     * map.reset_source(['TheFreakinMoon'], false, true);
     * ```
     * @param source_names - Array of [source_name, href]. Href is optional but if provided, the source href will be updated
     * @param keep_cache - Whether to keep the cache or not. don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
     * @param await_replace - Whether to await the replacement of tiles or not. to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
     */
    pub fn reset_source(
        &self,
        source_names: Vec<SourceName>,
        keep_cache: Option<bool>,    // = false,
        await_replace: Option<bool>, // = false,
    ) {
        let keep_cache = keep_cache.unwrap_or(false);
        let await_replace = await_replace.unwrap_or(false);
        //     const { offscreen, map } = this;
        //     // clear old info s2json data should it exist
        //     const msg: ResetSourceMessage = { type: 'reset_source', source_names, keep_cache, await_replace };
        //     offscreen?.postMessage(msg);
        //     map?.reset_source(source_names, keep_cache, await_replace);
        todo!()
    }

    /**
     * Delete a source's data from the map
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Add a new source to the map
     * map.add_source('TheFreakinMoon', 'http://yup-im-the-moon.com/');
     * // Do stuff ...
     *
     * // we are done rendering the moon
     * map.delete_source(['TheFreakinMoon', 'anotherSourceWeDontWantAnymore']);
     * ```
     * @param source_names - A single source_name or an array of source names
     */
    pub fn delete_source(&self, source_names: Vec<String>) {
        //     const { offscreen, map } = this;
        //     if (!Array.isArray(source_names)) source_names = [source_names];
        //     // 1) tell worker pool we dont need info data anymore
        //     window.S2WorkerPool.delete_source(this.id, source_names);
        //     // 2) clear old info s2json data should it exist
        //     offscreen?.postMessage({ type: 'clearSource', source_names });
        //     map?.clearSource(source_names);
        todo!()
    }

    /**
     * Add a new style layer to the map
     * - If the name_index is a string, it will search through the existing layers for the layer with that name and add the layer at said index
     * - If the name_index is a number, it will add the layer at that index in the style.layers array.
     * - If no name_index is provided, it will add the layer at the end
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Add a new style layer to the map
     * map.add_layer({ source: 'world', type: 'fill', color: 'red', ... });
     * ```
     * @param layer - The style layer to add
     * @param name_index - The index to add the layer at
     */
    pub fn add_layer(&self, layer: LayerStyle, name_index: Option<NameIndex>) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'add_layer', layer, name_index });
        //     map?.add_layer(layer, name_index);
        todo!()
    }

    /**
     * Update the an existing style layer in a map given the layer's name or index
     * - If the name_index is a string, it will search through the existing layers for the layer with that name and update the layer at said index
     * - If the name_index is a number, it will use the layer at that index in the style.layers array.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Update the style layer
     * map.update_layer({ source: 'world', type: 'fill', color: 'red', ... }, 12);
     * ```
     * @param layer - The style layer to update/replace the old layer with
     * @param name_index - The index/name of the style layer to update
     * @param full_update - If true, force a full re-render of the layer. Recommended to keep true unless you know what you're doing
     */
    pub fn update_layer(
        &self,
        layer: LayerStyle,
        name_index: NameIndex,
        full_update: Option<bool>,
    ) {
        let full_update = full_update.unwrap_or(true);
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'update_layer', layer, name_index, full_update });
        //     map?.update_layer(layer, name_index, full_update);
        todo!()
    }

    /**
     * Delete an existing style layer in a map given the layer's name or index
     * - If the name_index is a string, it will search through the existing layers for the layer with that name and update the layer at said index
     * - If the name_index is a number, it will use the layer at that index in the style.layers array.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Delete an existing layer
     * map.update_layer(12);
     * ```
     * @param name_index - The index/name of the style layer to delete
     */
    pub fn delete_layer(&self, name_index: NameIndex) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'delete_layer', name_index });
        //     map?.delete_layer(name_index);
        todo!()
    }

    /**
     * Reorder layers in the map.
     * - The key is the index of the layer to move
     * - The value is the index to move the layer to
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // Reorder layers
     * map.reorder_layers({ 0: 1, 1: 0 });
     * ```
     * @param layer_changes - The guide of how to reorder the layers
     */
    pub fn reorder_layers(&self, layer_changes: BTreeMap<u32, u32>) {
        //     const { offscreen, map } = this;
        //     offscreen?.postMessage({ type: 'reorder_layers', layer_changes });
        //     map?.reorder_layers(layer_changes);
        todo!()
    }

    /**
     * Add new marker(s) to the map
     * - See {@link MarkerDefinition} to see the shape of a marker
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // add a new marker
     * map.add_marker({ id: 22, lat: 0, lon: 0, html: '<div>hello</div>' });
     * ```
     * @param markers - A single marker or an array of markers
     * @param source_name - The name of the source to add the marker(s) to. [Default: `"_markers"`]
     */
    pub fn add_marker(&self, markers: Vec<MarkerDefinition>, source_name: Option<String>) {
        let source_name = source_name.unwrap_or("_markers".into());
        //     if (!Array.isArray(markers)) markers = [markers];
        //     // 1) let the worker pool know we have new marker(s)
        //     window.S2WorkerPool.add_markers(this.id, markers, source_name);
        //     // 2) tell the map that (a) new marker(s) has/have been added
        //     this.reset_source([[source_name, undefined]], true, true);
        todo!()
    }

    /**
     * Delete a marker or collection of markers from the map
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // add a new marker
     * map.remove_marker(22);
     * ```
     * @param ids - A single marker id or an array of marker ids to delete
     * @param source_name - The name of the source to remove the marker(s) from. [Default: `"_markers"`]
     */
    pub fn remove_marker(&self, ids: Vec<u64>, source_name: Option<String>) {
        let source_name = source_name.unwrap_or("_markers".into());
        //     if (!Array.isArray(ids)) ids = [ids];
        //     // 1) let the worker pool know we need to remove marker(s)
        //     window.S2WorkerPool.deleteMarkers(this.id, ids, source_name);
        //     // 2) tell the map that (a) marker(s) has/have to be removed
        //     this.reset_source([[source_name, undefined]], true, false);
        todo!()
    }

    /**
     * Take a screenshot of the current state of the map. Returns the screenshot as an `Uint8ClampedArray`.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // wait for the map to be full rendered
     * await map.await_fully_rendered();
     * // request the current screen
     * const screen = await map.screenshot();
     * ```
     * @returns An RGBA encoded `Uint8ClampedArray` that is of size `canvas.width` * `canvas.height`
     */
    pub async fn screenshot(&self) -> Option<Vec<u8>> {
        //     const { offscreen, map } = this;
        //     return await new Promise<null | Uint8ClampedArray>((resolve) => {
        //       /**
        //        * Setup a listener for when the screenshot to be shipped back
        //        * @param event - the response with the screenshot
        //        */
        //       const listener = (event: CustomEvent<Uint8ClampedArray | null>): void => {
        //         resolve(event?.detail);
        //       };
        //       this.addEventListener('screenshot', listener as EventListener, { once: true });
        //       offscreen?.postMessage({ type: 'screenshot' });
        //       map?.screenshot();
        //     });
        todo!()
    }

    /**
     * Async function to wait for the map to have all source and layer data rendered to the screen
     *
     * Useful for ensuring the map is rendered before running tests, starting an animation,
     * making changes, etc.
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... };
     * const map = new S2Map(options);
     * // wait for the map to be full rendered before making future changes
     * await map.await_fully_rendered();
     * // do more stuff
     * ```
     */
    pub async fn await_fully_rendered(&self) {
        //     const { offscreen, map } = this;
        //     await new Promise<void>((resolve) => {
        //       this.addEventListener(
        //         'rendered',
        //         (): void => {
        //           resolve();
        //         },
        //         { once: true },
        //       );
        //       offscreen?.postMessage({ type: 'awaitRendered' });
        //       map?.await_fully_rendered();
        //     });
        todo!()
    }

    /**
     * Delete the map instance and cleanup all it's resources
     *
     * ### Example
     * ```ts
     * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
     * import type { MapOptions } from 's2maps-gpu';
     *
     * const options: MapOptions = { ... }
     * const map = new S2Map(options)
     * // do something with the map
     * map.delete() // cleanup
     * ```
     */
    pub fn delete(&self) {
        //     const { offscreen, map } = this;
        //     this.dispatchEvent(new Event('delete'));
        //     offscreen?.postMessage({ type: 'delete' });
        //     offscreen?.terminate();
        //     map?.delete();
        //     // reset the worker pool
        //     window.S2WorkerPool.delete();
        //     // remove all canvas listeners via cloning
        //     if (this._canvas instanceof HTMLCanvasElement)
        //       this._canvas.replaceWith(this._canvas.cloneNode(true));
        //     // cleanup the html
        //     if (this._container !== undefined) {
        //       while (this._container.lastChild !== null)
        //         this._container.removeChild(this._container.lastChild);
        //     }
        todo!()
    }
}

// /**
//  * Figure out the best canvas we have access to
//  * @returns 0 for DOM, 1 for WebGL, 2 for WebGL2, 3 for WebGPU
//  */
// function getContext(): GPUType {
//   let tmpContext = document.createElement('canvas').getContext('webgpu');
//   if (tmpContext !== null) {
//     return 3;
//   } else {
//     tmpContext = document.createElement('canvas').getContext('webgl2');
//     if (tmpContext !== null) {
//       tmpContext.getExtension('WEBGL_lose_context')?.loseContext();
//       return 2;
//     } else if (document.createElement('canvas').getContext('webgl') !== null) {
//       return 1;
//     }
//   }
//   return 0;
// }

// /** Internal function returns layer coordinates */
// interface LayerCoordinates {
//   layerX: number;
//   layerY: number;
// }

// /**
//  * Internal tool to get layer coordinates
//  * @param event - mouse event
//  * @returns the layer coordinates in a series of elements
//  */
// function getLayerCoordinates(event: MouseEvent): LayerCoordinates {
//   const { target, offsetX, offsetY } = event;
//   const targetElement = target as HTMLElement | null;
//   let currentElement = targetElement;

//   let layerX = offsetX;
//   let layerY = offsetY;

//   // Traverse up the DOM tree to find the nearest positioned ancestor
//   while (currentElement !== null && currentElement !== document.body) {
//     const { offsetLeft, offsetTop, offsetParent } = currentElement;
//     const offsetParentElement = offsetParent;

//     if (
//       offsetParentElement !== null &&
//       getComputedStyle(offsetParentElement).position !== 'static'
//     ) {
//       layerX += offsetLeft;
//       layerY += offsetTop;
//       break;
//     }

//     currentElement = offsetParentElement as HTMLElement | null;
//   }

//   return { layerX, layerY };
// }

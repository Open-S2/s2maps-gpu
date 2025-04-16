/** CAMERA */
import Camera from './camera/index.js';
/** SOURCES */
import Animator from './camera/animator.js';

import type { ColorMode } from 's2/s2Map.js';
import type { UrlMap } from 'util/index.js';
import type { UserTouchEvent } from './camera/dragPan.js';
import type { AnimationDirections, AnimationType } from './camera/animator.js';
import type { Attributions, GPUType, LayerStyle, StyleDefinition } from 'style/style.spec.js';
import type {
  MapGLMessage,
  RenderedMessageGL,
  ScreenshotMessageGL,
  SourceFlushMessage,
  TileRequestMessage,
  TileWorkerMessage,
} from 'workers/worker.spec.js';

/**
 * # Map MapOptions
 *
 * ## Description
 *
 * User defined configuration options for the map.
 *
 * At a minimum, you probably want to define a {@link StyleDefinition} and an HTML element `container`.
 *
 * ex.
 * ```ts
 * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
 * import type { MapOptions, StyleDefinition } from 's2maps-gpu';
 *
 * // build a style guide of sources to fetch and layers to render
 * const style: StyleDefinition = { ... };
 * // setup options for the map
 * const options: MapOptions = {
 *   container: 'map', // the ID of the HTML element to render the map into
 *   // reference a canvas instead of a container:
 *   // canvas: userPulledCanvasElement
 *   style,
 * }
 * // Build the map
 * const map = new S2Map(options);
 * ```
 *
 * ### Rendering Options
 * - `contextType`: [See {@link GPUType}] Forces the use of specific GPU Context:
 *   - `1`: WebGL
 *   - `2`: WebGL2
 *   - `3`: WebGPU
 * - `offscreen`: Support OffscreenCanvas
 * - `canvas`: Reference a canvas instead of a container
 * - `container`: Can be a reference to an ID (string) or an HTMLElement
 * - `style`: [See {@link StyleDefinition}] Either the style definition or a string URL pointing to the location of the style definition
 * - `canvasMultiplier`: Control the number of fragments per pixel. [default: window.devicePixelRatio]
 * - `darkMode`: boolean flag. Enable dark mode. [default: false]
 *
 * ### Control Options
 * - `interactive`:boolean flag.  If true, the map will be interactive with user mouse/keyboard/finger inputs; [default: true]
 * - `scrollZoom`: boolean flag. If true, allow user to use scroll wheel to zoom. [default: true]
 * - `positionalZoom`: boolean flag. If true, cursor position impacts zoom's x & y directions. [default: true]
 * - `controls`: boolean flag. If true, enable default controls; [default: true]
 * - `zoomController`: boolean flag. Display zoom controller state. [default: true]
 * - `compassController`: boolean flag. Display compass controller state. [default: true]
 * - `colorblindController`: boolean flag. Display colorblind controller state. [default: true]
 * - `canZoom`: boolean flag. Enable zooming functionality. [default: true]
 * - `canMove`: boolean flag. Enable panning/moving functionality. [default: true]
 * - `noClamp`: boolean flag. Allow latitude and longitude to pass their limits (-90, 90) and (-180, 180) respectively [default: false]
 *
 * ### Additional Options
 * - `hash`: If true, the map will update the URL Hash with it's current View. [default: false]
 * - `apiKey`: string. API key for the map service.
 * - `urlMap`: [See {@link UrlMap}] An API URL that remaps any source strings that start with "example://" to whatever example is
 *    - example: `{ "apiURL": "https://api.opens2.com" }`
 * - `attributions`: Set additional attributions to be displayed on the map.
      - example: `{ "OpenS2": "https://opens2.com/data" }`
 * - `attributionOff`: boolean flag. Disable attribution display. [default: false]
 * - `watermarkOff`: boolean flag. Disable watermark display. [default: false]
 */
export interface MapOptions {
  /**
   * Forces the use of specific GPU Context:
   * - `1`: WebGL
   * - `2`: WebGL2
   * - `3`: WebGPU
   */
  contextType?: GPUType;
  /** Support OffscreenCanvas */
  offscreen?: false;
  /** Reference a canvas instead of a container */
  canvas?: HTMLCanvasElement;
  /** Can be a reference to an ID (string) or an HTMLElement */
  container?: string | HTMLElement;
  /** If true, the map will be interactive with user mouse/keyboard/finger inputs; [default: true] */
  interactive?: boolean;
  /**
   * If true, the map will update the URL Hash with it's current View.
   * e.g. `https://opens2.com/example/map#lon=0&lat=0&zoom=0&pitch=0&bearing=0`
   * [default: false]
   */
  hash?: boolean;
  /** An API key will ensure control and ownership over data */
  apiKey?: string;
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
  urlMap?: UrlMap;
  /** Either the style definition or a string URL pointing to the location of the style definition */
  style: StyleDefinition | string;
  /** If true, allow user to use scroll wheel to zoom. [default: true] */
  scrollZoom?: boolean;
  /** If true, cursor position impacts zoom's x & y directions. [default: true] */
  positionalZoom?: boolean;
  /** Control the number of fragments per pixel. [default: window.devicePixelRatio] */
  canvasMultiplier?: number;
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
  attributions?: Attributions;
  /** Hide the attribution tag. [default: false] */
  attributionOff?: boolean;
  /** Hide the logo. [default: false] */
  watermarkOff?: boolean;
  /** zoom, compass, and colorblind turned on or off. [default: true] */
  controls?: boolean;
  /** Display a zoom controller state. [default: true] */
  zoomController?: boolean;
  /** Display a compass controller state. [default: true] */
  compassController?: boolean;
  /** Display a colorblind controller state. [default: true] */
  colorblindController?: boolean;
  /** allow the user to zoom the map. [default: true] */
  canZoom?: boolean;
  /** allow the user to move the map. [default: true] */
  canMove?: boolean;
  /** display controls, info icon, etc. in a dark style. [default: false] */
  darkMode?: boolean;
  /** Alow latitude and longitude to pass their limits (-90, 90) and (-180, 180) respectively. [default: false] */
  noClamp?: boolean; // lat and lon can be any number
}

/**
 * # S2 Map UI
 *
 * Internal wrapper for the Camera.
 * Manages user APIs and inputs for user interactions to the map
 */
export default class S2MapUI extends Camera {
  renderNextFrame = false;
  injectionQueue: TileWorkerMessage[] = [];

  /* API */

  /** Delete all tile cache, painter, and draw method */
  delete(): void {
    // delete all tiles
    this.tileCache.deleteAll();
    // to ensure no more draws, set the draw method to a noop
    /** empty the draw method */
    this._draw = () => {
      /* noop */
    };
    // tell the painter to cleanup
    this.painter.delete();
  }

  /**
   * Jump to a specific location and zoom level
   * @param lon - Longitude of the target location
   * @param lat - Latitude of the target location
   * @param zoom - Zoom level to set after jumping
   */
  jumpTo(lon: number, lat: number, zoom?: number): void {
    // update the projectors position
    this.projector.setView({ lon, lat, zoom });
    // render it out
    this.render();
  }

  /**
   * Animate the map to a specific location and zoom level
   * @param type - Type of animation to perform
   * @param directions - Directions for the animation
   */
  animateTo(type: AnimationType, directions?: AnimationDirections): void {
    // build animator
    const animator = new Animator(this.projector, directions);
    const render = type === 'flyTo' ? animator.flyTo() : animator.easeTo();
    if (!render) return;
    /**
     * set an animation function
     * @param now - Current time in milliseconds from start
     */
    this.currAnimFunction = (now: number): void => {
      this._animate(animator, now * 0.001);
    };
    // render it out
    this.render();
  }

  /**
   * Set the style of the map
   * @param style - Style to set
   * @param ignorePosition - Ignore the current position of the map
   */
  async setStyle(style: string | StyleDefinition, ignorePosition: boolean): Promise<void> {
    await this._setStyle(style, ignorePosition);
  }

  /**
   * Update the style of the map
   * 1) updateStyle from the style object. return a list of "from->to" for tiles and "layerIDs" for webworkers
   * 2) remove tiles from tileCache not in view
   * 3) update the tileCache tiles using "from->to"
   * 4) if a layer "source", "layer", or "filter" change it will be in "webworkers". Tell webworkers to rebuild
   * @param _style - Style to update to
   */
  updateStyle(_style: StyleDefinition): void {
    // // build style for the map, painter, and webworkers
    // Style.updateStyle(style)
    // remove any tiles outside of view
    // this._resetTileCache([], false, true)
    // // update tileCache
    // this.tileCache.forEach(tile => { tile.updateStyle(Style) })
    // // inject minzoom and maxzoom
    // this._setStyle(style, true)
    // // render our first pass
    // this.render()
  }

  /**
   * Clear the source data from all tiles
   * @param sourceNames - Names of sources to clear
   */
  clearSource(sourceNames: string[]): void {
    // delete source data from all tiles
    this.tileCache.forEach((tile) => {
      tile.deleteSources(sourceNames);
    });
    // let the renderer know the painter is "dirty"
    this.painter.dirty = true;
    // rerender
    this.render();
  }

  /**
   * Reset the source data for all tiles
   * @param sources - Array of [sourceName, href] pairs
   * @param keepCache - Whether to keep the tile cache
   * @param awaitReplace - Whether to await the replacement of the source data or clear the cache immediately
   */
  resetSource(
    sources: Array<[sourceName: string, href: string | undefined]>,
    keepCache = false,
    awaitReplace = false,
  ): void {
    const { id: mapID, painter, webworker, parent } = this;
    const tileRequests = this._resetTileCache(
      sources.map((s) => s[0]),
      keepCache,
      awaitReplace,
    );
    // Send off the tile request (by including sourceNames we are letting the
    // source worker know we only need to update THIS source)
    if (tileRequests.length > 0) {
      const msg: TileRequestMessage = { mapID, type: 'tilerequest', tiles: tileRequests, sources };
      if (webworker) postMessage(msg);
      else parent?.onMessage({ data: msg } as MessageEvent<TileRequestMessage>);
    }
    // let the renderer know the painter is "dirty"
    painter.dirty = true;
    // rerender
    this.render();
  }

  /**
   * Add a new style layer to the map
   * @param _layer - the style layer to add
   * @param _nameIndex - the index position to add the layer
   */
  addLayer(_layer: LayerStyle, _nameIndex: number | string): void {
    // TODO
    // // remove all tiles outside of view
    // const tileRequests = this._resetTileCache([], false, true)
    // // style needs to be updated on the change
    // Style.addLayer(layer, nameIndex, tileRequests)
    // // rerender
    // this.render()
  }

  /**
   * Delete a style layer from the map
   * @param _nameIndex - the index position to delete the layer
   */
  deleteLayer(_nameIndex: number | string): void {
    // TODO
    // // style needs to be updated on the change
    // const index = Style.deleteLayer(nameIndex)
    // // remove all instances of the layer in each tile
    // this.tileCache.forEach(tile => { tile.deleteLayer(index) })
    // // rerender
    // this.render()
  }

  /**
   * Reorder style layers on the map
   * @param _layerChanges - the layer changes to make, their starting and end positions { [start]: end }
   */
  reorderLayers(_layerChanges: Record<number, number>): void {
    // TODO
    // // style needs to updated on the change
    // this.style.reorderLayers(layerChanges)
    // // update every tile
    // this.tileCache.forEach(tile => { tile.reorderLayers(layerChanges) })
    // // rerender
    // this.render()
  }

  /**
   * Update a style layer on the map
   * @param _layer - the layer to update
   * @param _nameIndex - the index position to update the layer
   * @param _fullUpdate - whether to update the layer completely or just the style
   */
  updateLayer(_layer: LayerStyle, _nameIndex: number | string, _fullUpdate = false): void {
    // TODO
  }

  /**
   * Set the move state (if true user can edit move, otherwise current move is locked in)
   * @param state - new state
   */
  setMoveState(state: boolean): void {
    this.canMove = state;
  }

  /**
   * Set the zoom state (if true user can edit zoom, otherwise current zoom is locked in)
   * @param state - new state
   */
  setZoomState(state: boolean): void {
    this.canZoom = state;
  }

  /**
   * Handle on zoom case
   * @param deltaZ - The change in zoom level
   * @param deltaX - The change in x position
   * @param deltaY - The change in y position
   */
  override onZoom(deltaZ: number, deltaX = 0, deltaY = 0): void {
    this.dragPan.clear();
    if (!this.canZoom) return;
    // remove any prexisting animations
    this.currAnimFunction = undefined;
    // update projector
    this.projector.onZoom(deltaZ, deltaX, deltaY);
    // render
    this.render();
  }

  /**
   * Update bearing and/or pitch from compass change
   * @param bearing - the bearing avlue to update
   * @param pitch - the pitch value to update
   */
  updateCompass(bearing: number, pitch: number): void {
    const { projector } = this;
    this.currAnimFunction = undefined;
    projector.setView({
      bearing: projector.bearing + bearing,
      pitch: projector.pitch + pitch,
    });
    this.render();
  }

  /** Handle compass on mouseup. Snap to north or south if close enough */
  mouseupCompass(): void {
    const { projector } = this;
    const { bearing } = projector;
    if (bearing === 0) return;
    const newBearing =
      bearing >= -10 && bearing <= 10
        ? 0
        : bearing <= -167.5
          ? -180
          : bearing >= 167.5
            ? 180
            : undefined;
    if (newBearing !== undefined) {
      const animator = new Animator(projector, { duration: 1, bearing: newBearing });
      animator.compassTo();
      /**
       * Set the current animation function
       * @param now - current time since start
       */
      this.currAnimFunction = (now: number) => {
        this._animate(animator, now * 0.001);
      };
      this.render();
    }
  }

  /** Reset the compass to north */
  resetCompass(): void {
    const { projector } = this;
    const { bearing, pitch } = projector;
    // create the animator
    const duration = bearing !== 0 ? (bearing > 90 ? 1.75 : 1) : 1;
    const animator = new Animator(projector, {
      duration,
      bearing: 0,
      pitch: bearing !== 0 ? bearing : pitch,
    });
    animator.compassTo();
    /**
     * Set the current animation function
     * @param now - current time since start
     */
    this.currAnimFunction = (now: number): void => {
      this._animate(animator, now * 0.001);
    };
    // send off a render
    this.render();
  }

  /**
   * Resize the canvas
   * @param width - new width
   * @param height - new height
   */
  resize(width: number, height: number): void {
    this.resizeQueued = { width, height };
    this.render();
  }

  /** Takes a screenshot and ships the uint8 buffer back to the parent */
  screenshot(): void {
    const { id: mapID, painter, parent, webworker } = this;
    requestAnimationFrame(() => {
      if (this.#fullyRenderedScreen()) {
        // assuming the screen is ready for a screen shot we ask for a draw
        void painter.getScreen().then((data) => {
          const screen = data.buffer as ArrayBuffer;
          const msg: ScreenshotMessageGL = { mapID, type: 'screenshot', screen };
          if (webworker) postMessage(msg, [screen]);
          else parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
        });
      } else {
        this.screenshot();
      }
    });
  }

  /**
   * Call this function to wait until the screen is fully rendered. A "rendered" message will be
   * sent back to the parent when the screen is fully rendered
   */
  awaitFullyRendered(): void {
    const { id: mapID, parent, webworker } = this;
    requestAnimationFrame(() => {
      if (this.#fullyRenderedScreen()) {
        const msg: RenderedMessageGL = { mapID, type: 'rendered' };
        if (webworker) postMessage({ type: 'rendered' });
        parent?.onMessage({ data: msg } as MessageEvent<MapGLMessage>);
      } else {
        this.awaitFullyRendered();
      }
    });
  }

  /**
   * Called when the screen is fully rendered with all source/layer data
   * @returns true if the screen is fully rendered
   */
  #fullyRenderedScreen(): boolean {
    // check tiles
    const tiles = this.getTiles();
    let fullyRendered = true;
    for (const tile of tiles) {
      if (tile.state === 'loading') {
        fullyRendered = false;
        break;
      }
    }
    // if the painter has a skybox, check it
    fullyRendered = this.painter.workflows.skybox?.ready ?? fullyRendered;

    return fullyRendered;
  }

  /**
   * some cases we can just do the work immediately, otherwise we do one job per frame
   * to improve performance. Data is stored in the injection queue while it waits for it's frame.
   * @param data - data to inject. Tile data resuls or a flush command (useful for clearing parent data or inverted fills, etc.)
   */
  injectData(data: TileWorkerMessage | SourceFlushMessage): void {
    if (data.type === 'flush') this._injectData(data);
    else this.injectionQueue.push(data);
    this.render();
  }

  /* INPUT EVENTS */

  /**
   * set the colorblind mode
   * @param mode - colorblind mode
   */
  colorMode(mode: ColorMode): void {
    this.painter.setColorMode(mode);
    // force a re-render
    this.render();
  }

  /**
   * for interaction with features on the screen
   * @param x - x mouse position
   * @param y - y mouse position
   */
  onCanvasMouseMove(x: number, y: number): void {
    if (!this._interactive) return;
    this._setMousePosition(x, y);
    this.mouseMoved = true;
    this.render();
  }

  /**
   * action when the user touches the screen
   * @param touches - collection of touch events
   */
  onTouchStart(touches: UserTouchEvent): void {
    this.dragPan.onTouchStart(touches);
    if (!this._interactive || touches.length > 1) return;
    const { x, y } = touches[0];
    this._setMousePosition(x, y);
    this.mouseMoved = true;
    this.render();
  }

  /**
   * builtin navigation controller inputs
   * @param ctrl - 'zoomIn' | 'zoomOut'
   * @param lon - optional longitude
   * @param lat - optional latitude
   */
  navEvent(ctrl: 'zoomIn' | 'zoomOut', lon?: number, lat?: number): void {
    this._navEvent(ctrl, lon, lat);
  }

  /* DRAW */

  /**
   * we don't want to over request rendering, so we render with a limiter to
   * safely call render as many times as we like
   */
  override render(): void {
    if (!this._canDraw) return;
    if (this.renderNextFrame) return;
    this.renderNextFrame = true;
    requestAnimationFrame((now: number) => {
      this.renderNextFrame = false;
      // if timeCache exists, run animation function
      this.timeCache?.animate(now, this._updatePainter.bind(this) as () => void);
      // if animation currently exists, run it
      this.currAnimFunction?.(now);
      // if resize has been queued, we do so now
      if (this.resizeQueued !== undefined) this._resize();
      // if there is data to 'inject', we make sure to render another frame later
      if (this.injectionQueue.length > 0) {
        // pull out the latest data we received (think about it, the newest data is the most constructive)
        const data = this.injectionQueue.pop();
        // tell the camera to inject data
        if (data !== undefined) this._injectData(data);
        // setup another render queue
        this.render();
      }
      // get state of scene
      const projectorDirty = this.projector.dirty;
      // if the projector was dirty (zoom or movement) we run render again just incase
      if (projectorDirty) {
        this.render();
        this._onViewUpdate();
      }
      // run a draw, it will repaint framebuffers as necessary
      try {
        this._draw();
      } catch (e) {
        this._canDraw = false;
        throw e;
      }
      // if mouse movement, check feature at position
      if (this.mouseMoved && !projectorDirty) {
        this.mouseMoved = false;
        void this._onCanvasMouseMove();
      }
    });
  }
}

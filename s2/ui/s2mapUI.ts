/** CAMERA */
import Camera from './camera/index';
/** SOURCES */
import Animator from './camera/animator';

import type { ColorMode } from 's2Map';
import type { UserTouchEvent } from './camera/dragPan';
import type { AnimationDirections, AnimationType } from './camera/animator';
import type { GPUType, LayerStyle, StyleDefinition } from 'style/style.spec';
import type {
  RenderedMessageGL,
  ScreenshotMessageGL,
  SourceFlushMessage,
  TileRequestMessage,
  TileWorkerMessage,
} from 'workers/worker.spec';

/**
 *
 */
export interface MapOptions {
  /**
   * Forces the use of:
   * - `1`: WebGL
   * - `2`: WebGL2
   * - `3`: WebGPU
   */
  contextType?: GPUType;
  /** Support OffscreenCanvas */
  offscreen?: false;
  /** Reference a canvas instead of a container */
  canvas?: HTMLCanvasElement;
  /** Can be a reference to an ID or an HTMLElement */
  container?: string | HTMLElement;
  /** If true, the map will be interactive; [default: true] */
  interactive?: boolean;
  /**
   * If true, the map will update the URL Hash with it's current View
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
  urlMap?: Record<string, string>;
  /** Either the style definition or a string URL pointing to the location of the style definition */
  style: StyleDefinition | string;
  /** if true, allow user to use scroll wheel to zoom. [default: true] */
  scrollZoom?: boolean;
  /** if true, cursor position impacts zoom's x & y directions. [default: true] */
  positionalZoom?: boolean; // If true, cursor position impacts zoom's x & y directions
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
  attributions?: Record<string, string>;
  /** Hide the attribution tag */
  attributionOff?: boolean;
  /** Hide the logo */
  watermarkOff?: boolean;
  /** zoom, compass, and colorblind turned on or off. [default: true] */
  controls?: boolean;
  /** controlling zoom controller state. [default: true] */
  zoomController?: boolean;
  /** controlling compass controller state. [default: true] */
  compassController?: boolean;
  /** controlling colorblind controller state. [default: true] */
  colorblindController?: boolean;
  /** allow the user to zoom the map. [default: true] */
  canZoom?: boolean;
  /** allow the user to move the map. [default: true] */
  canMove?: boolean;
  /** display controls, info icon, etc. in a dark style. [default: false] */
  darkMode?: boolean;
  /** Alow latitude and longitude to pass their limits (-90, 90) and (-180, 180) respectively */
  noClamp?: boolean; // lat and lon can be any number
}

/**
 *
 */
export default class S2MapUI extends Camera {
  renderNextFrame = false;
  injectionQueue: TileWorkerMessage[] = [];

  /* API */

  /**
   *
   */
  delete(): void {
    // delete all tiles
    this.tileCache.deleteAll();
    // to ensure no more draws, set the draw method to a noop
    /**
     *
     */
    this._draw = () => {
      /* noop */
    };
    // tell the painter to cleanup
    this.painter.delete();
  }

  /**
   * @param lon
   * @param lat
   * @param zoom
   */
  jumpTo(lon: number, lat: number, zoom?: number): void {
    // update the projectors position
    this.projector.setView({ lon, lat, zoom });
    // render it out
    this.render();
  }

  /**
   * @param type
   * @param directions
   */
  animateTo(type: AnimationType, directions?: AnimationDirections): void {
    // build animator
    const animator = new Animator(this.projector, directions);
    const render = type === 'flyTo' ? animator.flyTo() : animator.easeTo();
    if (!render) return;
    // set an animation fuction
    /**
     * @param now
     */
    this.currAnimFunction = (now: number): void => {
      this._animate(animator, now * 0.001);
    };
    // render it out
    this.render();
  }

  /**
   * @param style
   * @param ignorePosition
   */
  async setStyle(style: string | StyleDefinition, ignorePosition: boolean): Promise<void> {
    await this._setStyle(style, ignorePosition);
  }

  // 1) updateStyle from the style object. return a list of "from->to" for tiles and "layerIDs" for webworkers
  // 2) remove tiles from tileCache not in view
  // 3) update the tileCache tiles using "from->to"
  // 4) if a layer "source", "layer", or "filter" change it will be in "webworkers". Tell webworkers to rebuild
  /**
   * @param _style
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
   * @param sourceNames
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

  // sources: Array<[sourceName, href]>
  /**
   * @param sources
   * @param keepCache
   * @param awaitReplace
   */
  resetSource(
    sources: Array<[string, string | undefined]>,
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
      else parent?.onMessage({ data: msg });
    }
    // let the renderer know the painter is "dirty"
    painter.dirty = true;
    // rerender
    this.render();
  }

  /**
   * @param layer
   * @param nameIndex
   */
  addLayer(layer: LayerStyle, nameIndex: number | string): void {
    // TODO
    // // remove all tiles outside of view
    // const tileRequests = this._resetTileCache([], false, true)
    // // style needs to be updated on the change
    // Style.addLayer(layer, nameIndex, tileRequests)
    // // rerender
    // this.render()
  }

  /**
   * @param nameIndex
   */
  deleteLayer(nameIndex: number | string): void {
    // TODO
    // // style needs to be updated on the change
    // const index = Style.deleteLayer(nameIndex)
    // // remove all instances of the layer in each tile
    // this.tileCache.forEach(tile => { tile.deleteLayer(index) })
    // // rerender
    // this.render()
  }

  /**
   * @param layerChanges
   */
  reorderLayers(layerChanges: Record<number, number>): void {
    // TODO
    // // style needs to updated on the change
    // this.style.reorderLayers(layerChanges)
    // // update every tile
    // this.tileCache.forEach(tile => { tile.reorderLayers(layerChanges) })
    // // rerender
    // this.render()
  }

  /**
   * @param layer
   * @param nameIndex
   * @param fullUpdate
   */
  updateLayer(layer: LayerStyle, nameIndex: number | string, fullUpdate = false): void {
    // TODO
  }

  /**
   * @param state
   */
  setMoveState(state: boolean): void {
    this.canMove = state;
  }

  /**
   * @param state
   */
  setZoomState(state: boolean): void {
    this.canZoom = state;
  }

  /**
   * @param deltaZ
   * @param deltaX
   * @param deltaY
   */
  onZoom(deltaZ: number, deltaX = 0, deltaY = 0): void {
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
   * @param bearing
   * @param pitch
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

  // snap to upside down if interested
  /**
   *
   */
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
       * @param now
       */
      this.currAnimFunction = (now: number) => {
        this._animate(animator, now * 0.001);
      };
      this.render();
    }
  }

  /**
   *
   */
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
     * @param now
     */
    this.currAnimFunction = (now: number) => {
      this._animate(animator, now * 0.001);
    };
    // send off a render
    this.render();
  }

  /**
   * @param width
   * @param height
   */
  resize(width: number, height: number): void {
    this.resizeQueued = { width, height };
    this.render();
  }

  /**
   *
   */
  screenshot(): void {
    const { id: mapID, painter, parent, webworker } = this;
    requestAnimationFrame(() => {
      if (this.#fullyRenderedScreen()) {
        // assuming the screen is ready for a screen shot we ask for a draw
        void painter.getScreen().then((data) => {
          const screen = data.buffer as ArrayBuffer;
          const msg: ScreenshotMessageGL = { mapID, type: 'screenshot', screen };
          if (webworker) postMessage(msg, [screen]);
          else parent?.onMessage({ data: msg });
        });
      } else {
        this.screenshot();
      }
    });
  }

  /**
   *
   */
  awaitFullyRendered(): void {
    const { id: mapID, parent, webworker } = this;
    requestAnimationFrame(() => {
      if (this.#fullyRenderedScreen()) {
        const msg: RenderedMessageGL = { mapID, type: 'rendered' };
        if (webworker) postMessage({ type: 'rendered' });
        parent?.onMessage({ data: msg });
      } else {
        this.awaitFullyRendered();
      }
    });
  }

  /**
   *
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

  // some cases we can just do the work immediately, otherwise we do one job per frame
  // to improve performance. Data is stored in the injection queue while it waits for it's frame.
  /**
   * @param data
   */
  injectData(data: TileWorkerMessage | SourceFlushMessage): void {
    if (data.type === 'flush') this._injectData(data);
    else this.injectionQueue.push(data);
    this.render();
  }

  /* INPUT EVENTS */

  /**
   * @param mode
   */
  colorMode(mode: ColorMode): void {
    this.painter.setColorMode(mode);
    // force a re-render
    this.render();
  }

  // for interaction with features on the screen
  /**
   * @param x
   * @param y
   */
  onCanvasMouseMove(x: number, y: number): void {
    if (!this._interactive) return;
    this._setMousePosition(x, y);
    this.mouseMoved = true;
    this.render();
  }

  /**
   * @param touches
   */
  onTouchStart(touches: UserTouchEvent): void {
    this.dragPan.onTouchStart(touches);
    if (!this._interactive || touches.length > 1) return;
    const { x, y } = touches[0];
    this._setMousePosition(x, y);
    this.mouseMoved = true;
    this.render();
  }

  // builtin navigation controller inputs
  /**
   * @param ctrl
   * @param lon
   * @param lat
   */
  navEvent(ctrl: 'zoomIn' | 'zoomOut', lon?: number, lat?: number): void {
    this._navEvent(ctrl, lon, lat);
  }

  /* DRAW */

  // we don't want to over request rendering, so we render with a limiter to
  // safely call render as many times as we like
  /**
   *
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

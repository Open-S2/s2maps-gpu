import { isSafari, parseHash, setHash } from './util/index.js';

import type { AnimationDirections } from './ui/camera/animator.js';
import type { MapOptions } from './ui/s2mapUI.js';
import type { MarkerDefinition } from './workers/source/markerSource.js';
import type S2MapUI from './ui/s2mapUI.js';
import type { UserTouchEvent } from './ui/camera/dragPan.js';
import type { VectorPoint } from 'gis-tools/index.js';
import type { Attributions, LayerStyle, StyleDefinition } from './style/style.spec.js';
import type {
  MapGLMessage,
  ResetSourceMessage,
  SourceWorkerMessage,
  TileWorkerMessage,
} from './workers/worker.spec.js';

export type * from './ui/s2mapUI.js';
export type { MarkerDefinition } from './workers/source/markerSource.js';
export type { AnimationDirections } from './ui/camera/animator.js';
export type { UserTouchEvent } from './ui/camera/dragPan.js';

/**
 * Color blind states
 * - 0: None
 * - 1: Protanopia
 * - 2: Deuteranopia
 * - 3: Tritanopia
 * - 4: Greyscale
 */
export const ColorMode = {
  /** None */
  None: 0,
  /** Protanopia */
  Protanopia: 1,
  /** Deuteranopia */
  Deuteranopia: 2,
  /** Tritanopia */
  Tritanopia: 3,
  /** Greyscale */
  Greyscale: 4,
} as const;
/** colorblind mode */
export type ColorMode = (typeof ColorMode)[keyof typeof ColorMode];

declare global {
  /** a global object exposed to the window */
  interface Window {
    S2Map: typeof S2Map;
  }
}

// S2Map is called by the user and includes the API to interact with the mapping engine
/**
 *
 */
export default class S2Map extends EventTarget {
  readonly #container?: HTMLElement;
  #canvasContainer!: HTMLElement;
  // #navigationContainer!: HTMLElement;
  readonly #canvasMultiplier: number;
  readonly #canvas: HTMLCanvasElement;
  #attributionPopup?: HTMLDivElement;
  // #watermark?: HTMLAnchorElement;
  #compass?: HTMLElement;
  #colorBlind?: HTMLElement;
  #attributions: Attributions = {};
  bearing = 0; // degrees
  pitch = 0; // degrees
  colorMode: ColorMode = ColorMode.None;
  map?: S2MapUI;
  hash = false;
  offscreen?: Worker;
  id: string = Math.random().toString(36).replace('0.', '');
  isNative = false;
  isReady = false;
  /** @param options - map options */
  constructor(
    options: MapOptions = {
      canvasMultiplier: window.devicePixelRatio ?? 2,
      interactive: true,
      style: {},
    },
  ) {
    super();
    options.canvasMultiplier = this.#canvasMultiplier = Math.max(2, options.canvasMultiplier ?? 2);
    // set hash if necessary
    if (options.hash === true) {
      this.hash = true;
      // TODO: get this working even if style is a string
      if (typeof options.style === 'object')
        options.style.view = { ...options.style.view, ...parseHash() };
    }
    // get the container if we don't already have a canvas instance
    if (options.canvas === undefined) {
      if (typeof options.container === 'string') {
        const container = window.document.getElementById(options.container);
        if (container === null) throw new Error('Container not found.');
        this.#container = container;
      } else if (options.container instanceof HTMLElement) {
        this.#container = options.container;
      } else if (options.canvas === undefined) {
        throw new Error('Invalid type: "container" must be a String or HTMLElement.');
      }
    }
    // we now remove container from options for potential webworker
    delete options.container;
    // prep container, creating the canvas
    this.#canvas = options.canvas ?? this.#setupContainer(options);
    if ('node' in this.#canvas) this.isNative = true;
    // create map via a webworker if possible, otherwise just load it in directly
    void this.#setupCanvas(this.#canvas, options);
  }

  /**
   * Add an event listener overriding the original
   * @param type - type of event called
   * @param listener - event listener
   * @param options - event listener options
   */
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const { isReady } = this;
    // Call the original addEventListener method
    super.addEventListener(type, listener, options);
    // there are cases where the map loads so quickly that the ready event is missed
    // before the listener is added, so we need to check if the map was already ready
    if (type === 'ready' && isReady) {
      this.dispatchEvent(new CustomEvent('ready', { detail: this }));
    }
  }

  /* BUILD/CONSTRUCTION FUNCTIONS */

  /** Interal ready function. Let the user know that the map is ready. */
  #ready(): void {
    this.isReady = true;
    this.#onCanvasReady();
    this.dispatchEvent(new CustomEvent('ready', { detail: this }));
  }

  /**
   * Setup the container
   * @param options - MapOptions
   * @returns the canvas container element
   */
  #setupContainer(options: MapOptions): HTMLCanvasElement {
    if (this.#container === undefined) throw new Error('Container not found.');
    // prep container
    const container = this.#container;
    container.classList.add('s2-map');
    this.setDarkMode(options.darkMode);
    // build canvas-container
    const canvasContainer = (this.#canvasContainer = window.document.createElement('div'));
    canvasContainer.className = 's2-canvas-container';
    container.prepend(canvasContainer);
    // build canvas
    const canvas = window.document.createElement('canvas');
    canvas.className = 's2-canvas';
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('aria-label', 'S2Map');
    canvas.width = container.clientWidth * this.#canvasMultiplier;
    canvas.height = container.clientHeight * this.#canvasMultiplier;
    canvasContainer.appendChild(canvas);

    return canvas;
  }

  /**
   * Setup the canvas, workers, etc.
   * @param canvas - HTMLCanvasElement
   * @param options - MapOptions
   */
  async #setupCanvas(canvas: HTMLCanvasElement, options: MapOptions): Promise<void> {
    const isBrowser = options.canvas === undefined;
    // prep the ready function should it exist
    // prep webgpu/webgl type
    if (isBrowser && options.contextType === undefined) options.contextType = getContext();
    // if browser supports it, create an instance of the mapWorker
    // TODO: Safari offscreenCanvas sucks currently. It's so janky. Leave this here for when it's fixed.
    if (
      options.offscreen !== false &&
      !isSafari &&
      typeof canvas.transferControlToOffscreen === 'function'
    ) {
      const offscreenCanvas = canvas.transferControlToOffscreen();
      const mapWorker = (this.offscreen = new Worker(
        new URL('./workers/map.worker', import.meta.url),
        { name: 'map-worker', type: 'module' },
      ));
      mapWorker.onmessage = this.onMessage.bind(this);
      mapWorker.postMessage({ type: 'canvas', options, canvas: offscreenCanvas, id: this.id }, [
        offscreenCanvas,
      ]);
    } else {
      const Map = await import('./ui/s2mapUI.js').then((m) => m.default);
      this.map = new Map(options, canvas, this.id, this);
    }
    // now that canvas is setup, add control containers as necessary
    this.#setupControlContainer(options);
    // if we interact with the map, we need to both allow interaction with styling
    // and watch how the mouse moves on the canvas
    const canvasContainer = this.#canvasContainer;
    if (options.interactive ?? true) {
      canvasContainer.classList.add('s2-interactive');
      canvasContainer.addEventListener(
        'mousemove',
        this.#onCanvasMouseMove.bind(this) as (e: MouseEvent) => void,
      );
      canvasContainer.addEventListener(
        'contextmenu',
        this.#onCompassMouseDown.bind(this) as (e: MouseEvent) => void,
      );
      canvasContainer.addEventListener(
        'mouseleave',
        this.#onCanvasMouseLeave.bind(this) as () => void,
      );
      if (options.scrollZoom ?? true)
        canvasContainer.addEventListener(
          'wheel',
          this.#onScroll.bind(this) as (e: WheelEvent) => void,
        );
      canvasContainer.addEventListener(
        'mousedown',
        this.#onMouseDown.bind(this) as (e: MouseEvent) => void,
      );
      canvasContainer.addEventListener('touchstart', (e: TouchEvent) => {
        this.#onTouch(e, 'touchstart');
      });
      canvasContainer.addEventListener('touchend', (e: TouchEvent) => {
        this.#onTouch(e, 'touchend');
      });
      canvasContainer.addEventListener('touchmove', (e: TouchEvent) => {
        this.#onTouch(e, 'touchmove');
      });
    }
  }

  /** If mouse leaves the canvas, clear out any features considered "active" */
  #onCanvasMouseLeave(): void {
    this.#canvas.style.cursor = 'default';
    this.dispatchEvent(new CustomEvent('mouseleave', { detail: null }));
  }

  /**
   * Internal setup the control containers
   * @param options - map options
   */
  #setupControlContainer(options: MapOptions): void {
    const {
      attributions,
      controls,
      zoomController,
      compassController,
      colorblindController,
      attributionOff,
      watermarkOff,
    } = options;
    if (this.isNative) return;
    // add info bar with our jollyRoger
    if (attributionOff !== true) {
      const attribution = window.document.createElement('div');
      attribution.id = 's2-attribution';
      const info = window.document.createElement('div');
      info.className = info.id = 's2-info';
      /** Handle click on info bar */
      info.onclick = function () {
        attribution.classList.toggle('show');
      };
      const popup = (this.#attributionPopup = window.document.createElement('div'));
      popup.className = 's2-popup-container';
      popup.innerHTML =
        '<div>Rendered with ❤ by</div><a href="https://opens2.com" target="popup"><div class="s2-jolly-roger"></div></a>';
      // add attributions
      if (attributions !== undefined) {
        for (const name in attributions) {
          if (this.#attributions[name] === undefined) {
            this.#attributions[name] = attributions[name];
            popup.innerHTML += `<div><a href="${attributions[name]}" target="_popup">${name}</a></div>`;
          }
        }
      }
      attribution.appendChild(info);
      attribution.appendChild(popup);
      // add watermark
      if (watermarkOff !== true) {
        const watermark = window.document.createElement('a');
        watermark.className = 's2-watermark';
        watermark.href = 'https://opens2.com';
        watermark.target = '_popup';
        attribution.appendChild(watermark);
      }
      this.#container?.appendChild(attribution);
    }
    // if zoom or compass controllers, add
    if (controls !== false) {
      let navSep;
      let firstNavCompSet = false;
      // first create the container
      const navigationContainer = window.document.createElement('div');
      navigationContainer.className = 's2-nav-container';
      this.#container?.appendChild(navigationContainer);
      if (zoomController !== false) {
        // plus
        const zoomPlus = window.document.createElement('button');
        zoomPlus.className = 's2-control-button s2-zoom-plus';
        zoomPlus.setAttribute('aria-hidden', '');
        zoomPlus.tabIndex = -1;
        navigationContainer.appendChild(zoomPlus);
        zoomPlus.addEventListener('click', () => {
          this.#navEvent('zoomIn');
        });
        // seperator
        firstNavCompSet = true;
        navSep = window.document.createElement('div');
        navSep.className = 's2-nav-sep';
        navigationContainer.appendChild(navSep);
        // minus
        const zoomMinus = window.document.createElement('button');
        zoomMinus.className = 's2-control-button s2-zoom-minus';
        zoomMinus.setAttribute('aria-hidden', '');
        zoomMinus.tabIndex = -1;
        navigationContainer.appendChild(zoomMinus);
        zoomMinus.addEventListener('click', () => {
          this.#navEvent('zoomOut');
        });
      }
      if (compassController !== false) {
        if (!firstNavCompSet) {
          firstNavCompSet = true;
        } else {
          // seperator
          navSep = window.document.createElement('div');
          navSep.className = 's2-nav-sep';
          navigationContainer.appendChild(navSep);
        }
        // compass button
        const compassContainer = window.document.createElement('button');
        compassContainer.className = 's2-control-button';
        compassContainer.setAttribute('aria-hidden', '');
        compassContainer.tabIndex = -1;
        navigationContainer.appendChild(compassContainer);
        const compass = (this.#compass = window.document.createElement('div'));
        compass.className = 's2-compass';
        compass.setAttribute('aria-hidden', '');
        compass.tabIndex = -1;
        compassContainer.appendChild(compass);
        compassContainer.addEventListener(
          'mousedown',
          this.#onCompassMouseDown.bind(this) as (e: MouseEvent) => void,
        );
      }
      if (colorblindController !== false) {
        if (!firstNavCompSet) {
          firstNavCompSet = true;
        } else {
          // seperator
          navSep = window.document.createElement('div');
          navSep.className = 's2-nav-sep';
          navigationContainer.appendChild(navSep);
        }
        // colorblind button
        const colorBlind = (this.#colorBlind = window.document.createElement('button'));
        colorBlind.className = 's2-control-button s2-colorblind-button';
        colorBlind.id = 's2-colorblind-default';
        colorBlind.setAttribute('aria-hidden', '');
        colorBlind.tabIndex = -1;
        navigationContainer.appendChild(colorBlind);
        colorBlind.addEventListener('click', () => {
          this.#setColorMode();
        });
      }
    }
  }

  /* INTERNAL API */

  /**
   * @internal
   * @param data - The data to inject
   * Used by the WorkerPool.
   * Anytime a Source worker or Tile Worker has data to inject into the map,
   * it will call this function.
   */
  injectData(data: SourceWorkerMessage | TileWorkerMessage): void {
    const { type } = data;
    const { map, offscreen } = this;
    if (type === 'attributions') {
      this.#addAttributions(data.attributions);
    } else if (type === 'setStyle') {
      void this.setStyle(data.style, data.ignorePosition);
    } else if (offscreen !== undefined) {
      if (type === 'fill')
        offscreen.postMessage(data, [
          data.vertexBuffer,
          data.indexBuffer,
          data.idBuffer,
          data.codeTypeBuffer,
          data.featureGuideBuffer,
        ]);
      else if (type === 'line')
        offscreen.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer]);
      else if (type === 'glyph')
        offscreen.postMessage(data, [
          data.glyphFilterBuffer,
          data.glyphFilterIDBuffer,
          data.glyphQuadBuffer,
          data.glyphQuadIDBuffer,
          data.glyphColorBuffer,
          data.featureGuideBuffer,
        ]);
      else if (type === 'glyphimages')
        offscreen.postMessage(data, data.images.map((i) => i.data) as Transferable[]);
      else if (type === 'spriteimage') offscreen.postMessage(data, [data.image as Transferable]);
      else if (type === 'raster') offscreen.postMessage(data, [data.image as Transferable]);
      else if (type === 'point')
        offscreen.postMessage(data, [data.vertexBuffer, data.idBuffer, data.featureGuideBuffer]);
      else if (type === 'heatmap')
        offscreen.postMessage(data, [
          data.vertexBuffer,
          data.weightBuffer,
          data.featureGuideBuffer,
        ]);
      else if (type === 'interactive')
        offscreen.postMessage(data, [data.interactiveGuideBuffer, data.interactiveDataBuffer]);
      else offscreen.postMessage(data);
    } else if (map !== undefined) {
      map.injectData(data);
    }
  }

  /**
   * Used by the MapUI either from a thread or directly. to either
   * send messages to Source/Tile Workers or to the user.
   * @param message - The message to process
   * @internal
   */
  onMessage(message: MessageEvent<MapGLMessage>): void {
    const { data } = message;
    const { mapID, type } = data;
    if (type === 'tilerequest') {
      window.S2WorkerPool.tileRequest(mapID, data.tiles, data.sources);
    } else if (type === 'timerequest') {
      window.S2WorkerPool.timeRequest(mapID, data.tiles, data.sourceNames);
    } else if (type === 'mouseenter') {
      const { features } = data;
      this.#canvas.style.cursor = features[0]?.__cursor ?? 'default';
      this.dispatchEvent(new CustomEvent('mouseenter', { detail: data }));
    } else if (type === 'mouseleave') {
      const { currentFeatures } = data;
      if (currentFeatures.length === 0) this.#canvas.style.cursor = 'default';
      this.dispatchEvent(new CustomEvent('mouseleave', { detail: data }));
    } else if (type === 'click') {
      this.dispatchEvent(new CustomEvent('click', { detail: data }));
    } else if (type === 'view') {
      if (this.hash) setHash(data.view);
      this.dispatchEvent(new CustomEvent('view', { detail: data }));
    } else if (type === 'requestStyle') {
      window.S2WorkerPool.requestStyle(mapID, data.style, data.analytics, data.apiKey);
    } else if (type === 'style') {
      window.S2WorkerPool.injectStyle(mapID, data.style);
    } else if (type === 'updateCompass') {
      this._updateCompass(data.bearing, data.pitch);
    } else if (type === 'addLayer') {
      window.S2WorkerPool.addLayer(mapID, data.layer, data.index, data.tileRequest);
    } else if (type === 'deleteLayer') {
      window.S2WorkerPool.deleteLayer(mapID, data.index);
    } else if (type === 'reorderLayers') {
      window.S2WorkerPool.reorderLayers(mapID, data.layerChanges);
    } else if (type === 'screenshot') {
      this.dispatchEvent(
        new CustomEvent('screenshot', { detail: new Uint8ClampedArray(data.screen) }),
      );
    } else if (type === 'rendered') {
      this.dispatchEvent(new Event('rendered'));
    } else if (type === 'ready') {
      this.#ready();
    }
  }

  /* INTERNAL FUNCTIONS */

  /** internal function to handle canvas ready */
  #onCanvasReady(): void {
    // set color mode
    const mode = parseInt(localStorage.getItem('s2maps:gpu:colorBlindMode') ?? '0') as ColorMode;
    this.#setColorMode(mode);
    // now that canvas is setup, support resizing
    if (this.#container !== undefined && 'ResizeObserver' in window) {
      new ResizeObserver(this.#resize.bind(this) as () => void).observe(this.#container);
    } else window.addEventListener('resize', this.#resize.bind(this) as () => void);
    // let the S2WorkerPool know of this maps existance
    window.S2WorkerPool.addMap(this);
  }

  /**
   * Internal function to add missing attribution data.
   * @param attributions - Attributions object to inject into grouped attributions container
   */
  #addAttributions(attributions: Attributions = {}): void {
    if (this.#attributionPopup !== undefined) {
      for (const name in attributions) {
        if (this.#attributions[name] === undefined) {
          this.#attributions[name] = attributions[name];
          this.#attributionPopup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`;
        }
      }
    }
  }

  /**
   * Internal function to handle touch events
   * @param event - touch event
   * @param type - type of touch event
   */
  #onTouch(event: TouchEvent, type: 'touchstart' | 'touchend' | 'touchmove'): void {
    const { map, offscreen } = this;
    const canvasContainer = this.#canvasContainer;
    event.preventDefault();
    const { touches } = event;
    const { length } = touches;
    const touchEvent: UserTouchEvent = { length };

    for (let i = 0; i < length; i++) {
      const { clientX, clientY, pageX, pageY } = touches[i];
      const x = (pageX - canvasContainer.offsetLeft) * this.#canvasMultiplier;
      const y = (pageY - canvasContainer.offsetTop) * this.#canvasMultiplier;
      touchEvent[i] = { clientX, clientY, x, y };
    }
    offscreen?.postMessage({ type, touchEvent });
    if (map !== undefined) {
      if (type === 'touchstart') map.onTouchStart(touchEvent);
      else if (type === 'touchend') map.dragPan.onTouchEnd(touchEvent);
      else if (type === 'touchmove') map.dragPan.onTouchMove(touchEvent);
    }
  }

  /**
   * Internal function to handle scroll events
   * @param event - wheel event
   */
  #onScroll(event: WheelEvent): void {
    event.preventDefault();
    const { map, offscreen } = this;
    const { clientX, clientY, deltaY } = event;
    const rect = this.#canvas.getBoundingClientRect();
    offscreen?.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY });
    map?.onZoom(deltaY, clientX - rect.left, clientY - rect.top);
  }

  /**
   * Internal function to handle mouse down event
   * @param event - mouse down event
   */
  #onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const { map, offscreen } = this;
    // send off a mousedown
    offscreen?.postMessage({ type: 'mousedown' });
    map?.dragPan.onMouseDown();
    // build a listener to mousemovement
    const mouseMoveFunc: (e: MouseEvent) => void = this.#onMouseMove.bind(this);
    window.addEventListener('mousemove', mouseMoveFunc);
    // upon eventual mouseup, let the map know
    window.addEventListener(
      'mouseup',
      (e) => {
        const rect = this.#canvas.getBoundingClientRect();
        const { clientX, clientY } = e;
        window.removeEventListener('mousemove', mouseMoveFunc);
        offscreen?.postMessage({ type: 'mouseup', clientX, clientY, rect });
        map?.dragPan.onMouseUp(
          clientX - rect.left - rect.width / 2,
          rect.height / 2 - clientY - rect.top,
        );
      },
      { once: true },
    );
  }

  /**
   * Internal function to handle mouse move
   * @param event - mouse move event
   */
  #onMouseMove(event: MouseEvent): void {
    const { map, offscreen } = this;
    let { movementX, movementY } = event;
    movementX *= this.#canvasMultiplier;
    movementY *= this.#canvasMultiplier;
    offscreen?.postMessage({ type: 'mousemove', movementX, movementY });
    map?.dragPan.onMouseMove(movementX, movementY);
  }

  /**
   * Internal function to handle mouse move event inside the canvas
   * @param event - mouse move event
   */
  #onCanvasMouseMove(event: MouseEvent): void {
    const { map, offscreen } = this;
    const { layerX, layerY } = getLayerCoordinates(event);
    const x = layerX * this.#canvasMultiplier;
    const y = layerY * this.#canvasMultiplier;

    offscreen?.postMessage({ type: 'canvasmousemove', x, y });
    map?.onCanvasMouseMove(x, y);
  }

  /**
   * Internal function to handle compass update. Expands upon camera compass update
   * @param bearing - compass bearing
   * @param pitch - compass pitch
   */
  _updateCompass(bearing: number, pitch: number): void {
    this.bearing = -bearing;
    this.pitch = pitch;
    if (this.#compass !== undefined) {
      this.#compass.style.transform = `translate(-50%, -50%) rotate(${this.bearing}deg)`;
    }
  }

  /**
   * Internal function to handle mouse pressed down on the compass
   * @param event - mouse down event
   */
  #onCompassMouseDown(event: MouseEvent): void {
    event.preventDefault();
    const { map, offscreen } = this;
    const { abs } = Math;
    let totalMovementX = 0;
    let totalMovementY = 0;
    /**
     * Temp function to handle mouse movement while mouse is pressed on the compass
     * @param mEvent - mouse move event
     */
    const mouseMoveFunc = (mEvent: MouseEvent): void => {
      const { movementX, movementY } = mEvent;
      if (movementX !== 0) {
        totalMovementX += abs(movementX);
        totalMovementY += abs(movementY);
        offscreen?.postMessage({ type: 'updateCompass', bearing: movementX, pitch: movementY });
        map?.updateCompass(movementX, movementY);
      }
    };
    window.addEventListener('mousemove', mouseMoveFunc);
    window.addEventListener(
      'mouseup',
      () => {
        window.removeEventListener('mousemove', mouseMoveFunc);
        if (totalMovementX === 0 && totalMovementY === 0) {
          offscreen?.postMessage({ type: 'resetCompass' });
          map?.resetCompass();
        } else {
          offscreen?.postMessage({ type: 'mouseupCompass' });
          map?.mouseupCompass();
        }
      },
      { once: true },
    );
  }

  // #onCompassClick (): void {
  //   const { map, offscreen } = this
  //   offscreen?.postMessage({ type: 'resetCompass' })
  //   map?.resetCompass()
  // }

  /** resize the map */
  #resize(): void {
    const { map, offscreen } = this;
    const container = this.#container;
    if (container === undefined) return;
    const canvasMultiplier = this.#canvasMultiplier;
    // rebuild the proper width and height using the container as a guide
    offscreen?.postMessage({
      type: 'resize',
      width: container.clientWidth * canvasMultiplier,
      height: container.clientHeight * canvasMultiplier,
    });
    map?.resize(
      container.clientWidth * canvasMultiplier,
      container.clientHeight * canvasMultiplier,
    );
  }

  /**
   * Internal function to handle zoom in and zoom out events
   * @param ctrl - 'zoomIn' | 'zoomOut'
   */
  #navEvent(ctrl: 'zoomIn' | 'zoomOut'): void {
    const { map, offscreen } = this;
    offscreen?.postMessage({ type: 'nav', ctrl });
    map?.navEvent(ctrl);
  }

  /**
   * Internal function to set the colorblind mode
   * @param mode - colorblind mode
   */
  #setColorMode(mode?: ColorMode): void {
    const { map, offscreen } = this;
    if (mode !== undefined) this.colorMode = mode;
    else this.colorMode++;
    if (this.colorMode > 4) this.colorMode = ColorMode.None;
    localStorage.setItem('s2maps:gpu:colorBlindMode', String(this.colorMode));
    // update the icon
    const cM = this.colorMode;
    if (this.#colorBlind !== undefined)
      this.#colorBlind.id = `s2-colorblind${cM === 0 ? '-default' : cM === 1 ? '-proto' : cM === 2 ? '-deut' : cM === 3 ? '-trit' : '-grey'}`;
    // tell the map to update
    offscreen?.postMessage({ type: 'colorMode', mode: cM });
    map?.colorMode(cM);
  }

  /* API */

  /**
   * Delete the map instance to cleanup all resources
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
  delete(): void {
    const { offscreen, map } = this;
    this.dispatchEvent(new Event('delete'));
    offscreen?.postMessage({ type: 'delete' });
    offscreen?.terminate();
    map?.delete();
    // reset the worker pool
    window.S2WorkerPool.delete();
    // remove all canvas listeners via cloning
    if (this.#canvas instanceof HTMLCanvasElement)
      this.#canvas.replaceWith(this.#canvas.cloneNode(true));
    // cleanup the html
    if (this.#container !== undefined) {
      while (this.#container.lastChild !== null)
        this.#container.removeChild(this.#container.lastChild);
    }
  }

  /**
   * Update the state of the map's UI mode.
   *
   * ### Example
   * ```ts
   * import { S2Map } from 's2maps-gpu'; // or you can access it via the global `window.S2Map`
   * import type { MapOptions } from 's2maps-gpu';
   *
   * const options: MapOptions = { ..., darkMode: false }
   * const map = new S2Map(options)
   * // do something with the map
   * map.setDarkMode(true)
   * ```
   * @param state - which UI mode to set the map to. `true` for dark-mode, `false` for light-mode
   */
  setDarkMode(state: boolean = false): void {
    const classList = this.#container?.classList;
    if (state) classList?.add('dark-mode');
    else classList?.remove('dark-mode');
  }

  /**
   *
   */
  getContainer(): HTMLElement | undefined {
    return this.#container;
  }

  /**
   *
   */
  getCanvasContainer(): HTMLElement {
    return this.#canvasContainer;
  }

  /**
   *
   */
  getContainerDimensions(): null | VectorPoint {
    return { x: this.#container?.clientWidth ?? 0, y: this.#container?.clientHeight ?? 0 };
  }

  // in this case, reset the style from scratch
  /**
   * @param style
   * @param ignorePosition
   */
  async setStyle(style: StyleDefinition, ignorePosition = true): Promise<void> {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'setStyle', style, ignorePosition });
    await map?.setStyle(style, ignorePosition);
  }

  // in this case, check for changes and update accordingly
  /**
   * @param style
   */
  updateStyle(style: StyleDefinition): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'updateStyle', style });
    map?.updateStyle(style);
  }

  /**
   * @param state
   */
  setMoveState(state: boolean): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'moveState', state });
    map?.setMoveState(state);
  }

  /**
   * @param state
   */
  setZoomState(state: boolean): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'zoomState', state });
    map?.setZoomState(state);
  }

  /**
   * @param lon
   * @param lat
   * @param zoom
   */
  jumpTo(lon: number, lat: number, zoom?: number): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'jumpTo', lon, lat, zoom });
    map?.jumpTo(lon, lat, zoom);
  }

  /**
   * @param directions
   */
  easeTo(directions?: AnimationDirections): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'easeTo', directions });
    map?.animateTo('easeTo', directions);
  }

  /**
   * @param directions
   */
  flyTo(directions?: AnimationDirections): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'flyTo', directions });
    map?.animateTo('flyTo', directions);
  }

  /**
   * @param sourceName
   * @param href
   */
  addSource(sourceName: string, href: string): void {
    this.updateSource(sourceName, href, false, false);
  }

  /**
   * @param sourceName
   * @param href
   * @param keepCache
   * @param awaitReplace
   */
  updateSource(sourceName: string, href: string, keepCache = true, awaitReplace = true): void {
    this.resetSource([[sourceName, href]], keepCache, awaitReplace);
  }

  /**
   * @param sourceNames
   * @param keepCache
   * @param awaitReplace
   */
  resetSource(
    sourceNames: Array<[string, string | undefined]>,
    keepCache = false,
    awaitReplace = false,
  ): void {
    const { offscreen, map } = this;
    // clear old info s2json data should it exist
    const msg: ResetSourceMessage = { type: 'resetSource', sourceNames, keepCache, awaitReplace };
    offscreen?.postMessage(msg);
    map?.resetSource(sourceNames, keepCache, awaitReplace);
  }

  /**
   * @param sourceNames
   */
  deleteSource(sourceNames: string | string[]): void {
    const { offscreen, map } = this;
    if (!Array.isArray(sourceNames)) sourceNames = [sourceNames];
    // 1) tell worker pool we dont need info data anymore
    window.S2WorkerPool.deleteSource(this.id, sourceNames);
    // 2) clear old info s2json data should it exist
    offscreen?.postMessage({ type: 'clearSource', sourceNames });
    map?.clearSource(sourceNames);
  }

  // nameIndex -> if name it goes BEFORE the layer name specified. If layer name not found, it goes at the end
  // if no nameIndex, it goes at the end
  /**
   * @param layer
   * @param nameIndex
   */
  addLayer(layer: LayerStyle, nameIndex: number | string): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'addLayer', layer, nameIndex });
    map?.addLayer(layer, nameIndex);
  }

  // fullUpdate -> if false, don't ask webworkers to reupdate
  // nameIndex -> if name it finds the layer name to update, otherwise gives up
  /**
   * @param layer
   * @param nameIndex
   * @param fullUpdate
   */
  updateLayer(layer: LayerStyle, nameIndex: number | string, fullUpdate = true): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'updateLayer', layer, nameIndex, fullUpdate });
    map?.updateLayer(layer, nameIndex, fullUpdate);
  }

  // nameIndex -> if name it finds the layer name to update, otherwise gives up
  /**
   * @param nameIndex
   */
  deleteLayer(nameIndex: number | string): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'deleteLayer', nameIndex });
    map?.deleteLayer(nameIndex);
  }

  // { [+from]: +to }
  /**
   * @param layerChanges
   */
  reorderLayers(layerChanges: Record<number, number>): void {
    const { offscreen, map } = this;
    offscreen?.postMessage({ type: 'reorderLayers', layerChanges });
    map?.reorderLayers(layerChanges);
  }

  /**
   * @param markers
   * @param sourceName
   */
  addMarker(markers: MarkerDefinition | MarkerDefinition[], sourceName = '_markers'): void {
    if (!Array.isArray(markers)) markers = [markers];
    // 1) let the worker pool know we have new marker(s)
    window.S2WorkerPool.addMarkers(this.id, markers, sourceName);
    // 2) tell the map that (a) new marker(s) has/have been added
    this.resetSource([[sourceName, undefined]], true, true);
  }

  /**
   * @param ids
   * @param sourceName
   */
  removeMarker(ids: number | number[], sourceName = '_markers'): void {
    if (!Array.isArray(ids)) ids = [ids];
    // 1) let the worker pool know we need to remove marker(s)
    window.S2WorkerPool.deleteMarkers(this.id, ids, sourceName);
    // 2) tell the map that (a) marker(s) has/have to be removed
    this.resetSource([[sourceName, undefined]], true, false);
  }

  /**
   *
   */
  async screenshot(): Promise<null | Uint8Array> {
    const { offscreen, map } = this;
    return await new Promise<null | Uint8Array>((resolve) => {
      /**
       * Setup a listener for when the screenshot to be shipped back
       * @param event - the response with the screenshot
       */
      const listener = (event: CustomEvent<Uint8Array | null>): void => {
        resolve(event?.detail);
      };
      this.addEventListener('screenshot', listener, { once: true });
      offscreen?.postMessage({ type: 'screenshot' });
      map?.screenshot();
    });
  }

  /**
   *
   */
  async awaitFullyRendered(): Promise<void> {
    const { offscreen, map } = this;
    await new Promise<void>((resolve) => {
      this.addEventListener(
        'rendered',
        (): void => {
          resolve();
        },
        { once: true },
      );
      offscreen?.postMessage({ type: 'awaitRendered' });
      map?.awaitFullyRendered();
    });
  }
}

/**
 * Figure out the best canvas we have access to
 * @returns 1 for WebGL, 2 for WebGL2, 3 for WebGPU
 */
function getContext(): 1 | 2 | 3 {
  let tmpContext = document.createElement('canvas').getContext('webgpu');
  if (tmpContext !== null) {
    return 3;
  } else {
    tmpContext = document.createElement('canvas').getContext('webgl2');
    if (tmpContext !== null) {
      tmpContext.getExtension('WEBGL_lose_context')?.loseContext();
      return 2;
    }
  }
  return 1;
}

/** Internal function returns layer coordinates */
interface LayerCoordinates {
  layerX: number;
  layerY: number;
}

/**
 * Internal tool to get layer coordinates
 * @param event - mouse event
 * @returns the layer coordinates in a series of elements
 */
function getLayerCoordinates(event: MouseEvent): LayerCoordinates {
  const { target, offsetX, offsetY } = event;
  const targetElement = target as HTMLElement | null;
  let currentElement = targetElement;

  let layerX = offsetX;
  let layerY = offsetY;

  // Traverse up the DOM tree to find the nearest positioned ancestor
  while (currentElement !== null && currentElement !== document.body) {
    const { offsetLeft, offsetTop, offsetParent } = currentElement;
    const offsetParentElement = offsetParent;

    if (
      offsetParentElement !== null &&
      getComputedStyle(offsetParentElement).position !== 'static'
    ) {
      layerX += offsetLeft;
      layerY += offsetTop;
      break;
    }

    currentElement = offsetParentElement as HTMLElement | null;
  }

  return { layerX, layerY };
}

window.S2Map = S2Map;

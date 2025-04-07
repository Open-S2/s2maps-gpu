/** STYLE */
import Style from 'style';
/** PAINT */
import type { Painter as GLPainter } from 'gl/painter.spec';
import type { Painter as GPUPainter } from 'gpu/painter.spec';
import type { MapOptions } from '../s2mapUI';
/** GEOMETRY / PROJECTIONS */
import Projector from './projector';
import { tileIDWrapped as tileIDWrappedWM } from 'geometry/wm';
import { isFace, parent as parentID } from 'geometry/id';
/** SOURCES */
import Animator from './animator';
import Cache from './cache';
import DragPan from './dragPan';
import TimeCache from './timeCache';
import { createTile } from 'source';

import type { ClickEvent } from './dragPan';
import type S2Map from 's2Map';
import type { VectorPoint } from 'gis-tools';
import type { Combine, TileShared as Tile } from 'source/tile.spec';
import type {
  InteractiveObject,
  MouseClickMessage,
  MouseEnterMessage,
  MouseLeaveMessage,
  ReadyMessageGL,
  SourceFlushMessage,
  TileFlushMessage,
  TileRequest,
  TileWorkerMessage,
  ViewMessage,
} from 'workers/worker.spec';
import type { StyleDefinition, TimeSeriesStyle } from 'style/style.spec';

/**
 *
 */
export interface ResizeDimensions {
  width: number;
  height: number;
}

/**
 *
 */
export type SharedPainter = Combine<GLPainter | GPUPainter>;

/**
 *
 */
export default class Camera<P extends SharedPainter = SharedPainter> {
  readonly parent?: S2Map;
  id: string;
  readonly #canvas: HTMLCanvasElement;
  _canDraw = false; // let the render sequence know if the painter is ready to paint
  _interactive = false; // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
  readonly #scrollZoom: boolean; // allow the user to scroll over the canvas and cause a zoom change
  style: Style;
  projector: Projector;
  painter!: P;
  tileCache = new Cache<bigint, Tile>();
  timeCache?: TimeCache;
  tilesInView: Tile[] = []; // S2CellIDs of the tiles
  lastTileViewState: number[] = [];
  requestQueue: Tile[] = [];
  wasDirtyLastFrame = false;
  /** Denote this mapUI is running in a separate thread */
  webworker: boolean;
  canMove = true;
  canZoom = true;
  dragPan: DragPan = new DragPan();
  mouseMoved = true;
  mousePosition: VectorPoint = { x: 0, y: 0 };
  currAnimFunction?: (now: number) => void;
  resizeQueued?: ResizeDimensions;
  currFeatures = new Map<number, InteractiveObject>();
  /**
   * @param options
   * @param canvas
   * @param id
   * @param parent
   */
  constructor(options: MapOptions, canvas: HTMLCanvasElement, id: string, parent?: S2Map) {
    this.#canvas = canvas;
    // setup options
    const { style, interactive, scrollZoom, canMove, canZoom } = options;
    // assign webworker if applicable
    this.webworker = parent === undefined;
    // check if we can interact with the camera
    this._interactive = interactive ?? true;
    this.#scrollZoom = scrollZoom ?? true;
    this.canMove = canMove ?? true;
    this.canZoom = canZoom ?? true;
    // create style
    this.style = new Style(this, options);
    // setup projector
    this.projector = new Projector(options, this);
    this.id = id;
    this.parent = parent;
    // build the painter and style
    void this.#buildPaint(options, style);
  }

  // CREATED BY S2MAP_UI
  /**
   * @param _deltaZ
   * @param _deltaX
   * @param _deltaY
   */
  onZoom(_deltaZ: number, _deltaX?: number, _deltaY?: number): void {
    /* NOOP */
  }
  /**
   *
   */
  render(): void {
    /* NOOP */
  }

  /**
   * @param timeSeries
   */
  buildTimeCache(timeSeries: TimeSeriesStyle): void {
    const { webworker, painter } = this;
    this.timeCache = new TimeCache(this, webworker, timeSeries);
    painter.injectTimeCache(this.timeCache);
  }

  /**
   * @param options
   * @param style
   */
  async #buildPaint(options: MapOptions, style: string | StyleDefinition): Promise<void> {
    const isBuilt = await this.#createPainter(options);
    if (!isBuilt) throw new Error('Could not build painter');
    // now we setup canvas interaction
    this.#setupCanvas();
    // setup the style - this goes AFTER creation of the painter, because the
    // style will tell the painter what programs/pipelines it will be using
    await this._setStyle(style, false);
    // explain we are ready to paint
    const msg: ReadyMessageGL = { type: 'ready', mapID: this.id };
    if (this.webworker) postMessage(msg);
    else this.parent?.onMessage({ data: msg });
  }

  /**
   * @param style
   * @param ignorePosition
   */
  async _setStyle(style: string | StyleDefinition, ignorePosition: boolean): Promise<void> {
    // ensure we don't draw for a sec
    this._canDraw = false;
    // incase style was imported, clear cache
    this.tileCache.deleteAll();
    // build style for the map, painter, and webworkers
    this._canDraw = await this.style.buildStyle(style, ignorePosition);
    // render our first pass
    this.render();
  }

  /**
   *
   */
  #setupCanvas(): void {
    const { _interactive, dragPan } = this;
    // setup listeners
    this.#canvas.addEventListener(
      'webglcontextlost',
      this.#contextLost.bind(this) as EventListener,
    );
    this.#canvas.addEventListener(
      'webglcontextrestored',
      this.#contextRestored.bind(this) as EventListener,
    );
    // if we allow the user to interact with map, we add events
    if (_interactive) {
      // let dragPan know if we can zoom
      if (this.#scrollZoom) dragPan.zoomActive = true;
      // listen to dragPans updates
      dragPan.addEventListener('move', this.#onMovement.bind(this) as EventListener);
      dragPan.addEventListener('swipe', this.#onSwipe.bind(this) as EventListener);
      dragPan.addEventListener('zoom', () => {
        this.onZoom(dragPan.zoom);
      });
      dragPan.addEventListener('click', ((e: CustomEvent) => {
        this.#onClick(e);
      }) as EventListener);
      dragPan.addEventListener('doubleClick', ((e: CustomEvent) => {
        this.#onDoubleClick(e);
      }) as EventListener);
    }
    // setup camera
    this.#resizeCamera(this.#canvas.width, this.#canvas.height);
  }

  /**
   * @param _evt
   */
  #contextLost(_evt: Event): void {
    console.warn('context lost');
  }

  /**
   *
   */
  #contextRestored(): void {
    console.info('context restored');
  }

  // we figure out which context we can use before pulling in GL or GPU
  // After we have the appropriate context, we build the painter and then the
  /**
   * @param options
   */
  async #createPainter(options: MapOptions): Promise<boolean> {
    const { contextType } = options;
    let context: null | GPUCanvasContext | WebGL2RenderingContext | WebGLRenderingContext = null;
    // first try webGPU
    if (contextType === 3) {
      context = this.#canvas.getContext('webgpu') as unknown as GPUCanvasContext; // GPUCanvasContext
      if (context === null) return false;
      const Painter = await import('gpu').then((m) => m.Painter);
      this.painter = new Painter(context, options) as unknown as P;
      await this.painter.prepare();
    } else {
      let type: 1 | 2 = 1;
      // prep webgl style options
      const webglOptions = {
        antialias: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        alpha: true,
        stencil: true,
      };
      // than try webgl2
      if (contextType === 2) {
        context = this.#canvas.getContext('webgl2', webglOptions) as WebGL2RenderingContext;
        type = 2;
      }
      if (context === null) {
        // last effort, webgl1
        webglOptions.premultipliedAlpha = true;
        context = this.#canvas.getContext('webgl', webglOptions) as WebGLRenderingContext;
      }
      if (context === null) return false;
      const Painter = await import('gl').then((m) => m.Painter);
      this.painter = new Painter(context, type, options) as unknown as P;
    }

    return true;
  }

  /**
   * @param bearing
   * @param pitch
   */
  _updateCompass(bearing: number, pitch: number): void {
    if (this.webworker) postMessage({ type: 'updateCompass', bearing, pitch });
    else this.parent?._updateCompass(bearing, pitch);
  }

  /**
   * @param width
   * @param height
   */
  #resizeCamera(width: number, height: number): void {
    // ensure minimum is 1px for both
    width = Math.max(width, 1);
    height = Math.max(height, 1);
    // update the projector and painter
    this.projector.resize(width, height);
    this.painter.resize(width, height);
  }

  // keepCache => don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
  // awaitReplace => to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
  /**
   * @param sourceNames
   * @param keepCache
   * @param awaitReplace
   */
  _resetTileCache(sourceNames: string[], keepCache: boolean, awaitReplace: boolean): TileRequest[] {
    // TODO:
    // get tiles in view, prep request for said tiles
    const tilesInView = this.getTiles();
    const tileIDs = tilesInView.map((tile) => tile.id);
    const tileRequests: TileRequest[] = [];
    // delete all tiles not in view, add to tileRequests for those that are,
    // and delete source data from tile
    this.tileCache.forEach((tile, key) => {
      if (!keepCache && !tileIDs.includes(key)) {
        // just remove the tile for simplicity
        this.tileCache.delete(key);
      } else {
        // add to tileRequests
        const { id, face, zoom, i, j, bbox, type, division } = tile;
        tileRequests.push({ id, face, zoom, i, j, bbox, type, division });
        if (!awaitReplace) tile.deleteSources(sourceNames);
      }
    });

    return tileRequests;
  }

  /**
   *
   */
  _resize(): void {
    const { resizeQueued } = this;
    if (resizeQueued !== undefined) {
      // remove any prexisting animations
      this.currAnimFunction = undefined;
      // grab width and height
      const { width, height } = resizeQueued;
      this.#canvas.width = width;
      this.#canvas.height = height;
      this.#resizeCamera(width, height);
      this.resizeQueued = undefined;
    }
  }

  /**
   * @param posX
   * @param posY
   */
  _setMousePosition(posX: number, posY: number): void {
    this.mousePosition = { x: posX, y: posY };
    this.projector.setMousePosition(posX, posY);
    // NOTE: Sometimes mouse positions update before the painter is ready, so discard them
    if (this._canDraw) this.painter.dirty = true;
  }

  /**
   * @param root0
   * @param root0.detail
   */
  #onClick({ detail }: ClickEvent): void {
    const { id: mapID, projector, currFeatures, parent, webworker } = this;
    // get lon lat of cursor
    const { posX, posY } = detail;
    const lonLat = projector.cursorToLonLat(posX, posY);
    if (lonLat === undefined) return;
    const { x: lon, y: lat } = lonLat;
    // send off the information
    const msg: MouseClickMessage = {
      type: 'click',
      mapID,
      features: [...currFeatures.values()],
      lon,
      lat,
    };
    if (webworker) postMessage(msg);
    else parent?.onMessage({ data: msg });
  }

  /**
   * @param root0
   * @param root0.detail
   */
  #onDoubleClick({ detail }: ClickEvent): void {
    const { posX, posY } = detail;
    const lonLat = this.projector.cursorToLonLat(posX, posY);
    if (lonLat === undefined) return;
    const { x: lon, y: lat } = lonLat;
    this._navEvent('zoomIn', lon, lat);
  }

  /**
   * @param ctrl
   * @param lon
   * @param lat
   */
  _navEvent(ctrl: 'zoomIn' | 'zoomOut', lon?: number, lat?: number): void {
    const { projector } = this;
    const startZoom = projector.zoom;
    const endZoom = startZoom + (ctrl === 'zoomIn' ? 1 : -1);
    // build animation
    const animator = new Animator(projector, { duration: 1.5, zoom: endZoom, lon, lat });
    animator.zoomTo();
    /**
     * @param now
     */
    this.currAnimFunction = (now: number) => {
      this._animate(animator, now * 0.001);
    };
    // render
    this.render();
  }

  /**
   *
   */
  _onViewUpdate(): void {
    const { id: mapID, projector, webworker, parent } = this;
    const { zoom, lon, lat, bearing, pitch } = projector;
    const msg: ViewMessage = { type: 'view', mapID, view: { zoom, lon, lat, bearing, pitch } };
    if (webworker) postMessage(msg);
    else parent?.onMessage({ data: msg });
  }

  /**
   *
   */
  async _onCanvasMouseMove(): Promise<void> {
    const {
      style,
      mousePosition: { x, y },
      painter,
      currFeatures,
      tileCache,
    } = this;
    if (!style.interactive) return;
    const foundObjects = new Map<number, InteractiveObject>();
    const featureIDs = await painter.context.getFeatureAtMousePosition(x, y);
    // if we found an ID and said feature is not the same as the current, we dive down
    for (const featureID of featureIDs) {
      // first check if we already have the feature
      const hasFeature = currFeatures.get(featureID);
      if (hasFeature !== undefined) {
        foundObjects.set(featureID, hasFeature);
        continue;
      }
      // otherwise, we check the tiles in our store
      for (const tile of tileCache.getAll()) {
        const feature = tile.getInteractiveFeature(featureID);
        if (feature !== undefined) {
          foundObjects.set(featureID, feature);
          break;
        }
      }
    }
    this.#handleFeatureChange(foundObjects);
  }

  /**
   * @param foundFeatures
   */
  #handleFeatureChange(foundFeatures: Map<number, InteractiveObject>): void {
    const previousFrameFeatures = this.currFeatures;
    // ensure currFeature is up-to-date
    this.currFeatures = foundFeatures;
    const currentFeatures = [...foundFeatures.values()];

    // find all the new features found this frame compared to the previous frame
    const newFeatures: InteractiveObject[] = [];
    for (const [id, feature] of foundFeatures) {
      if (!previousFrameFeatures.has(id)) newFeatures.push(feature);
    }
    this.#submitFeatureChanges('mouseenter', newFeatures, currentFeatures);
    // find all the old features found in the previous frame compared to the current frame
    const oldFeatures: InteractiveObject[] = [];
    for (const [id, feature] of previousFrameFeatures) {
      if (!foundFeatures.has(id)) oldFeatures.push(feature);
    }
    this.#submitFeatureChanges('mouseleave', oldFeatures, currentFeatures);

    // due to a potential change in feature draw properties (change in color/size/etc.) we draw again
    this.render();
  }

  /**
   * @param type
   * @param features
   * @param currentFeatures
   */
  #submitFeatureChanges(
    type: 'mouseenter' | 'mouseleave',
    features: InteractiveObject[],
    currentFeatures: InteractiveObject[],
  ): void {
    if (features.length === 0) return;
    const { id: mapID, webworker, parent } = this;
    const msg: MouseEnterMessage | MouseLeaveMessage = { type, mapID, features, currentFeatures };
    if (webworker) postMessage(msg);
    else parent?.onMessage({ data: msg });
  }

  /**
   *
   */
  #onMovement(): void {
    const { projector, dragPan, canMove } = this;
    if (!canMove) return;
    const { movementX, movementY } = dragPan;
    // update projector
    projector.onMove(movementX, movementY);
    this.render();
  }

  /**
   *
   */
  #onSwipe(): void {
    const { projector, dragPan, canMove } = this;
    const { movementX, movementY } = dragPan;
    if (!canMove) return;
    // build animation
    const animator = new Animator(projector, { duration: 1.75 });
    animator.swipeTo(movementX, movementY);
    /**
     * @param now
     */
    this.currAnimFunction = (now: number) => {
      this._animate(animator, now * 0.001);
    };
    // render
    this.render();
  }

  /**
   * @param animator
   * @param curTime
   */
  _animate(animator: Animator, curTime: number): void {
    // ensure new render is queued
    this.render();
    // tell the animator to increment frame
    const done = animator.increment(curTime);
    // continue animation if not done and no mouse/touch events
    if (done || this.dragPan.mouseActive) this.currAnimFunction = undefined;
  }

  /**
   *
   */
  _updatePainter(): void {
    const { painter } = this;
    painter.dirty = true;
    this.render();
  }

  /**
   * @param data
   */
  _injectData(data: TileWorkerMessage | SourceFlushMessage): void {
    const { painter, tileCache } = this;
    const { type } = data;

    if (type === 'interactive')
      this.#injectInteractiveData(
        data.tileID,
        data.interactiveGuideBuffer,
        data.interactiveDataBuffer,
      );
    else if (type === 'flush') this.#injectFlush(data);
    else if (type === 'glyphimages')
      painter.injectGlyphImages(data.maxHeight, data.images, tileCache.getAll());
    else if (type === 'spriteimage') painter.injectSpriteImage(data, tileCache.getAll());
    else if (type === 'timesource') this._addTimeSource(data.sourceName, data.interval);
    else {
      // 1) grab the tile
      const tile = tileCache.get(data.tileID);
      if (tile === undefined) return;
      // 2) Build features via the painter. Said workflow will add to the tile's feature list
      painter.buildFeatureData(tile, data);
    }

    // new 'paint', so painter is dirty
    painter.dirty = true;
    this.render();
  }

  /**
   * @param data
   */
  #injectFlush(data: TileFlushMessage | SourceFlushMessage): void {
    const { tileID } = data;
    const tile = this.tileCache.get(tileID);
    tile?.flush(data);
  }

  /**
   * @param sourceName
   * @param interval
   */
  _addTimeSource(sourceName: string, interval: number): void {
    this.timeCache?.addSource(sourceName, interval);
  }

  /**
   * @param tileID
   * @param interactiveGuideBuffer
   * @param interactiveDataBuffer
   */
  #injectInteractiveData(
    tileID: bigint,
    interactiveGuideBuffer: ArrayBuffer,
    interactiveDataBuffer: ArrayBuffer,
  ): void {
    const { tileCache } = this;
    if (tileCache.has(tileID)) {
      const tile = tileCache.get(tileID);
      if (tile === undefined) return;
      tile.injectInteractiveData(
        new Uint32Array(interactiveGuideBuffer),
        new Uint8Array(interactiveDataBuffer),
      );
    }
  }

  /**
   * @param tileID
   */
  getTile(tileID: bigint): undefined | Tile {
    return this.tileCache.get(tileID);
  }

  /**
   *
   */
  getTiles(): Tile[] {
    const { tileCache, projector, painter, style } = this;
    if (projector.dirty) {
      painter.dirty = true; // to avoid re-requesting getTiles (which is expensive), we set painter.dirty to true
      let tilesInView: bigint[] = [];
      // no matter what we need to update what's in view
      const newTiles: Tile[] = [];
      // update tiles in view
      tilesInView = projector.getTilesInView();
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (const id of tilesInView) {
        if (!tileCache.has(id)) {
          // tile not found, so we create it
          const createdTiles = this.#createTiles(id);
          // store reference for the style to request from webworker(s)
          newTiles.push(...createdTiles);
        }
      }
      // if new tiles exist, ensture the worker and painter are updated
      // do not request out of bounds tiles because they just reference
      // the "wrapped" real world tiles
      const newTilesWithoutOutofBounds = newTiles.filter((tile) => !tile.outofBounds);
      if (newTilesWithoutOutofBounds.length > 0) style.requestTiles(newTilesWithoutOutofBounds);
      // given the S2CellID, find them in cache and return them
      this.tilesInView = tileCache.getBatch(tilesInView);
    }
    return this.tilesInView;
  }

  /**
   * @param tileIDs
   */
  createFutureTiles(tileIDs: bigint[]): void {
    const { tileCache, painter, style } = this;
    const newTiles: Tile[] = [];
    // create the tiles
    for (const id of tileIDs) {
      if (!tileCache.has(id)) {
        const createdTiles = this.#createTiles(id);
        newTiles.push(...createdTiles);
      }
    }
    // tell the style to make the requests
    painter.dirty = true;
    style.requestTiles(newTiles);
  }

  // although steriotypical, we only create a single tile from the S2CellID or WMID,
  // if the tile is out of bounds, we may need to create a second tile that
  // it references (the "wrapped" tile). Often times the tile already exists
  /**
   * @param id
   */
  #createTiles(id: bigint): Tile[] {
    const res: Tile[] = [];
    const { style, painter, tileCache, projector } = this;
    const { projection } = projector;
    // create tile
    const tile = createTile(projector.projection, painter.context, id);
    res.push(tile);
    // should our style have mask layers, let's add them
    style.injectMaskLayers(tile);
    // inject parent should one exist
    if (!isFace(projection, id)) {
      // get closest parent S2CellID. If actively zooming, the parent tile will pass along
      // it's parent tile (and so forth) if its own data has not been processed yet.
      const pID = parentID(projection, id);
      // check if parent tile exists, if so inject
      const parent = tileCache.get(pID);
      if (parent !== undefined) tile.injectParentTile(parent, style.layers);
    }
    if (tile.outofBounds) {
      // This is a WM only case. Inject "wrapped" tile's featureGuides as a reference
      const wrappedID: bigint = tileIDWrappedWM(id);
      if (!tileCache.has(wrappedID)) res.push(...this.#createTiles(wrappedID));
      const wrappedTile = tileCache.get(wrappedID);
      if (wrappedTile !== undefined) tile.injectWrappedTile(wrappedTile);
    }
    // store the tile
    tileCache.set(id, tile);

    return res;
  }

  /**
   *
   */
  _draw(): void {
    const { style, painter, projector } = this;
    // prep tiles
    const tiles = this.getTiles();
    // if any changes, we paint new scene
    if (style.dirty || painter.dirty || projector.dirty) {
      // store for future draw that it was a "dirty" frame
      this.wasDirtyLastFrame = true;
      // paint scene
      painter.paint(projector, tiles);
    }
    // draw the interactive elements if there was no movement/zoom change
    if (style.interactive && !projector.dirty && this.wasDirtyLastFrame) {
      this.wasDirtyLastFrame = false;
      painter.computeInteractive(tiles);
    }
    // cleanup
    painter.dirty = false;
    style.dirty = false;
    projector.dirty = false;
  }
}

/** STYLE **/
import Style from 'style'
/** PAINT **/
import type { Painter as GLPainter } from 'gl/painter.spec'
import type { Painter as GPUPainter } from 'gpu/painter.spec'
import type { MapOptions } from '../s2mapUI'
/** PROJECTIONS **/
import { isFace, parent as parentID } from 'geometry/id'
import Projector from './projector'
/** SOURCES **/
import { createTile } from 'source'
import Cache from './cache'
import TimeCache from './timeCache'
import DragPan, { type ClickEvent } from './dragPan'
import Animator from './animator'
import { type StyleDefinition, type TimeSeriesStyle } from 'style/style.spec'

import type S2Map from 's2Map'
import type { FlushData, InteractiveObject, ReadyMessageGL, TileRequest, TileWorkerMessage } from 'workers/worker.spec'
import type { Combine, TileShared as Tile } from 'source/tile.spec'

export interface ResizeDimensions {
  width: number
  height: number
}

export type SharedPainter = Combine<GLPainter | GPUPainter>

export default class Camera<P extends SharedPainter = SharedPainter> {
  readonly parent?: S2Map
  id: string
  readonly #canvas: HTMLCanvasElement
  _canDraw = false // let the render sequence know if the painter is ready to paint
  _interactive = false // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
  readonly #scrollZoom: boolean // allow the user to scroll over the canvas and cause a zoom change
  style: Style
  projector: Projector
  painter!: P
  tileCache = new Cache<bigint, Tile>()
  timeCache?: TimeCache
  tilesInView: Tile[] = [] // S2CellIDs of the tiles
  lastTileViewState: number[] = []
  requestQueue: Tile[] = []
  wasDirtyLastFrame = false
  webworker: boolean
  canMove = true
  canZoom = true
  dragPan: DragPan = new DragPan()
  mouseMoved = true
  mousePosition: [number, number] = [0, 0]
  currAnimFunction?: (now: number) => void
  resizeQueued?: ResizeDimensions
  currFeature: null | InteractiveObject = null
  constructor (options: MapOptions, canvas: HTMLCanvasElement, id: string, parent?: S2Map) {
    this.#canvas = canvas
    // setup options
    const { style, webworker, interactive, scrollZoom, canMove, canZoom } = options
    // assign webworker if applicable
    this.webworker = webworker ?? false
    // check if we can interact with the camera
    this._interactive = interactive ?? true
    this.#scrollZoom = scrollZoom ?? true
    this.canMove = canMove ?? true
    this.canZoom = canZoom ?? true
    // create style
    this.style = new Style(this, options)
    // setup projector
    this.projector = new Projector(options, this)
    this.id = id
    this.parent = parent
    // build the painter and style
    void this.#buildPaint(options, style)
  }

  // CREATED BY S2MAP_UI
  onZoom (_deltaZ: number, _deltaX?: number, _deltaY?: number): void { /* NOOP */ }
  render (): void { /* NOOP */ }

  buildTimeCache (timeSeries: TimeSeriesStyle): void {
    const { webworker, painter } = this
    this.timeCache = new TimeCache(this, webworker, timeSeries)
    painter.injectTimeCache(this.timeCache)
  }

  async #buildPaint (options: MapOptions, style: string | StyleDefinition): Promise<void> {
    const isBuilt = await this.#createPainter(options)
    if (!isBuilt) throw new Error('Could not build painter')
    // now we setup canvas interaction
    this.#setupCanvas()
    // setup the style - this goes AFTER creation of the painter, because the
    // style will tell the painter what programs/pipelines it will be using
    await this._setStyle(style, false)
    // explain we are ready to paint
    const msg: ReadyMessageGL = { type: 'ready', mapID: this.id }
    if (this.webworker) postMessage(msg)
    else this.parent?.ready()
  }

  async _setStyle (style: string | StyleDefinition, ignorePosition: boolean): Promise<void> {
    // ensure we don't draw for a sec
    this._canDraw = false
    // incase style was imported, clear cache
    this.tileCache.deleteAll()
    // build style for the map, painter, and webworkers
    this._canDraw = await this.style.buildStyle(style)
    // inject minzoom and maxzoom
    if (typeof style !== 'string') this.projector.setStyleParameters(style, ignorePosition)
    // render our first pass
    this.render()
  }

  #setupCanvas (): void {
    const { _interactive, dragPan } = this
    // setup listeners
    this.#canvas.addEventListener('webglcontextlost', this.#contextLost.bind(this) as EventListener)
    this.#canvas.addEventListener('webglcontextrestored', this.#contextRestored.bind(this) as EventListener)
    // if we allow the user to interact with map, we add events
    if (_interactive) {
      // let dragPan know if we can zoom
      if (this.#scrollZoom) dragPan.zoomActive = true
      // listen to dragPans updates
      dragPan.addEventListener('move', this.#onMovement.bind(this) as EventListener)
      dragPan.addEventListener('swipe', this.#onSwipe.bind(this) as EventListener)
      dragPan.addEventListener('zoom', () => { this.onZoom(dragPan.zoom) })
      dragPan.addEventListener('click', ((e: CustomEvent) => { this.#onClick(e) }) as EventListener)
      dragPan.addEventListener('doubleClick', ((e: CustomEvent) => { this.#onDoubleClick(e) }) as EventListener)
    }
    // setup camera
    this.#resizeCamera(this.#canvas.width, this.#canvas.height)
  }

  #contextLost (evt: Event): void {
    console.warn('context lost')
  }

  #contextRestored (): void {
    console.info('context restored')
  }

  // we figure out which context we can use before pulling in GL or GPU
  // After we have the appropriate context, we build the painter and then the
  async #createPainter (options: MapOptions): Promise<boolean> {
    const { contextType } = options
    let context: null | GPUCanvasContext | WebGL2RenderingContext | WebGLRenderingContext = null
    // first try webGPU
    if (contextType === 3) {
      context = this.#canvas.getContext('webgpu') as unknown as GPUCanvasContext // GPUCanvasContext
      if (context === null) return false
      const Painter = await import('gpu').then(m => m.Painter)
      this.painter = new Painter(context, options) as unknown as P
      await this.painter.prepare()
    } else {
      let type: 1 | 2 = 1
      // prep webgl style options
      const webglOptions = { antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true, stencil: true }
      // than try webgl2
      if (contextType === 2) {
        context = this.#canvas.getContext('webgl2', webglOptions) as WebGL2RenderingContext
        type = 2
      }
      if (context === null) { // last effort, webgl1
        webglOptions.premultipliedAlpha = true
        context = this.#canvas.getContext('webgl', webglOptions) as WebGLRenderingContext
      }
      if (context === null) return false
      const Painter = await import('gl').then(m => m.Painter)
      this.painter = new Painter(context, type, options) as unknown as P
    }

    return true
  }

  _updateCompass (bearing: number, pitch: number): void {
    if (this.webworker) postMessage({ type: 'updateCompass', bearing, pitch })
    else this.parent?._updateCompass(bearing, pitch)
  }

  #resizeCamera (width: number, height: number): void {
    // ensure minimum is 1px for both
    width = Math.max(width, 1)
    height = Math.max(height, 1)
    // update the projector and painter
    this.projector.resize(width, height)
    this.painter.resize(width, height)
  }

  // keepCache => don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
  // awaitReplace => to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
  _resetTileCache (
    sourceNames: string[],
    keepCache: boolean,
    awaitReplace: boolean
  ): TileRequest[] {
    // TODO:
    // get tiles in view, prep request for said tiles
    const tilesInView = this.getTiles()
    const tileIDs = tilesInView.map(tile => tile.id)
    const tileRequests: TileRequest[] = []
    // delete all tiles not in view, add to tileRequests for those that are,
    // and delete source data from tile
    this.tileCache.forEach((tile, key) => {
      if (!keepCache && !tileIDs.includes(key)) { // just remove the tile for simplicity
        this.tileCache.delete(key)
      } else { // add to tileRequests
        const { id, face, zoom, i, j, bbox, type, division } = tile
        tileRequests.push({ id, face, zoom, i, j, bbox, type, division })
        if (!awaitReplace) tile.deleteSources(sourceNames)
      }
    })

    return tileRequests
  }

  _resize (): void {
    const { resizeQueued } = this
    if (resizeQueued !== undefined) {
      // remove any prexisting animations
      this.currAnimFunction = undefined
      // grab width and height
      const { width, height } = resizeQueued
      this.#canvas.width = width
      this.#canvas.height = height
      this.#resizeCamera(width, height)
      this.resizeQueued = undefined
    }
  }

  _setMousePosition (posX: number, posY: number): void {
    this.mousePosition = [posX, posY]
    this.projector.setMousePosition(posX, posY)
    this.painter.dirty = true
  }

  #onClick ({ detail }: ClickEvent): void {
    const { projector, currFeature, parent } = this
    // get lon lat of cursor
    const { posX, posY } = detail
    const lonLat = projector.cursorToLonLat(posX, posY)
    if (lonLat === undefined) return
    const [lon, lat] = lonLat
    // send off the information
    if (this.webworker) {
      postMessage({ type: 'click', feature: currFeature, lon, lat })
    } else {
      parent?.dispatchEvent(new CustomEvent('click', { detail: { feature: currFeature, lon, lat } }))
    }
  }

  #onDoubleClick ({ detail }: ClickEvent): void {
    const { posX, posY } = detail
    const lonLat = this.projector.cursorToLonLat(posX, posY)
    if (lonLat === undefined) return
    const [lon, lat] = lonLat
    this._navEvent('zoomIn', lon, lat)
  }

  _navEvent (ctrl: 'zoomIn' | 'zoomOut', lon?: number, lat?: number): void {
    const { projector } = this
    const startZoom = projector.zoom
    const endZoom = startZoom + ((ctrl === 'zoomIn') ? 1 : -1)
    // build animation
    const animator = new Animator(projector, { duration: 1.5, zoom: endZoom, lon, lat })
    animator.zoomTo()
    this.currAnimFunction = (now: number) => { this._animate(animator, now * 0.001) }
    // render
    this.render()
  }

  _onPositionUpdate (): void {
    const { projector } = this
    const { zoom, lon, lat } = projector
    if (this.webworker) postMessage({ type: 'pos', zoom, lon, lat })
    else this.parent?.dispatchEvent(new CustomEvent('pos', { detail: { zoom, lon, lat } }))
  }

  async _onCanvasMouseMove (): Promise<void> {
    const { style, mousePosition, currFeature } = this
    if (!style.interactive) return
    const featureID = await this.painter.context.getFeatureAtMousePosition(...mousePosition)
    // if we found an ID and said feature is not the same as the current, we dive down
    // @ts-expect-error isNaN can check for properties that are not numbers
    if (isNaN(featureID) && currFeature !== null) {
      this.#handleFeatureChange(null)
    } else if (
      typeof featureID === 'number' &&
      (currFeature === null || currFeature.__id !== featureID)
    ) {
      let found = false
      for (const tile of this.tilesInView) {
        const feature = tile.getInteractiveFeature(featureID)
        if (feature !== undefined) {
          this.#handleFeatureChange(feature)
          found = true
          break
        }
      }
      if (!found && currFeature !== undefined) this.#handleFeatureChange(null)
    }
  }

  #handleFeatureChange (newFeature: null | InteractiveObject): void {
    const oldFeature = this.currFeature
    // ensure currFeature is up-to-date
    this.currFeature = newFeature
    // handle old feature
    if (this.webworker) {
      postMessage({ type: 'mouseleave', feature: oldFeature })
    } else {
      if (oldFeature !== null) this.parent?.dispatchEvent(new CustomEvent('mouseleave', { detail: oldFeature }))
      this.#canvas.style.cursor = 'default'
    }
    // handle new feature
    if (newFeature !== null) {
      if (this.webworker) {
        postMessage({ type: 'mouseenter', feature: newFeature })
      } else {
        this.parent?.dispatchEvent(new CustomEvent('mouseenter', { detail: newFeature }))
        this.#canvas.style.cursor = newFeature?.__cursor ?? 'default'
      }
    }
    // due to a potential change in feature draw properties (change in color/size/etc.) we draw again
    this.render()
  }

  #onMovement (): void {
    if (!this.canMove) return
    const { projector, dragPan } = this
    const { movementX, movementY } = dragPan
    // update projector
    projector.onMove(movementX, movementY)
    this.render()
  }

  #onSwipe (): void {
    if (!this.canMove) return
    const { projector, dragPan } = this
    const { movementX, movementY } = dragPan
    // build animation
    const animator = new Animator(projector, { duration: 1.75 })
    animator.swipeTo(movementX, movementY)
    this.currAnimFunction = (now: number) => { this._animate(animator, now * 0.001) }
    // render
    this.render()
  }

  _animate (animator: Animator, curTime: number): void {
    // ensure new render is queued
    this.render()
    // tell the animator to increment frame
    const done = animator.increment(curTime)
    // continue animation if not done and no mouse/touch events
    if (done || this.dragPan.mouseActive) this.currAnimFunction = undefined
  }

  _updatePainter (): void {
    const { painter } = this
    painter.dirty = true
    this.render()
  }

  _injectData (data: TileWorkerMessage): void {
    const { type } = data

    if (type === 'interactive') this.#injectInteractiveData(data.tileID, data.interactiveGuideBuffer, data.interactiveDataBuffer)
    else if (type === 'flush') this.#injectFlush(data)
    else if (type === 'glyphimages') this.painter.injectGlyphImages(data.maxHeight, data.images, this.tileCache.getAll())
    else if (type === 'spriteimage') this.painter.injectSpriteImage(data, this.tileCache.getAll())
    else if (type === 'timesource') this._addTimeSource(data.sourceName, data.interval)
    else {
      // 1) grab the tile
      const tile = this.tileCache.get(data.tileID)
      if (tile === undefined) return
      // 2) Build features via the painter. Said workflow will add to the tile's feature list
      this.painter.buildFeatureData(tile, data)
    }

    // new 'paint', so painter is dirty
    this.painter.dirty = true
    this.render()
  }

  #injectFlush (data: FlushData): void {
    const { tileID } = data
    const tile = this.tileCache.get(tileID)
    tile?.flush(data)
  }

  _addTimeSource (sourceName: string, interval: number): void {
    this.timeCache?.addSource(sourceName, interval)
  }

  #injectInteractiveData (
    tileID: bigint,
    interactiveGuideBuffer: ArrayBuffer,
    interactiveDataBuffer: ArrayBuffer
  ): void {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      if (tile === undefined) return
      tile.injectInteractiveData(
        new Uint32Array(interactiveGuideBuffer),
        new Uint8Array(interactiveDataBuffer)
      )
    }
  }

  getTile (tileID: bigint): undefined | Tile {
    return this.tileCache.get(tileID)
  }

  getTiles (): Tile[] {
    const { tileCache, projector, painter, style } = this
    if (projector.dirty) {
      painter.dirty = true // to avoid re-requesting getTiles (which is expensive), we set painter.dirty to true
      let tilesInView: bigint[] = []
      // no matter what we need to update what's in view
      const newTiles: Tile[] = []
      // update tiles in view
      tilesInView = projector.getTilesInView()
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (const id of tilesInView) {
        if (!tileCache.has(id)) {
          // tile not found, so we create it
          const newTile = this.#createTile(id)
          // store reference for the style to request from webworker(s)
          newTiles.push(newTile)
        }
      }
      // if new tiles exist, ensture the worker and painter are updated
      if (newTiles.length > 0) style.requestTiles(newTiles)
      // given the S2CellID, find them in cache and return them
      this.tilesInView = tileCache.getBatch(tilesInView)
    }
    return this.tilesInView
  }

  createFutureTiles (tileIDs: bigint[]): void {
    const { tileCache, painter, style } = this
    const newTiles: Tile[] = []
    // create the tiles
    for (const id of tileIDs) {
      if (!tileCache.has(id)) {
        const newTile = this.#createTile(id)
        newTiles.push(newTile)
      }
    }
    // tell the style to make the requests
    painter.dirty = true
    style.requestTiles(newTiles)
  }

  #createTile (id: bigint): Tile {
    const { style, painter, tileCache, projector } = this
    const { projection } = projector
    // create tile
    const tile = createTile(projector.projection, painter.context, id)
    // should our style have mask layers, let's add them
    style.injectMaskLayers(tile)
    // inject parent should one exist
    if (!isFace(projection, id)) {
      // get closest parent S2CellID. If actively zooming, the parent tile will pass along
      // it's parent tile (and so forth) if its own data has not been processed yet.
      const pID = parentID(projection, id)
      // check if parent tile exists, if so inject
      const parent = tileCache.get(pID)
      if (parent !== undefined) tile.injectParentTile(parent, style.layers)
    }
    // store the tile
    tileCache.set(id, tile)

    return tile
  }

  _draw (): void {
    const { style, painter, projector } = this
    // prep tiles
    const tiles = this.getTiles()
    // if any changes, we paint new scene
    if (style.dirty || painter.dirty || projector.dirty) {
      // store for future draw that it was a "dirty" frame
      this.wasDirtyLastFrame = true
      // paint scene
      painter.paint(projector, tiles)
    }
    // draw the interactive elements if there was no movement/zoom change
    if (style.interactive && !projector.dirty && this.wasDirtyLastFrame) {
      this.wasDirtyLastFrame = false
      painter.computeInteractive(tiles)
    }
    // cleanup
    painter.dirty = false
    style.dirty = false
    projector.dirty = false
  }
}

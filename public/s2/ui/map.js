// @flow
/* eslint-env browser */
import Camera from './camera'
import DragPan from './camera/dragPan'
import Style from '../style'

import type { S2Map } from '../s2Map'
import type { ProjectionType } from './camera/projections'
import type { TileRequest } from '../workers/workerPool'

export type MapOptions = {
  container: HTMLElement,
  interactive: boolean,
  apiKey: string,
  style: Object | string,
  projection?: ProjectionType,
  scrollZoom?: boolean,
  updateWhileZooming?: boolean,
  canvasMultiplier?: number,
  jollyRoger?: false | 'default' | 'light' | 'dark', // wether to load the logo or not, defaults to true
  zoomController?: boolean,
  colorBlindController?: boolean,
  canZoom?: boolean,
  canMove?: boolean,
  darkMode?: boolean,
  webworker?: boolean
}

// type ScrollEvent = SyntheticEvent<Object>

type ResizeDimensions = { width: number, height: number }

export default class Map extends Camera {
  id: string
  parent: S2Map
  _canvas: HTMLCanvasElement
  _canDraw: boolean = false // let the render sequence know if the painter is ready to paint
  _interactive: boolean = false // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
  _scrollZoom: boolean = true // allow the user to scroll over the canvas and cause a zoom change
  renderNextFrame: boolean = false
  mousePosition: [number, number] = [0, 0]
  injectionQueue: Array<Function> = []
  resizeQueued: null | ResizeDimensions = null
  webworker: boolean = false
  dragPan: DragPan
  canMove: boolean = true
  canZoom: boolean = true
  mouseMoved: boolean = true
  currAnimFunction: Function
  currFeature: null | Object = null
  constructor (options: MapOptions, canvas: HTMLCanvasElement, id: string, parent: S2Map) {
    // setup default variables
    super(options)
    this.id = id
    this.parent = parent
    this._canvas = canvas
    // setup options
    const { style, webworker, interactive, scrollZoom, canMove, canZoom } = options
    // assign webworker if applicable
    this.webworker = !!webworker
    // check if we can interact with the map
    if (interactive) this._interactive = interactive
    if (scrollZoom) this._scrollZoom = scrollZoom
    if (canMove !== undefined) this.canMove = canMove
    if (canZoom !== undefined) this.canZoom = canZoom
    // build the painter and style
    this._buildPaint(options, style)
  }

  async _buildPaint (options: MapOptions, style: Object | string) {
    const isBuilt = await this._createPainter(options)
    // assuming we built a painter, we can setup the rest of the properties
    if (isBuilt) {
      // now we setup canvas interaction
      this._setupCanvas()
      // setup the style - this goes AFTER creation of the painter, because the
      // style will tell the painter what programs/pipelines it will be using
      this.style = new Style(options, this)
      // build style
      await this.setStyle(style, false)
    }
  }

  // we figure out which context we can use before pulling in GL or GPU
  // After we have the appropriate context, we build the painter and then the
  async _createPainter (options: MapOptions): boolean {
    let context
    let type = 0
    // first try webGPU
    context = this._canvas.getContext('webgpu')
    if (context && typeof context.configure === 'function') {
      type = 3
    } else {
      // prep webgl style options
      const webglOptions = { powerPreference: 'high-performance', antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: true, stencil: true }
      // than try webgl2
      context = this._canvas.getContext('webgl2', webglOptions)
      if (context && typeof context.getParameter === 'function') {
        type = 2
      } else { // last effort, webgl1
        context = this._canvas.getContext('webgl', webglOptions)
        if (context && typeof context.getParameter === 'function') type = 1
      }
    }
    // create the painter and build the context
    if (!context) { // kill switch
      return false
    } else if (type === 3) { // WebGPU
      const Painter = await import('../gpu').then(m => m.Painter)
      this.painter = new Painter()
      await this.painter.createContext(context, options)
    } else { // WebGL 1 or 2
      const Painter = await import('../gl').then(m => m.Painter)
      this.painter = new Painter(context, type, options)
    }
    return true
  }

  delete () {
    // delete all tiles
    this.tileCache.deleteAll()
    // dereference the style object $FlowIgnore
    this.style = {}
    // to ensure no more draws, set the draw method to a noop
    this._draw = () => {} // eslint-disable-line
    // tell the painter to cleanup
    this.painter.delete()
  }

  async setStyle (style: string | Object, ignorePosition: boolean) {
    // ensure we don't draw for a sec
    this._canDraw = false
    // incase style was imported, clear cache
    this.tileCache.deleteAll()
    // build style for the map, painter, and webworkers
    await this.style.buildStyle(style)
    // ready to start drawing
    this._canDraw = true
    // inject minzoom and maxzoom
    this.projection.setStyleParameters(this.style, ignorePosition)
    // render our first pass
    this.render()
  }

  // 1) updateStyle from the style object. return a list of "from->to" for tiles and "layerIDs" for webworkers
  // 2) remove tiles from tileCache not in view
  // 3) update the tileCache tiles using "from->to"
  // 4) if a layer "source", "layer", or "filter" change it will be in "webworkers". Tell webworkers to rebuild
  updateStyle (style: Object) {
    // // build style for the map, painter, and webworkers
    // this.style.updateStyle(style)
    // remove any tiles outside of view
    // this._resetTileCache([], false, true)
    // // update tileCache
    // this.tileCache.forEach(tile => { tile.updateStyle(this.style) })
    // // inject minzoom and maxzoom
    // this.projection.setStyleParameters(this.style, true)
    // // render our first pass
    // this.render()
  }

  clearSource (sourceNames: Array<string>) {
    // delete source data from all tiles
    this.tileCache.forEach(tile => { tile.deleteSources(sourceNames) })
    // remove source from style
    this.style.deleteSources(sourceNames)
    // let the renderer know the painter is "dirty"
    this.painter.dirty = true
    // rerender
    this.render()
  }

  // sources: Array<[sourceName, href]>
  resetSource (sources: Array<[string, string]>, keepCache: boolean = false, awaitReplace: boolean = false) {
    const tileRequests = this._resetTileCache(sources.map(s => s[0]), keepCache, awaitReplace)
    // Send off the tile request (by including sourceNames we are letting the
    // source worker know we only need to update THIS source)
    if (tileRequests.length) {
      if (this.webworker) { // $FlowIgnore
        postMessage({ mapID: this.id, type: 'tilerequest', tiles: tileRequests, sources })
      } else {
        window.S2WorkerPool.tileRequest(this.id, tileRequests, sources)
      }
    }
    // let the renderer know the painter is "dirty"
    this.painter.dirty = true
    // rerender
    this.render()
  }

  addLayer (layer: Layer, nameIndex?: number | string) {
    // remove all tiles outside of view
    const tileRequests = this._resetTileCache(null, false, true)
    // style needs to be updated on the change
    this.style.addLayer(layer, nameIndex, tileRequests)
    // rerender
    this.render()
  }

  removeLayer (nameIndex: number | string) {
    // style needs to be updated on the change
    const index = this.style.removeLayer(nameIndex)
    // remove all instances of the layer in each tile
    this.tileCache.forEach(tile => { tile.removeLayer(index) })
    // rerender
    this.render()
  }

  reorderLayers (layerChanges: { [string | number]: number }) {
    // style needs to updated on the change
    this.style.reorderLayers(layerChanges)
    // update every tile
    this.tileCache.forEach(tile => { tile.reorderLayers(layerChanges) })
    // rerender
    this.render()
  }

  // keepCache => don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
  // awaitReplace => to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
  _resetTileCache (sourceNames?: Array<string>, keepCache: boolean, awaitReplace: boolean): Array<TileRequest> {
    // get tiles in view, prep request for said tiles
    const tilesInView = this._getTiles().map(tile => tile.id)
    const tileRequests: Array<TileRequest> = []
    // delete all tiles not in view, add to tileRequests for those that are,
    // and delete source data from tile
    this.tileCache.forEach((tile, key) => {
      if (!keepCache && !tilesInView.includes(key)) { // just remove the tile for simplicity
        this.tileCache.delete(key)
      } else { // add to tileRequests
        const { id, face, zoom, i, j, bbox, division, size } = tile
        tileRequests.push({ id, face, zoom, i, j, bbox, division, size })
        if (!awaitReplace && sourceNames) tile.deleteSources(sourceNames)
      }
    })

    return tileRequests
  }

  jumpTo (lon: number, lat: number, zoom: number) {
    // update the projectors position
    this.projection.setPosition(lon, lat, zoom)
    // render it out
    this.render()
  }

  flyTo (lon: number, lat: number, zoom: number, duration?: number) {

  }

  _flyTo () {

  }

  _setupCanvas () {
    const self = this
    const { _canvas, _interactive, _scrollZoom } = self
    // setup listeners
    _canvas.addEventListener('webglcontextlost', self._contextLost, false)
    _canvas.addEventListener('webglcontextrestored', self._contextRestored, false)
    // if we allow the user to interact with map, we add events
    if (_interactive) {
      // create a dragPan
      const dragPan = self.dragPan = new DragPan()
      // let dragPan know if we can zoom
      if (_scrollZoom) dragPan.zoomActive = true
      // listen to dragPans updates
      dragPan.addEventListener('move', self._onMovement.bind(self))
      dragPan.addEventListener('swipe', self._onSwipe.bind(self))
      dragPan.addEventListener('zoom', () => { self._onZoom(dragPan.zoom) })
      dragPan.addEventListener('click', self._onClick.bind(self))
    }
    // setup camera
    self.resizeCamera(_canvas.width, _canvas.height)
  }

  setMoveState (state: boolean) {
    this.canMove = !!state
  }

  setZoomState (state: boolean) {
    this.canZoom = !!state
  }

  resize (width: number, height: number) {
    this.resizeQueued = { width, height }
    this.render()
  }

  // for interaction with features on the screen
  onCanvasMouseMove (x: number, y: number) {
    if (!this.style || !this.style.interactive || this.projection.dirty) return
    this.mousePosition[0] = x
    this.mousePosition[1] = y
    this.mouseMoved = true
    this.render()
  }

  _onCanvasMouseMove () {
    const featureID = this.painter.context.getFeatureAtMousePosition(...this.mousePosition)
    // if we found an ID and said feature is not the same as the current, we dive down
    if (!featureID && this.currFeature) {
      this._handleFeatureChange(null)
    } else if (featureID && (!this.currFeature || this.currFeature.__id !== featureID)) {
      let found = false
      for (const tile of this.tilesInView) {
        const feature = tile.findInteractiveFeature(featureID)
        if (feature) {
          this._handleFeatureChange(feature)
          found = true
          break
        }
      }
      if (!found && this.currFeature) this._handleFeatureChange(null)
    }
  }

  onTouchStart (touches) {
    this.dragPan.onTouchStart(touches)
    if (!this.style.interactive || this.projection.dirty || touches.length > 1) return
    const { x, y } = touches[0]
    this.mousePosition[0] = x
    this.mousePosition[1] = y
    this.mouseMoved = true
    this.render()
  }

  _handleFeatureChange (newFeature: null | Object) {
    const oldFeature = this.currFeature
    // ensure currFeature is up-to-date
    this.currFeature = newFeature
    // handle old feature
    if (this.webworker) {
      postMessage({ type: 'mouseleave', feature: oldFeature })
    } else {
      if (oldFeature) this.parent.dispatchEvent(new CustomEvent('mouseleave', { detail: oldFeature }))
      this._canvas.style.cursor = 'default'
    }
    // handle new feature
    if (this.webworker) {
      postMessage({ type: 'mouseenter', feature: newFeature })
    } else {
      if (newFeature) {
        this.parent.dispatchEvent(new CustomEvent('mouseenter', { detail: newFeature }))
        this._canvas.style.cursor = newFeature.__cursor || 'default'
      }
    }
    // due to a potential change in feature draw properties (change in color/size/etc.) we draw again
    this.render()
  }

  _resize () {
    const { _canvas, resizeQueued } = this
    if (resizeQueued) {
      // remove any prexisting animations
      this.currAnimFunction = null
      // grab width and height
      const { width, height } = resizeQueued
      _canvas.width = width
      _canvas.height = height
      this.resizeCamera(width, height)
      this.resizeQueued = null
    }
  }

  _onZoom (deltaZ: number, deltaX?: number = 0, deltaY?: number = 0) {
    this.dragPan.clear()
    if (!this.canZoom) return
    // remove any prexisting animations
    this.currAnimFunction = null
    // update projection
    const update = this.projection.onZoom(deltaZ, deltaX, deltaY)
    // if the projection sees a zoom change, we need to render, but don't request new tiles until
    // done zooming if the updateWhileZooming flag is set to false
    if (update) {
      this.painter.dirty = true
      this.render()
    }
  }

  _contextLost () {
    // console.log('context lost')
  }

  _contextRestored () {
    // console.log('context restored')
  }

  _onMovement (e: Event) {
    if (!this.canMove) return
    const { movementX, movementY } = this.dragPan
    // remove any prexisting animations
    this.currAnimFunction = null
    // update projection
    this.projection.onMove(movementX, movementY)
    this.render()
  }

  _onSwipe (e: Event) {
    if (!this.canMove) return
    this.currAnimFunction = (now) => this.swipeAnimation(now)
    this.render()
  }

  // builtin navigation controller inputs
  navEvent (ctrl: 'zoomIn' | 'zoomOut') {
    const { projection } = this
    const { zoom, minzoom, maxzoom } = projection
    const startZoom = zoom
    const deltaZoom = Math.max(Math.min((ctrl === 'zoomIn') ? startZoom + 1 : startZoom - 1, maxzoom), minzoom) - startZoom
    if (deltaZoom) { // assuming we have a new end position we animate
      // preload end position tiles, reset for next frame
      projection.setZoom(startZoom + deltaZoom)
      this._getTiles()
      projection.setZoom(startZoom)
      // build animation function
      this.currAnimFunction = (now) => this.zoomAnimation(startZoom, deltaZoom, now * 0.001)
      // render
      this.render()
    }
  }

  colorMode (mode: 0 | 1 | 2 | 3) {
    this.painter.setColorMode(mode)
    // force a re-render
    this.render()
  }

  swipeAnimation (curTime: number) {
    const { abs } = Math
    const { dragPan, projection } = this
    const [newMovementX, newMovementY, time] = dragPan.getNextSwipeFrame(curTime * 0.001)
    const noMovement = (abs(newMovementX) > 0.5 || abs(newMovementY) > 0.5)
    if (time && noMovement) {
      // adjust position
      projection.onMove(newMovementX, newMovementY, 6, 6)
      // ensure new render is queued
      this.render()
      // set next animation
      this.currAnimFunction = (now) => this.swipeAnimation(now)
    } else {
      // a timeout shouldn't kill wasActive, but no more movement should.
      // (stopping swipe animation with a mousedown kills time, so we avoid confusing the engine that this is a click)
      if (time && !noMovement) this.dragPan.wasActive = false
      this.currAnimFunction = null
    }
  }

  zoomAnimation (startZoom: number, deltaZoom: number, startTime: number, curTime?: number) {
    const { dragPan, projection } = this
    if (!curTime) curTime = dragPan.time = startTime
    const multiplier = dragPan.getNextZoomFrame(curTime)
    // ensure new render is queued
    this.render()
    if (multiplier >= 1) {
      projection.setZoom(startZoom + deltaZoom)
    } else {
      projection.setZoom(startZoom + (multiplier * deltaZoom))
      this.currAnimFunction = (now) => this.zoomAnimation(startZoom, deltaZoom, startTime, now * 0.001)
    }
  }

  _onClick ({ detail }) {
    const { projection, currFeature, parent } = this
    // get lon lat of cursor
    const { posX, posY } = detail
    const [lon, lat] = projection.cursorToLonLat(posX, posY)
    // send off the information
    if (this.webworker) {
      postMessage({ type: 'click', feature: currFeature, lon, lat })
    } else {
      if (parent.info) parent.info.click(currFeature, lon, lat)
      parent.dispatchEvent(new CustomEvent('click', { detail: { feature: currFeature, lon, lat } }))
    }
  }

  _onPositionUpdate () {
    const { projection } = this
    const { zoom, lon, lat } = projection
    if (this.webworker) {
      postMessage({ type: 'pos', zoom, lon, lat })
    } else {
      this.parent.dispatchEvent(new CustomEvent('pos', { detail: { zoom, lon, lat } }))
    }
  }

  screenshot () {
    requestAnimationFrame(() => {
      if (this._fullyRenderedScreen()) {
        // assuming the screen is ready for a screen shot we ask for a draw
        const screen = this.painter.getScreen()
        if (this.webworker) {
          postMessage({ type: 'screenshot', screen })
        } else {
          this.parent.dispatchEvent(new CustomEvent('screenshot', { detail: screen }))
        }
      } else { this.screenshot() }
    })
  }

  // some cases we can just do the work immediately, otherwise we do one job per frame
  // to improve performance. Data is stored in the injection queue while it waits for it's frame.
  injectData (data) {
    if (data.type === 'flush') this._injectData(data)
    else this.injectionQueue.push(data)
    this.render()
  }

  // we don't want to over request rendering, so we render with a limiter to
  // safely call render as many times as we like
  render () {
    const self = this
    if (!self._canDraw) return
    if (self.renderNextFrame) return
    self.renderNextFrame = true
    requestAnimationFrame(now => {
      self.renderNextFrame = false
      // if animation currently exists, run it
      if (self.currAnimFunction) self.currAnimFunction(now)
      // if resize has been queued, we do so now
      if (self.resizeQueued) self._resize()
      // if there is data to 'inject', we make sure to render another frame later
      if (self.injectionQueue.length) {
        // pull out the latest data we received (think about it, the newest data is the most constructive)
        const data = self.injectionQueue.pop()
        // tell the camera to inject data
        self._injectData(data)
        // setup another render queue
        self.render()
      }
      // get state of scene
      const projectionDirty = self.projection.dirty
      // if the projection was dirty (zoom or movement) we run render again just incase
      if (projectionDirty) {
        self.render()
        self._onPositionUpdate()
      }
      // run a draw, it will repaint framebuffers as necessary
      self._draw()
      // if mouse movement, check feature at position
      if (self.mouseMoved && !projectionDirty) {
        self.mouseMoved = false
        self._onCanvasMouseMove()
      }
    })
  }
}

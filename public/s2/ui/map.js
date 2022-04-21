// @flow
/* eslint-env browser */
import Camera from './camera'
import DragPan from './camera/dragPan'
import Animator from './camera/animator'
import Style from '../style'

import type S2Map from '../s2Map'
import type { Layer } from '../style/styleSpec'
import type { AnimationType, AnimationDirections } from './camera/animator'
import type { TileRequest } from '../workers/workerPool'

export type MapOptions = {
  contextType?: 1 | 2 | 3, // can force a specific context type (1 -> webgl1, 2 -> webgl2, 3 -> webgpu)
  container?: HTMLElement, // used by offscreen canvas
  interactive?: boolean,
  apiKey: string,
  style: Object | string,
  scrollZoom?: boolean,
  canvasMultiplier?: number,
  attributions?: { [string]: string },
  attributionOff?: boolean,
  infoLayers?: Array<string>,
  controls?: boolean, // zoom, compass, and colorblind turned on or off
  zoomController?: boolean,
  compassController?: boolean,
  colorblindController?: boolean,
  canZoom?: boolean,
  canMove?: boolean,
  darkMode?: boolean,
  webworker?: boolean,
  noClamp?: boolean // lat and lon can be any number
}

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
    if (canMove === false) this.canMove = false
    if (canZoom === false) this.canZoom = false
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
  async _createPainter (options: MapOptions): Promise<boolean> {
    const { contextType } = options
    let context
    let type = 0
    // first try webGPU
    if (contextType === 3) {
      context = this._canvas.getContext('webgpu')
      type = 3
    } else {
      // prep webgl style options
      const webglOptions = { powerPreference: 'high-performance', antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: true, stencil: true }
      // than try webgl2
      if (contextType === 2) {
        context = this._canvas.getContext('webgl2', webglOptions)
        type = 2
      } else { // last effort, webgl1
        context = this._canvas.getContext('webgl', webglOptions)
        type = 1
      }
    }
    // create the painter and build the context
    if (!context) { // kill switch
      return false
    } else if (type === 3) { // WebGPU
      const Painter = await import('../gpu').then(m => m.Painter)
      this.painter = new Painter()
      // await this.painter.createContext(context, options)
    } else { // WebGL 1 or 2
      const Painter = await import('../gl').then(m => m.Painter)
      this.painter = new Painter(context, type, options)
    }
    return true
  }

  /* API */

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

  jumpTo (lon: number, lat: number, zoom?: number) {
    // update the projectors position
    this.projector.setPosition(lon, lat, zoom)
    // render it out
    this.render()
  }

  animateTo (type: AnimationType, directions?: AnimationDirections) {
    // build animator
    const animator = new Animator(this.projector, directions)
    const render = (type === 'flyTo') ? animator.flyTo() : animator.easeTo()
    if (!render) return
    // set an animation fuction
    this.currAnimFunction = (now) => this._animate(animator, now * 0.001)
    // render it out
    this.render()
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
    this.projector.setStyleParameters(this.style, ignorePosition)
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
    // this.projector.setStyleParameters(this.style, true)
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

  setMoveState (state: boolean) {
    this.canMove = !!state
  }

  setZoomState (state: boolean) {
    this.canZoom = !!state
  }

  updateCompass (bearing?: number, pitch?: number) {
    const { projector } = this
    this.currAnimFunction = null
    projector.setCompass(projector.bearing + (bearing | 0), projector.pitch + (pitch | 0))
    this.render()
  }

  // snap to upside down if interested
  mouseupCompass () {
    const { projector } = this
    const { bearing } = projector
    if (!bearing) return
    const newBearing = (bearing >= -10 && bearing <= 10)
      ? 0
      : (bearing <= -167.5)
          ? -180
          : (bearing >= 167.5)
              ? 180
              : undefined
    if (!isNaN(newBearing)) {
      const animator = new Animator(projector, { duration: 1, bearing: newBearing })
      animator.compassTo()
      this.currAnimFunction = (now) => this._animate(animator, now * 0.001)
      this.render()
    }
  }

  resetCompass () {
    const { projector } = this
    const { bearing, pitch } = projector
    // create the animator
    const duration = bearing ? ((bearing > 90) ? 1.75 : 1) : 1
    const animator = new Animator(projector, { duration, bearing: 0, pitch: (!bearing) ? pitch | 0 : null })
    animator.compassTo()
    this.currAnimFunction = (now) => this._animate(animator, now * 0.001)
    // send off a render
    this.render()
  }

  resize (width: number, height: number) {
    this.resizeQueued = { width, height }
    this.render()
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

  /* INPUT EVENTS */

  colorMode (mode: 0 | 1 | 2 | 3) {
    this.painter.setColorMode(mode)
    // force a re-render
    this.render()
  }

  // for interaction with features on the screen
  onCanvasMouseMove (x: number, y: number) {
    if (!this.style || !this.style.interactive || this.projector.dirty) return
    this.mousePosition[0] = x
    this.mousePosition[1] = y
    this.mouseMoved = true
    this.render()
  }

  onTouchStart (touches) {
    this.dragPan.onTouchStart(touches)
    if (!this.style.interactive || this.projector.dirty || touches.length > 1) return
    const { x, y } = touches[0]
    this.mousePosition[0] = x
    this.mousePosition[1] = y
    this.mouseMoved = true
    this.render()
  }

  // builtin navigation controller inputs
  navEvent (ctrl: 'zoomIn' | 'zoomOut', lon?: number, lat?: number) {
    const { projector } = this
    const startZoom = projector.zoom
    const endZoom = startZoom + ((ctrl === 'zoomIn') ? 1 : -1)
    // build animation
    const animator = new Animator(this.projector, { duration: 1.5, zoom: endZoom, lon, lat })
    animator.zoomTo()
    this.currAnimFunction = (now) => this._animate(animator, now * 0.001)
    // render
    this.render()
  }

  /* INTERNAL FUNCTIONS */

  _contextLost () {
    // console.log('context lost')
  }

  _contextRestored () {
    // console.log('context restored')
  }

  // keepCache => don't delete any tiles, request replacements for all (for s2json since it's locally cached and fast)
  // awaitReplace => to avoid flickering (i.e. adding/removing markers), we can wait for an update (from source+tile workers) on how the tile should look
  _resetTileCache (sourceNames?: Array<string>, keepCache: boolean, awaitReplace: boolean): Array<TileRequest> {
    // get tiles in view, prep request for said tiles
    const tilesInView = this.getTiles()
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

  _setupCanvas () {
    const self = this
    const { _canvas, _interactive, _scrollZoom } = self
    // setup listeners
    _canvas.addEventListener('webglcontextlost', self._contextLost, false)
    _canvas.addEventListener('webglcontextrestored', self._contextRestored, false)
    // create a dragPan
    const dragPan = self.dragPan = new DragPan()
    // if we allow the user to interact with map, we add events
    if (_interactive) {
      // let dragPan know if we can zoom
      if (_scrollZoom) dragPan.zoomActive = true
      // listen to dragPans updates
      dragPan.addEventListener('move', self._onMovement.bind(self))
      dragPan.addEventListener('swipe', self._onSwipe.bind(self))
      dragPan.addEventListener('zoom', () => { self._onZoom(dragPan.zoom) })
      dragPan.addEventListener('click', self._onClick.bind(self))
      dragPan.addEventListener('doubleClick', self._onDoubleClick.bind(self))
    }
    // setup camera
    self._resizeCamera(_canvas.width, _canvas.height)
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
      this._resizeCamera(width, height)
      this.resizeQueued = null
    }
  }

  _onClick ({ detail }) {
    const { projector, currFeature, parent } = this
    // get lon lat of cursor
    const { posX, posY } = detail
    const [lon, lat] = projector.cursorToLonLat(posX, posY)
    // send off the information
    if (this.webworker) {
      postMessage({ type: 'click', feature: currFeature, lon, lat })
    } else {
      if (parent.info) parent.info.click(currFeature, lon, lat)
      parent.dispatchEvent(new CustomEvent('click', { detail: { feature: currFeature, lon, lat } }))
    }
  }

  _onDoubleClick ({ detail }) {
    const { posX, posY } = detail
    const [lon, lat] = this.projector.cursorToLonLat(posX, posY)
    this.navEvent('zoomIn', lon, lat)
  }

  _onPositionUpdate () {
    const { projector } = this
    const { zoom, lon, lat } = projector
    if (this.webworker) {
      postMessage({ type: 'pos', zoom, lon, lat })
    } else {
      this.parent.dispatchEvent(new CustomEvent('pos', { detail: { zoom, lon, lat } }))
    }
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

  _onZoom (deltaZ: number, deltaX?: number = 0, deltaY?: number = 0) {
    this.dragPan.clear()
    if (!this.canZoom) return
    // remove any prexisting animations
    this.currAnimFunction = null
    // update projector
    if (deltaZ) this.projector.onZoom(deltaZ, deltaX, deltaY)
    // render
    this.render()
  }

  _onMovement (e: Event) {
    if (!this.canMove) return
    const { projector, dragPan } = this
    const { movementX, movementY } = dragPan
    // update projector
    projector.onMove(movementX, movementY)
    this.render()
  }

  _onSwipe (e: Event) {
    if (!this.canMove) return
    const { projector, dragPan } = this
    const { movementX, movementY } = dragPan
    // build animation
    const animator = new Animator(projector, { duration: 1.75 })
    animator.swipeTo(movementX, movementY)
    this.currAnimFunction = (now) => this._animate(animator, now * 0.001)
    // render
    this.render()
  }

  _animate (animator: Animator, curTime: number) {
    const { mouseActive } = this.dragPan
    // ensure new render is queued
    this.render()
    // tell the animator to increment frame
    const done = animator.increment(curTime)
    // continue animation if not done and no mouse/touch events
    if (done || mouseActive) this.currAnimFunction = null
  }

  _updatePainter () {
    const { painter } = this
    painter.dirty = true
    this.render()
  }

  /* DRAW */

  // we don't want to over request rendering, so we render with a limiter to
  // safely call render as many times as we like
  render () {
    const self = this
    if (!self._canDraw) return
    if (self.renderNextFrame) return
    self.renderNextFrame = true
    requestAnimationFrame(now => {
      self.renderNextFrame = false
      // if timeCache exists, run animation function
      if (self.timeCache) self.timeCache.animate(now, self._updatePainter.bind(self))
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
      const projectorDirty = self.projector.dirty
      // if the projector was dirty (zoom or movement) we run render again just incase
      if (projectorDirty) {
        self.render()
        self._onPositionUpdate()
      }
      // run a draw, it will repaint framebuffers as necessary
      self._draw()
      // if mouse movement, check feature at position
      if (self.mouseMoved && !projectorDirty) {
        self.mouseMoved = false
        self._onCanvasMouseMove()
      }
    })
  }
}

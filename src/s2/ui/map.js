// @flow
import Camera from './camera'
import DragPan from './camera/dragPan'
import Style from '../style'
import { Painter } from '../gl'

import type { ProjectionType } from './camera/projections'

export type MapOptions = {
  container: HTMLElement,
  interactive: boolean,
  style: Object | string,
  projection?: ProjectionType,
  scrollZoom?: boolean,
  updateWhileZooming?: boolean,
  canvasMultiplier?: number,
  jollyRoger?: false | 'default' | 'light' | 'dark', // wether to load the logo or not, defaults to true
  zoomController?: boolean,
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
    // now we setup canvas
    this._setupCanvas(options)
    // build the painter and style
    this._buildPaint(options, style)
  }

  _buildPaint (options: MapOptions, style: Object | string) {
    // now that we have a canvas, prep the camera's painter
    this.painter = new Painter(this._canvas, options)
    // setup the style - this goes AFTER creation of the painter, because the
    // style will tell the painter what programs it will be using
    this.style = new Style(options, this)
    // build style
    this.setStyle(style, false)
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

  setStyle (style: string | Object, ignorePosition: boolean) {
    // ensure we don't draw for a sec
    this._canDraw = false
    // incase style was imported, clear cache
    this.clearCache()
    // build style for the map, painter, and webworkers
    this.style.buildStyle(style)
    // ready to start drawing
    this._canDraw = true
    // inject minzoom and maxzoom
    this.projection.setStyleParameters(this.style, ignorePosition)
    // render our first pass
    this.render()
  }

  jumpTo (lon: number, lat: number, zoom: number) {
    // update the projectors position
    this.projection.setPosition(lon, lat, zoom)
    // render it out
    this.render()
  }

  _setupCanvas (options: MapOptions) {
    const self = this
    // setup listeners
    self._canvas.addEventListener('webglcontextlost', self._contextLost, false)
    self._canvas.addEventListener('webglcontextrestored', self._contextRestored, false)
    // if we allow the user to interact with map, we add events
    if (self._interactive) {
      // create a dragPan
      self.dragPan = new DragPan()
      // let dragPan know if we can zoom
      if (self._scrollZoom) self.dragPan.zoomActive = true
      // listen to dragPans updates
      self.dragPan.addEventListener('move', self._onMovement.bind(self))
      self.dragPan.addEventListener('swipe', self._onSwipe.bind(self))
      self.dragPan.addEventListener('zoom', () => { self._onZoom(self.dragPan.zoom) })
      self.dragPan.addEventListener('click', self._onClick.bind(self))
    }
    // setup camera
    self.resizeCamera(self._canvas.width, this._canvas.height)
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
    if (!this.style.interactive || this.projection.dirty) return
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
        console.log(newFeature)
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

  swipeAnimation (curTime: number) {
    const { abs } = Math
    const { dragPan, projection } = this
    const [newMovementX, newMovementY, time] = dragPan.getNextSwipeFrame(curTime * 0.001)
    if (time && (abs(newMovementX) > 0.5 || abs(newMovementY) > 0.5)) {
      // adjust position
      projection.onMove(newMovementX, newMovementY, 6, 6)
      // ensure new render is queued
      this.render()
      // set next animation
      this.currAnimFunction = (now) => this.swipeAnimation(now)
    } else { dragPan.wasActive = false }
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

  _onClick () {
    const { currFeature } = this
    if (this.webworker) {
      postMessage({ type: 'click', feature: currFeature })
    } else {
      this.parent.dispatchEvent(new CustomEvent('click', { detail: currFeature }))
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

  // tile data is stored in the map, waiting for the render to
  injectData (data) {
    this.injectionQueue.push(data)
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

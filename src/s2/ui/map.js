// @flow
/* global requestAnimationFrame Event HTMLElement HTMLCanvasElement WheelEvent TouchEvent MouseEvent */
import Camera from './camera'
import DragPan from './camera/dragPan'
import Style from '../style'
import { Painter } from '../gl'

import type { ProjectionType } from './camera/projections'

export type MapOptions = {
  container: HTMLElement,
  interactive?: boolean,
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
  _canvas: HTMLCanvasElement
  _interactive: boolean = true // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
  _scrollZoom: boolean = true // allow the user to scroll over the canvas and cause a zoom change
  renderNextFrame: boolean = false
  injectionQueue: Array<Function> = []
  resizeQueued: null | ResizeDimensions = null
  webworker: boolean = false
  firefoxScroll: boolean = navigator.platform !== 'MacIntel' && navigator.appCodeName === 'Mozilla'
  dragPan: DragPan
  canMove: boolean = true
  canZoom: boolean = true
  constructor (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    // setup default variables
    super(options)
    this.id = id
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
    // now that we have a canvas, prep the camera's painter
    this.painter = new Painter(this._canvas, options)
    // setup the style - this goes AFTER creation of the painter, because the
    // style will tell the painter what programs it will be using
    this.style = new Style(options, this)
    // build style
    this.setStyle(style)
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

  setStyle (style: string | Object) {
    // incase style was imported, clear cache
    this.clearCache()
    // build style for the map, painter, and webworkers
    this.style.buildStyle(style)
    // inject minzoom and maxzoom
    this.projection.setStyleParameters(this.style)
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
      // if not a webworker we add all events
      if (!self.webworker) {
        // listen to scroll events
        if (self._scrollZoom) {
          self._canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault()
            const { clientX, clientY, deltaY } = e
            const rect = this._canvas.getBoundingClientRect()
            self._onZoom((this.firefoxScroll) ? deltaY * 25 : deltaY, clientX - rect.left, clientY - rect.top)
          })
        }
        // listen to mouse movement
        self._canvas.addEventListener('touchstart', (e: TouchEvent) => { e.preventDefault(); self.dragPan.onTouchStart(e.touches) })
        self._canvas.addEventListener('touchend', (e: TouchEvent) => { e.preventDefault(); self.dragPan.onTouchEnd(e.touches) })
        self._canvas.addEventListener('mousedown', () => {
          self.dragPan.onMouseDown()
          const mouseMoveFunc = (e: MouseEvent) => { self.dragPan.onMouseMove(e.movementX, e.movementY) }
          window.addEventListener('mousemove', mouseMoveFunc)
          window.addEventListener('mouseup', () => {
            window.removeEventListener('mousemove', mouseMoveFunc)
            self.dragPan.onMouseUp()
          }, { once: true })
        })
        self._canvas.addEventListener('touchmove', (e: MouseEvent) => { e.preventDefault(); self.dragPan.onTouchMove(e.touches) })
      }
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

  getCanvas (): HTMLCanvasElement {
    return this._canvas
  }

  resize (width: number, height: number) {
    this.resizeQueued = { width, height }
    this.render()
  }

  _resize () {
    const { _canvas, resizeQueued } = this
    if (resizeQueued) {
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
    // update projection
    this.projection.onMove(movementX, movementY)
    this.render()
  }

  _onSwipe (e: Event) {
    if (!this.canMove) return
    const seed = this.dragPan.newSeed()
    requestAnimationFrame(now => this.swipeAnimation(seed, now))
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
      // build animation seed and animate
      const seed = this.dragPan.newSeed()
      requestAnimationFrame(now => this.zoomAnimation(seed, startZoom, deltaZoom, now * 0.001))
    }
  }

  swipeAnimation (seed: number, curTime: number) {
    const self = this
    const { dragPan, projection } = self
    if (dragPan.animSeed !== seed) return
    const [newMovementX, newMovementY, time] = dragPan.getNextSwipeFrame(curTime * 0.001)
    if (time) {
      projection.onMove(newMovementX, newMovementY, 6, 6)
      self.render()
      requestAnimationFrame(now => self.swipeAnimation(seed, now))
    }
  }

  zoomAnimation (seed: number, startZoom: number, deltaZoom: number, startTime: number, curTime?: number) {
    const self = this
    const { dragPan, projection } = self
    if (dragPan.animSeed !== seed) return
    if (!curTime) curTime = dragPan.time = startTime
    const multiplier = dragPan.getNextZoomFrame(curTime)
    self.render()
    if (multiplier >= 1) {
      projection.setZoom(startZoom + deltaZoom)
    } else {
      projection.setZoom(startZoom + (multiplier * deltaZoom))
      requestAnimationFrame(now => { self.zoomAnimation(seed, startZoom, deltaZoom, startTime, now * 0.001) })
    }
  }

  _onClick (e: Event) {
    // console.log('CLICK')
  }

  // tile data is stored in the map, waiting for the render to
  injectData (data) {
    this.injectionQueue.push(data)
    this.injectionQueue = this.injectionQueue.sort(injectionDataSort)
    // if (data.type === 'parentlayers') this.injectionQueue.unshift(data)
    // else this.injectionQueue.push(data)
    this.render()
  }

  // we don't want to over request rendering, so we render with a limiter to
  // safely call render as many times as we like
  render () {
    const self = this
    if (self.renderNextFrame) return
    self.renderNextFrame = true
    requestAnimationFrame(() => {
      self.renderNextFrame = false
      // if resize has been queued, we do so now
      if (this.resizeQueued) this._resize()
      // if there is data to 'inject', we make sure to render another frame later
      if (self.injectionQueue.length) {
        // pull out the latest data we received (think about it, the newest data is the most constructive)
        const data = self.injectionQueue.pop()
        // tell the camera to inject data
        self._injectData(data)
        // actually draw
        self._draw()
        // setup another render queue
        self.render()
      } else { // only draw, no future renders needed
        self._draw()
      }
    })
  }
}

function injectionDataSort (a, b) {
  const sortMethod = (type) => (type === 'parentLayers') ? 0 : 1

  return sortMethod(b.type) - sortMethod(a.type)
}

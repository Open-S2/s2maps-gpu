// @flow
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
  canvasWidth?: number, // incase the map is a webworker, this value will be added to the options
  canvasHeight?: number, // incase the map is a webworker, this value will be added to the options
  webworker?: boolean
}

// type ScrollEvent = SyntheticEvent<Object>

export default class Map extends Camera {
  id: string
  _canvas: HTMLCanvasElement
  _interactive: boolean = true // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
  _scrollZoom: boolean = true // allow the user to scroll over the canvas and cause a zoom change
  renderNextFrame: boolean = false
  webworker: boolean = false
  dragPan: DragPan
  constructor (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    // setup default variables
    super(options)
    this.id = id
    this._canvas = canvas
    if (options.webworker) this.webworker = true
    // check if we can interact with the map
    if (options.interactive) this._interactive = options.interactive
    if (options.scrollZoom) this._scrollZoom = options.scrollZoom
    // now we setup canvas
    this._setupCanvas(options)
    // now that we have a canvas, prep the camera's painter
    this.painter = new Painter(this._canvas, options)
    // setup the style - this goes AFTER creation of the painter, because the
    // style will tell the painter what programs it will be using
    this.style = new Style(options, this)
    // inject minzoom and maxzoom
    this.projection.setStyleParameters(this.style)
    // render our first pass
    this.render()
  }

  _setupCanvas (options: MapOptions) {
    const self = this
    // setup listeners
    self._canvas.addEventListener('webglcontextlost', self._contextLost, false)
    self._canvas.addEventListener('webglcontextrestored', self._contextRestored, false)
    if (self._interactive) {
      // create a dragPan
      self.dragPan = new DragPan()
      if (!self.webworker) {
        // listen to scroll events
        if (self._scrollZoom) self._canvas.addEventListener('wheel', (e) => {
          e.preventDefault()
          const { clientX, clientY, deltaY } = e
          const rect = this._canvas.getBoundingClientRect()
          self._onScroll(rect, clientX, clientY, deltaY)
        })
        // listen to mouse movement
        self._canvas.addEventListener('touchstart', self.dragPan.onMouseDown.bind(self.dragPan))
        self._canvas.addEventListener('mousedown', self.dragPan.onMouseDown.bind(self.dragPan))
        self._canvas.addEventListener('mouseup', self.dragPan.onMouseUp.bind(self.dragPan))
        self._canvas.addEventListener('touchend', self.dragPan.onMouseUp.bind(self.dragPan))
        self._canvas.addEventListener('mousemove', (e) => { self.dragPan.onMouseMove(e.movementX, e.movementY) })
        self._canvas.addEventListener('touchmove', (e) => { self.dragPan.onMouseMove(e.movementX, e.movementY) })
      }
      // listen to dragPans updates
      self.dragPan.addEventListener('move', self._onMovement.bind(self))
      self.dragPan.addEventListener('swipe', self._onSwipe.bind(self))
      self.dragPan.addEventListener('click', self._onClick.bind(self))
    }
    // setup camera
    if (options.canvasWidth && options.canvasHeight) this.resizeCamera(options.canvasWidth, options.canvasHeight)
    else this.resizeCamera(this._canvas.clientWidth, this._canvas.clientHeight)
  }

  getCanvas (): HTMLCanvasElement {
    return this._canvas
  }

  resize (width?: number, height?: number) {
    if (width && height) this.resizeCamera(width, height)
    else this.resizeCamera(this._canvas.clientWidth, this._canvas.clientHeight)
    this.render()
  }

  _onScroll (rect, clientX, clientY, deltaY) {
    this.dragPan.clear()
    // update projection
    const update = this.projection.onZoom(deltaY, clientX - rect.left, clientY - rect.top)
    // if the projection sees a zoom change, we need to render, but don't request new tiles until
    // done zooming if the updateWhileZooming flag is set to false
    if (update) {
      this.painter.dirty = true
      this.render(true)
    }
  }

  _contextLost () {
    console.log('context lost')
  }

  _contextRestored () {
    console.log('context restored')
  }

  _onMovement (e: Event) {
    const { movementX, movementY } = this.dragPan
    // update projection
    this.projection.onMove(movementX, movementY)
    this.render()
  }

  // we don't want to over request rendering, so we render with a limiter to
  // safely call render as many times as we like
  render (isZooming?: boolean = false) {
    const self = this
    if (self.renderNextFrame) return
    self.renderNextFrame = true
    requestAnimationFrame(() => {
      self._render(isZooming)
      self.renderNextFrame = false
    })
  }

  _onSwipe (e: Event) {
    this.dragPan.swipeActive = true
    requestAnimationFrame(this.swipeAnimation.bind(this))
  }

  swipeAnimation (now: number) {
    if (!this.dragPan.swipeActive) return
    const [newMovementX, newMovementY, time] = this.dragPan.getNextFrame(now)
    if (time) {
      this.projection.onMove(newMovementX, newMovementY, 6, 6)
      this._render()
      requestAnimationFrame(this.swipeAnimation.bind(this))
    }
  }

  _onClick (e: Event) {
    console.log('CLICK')
  }
}

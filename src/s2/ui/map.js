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

type ScrollEvent = SyntheticEvent<Object>

export default class Map extends Camera {
  id: string
  _canvas: HTMLCanvasElement
  _interactive: boolean // allow the user to make visual changes to the map, whether that be zooming, panning, or dragging
  _scrollZoom: boolean // allow the user to scroll over the canvas and cause a zoom change
  dragPan: DragPan
  constructor (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    // setup default variables
    super(options)
    this.id = id
    this._canvas = canvas
    // check if we can interact with the map
    this._interactive = options.interactive || true
    this._scrollZoom = options.scrollZoom || true
    // now we setup canvas
    this._setupCanvas(options)
    // now that we have a canvas, prep the camera's painter
    this.painter = new Painter(this._canvas, options)
    // setup the style - this goes AFTER creation of the painter, because the
    // style will tell the painter what programs it will be using
    this.style = new Style(options, this)
    // inject minzoom and maxzoom
    this.projection.setZoomRange(this.style.minzoom, this.style.maxzoom)
    // now that we have a painter and style object, let's create the initial scene
    this._setupInitialScene()
    // render our first pass
    this._render()
  }

  _setupCanvas (options: MapOptions) {
    // setup listeners
    this._canvas.addEventListener('webglcontextlost', this._contextLost, false)
    this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false)
    if (this._interactive) {
      // listen to scroll events
      if (this._scrollZoom) this._canvas.addEventListener('wheel', this._onScroll.bind(this))
      // create a dragPan
      this.dragPan = new DragPan()
      // listen to mouse movement
      this._canvas.addEventListener('mousedown', this.dragPan.onMouseDown.bind(this.dragPan))
      this._canvas.addEventListener('mouseup', this.dragPan.onMouseUp.bind(this.dragPan))
      this._canvas.addEventListener('mousemove', this.dragPan.onMouseMove.bind(this.dragPan))
      // listen to dragPans updates
      this.dragPan.addEventListener('move', this._onMovement.bind(this))
      this.dragPan.addEventListener('swipe', this._onSwipe.bind(this))
      this.dragPan.addEventListener('click', this._onClick.bind(this))
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
    this._render()
  }

  _onScroll (e: ScrollEvent) {
    e.preventDefault()
    this.dragPan.clear()
    const rect = this._canvas.getBoundingClientRect()
    const { clientX, clientY, deltaY } = e
    // update projection
    const update = this.projection.onZoom(deltaY, clientX - rect.left, clientY - rect.top)
    // if the projection sees a zoom change, we need to render, but don't request new tiles until
    // done zooming if the updateWhileZooming flag is set to false
    if (update) {
      const stats = window.stats
      stats.begin()
      this.painter.dirty = true
      this._render(true)
      stats.end()
    }
  }

  _contextLost () {
    console.log('context lost')
  }

  _contextRestored () {
    console.log('context restored')
  }

  _onMovement (e: Event) {
    const { movementX, movementY } = e.target
    // update projection
    this.projection.onMove(movementX, movementY)
    this._render()
  }

  _onSwipe (e: Event) {
    this.dragPan.swipeActive = true
    requestAnimationFrame(this.swipeAnimation.bind(this))
  }

  swipeAnimation (now: number) {
    if (!this.dragPan.swipeActive) return
    const stats = window.stats
    stats.begin()
    const [newMovementX, newMovementY, time] = this.dragPan.getNextFrame(now)
    if (time) {
      this.projection.onMove(newMovementX, newMovementY, 6, 6)
      this._render()
      stats.end()
      requestAnimationFrame(this.swipeAnimation.bind(this))
    } else { stats.end() }
  }

  _onClick (e: Event) {
    console.log('CLICK')
  }
}

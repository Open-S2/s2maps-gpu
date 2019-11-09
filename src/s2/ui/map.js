// @flow
import Camera from './camera'
import DragPan from './camera/dragPan'
import Style from '../style'
import { Painter } from '../gl'

import type { ProjectionType } from './camera/projections'

export type MapOptions = {
  container: HTMLElement,
  interactive?: boolean,
  style: Style | Object | string,
  projection?: ProjectionType,
  scrollZoom?: boolean,
  canvasMultiplier?: number
}

type ScrollEvent = SyntheticEvent<Object>

export default class Map extends Camera {
  id: string
  _canvas: HTMLCanvasElement
  _interactive: boolean
  _scrollZoom: boolean
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
    this._setupCanvas()
    // now that we have a canvas, prep the camera's painter
    this.painter = new Painter(this._canvas, options)
    // setup the style
    this.style = new Style(options.style, this)
    // now that we have a painter and style object, let's create the initial scene
    this._setupInitialScene()
    // render our first pass
    this._render()
  }

  _setupCanvas () {
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
    this.resizeCamera(this._canvas.clientWidth, this._canvas.clientHeight)
  }

  getCanvas (): HTMLCanvasElement {
    return this._canvas
  }

  resize () {
    this.resizeCamera(this._canvas.clientWidth, this._canvas.clientHeight)
    this._render()
  }

  _onScroll (e: ScrollEvent) {
    if (this._scrollZoom) e.preventDefault()
    // update camera
    this._onZoom(e.wheelDeltaY)
    this._render()
  }

  _contextLost () {
    console.log('context lost')
  }

  _contextRestored () {
    console.log('context restored')
  }

  _onMovement (e: Event) {
    const { movementX, movementY } = e.target
    this.projection.onMove(movementX, movementY)
    this._render()
  }

  _onSwipe (e: Event) {
    requestAnimationFrame(this.swipeAnimation.bind(this))
  }

  swipeAnimation (now: number) {
    const [newMovementX, newMovementY, time] = this.dragPan.getNextFrame(now)
    this.projection.onMove(newMovementX, newMovementY, 6, 6)
    this._render()
    if (time) requestAnimationFrame(this.swipeAnimation.bind(this))
  }

  _onClick (e: Event) {
    console.log('CLICK')
  }
}

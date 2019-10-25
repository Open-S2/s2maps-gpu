// @flow
import Camera from './camera'
import Style from '../style'
import { Painter } from '../gl'

import type { ProjectionType } from './projections'

export type MapOptions = {
  container: HTMLElement,
  interactive?: boolean,
  style: Style | Object | string,
  projection?: ProjectionType,
  scrollZoom?: boolean,
  canvasMultiplier?: number
}

export default class Map extends Camera {
  id: string = Math.random().toString(36).replace('0.', '')
  _canvas: HTMLCanvasElement
  _interactive: boolean
  _scrollZoom: boolean
  constructor (options?: MapOptions = {}, canvas: HTMLCanvasElement) {
    super(options)
    this._canvas = canvas
    this._setupCanvas()
    // check if we can interact with the map
    this._interactive = options.interactive || true
    this._scrollZoom = options.scrollZoom || true
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
    this._canvas.addEventListener('webglcontextlost', this._contextLost, false)
    this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false)
    this._canvas.addEventListener('wheel', this._onScroll.bind(this))
    this.resizeCamera(this._canvas.width, this._canvas.height)
  }

  getCanvas (): HTMLCanvasElement {
    return this._canvas
  }

  resize (width: number, height: number) {
    this.resizeCamera(width, height)
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
}

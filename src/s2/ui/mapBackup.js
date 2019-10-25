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
  scrollZoom?: boolean
}

export default class Map extends Camera {
  _container: HTMLElement
  _canvasContainer: HTMLElement
  _canvas: HTMLCanvasElement
  _canvasMultiplier: number = 2
  _interactive: boolean
  _scrollZoom: boolean
  constructor (options: MapOptions) {
    super(options)
    // check if we can interact with the map
    this._interactive = options.interactive || true
    this._scrollZoom = options.scrollZoom || true
    // get the container
    if (typeof options.container === 'string') {
      this._container = window.document.getElementById(options.container)
      if (!this._container) throw new Error(`Container '${options.container}' not found.`)
    } else if (options.container instanceof HTMLElement) {
      this._container = options.container
    } else {
      throw new Error(`Invalid type: 'container' must be a String or HTMLElement.`)
    }
    // prep container, creating the canvas
    this._setupContainer()
    // now that we have a canvas, prep the camera's painter
    this.painter = new Painter(this._canvas, options)
    // setup the style
    this.style = new Style(options.style)
    // now that we have a painter and style object, let's create the initial scene
    this._setupInitialScene()
    // render our first pass
    this._render()
  }

  _setupContainer () {
    // prep container
    const container = this._container
    container.classList.add('s2-map')
    // build canvas-container
    const canvasContainer = this._canvasContainer = window.document.createElement('div')
    canvasContainer.className = 's2-canvas-container'
    container.appendChild(canvasContainer)
    if (this._interactive) canvasContainer.classList.add('s2-interactive')
    // build canvas
    const canvas = this._canvas = window.document.createElement('canvas')
    canvas.className = 's2-canvas'
    canvasContainer.appendChild(canvas)
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', 'S2Map')
    canvas.addEventListener('webglcontextlost', this._contextLost, false)
    canvas.addEventListener('webglcontextrestored', this._contextRestored, false)
    canvas.addEventListener('wheel', this._onScroll.bind(this))
    window.addEventListener('resize', this._resize.bind(this))
    this._resizeCanvasToDisplaySize()
  }

  _containerDimensions (): null | [number, number] {
    if (this._container) return [this._container.clientWidth, this._container.clientHeight]
    else return null
  }

  getContainer (): HTMLElement {
    return this._container
  }

  getCanvasContainer (): HTMLElement {
    return this._canvasContainer
  }

  getCanvas (): HTMLCanvasElement {
    return this._canvas
  }

  _resize (e: Event) {
    this._resizeCanvasToDisplaySize()
    this._render()
  }

  _resizeCanvasToDisplaySize () {
    const canvas = this._canvas
    const container = this._container
    const width  = container.clientWidth  * this._canvasMultiplier | 0
    const height = container.clientHeight * this._canvasMultiplier | 0
    if (width !== canvas.width && height !== canvas.height) {
      canvas.width  = width
      canvas.height = height
    }
    this.resizeCamera(width, height)
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

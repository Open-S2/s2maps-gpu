// @flow
import type { MapOptions } from './ui/map'

// This is a builder / api instance for the end user.
// We want individual map instances in their own web worker thread. However,
// we only want one instance of webWorkerPool to run for all map instances.
export default class S2Map {
  _container: HTMLElement
  _canvasContainer: HTMLElement
  _canvasMultiplier: number = window.devicePixelRatio || 1
  _offscreen: boolean = false
  _canvas: HTMLCanvasElement
  map: Map | Worker
  id: string = Math.random().toString(36).replace('0.', '')
  constructor (options: MapOptions) {
    if (options.canvasMultiplier) this._canvasMultiplier = options.canvasMultiplier
    else options.canvasMultiplier = this._canvasMultiplier
    // get the container
    if (typeof options.container === 'string') {
      this._container = window.document.getElementById(options.container)
      if (!this._container) throw new Error(`Container '${options.container}' not found.`)
    } else if (options.container instanceof HTMLElement) {
      this._container = options.container
    } else { throw new Error(`Invalid type: 'container' must be a String or HTMLElement.`) }
    // we now remove container from options for potential webworker
    delete options.container
    // prep container, creating the canvas
    const canvas = this._canvas = this._setupContainer()
    // create map via a webworker if possible, otherwise just load it in directly
    this._setupCanvas(canvas, options)
    // now that canvas is setup, support resizing
    if (ResizeObserver) new ResizeObserver(this._resize.bind(this)).observe(this._container)
    else window.addEventListener('resize', this._resize.bind(this))
    // lastly let the S2WorkerPool know of this maps existance
    window.S2WorkerPool.addMap(this)
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
    const canvas = window.document.createElement('canvas')
    canvas.className = 's2-canvas'
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', 'S2Map')
    canvas.width = container.clientWidth * this._canvasMultiplier
    canvas.height = container.clientHeight * this._canvasMultiplier
    canvasContainer.appendChild(canvas)
    return canvas
  }

  _setupCanvas (canvas: HTMLCanvasElement, options: MapOptions) {
    const self = this
    // if browser supports it, create an instance of the mapWorker
    if (canvas.transferControlToOffscreen) {
      if (options.interactive === undefined || options.interactive === true) {
        if (options.scrollZoom === undefined || options.scrollZoom === true) canvas.addEventListener('wheel', self._onScroll.bind(self))
        canvas.addEventListener('mousedown', () => self.map.postMessage({ type: 'mousedown' }))
        canvas.addEventListener('mouseup', () => self.map.postMessage({ type: 'mouseup' }))
        canvas.addEventListener('mousemove', self._onMouseMove.bind(self))
        canvas.addEventListener('touchstart', (e) => self._onTouch(e, 'touchstart'))
        canvas.addEventListener('touchend', (e) => self._onTouch(e, 'touchend'))
        canvas.addEventListener('touchmove', (e) => self._onTouch(e, 'touchmove'))
      }
      const offscreen = canvas.transferControlToOffscreen()
      self._offscreen = true
      self.map = new Worker('./workers/map.worker.js', { type: 'module' })
      self.map.onmessage = self._mapMessage.bind(self)
      options.canvasWidth = self._container.clientWidth
      options.canvasHeight = self._container.clientHeight
      self.map.postMessage({ type: 'canvas', options, canvas: offscreen, id: self.id }, [offscreen])
    } else {
      import('./ui/map').then(map => {
        self.map = new map.default(options, canvas, self.id)
      })
    }
  }

  _onTouch (e: Event, type: string) {
    e.preventDefault()
    const { touches } = e
    const { length } = touches
    const touchEvent = { length }

    for (let i = 0; i < length; i++) {
      const { clientX, clientY } = touches[i]
      touchEvent[i] = { clientX, clientY }
    }

    this.map.postMessage({ type, touchEvent })
  }

  _onScroll (e) {
    e.preventDefault()
    const { clientX, clientY, deltaY } = e
    const rect = this._canvas.getBoundingClientRect()
    this.map.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY })
  }

  _onMouseMove (e) {
    const { movementX, movementY } = e
    this.map.postMessage({ type: 'mousemove', movementX, movementY })
  }

  _mapMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'request') {
      window.S2WorkerPool.tileRequest(mapID, data.tiles)
    } else if (type === 'style') {
      window.S2WorkerPool.injectStyle(mapID, data.style)
    }
  }

  _resize () {
    const { _container, _canvasMultiplier } = this
    // rebuild the proper width and height using the container as a guide
    if (this._offscreen) {
      this.map.postMessage({
        type: 'resize',
        width: _container.clientWidth,
        height: _container.clientHeight,
        canvasMultiplier: _canvasMultiplier
      })
    } else if (this.map) { this.map.resize(_container.clientWidth, _container.clientHeight, _canvasMultiplier) }
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

  injectData (data) {
    if (this._offscreen) {
      // prep ArrayBuffer 0 copy transfer
      const { type } = data
      if (type === 'filldata') this.map.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.codeTypeBuffer, data.featureGuideBuffer])
      else if (type === 'linedata') this.map.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer])
      else if (type === 'glyphdata') this.map.postMessage(data, [data.glyphFilterBuffer, data.glyphFillVertexBuffer, data.glyphFillIndexBuffer, data.glyphLineVertexBuffer, data.glyphQuadBuffer, data.layerGuideBuffer])
      else if (type === 'rasterdata') this.map.postMessage(data, [data.image])
      else if (type === 'maskdata') this.map.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.radiiBuffer])
      else this.map.postMessage(data)
    } else {
      this.map.injectData(data)
    }
  }
}

// @flow
/* global HTMLElement HTMLCanvasElement ResizeObserver TouchEvent WheelEvent MouseEvent */
import type Map, { MapOptions } from './ui/map'
import type MapWorker from './workers/map.worker.js'

// This is a builder / api instance for the end user.
// We want individual map instances in their own web worker thread. However,
// we only want one instance of webWorkerPool to run for all map instances.
export default class S2Map {
  _container: HTMLElement
  _canvasContainer: HTMLElement
  _navigationContainer: HTMLElement
  _jollyRoger: HTMLElement
  _canvasMultiplier: number = window.devicePixelRatio || 2
  _offscreen: boolean = false
  _canvas: HTMLCanvasElement
  map: Map | MapWorker
  id: string = Math.random().toString(36).replace('0.', '')
  constructor (options: MapOptions) {
    this._canvasMultiplier = options.canvasMultiplier = Math.max(2, options.canvasMultiplier || this._canvasMultiplier)
    // get the container
    if (typeof options.container === 'string') {
      this._container = window.document.getElementById(options.container)
      if (!this._container) throw new Error(`Container not found.`)
    } else if (options.container instanceof HTMLElement) {
      this._container = options.container
    } else { throw new Error(`Invalid type: 'container' must be a String or HTMLElement.`) }
    // we now remove container from options for potential webworker
    delete options.container
    // prep container, creating the canvas
    const canvas = this._canvas = this._setupContainer(options)
    // create map via a webworker if possible, otherwise just load it in directly
    this._setupCanvas(canvas, options)
  }

  delete () {
    const { _offscreen, map, _canvas } = this
    if (_offscreen && map) map.postMessage({ type: 'delete' }) // $FlowIgnore
    else if (map) map.delete()
    // lastly, remove all canvas listeners via cloning
    _canvas.replaceWith(_canvas.cloneNode(true))
  }

  _setupContainer (): HTMLCanvasElement {
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

  _setupControlContainer (options: MapOptions) {
    const { _canvasContainer } = this
    const { jollyRoger, zoomController, darkMode } = options
    // if jollyRoger is not false, add the logo
    if (jollyRoger !== false) {
      const jR = this._jollyRoger = window.document.createElement('div')
      jR.className = 's2-jolly-roger' + (darkMode ? '-dark' : '')
      _canvasContainer.appendChild(jR)
    }
    // if zoom or compass controllers, add
    if (zoomController) {
      // first create the container
      const navigationContainer = this._navigationContainer = window.document.createElement('div')
      navigationContainer.className = 's2-nav-container'
      if (darkMode) navigationContainer.classList.add('s2-nav-dark')
      _canvasContainer.appendChild(navigationContainer)
      if (zoomController) {
        // plus
        const zoomPlus = window.document.createElement('button')
        zoomPlus.className = 's2-zoom-button s2-zoom-plus'
        zoomPlus.setAttribute('aria-hidden', true)
        zoomPlus.tabIndex = -1
        navigationContainer.appendChild(zoomPlus)
        zoomPlus.addEventListener('click', () => this._navEvent('zoomIn'))
        // seperator
        const navSep = window.document.createElement('div')
        navSep.className = 's2-nav-sep' + (darkMode ? '-dark' : '')
        navigationContainer.appendChild(navSep)
        // minus
        const zoomMinus = window.document.createElement('button')
        zoomMinus.className = 's2-zoom-button s2-zoom-minus'
        zoomMinus.setAttribute('aria-hidden', true)
        zoomMinus.tabIndex = -1
        navigationContainer.appendChild(zoomMinus)
        zoomMinus.addEventListener('click', () => this._navEvent('zoomOut'))
      }
    }
  }

  _setupCanvas (canvas: HTMLCanvasElement, options: MapOptions) {
    const self = this
    // if browser supports it, create an instance of the mapWorker
    if (canvas.transferControlToOffscreen) { // $FlowIgnore
      const offscreen = canvas.transferControlToOffscreen()
      self._offscreen = true
      import('./workers/map.worker.js').then(res => {
        const Map: MapWorker = res.default
        const mapWorker = self.map = new Map()
        mapWorker.onmessage = self._mapMessage.bind(self)
        mapWorker.postMessage({ type: 'canvas', options, canvas: offscreen, id: self.id }, [offscreen])
        if (options.interactive === undefined || options.interactive === true) {
          if (options.scrollZoom === undefined || options.scrollZoom === true) canvas.addEventListener('wheel', self._onScroll.bind(self))
          canvas.addEventListener('mousedown', () => {
            mapWorker.postMessage({ type: 'mousedown' })
            // build mousemove
            const mouseMoveFunc = (e: MouseEvent) => { self._onMouseMove(e) }
            window.addEventListener('mousemove', mouseMoveFunc)
            window.addEventListener('mouseup', () => {
              window.removeEventListener('mousemove', mouseMoveFunc)
              mapWorker.postMessage({ type: 'mouseup' })
            }, { once: true })
          })
          canvas.addEventListener('touchstart', (e: TouchEvent) => self._onTouch(e, 'touchstart'))
          canvas.addEventListener('touchend', (e: TouchEvent) => self._onTouch(e, 'touchend'))
          canvas.addEventListener('touchmove', (e: TouchEvent) => self._onTouch(e, 'touchmove'))
        }
        // let map know to finish the setup
        self._onCanvasReady(options)
      })
    } else {
      import('./ui/map').then(map => {
        const Map = map.default
        self.map = new Map(options, canvas, self.id)
        // let map know to finish the setup
        self._onCanvasReady(options)
      })
    }
  }

  _onCanvasReady (options: MapOptions) {
    // now that canvas is setup, support resizing // $FlowIgnore
    if ('ResizeObserver' in window) new ResizeObserver(this._resize.bind(this)).observe(this._container)
    else window.addEventListener('resize', this._resize.bind(this))
    // now that canvas is setup, add control containers as necessary
    this._setupControlContainer(options)
    // lastly let the S2WorkerPool know of this maps existance
    window.S2WorkerPool.addMap(this)
  }

  _onTouch (e: TouchEvent, type: string) {
    e.preventDefault()
    const { touches } = e
    const { length } = touches
    const touchEvent = { length }

    for (let i = 0; i < length; i++) {
      const { clientX, clientY } = touches[i]
      touchEvent[i] = { clientX, clientY }
    }
    // $FlowIgnore
    this.map.postMessage({ type, touchEvent })
  }

  _onScroll (e: WheelEvent) {
    e.preventDefault()
    const { clientX, clientY, deltaY } = e
    const rect = this._canvas.getBoundingClientRect() // $FlowIgnore
    this.map.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY })
  }

  _onMouseMove (e: MouseEvent) {
    const { movementX, movementY } = e // $FlowIgnore
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

  _resize () {
    const { map, _offscreen, _container, _canvasMultiplier } = this
    // rebuild the proper width and height using the container as a guide
    if (_offscreen && map) { // $FlowIgnore
      map.postMessage({
        type: 'resize',
        width: _container.clientWidth * _canvasMultiplier,
        height: _container.clientHeight * _canvasMultiplier
      }) // $FlowIgnore
    } else if (map) { map.resize(_container.clientWidth * _canvasMultiplier, _container.clientHeight * _canvasMultiplier) }
  }

  _navEvent (ctrl: 'zoomIn' | 'zoomOut') {
    const { map, _offscreen } = this
    if (_offscreen && map) map.postMessage({ type: 'nav', ctrl })
    else if (map) map.navEvent(ctrl)
  }

  injectData (data) {
    const { map, _offscreen } = this
    if (_offscreen && map) {
      // prep ArrayBuffer 0 copy transfer
      const { type } = data // $FlowIgnore
      if (type === 'filldata') map.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.codeTypeBuffer, data.featureGuideBuffer]) // $FlowIgnore
      else if (type === 'linedata') map.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer]) // $FlowIgnore
      else if (type === 'glyphdata') map.postMessage(data, [data.glyphFilterBuffer, data.glyphFillVertexBuffer, data.glyphFillIndexBuffer, data.glyphLineVertexBuffer, data.glyphQuadBuffer, data.layerGuideBuffer]) // $FlowIgnore
      else if (type === 'rasterdata') map.postMessage(data, [data.image]) // $FlowIgnore
      else if (type === 'maskdata') map.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.radiiBuffer]) // $FlowIgnore
      else map.postMessage(data)
    } else if (map) { // $FlowIgnore
      map.injectData(data)
    }
  }

  /** API **/
  setStyle (style: Object) { // $FlowIgnore
    const { _offscreen, map } = this
    if (_offscreen && map) map.postMessage({ type: 'setStyle', style }) // $FlowIgnore
    else if (map) map.setStyle(style)
  }

  setMoveState (state: boolean) { // $FlowIgnore
    const { _offscreen, map } = this
    if (_offscreen) map.postMessage({ type: 'moveState', state }) // $FlowIgnore
    else if (map) map.setMoveState(state)
  }

  setZoomState (state: boolean) { // $FlowIgnore
    const { _offscreen, map } = this
    if (_offscreen) map.postMessage({ type: 'zoomState', state }) // $FlowIgnore
    else if (map) map.setZoomState(state)
  }

  jumpTo (lon: number, lat: number, zoom: number) {
    const { _offscreen, map } = this
    if (_offscreen) map.postMessage({ type: 'jumpTo', lon, lat, zoom }) // $FlowIgnore
    else if (map) map.jumpTo(lon, lat, zoom)
  }

  flyTo (lon: number, lat: number, zoom: number) {

  }
}

if (window) window.S2Map = S2Map

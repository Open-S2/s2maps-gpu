// @flow
/* eslint-env browser */
import Info from './ui/info'

import type { MapOptions } from './ui/map'
import type { Marker } from './workers/source/MarkerSource'

type Attributions = { [string]: string }

// This is a builder / api instance for the end user.
// We want individual map instances in their own web worker thread. However,
// we only want one instance of webWorkerPool to run for all map instances.
export default class S2Map extends EventTarget {
  _container: HTMLElement
  _canvasContainer: HTMLElement
  _navigationContainer: HTMLElement
  _canvasMultiplier: number
  _offscreen: boolean = false
  _canvas: HTMLCanvasElement
  _attributionPopup: HTMLCanvasElement
  _attributions: Attributions = {}
  map: Map | Worker
  info: Info
  id: string = Math.random().toString(36).replace('0.', '')
  constructor (options: MapOptions = {}) {
    super()
    // make sure certain options exist
    options = { canvasMultiplier: window.devicePixelRatio || 2, interactive: true, ...options }
    options.canvasMultiplier = this._canvasMultiplier = Math.max(2, options.canvasMultiplier)
    // get the container
    if (typeof options.container === 'string') {
      this._container = window.document.getElementById(options.container)
      if (!this._container) throw new Error('Container not found.')
    } else if (options.container instanceof HTMLElement) {
      this._container = options.container
    } else { throw new Error('Invalid type: \'container\' must be a String or HTMLElement.') }
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
    // reset the worker pool
    window.S2WorkerPool.delete()
    // lastly, remove all canvas listeners via cloning
    _canvas.replaceWith(_canvas.cloneNode(true))
  }

  _setupContainer (options: MapOptions): HTMLCanvasElement {
    const self = this
    // prep container
    const container = self._container
    container.classList.add('s2-map')
    // build canvas-container
    const canvasContainer = self._canvasContainer = window.document.createElement('div')
    canvasContainer.className = 's2-canvas-container'
    container.appendChild(canvasContainer)
    // build canvas
    const canvas = window.document.createElement('canvas')
    canvas.className = 's2-canvas'
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', 'S2Map')
    canvas.width = container.clientWidth * self._canvasMultiplier
    canvas.height = container.clientHeight * self._canvasMultiplier
    canvasContainer.appendChild(canvas)
    // add infoLayers should they exist
    if (Array.isArray(options.infoLayers)) this.info = new Info(this, container, options.infoLayers)

    return canvas
  }

  async _setupCanvas (canvas: HTMLCanvasElement, options: MapOptions) {
    const self = this
    const { _canvasContainer } = self
    // if browser supports it, create an instance of the mapWorker
    if (!navigator.gpu && canvas.transferControlToOffscreen) { // $FlowIgnore
      const offscreen = canvas.transferControlToOffscreen()
      self._offscreen = true
      const mapWorker = self.map = new Worker(new URL('./workers/map.worker.js', import.meta.url), { name: 'map-worker', type: 'module' })
      mapWorker.onmessage = self._mapMessage.bind(self)
      mapWorker.postMessage({ type: 'canvas', options, canvas: offscreen, id: self.id }, [offscreen])
    } else {
      const Map = await import('./ui/map').then(m => m.default)
      self.map = new Map(options, canvas, self.id, self)
    }
    // now that canvas is setup, add control containers as necessary
    this._setupControlContainer(options)
    // if we interact with the map, we need to both allow interaction with styling
    // and watch how the mouse moves on the canvas
    if (options.interactive === true) {
      _canvasContainer.classList.add('s2-interactive')
      _canvasContainer.addEventListener('mousemove', self._onCanvasMouseMove.bind(self))
      if (options.scrollZoom === undefined || options.scrollZoom === true) _canvasContainer.addEventListener('wheel', self._onScroll.bind(self))
      _canvasContainer.addEventListener('mousedown', self._onMouseDown.bind(self))
      _canvasContainer.addEventListener('touchstart', (e: TouchEvent) => self._onTouch(e, 'touchstart'))
      _canvasContainer.addEventListener('touchend', (e: TouchEvent) => self._onTouch(e, 'touchend'))
      _canvasContainer.addEventListener('touchmove', (e: TouchEvent) => self._onTouch(e, 'touchmove'))
    }
    // let map know to finish the setup
    self._onCanvasReady()
  }

  _onCanvasReady () {
    // now that canvas is setup, support resizing // $FlowIgnore
    if ('ResizeObserver' in window) new ResizeObserver(this._resize.bind(this)).observe(this._container)
    else window.addEventListener('resize', this._resize.bind(this))
    // let the S2WorkerPool know of this maps existance
    window.S2WorkerPool.addMap(this)
    // lastly emit that the map is ready for commands
    this.dispatchEvent(new Event('ready'))
  }

  _setupControlContainer (options: MapOptions) {
    const { _container, _attributions } = this
    const { attributions, zoomController, darkMode } = options
    // add info bar with our jollyRoger
    const attribution = window.document.createElement('div')
    attribution.id = 's2-attribution'
    const info = window.document.createElement('div')
    info.id = 's2-info'
    info.onclick = function () { attribution.classList.toggle('show') }
    const popup = this._attributionPopup = window.document.createElement('div')
    popup.className = 's2-popup-container'
    popup.innerHTML = '<div>Rendered with ❤ by</div><a href="https://s2maps.io" target="popup"><div class="s2-jolly-roger"></div></a>'
    // add attributions
    if (attributions) {
      for (const name in attributions) {
        if (!_attributions[name]) {
          _attributions[name] = attributions[name]
          popup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`
        }
      }
    }
    attribution.appendChild(info)
    attribution.appendChild(popup)
    _container.appendChild(attribution)
    // if zoom or compass controllers, add
    if (zoomController) {
      // first create the container
      const navigationContainer = this._navigationContainer = window.document.createElement('div')
      navigationContainer.className = 's2-nav-container'
      if (darkMode) navigationContainer.classList.add('s2-nav-dark')
      _container.appendChild(navigationContainer)
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

  _addAttributions (attributions: Attributions = {}) {
    const { _attributionPopup, _attributions } = this
    for (const name in attributions) {
      if (!_attributions[name]) {
        _attributions[name] = attributions[name]
        _attributionPopup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`
      }
    }
  }

  _onTouch (e: TouchEvent, type: string) {
    const { map, _offscreen, _canvasContainer, _canvasMultiplier } = this
    e.preventDefault()
    const { touches } = e
    const { length } = touches
    const touchEvent = { length }

    for (let i = 0; i < length; i++) {
      const { clientX, clientY, pageX, pageY } = touches[i]
      const x = (pageX - _canvasContainer.offsetLeft) * _canvasMultiplier
      const y = (pageY - _canvasContainer.offsetTop) * _canvasMultiplier
      touchEvent[i] = { clientX, clientY, x, y }
    }
    if (_offscreen && map) {
      map.postMessage({ type, touchEvent })
    } else if (map) {
      if (type === 'touchstart') map.onTouchStart(touchEvent)
      else if (type === 'touchend') map.dragPan.onTouchEnd(touchEvent)
      else if (type === 'touchmove') map.dragPan.onTouchMove(touchEvent)
    }
  }

  _onScroll (e: WheelEvent) {
    e.preventDefault()
    const { map, _offscreen } = this
    const { clientX, clientY, deltaY } = e
    const rect = this._canvas.getBoundingClientRect() // $FlowIgnore
    if (_offscreen && map) {
      map.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY })
    } else if (map) { map._onZoom(deltaY, clientX - rect.left, clientY - rect.top) }
  }

  _onMouseDown () {
    const self = this
    const { map, _offscreen } = self
    // send off a mousedown
    if (_offscreen && map) {
      map.postMessage({ type: 'mousedown' })
    } else if (map) { map.dragPan.onMouseDown() }
    // build a listener to mousemovement
    const mouseMoveFunc = self._onMouseMove.bind(self)
    window.addEventListener('mousemove', mouseMoveFunc)
    // upon eventual mouseup, let the map know
    window.addEventListener('mouseup', (e) => {
      const rect = self._canvas.getBoundingClientRect()
      const { clientX, clientY } = e
      window.removeEventListener('mousemove', mouseMoveFunc)
      if (_offscreen && map) {
        map.postMessage({ type: 'mouseup', clientX, clientY, rect })
      } else if (map) { map.dragPan.onMouseUp(clientX - rect.left - (rect.width / 2), (rect.height / 2) - clientY - rect.top) }
    }, { once: true })
  }

  _onMouseMove (e: MouseEvent) {
    const { map, _offscreen } = this
    const { movementX, movementY } = e // $FlowIgnore
    if (_offscreen && map) {
      map.postMessage({ type: 'mousemove', movementX, movementY })
    } else if (map) { map.dragPan.onMouseMove(movementX, movementY) }
  }

  _onCanvasMouseMove (e: MouseEvent) {
    const { map, _offscreen, _canvasContainer, _canvasMultiplier } = this
    const { pageX, pageY } = e

    const x = (pageX - _canvasContainer.offsetLeft) * _canvasMultiplier
    const y = (pageY - _canvasContainer.offsetTop) * _canvasMultiplier

    if (_offscreen && map) {
      map.postMessage({ type: 'canvasmousemove', x, y })
    } else if (map) { map.onCanvasMouseMove(x, y) }
  }

  _mapMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'tilerequest') {
      window.S2WorkerPool.tileRequest(mapID, data.tiles, data.sourceNames)
    } else if (type === 'style') {
      window.S2WorkerPool.injectStyle(mapID, data.style)
    } else if (type === 'mouseenter') {
      const { feature } = data
      if (feature) {
        this._canvas.style.cursor = feature.__cursor || 'default'
        this.dispatchEvent(new CustomEvent('mouseenter', { detail: feature }))
      }
    } else if (type === 'mouseleave') {
      const { feature } = data
      this._canvas.style.cursor = 'default'
      if (feature) this.dispatchEvent(new CustomEvent('mouseleave', { detail: feature }))
    } else if (type === 'click') {
      const { feature, lon, lat } = data
      if (this.info) this.info.click(feature, lon, lat)
      this.dispatchEvent(new CustomEvent('click', { detail: { feature, lon, lat } }))
    } else if (type === 'pos') {
      const { zoom, lon, lat } = data
      this.dispatchEvent(new CustomEvent('pos', { detail: { zoom, lon, lat } }))
    } else if (type === 'screenshot') {
      this.dispatchEvent(new CustomEvent('screenshot', { detail: data.screen }))
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
    if (data.type === 'attributions') {
      this._addAttributions(data.attributions)
    } else if (data.type === 'info') {
      if (this.info) this.info.injectInfo(data.json)
    } else if (_offscreen && map) {
      const { type } = data // $FlowIgnore
      if (type === 'filldata') map.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.codeTypeBuffer, data.featureGuideBuffer]) // $FlowIgnore
      else if (type === 'linedata') map.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer]) // $FlowIgnore
      else if (type === 'glyphdata') map.postMessage(data, [data.glyphFilterBuffer, data.glyphQuadBuffer, data.glyphColorBuffer, data.featureGuideBuffer]) // $FlowIgnore
      else if (type === 'glyphimages') map.postMessage(data, data.images.map(i => i.data))
      else if (type === 'rasterdata') map.postMessage(data, [data.image]) // $FlowIgnore
      else if (type === 'maskdata') map.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.radiiBuffer]) // $FlowIgnore
      else if (type === 'pointdata' || type === 'heatmapdata') map.postMessage(data, [data.vertexBuffer, data.weightBuffer, data.featureGuideBuffer]) // $FlowIgnore
      else if (type === 'interactivedata') map.postMessage(data, [data.interactiveGuideBuffer, data.interactiveDataBuffer])
      else map.postMessage(data)
    } else if (map) { // $FlowIgnore
      map.injectData(data)
    }
  }

  /** API **/
  setStyle (style: Object, ignorePosition: boolean = true) { // $FlowIgnore
    const { _offscreen, map } = this
    if (_offscreen && map) map.postMessage({ type: 'setStyle', style, ignorePosition }) // $FlowIgnore
    else if (map) map.setStyle(style, ignorePosition)
  }

  setMoveState (state: boolean) { // $FlowIgnore
    const { _offscreen, map } = this
    if (_offscreen && map) map.postMessage({ type: 'moveState', state }) // $FlowIgnore
    else if (map) map.setMoveState(state)
  }

  setZoomState (state: boolean) { // $FlowIgnore
    const { _offscreen, map } = this
    if (_offscreen && map) map.postMessage({ type: 'zoomState', state }) // $FlowIgnore
    else if (map) map.setZoomState(state)
  }

  jumpTo (lon: number, lat: number, zoom: number) {
    const { _offscreen, map } = this
    if (_offscreen && map) map.postMessage({ type: 'jumpTo', lon, lat, zoom }) // $FlowIgnore
    else if (map) map.jumpTo(lon, lat, zoom)
  }

  flyTo (lon: number, lat: number, zoom: number) {

  }

  getInfo (featureID: number) {
    const { _offscreen, map } = this
    // 1) tell worker pool we need info data
    window.S2WorkerPool.getInfo(this.id, featureID)
    // 2) clear old info s2json data should it exist
    const sourceNames = ['_info']
    if (_offscreen && map) map.postMessage({ type: 'resetSource', sourceNames, keepCache: true }) // $FlowIgnore
    else if (map) map.resetSource(sourceNames, true)
  }

  resetSource (sourceNames: string | Array<string>, keepCache?: boolean = false, awaitReplace?: boolean = false) {
    const { _offscreen, map } = this
    if (!Array.isArray(sourceNames)) sourceNames = [sourceNames]
    // 1) tell worker pool we dont need info data anymore
    window.S2WorkerPool.deleteSource(this.id, sourceNames)
    // 2) clear old info s2json data should it exist
    if (_offscreen && map) map.postMessage({ type: 'resetSource', sourceNames }) // $FlowIgnore
    else if (map) map.resetSource(sourceNames, keepCache, awaitReplace)
  }

  deleteSource (sourceNames: string | Array<string>) {
    const { _offscreen, map } = this
    if (!Array.isArray(sourceNames)) sourceNames = [sourceNames]
    // 1) tell worker pool we dont need info data anymore
    window.S2WorkerPool.deleteSource(this.id, sourceNames)
    // 2) clear old info s2json data should it exist
    if (_offscreen && map) map.postMessage({ type: 'clearSource', sourceNames }) // $FlowIgnore
    else if (map) map.clearSource(sourceNames)
  }

  addMarker (markers: Marker | Array<Marker>, sourceName?: string = '_markers') {
    const { _offscreen, map } = this
    if (!Array.isArray(markers)) markers = [markers]
    // 1) let the worker pool know we have new marker(s)
    window.S2WorkerPool.addMarkers(this.id, markers, sourceName)
    // 2) tell the map that (a) new marker(s) has/have been added
    if (_offscreen && map) map.postMessage({ type: 'resetSource', sourceNames: [sourceName], keepCache: true, awaitReplace: true }) // $FlowIgnore
    else if (map) map.resetSource(sourceName, true, true)
  }

  removeMarker (ids: number | Array<number>, sourceName?: string = '_markers') {
    const { _offscreen, map } = this
    if (!Array.isArray(ids)) ids = [ids]
    // 1) let the worker pool know we need to remove marker(s)
    window.S2WorkerPool.removeMarkers(this.id, ids, sourceName)
    // 2) tell the map that (a) marker(s) has/have to be removed
    if (_offscreen && map) map.postMessage({ type: 'resetSource', sourceNames: [sourceName], keepCache: true, awaitReplace: true }) // $FlowIgnore
    else if (map) map.resetSource(sourceName, true, true)
  }

  screenshot () {
    const { _offscreen, map } = this
    if (_offscreen && map) map.postMessage({ type: 'screenshot' }) // $FlowIgnore
    else if (map) map.screenshot()
    return new Promise(resolve => {
      this.addEventListener('screenshot', (data) => { resolve(data) }, { once: true })
    })
  }
}

if (window) window.S2Map = S2Map

// 1) markers/popups with html
// 2) fix glyph filter overlap / interact should be the same as filter overlap
// 3) glyph icon + text pairs (required checking if same id overlap)
// 4) text along path
// 5) road signs
// 6) dashed lines + rounded joins
// 7) interact with points, lines, and fills

// 3D points
// 3D buildings (shapes)
// hillshade fixes
// webgpu
// view at angle + camera system upgrade
// 3D terrain
// geocoding
// isochrones

// olympus
// * new point + line + poly algorithm
// * improve joining algorthim (use same as msdf)
// * redo fills (also low zooms shouldn't have to split on front end)
// * redo roads -> working for road signs
// * redo terrain

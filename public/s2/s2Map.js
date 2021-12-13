// @flow
/* eslint-env browser */
import Worker from './util/corsWorker'
import Info from './ui/info'

import type { MapOptions } from './ui/map'
import type { Layer } from './style/styleSpec'
import type { Marker } from './workers/source/MarkerSource'
import type { AnimationDirections } from './ui/camera/animator'

type Attributions = { [string]: string }

// S2Map is called by the user and includes the API to interact with the mapping engine
export default class S2Map extends EventTarget {
  _container: HTMLElement
  _canvasContainer: HTMLElement
  _navigationContainer: HTMLElement
  _canvasMultiplier: number
  _canvas: HTMLCanvasElement
  _attributionPopup: HTMLCanvasElement
  _compass: HTMLElement
  _colorBlind: HTMLElement
  _attributions: Attributions = {}
  bearing: number = 0 // degrees
  pitch: number = 0 // degrees
  colorMode: 0 | 1 | 2 | 3 = 0 // 0: none - 1: protanopia - 2: deutranopia - 3: tritanopia
  map: Map
  offscreen: Worker
  info: Info
  id: string = Math.random().toString(36).replace('0.', '')
  constructor (options: MapOptions = {}) {
    super()
    // make sure certain options exist
    options = { canvasMultiplier: window.devicePixelRatio || 2, interactive: true, ...options }
    options.canvasMultiplier = this._canvasMultiplier = Math.max(2, options.canvasMultiplier || 2)
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

  /* BUILD */

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
    // prep the ready function should it exist
    const { ready } = options
    delete options.ready
    // if browser supports it, create an instance of the mapWorker
    if (!navigator.gpu && canvas.transferControlToOffscreen) {
      // TODO: MORE THAN LIKELY A RACE CONDITION HERE IF WAITING FOR A "READY" EVENT
      const offscreenCanvas = canvas.transferControlToOffscreen()
      const mapWorker = self.offscreen = new Worker(new URL('./workers/map.worker.js', import.meta.url), { name: 'map-worker', type: 'module' })
      mapWorker.onmessage = self._mapMessage.bind(self)
      mapWorker.postMessage({ type: 'canvas', options, canvas: offscreenCanvas, id: self.id }, [offscreenCanvas])
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
      _canvasContainer.addEventListener('contextmenu', self._onCompassMouseDown.bind(self))
      // _canvasContainer.addEventListener('dblclick', () => { console.log('DOUBLE CLICK') })
      if (options.scrollZoom === undefined || options.scrollZoom === true) _canvasContainer.addEventListener('wheel', self._onScroll.bind(self))
      _canvasContainer.addEventListener('mousedown', self._onMouseDown.bind(self))
      _canvasContainer.addEventListener('touchstart', (e: TouchEvent) => self._onTouch(e, 'touchstart'))
      _canvasContainer.addEventListener('touchend', (e: TouchEvent) => self._onTouch(e, 'touchend'))
      _canvasContainer.addEventListener('touchmove', (e: TouchEvent) => self._onTouch(e, 'touchmove'))
    }
    // let map know to finish the setup
    self._onCanvasReady(ready)
  }

  _setupControlContainer (options: MapOptions) {
    const { _container, _attributions } = this
    const { attributions, zoomController, compassController, colorBlindController, darkMode, attributionOff } = options
    // add info bar with our jollyRoger
    if (!attributionOff) {
      const attribution = window.document.createElement('div')
      attribution.id = 's2-attribution'
      const info = window.document.createElement('div')
      info.className = info.id = 's2-info'
      if (darkMode) info.classList.add('s2-info-dark')
      info.onclick = function () { attribution.classList.toggle('show') }
      const popup = this._attributionPopup = window.document.createElement('div')
      popup.className = 's2-popup-container'
      if (darkMode) popup.classList.add('s2-popup-container-dark')
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
    }
    // if zoom or compass controllers, add
    if (zoomController !== false) {
      // first create the container
      const navigationContainer = this._navigationContainer = window.document.createElement('div')
      navigationContainer.className = 's2-nav-container'
      if (darkMode) navigationContainer.classList.add('s2-nav-dark')
      _container.appendChild(navigationContainer)
      // plus
      const zoomPlus = window.document.createElement('button')
      zoomPlus.className = 's2-control-button s2-zoom-plus'
      zoomPlus.setAttribute('aria-hidden', true)
      zoomPlus.tabIndex = -1
      navigationContainer.appendChild(zoomPlus)
      zoomPlus.addEventListener('click', () => this._navEvent('zoomIn'))
      // seperator
      let navSep = window.document.createElement('div')
      navSep.className = 's2-nav-sep' + (darkMode ? '-dark' : '')
      navigationContainer.appendChild(navSep)
      // minus
      const zoomMinus = window.document.createElement('button')
      zoomMinus.className = 's2-control-button s2-zoom-minus'
      zoomMinus.setAttribute('aria-hidden', true)
      zoomMinus.tabIndex = -1
      navigationContainer.appendChild(zoomMinus)
      zoomMinus.addEventListener('click', () => this._navEvent('zoomOut'))
      if (compassController !== false) {
        // seperator
        navSep = window.document.createElement('div')
        navSep.className = 's2-nav-sep' + (darkMode ? '-dark' : '')
        navigationContainer.appendChild(navSep)
        // compass button
        const compassContainer = window.document.createElement('button')
        compassContainer.className = 's2-control-button'
        compassContainer.setAttribute('aria-hidden', true)
        compassContainer.tabIndex = -1
        navigationContainer.appendChild(compassContainer)
        const compass = this._compass = window.document.createElement('div')
        compass.className = 's2-compass'
        compass.setAttribute('aria-hidden', true)
        compass.tabIndex = -1
        compassContainer.appendChild(compass)
        compassContainer.addEventListener('mousedown', this._onCompassMouseDown.bind(this))
      }
      if (colorBlindController !== false) {
        // seperator
        navSep = window.document.createElement('div')
        navSep.className = 's2-nav-sep' + (darkMode ? '-dark' : '')
        navigationContainer.appendChild(navSep)
        // colorblind button
        const colorBlind = this._colorBlind = window.document.createElement('button')
        colorBlind.className = 's2-control-button s2-colorblind-button'
        colorBlind.id = 's2-colorblind-default'
        colorBlind.setAttribute('aria-hidden', true)
        colorBlind.tabIndex = -1
        navigationContainer.appendChild(colorBlind)
        colorBlind.addEventListener('click', this._setColorMode.bind(this))
      }
    }
  }

  /* INTERNAL API */

  injectData (data) {
    const { map, offscreen } = this
    if (data.type === 'attributions') {
      this._addAttributions(data.attributions)
    } else if (data.type === 'info') {
      if (this.info) this.info.injectInfo(data.json)
    } else if (offscreen) {
      const { type } = data
      if (type === 'filldata') offscreen.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.codeTypeBuffer, data.featureGuideBuffer])
      else if (type === 'linedata') offscreen.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer])
      else if (type === 'glyphdata') offscreen.postMessage(data, [data.glyphFilterBuffer, data.glyphQuadBuffer, data.glyphColorBuffer, data.featureGuideBuffer])
      else if (type === 'glyphimages') offscreen.postMessage(data, data.images.map(i => i.data))
      else if (type === 'rasterdata') offscreen.postMessage(data, [data.image])
      else if (type === 'maskdata') offscreen.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.radiiBuffer])
      else if (type === 'pointdata' || type === 'heatmapdata') offscreen.postMessage(data, [data.vertexBuffer, data.weightBuffer, data.featureGuideBuffer])
      else if (type === 'interactivedata') offscreen.postMessage(data, [data.interactiveGuideBuffer, data.interactiveDataBuffer])
      else offscreen.postMessage(data)
    } else if (map) {
      map.injectData(data)
    }
  }

  _mapMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'tilerequest') {
      window.S2WorkerPool.tileRequest(mapID, data.tiles, data.sources)
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
    } else if (type === 'style') {
      window.S2WorkerPool.injectStyle(mapID, data.style)
    } else if (type === 'updateCompass') {
      this._updateCompass(data.bearing, data.pitch)
    } else if (type === 'addLayer') {
      window.S2WorkerPool.addLayer(mapID, data.layer, data.index, data.tileRequest)
    } else if (type === 'removeLayer') {
      window.S2WorkerPool.removeLayer(mapID, data.index)
    } else if (type === 'reorderLayers') {
      window.S2WorkerPool.reorderLayers(mapID, data.layerChanges)
    } else if (type === 'screenshot') {
      this.dispatchEvent(new CustomEvent('screenshot', { detail: data.screen }))
    }
  }

  /* INTERNAL FUNCTIONS */

  _onCanvasReady (ready: null | Function) {
    // now that canvas is setup, support resizing
    if ('ResizeObserver' in window) new ResizeObserver(this._resize.bind(this)).observe(this._container)
    else window.addEventListener('resize', this._resize.bind(this))
    // let the S2WorkerPool know of this maps existance
    window.S2WorkerPool.addMap(this)
    // lastly emit that the map is ready for commands
    if (typeof ready === 'function') ready(this)
  }

  _addAttributions (attributions: Attributions = {}) {
    const { _attributionPopup, _attributions } = this
    if (_attributionPopup) {
      for (const name in attributions) {
        if (!_attributions[name]) {
          _attributions[name] = attributions[name]
          _attributionPopup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`
        }
      }
    }
  }

  _onTouch (e: TouchEvent, type: string) {
    const { map, offscreen, _canvasContainer, _canvasMultiplier } = this
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
    if (offscreen) {
      offscreen.postMessage({ type, touchEvent })
    } else if (map) {
      if (type === 'touchstart') map.onTouchStart(touchEvent)
      else if (type === 'touchend') map.dragPan.onTouchEnd(touchEvent)
      else if (type === 'touchmove') map.dragPan.onTouchMove(touchEvent)
    }
  }

  _onScroll (e: WheelEvent) {
    e.preventDefault()
    const { map, offscreen } = this
    const { clientX, clientY, deltaY } = e
    const rect = this._canvas.getBoundingClientRect()
    if (offscreen) {
      offscreen.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY })
    } else if (map) { map._onZoom(deltaY, clientX - rect.left, clientY - rect.top) }
  }

  _onMouseDown (e: MouseEvent) {
    if (e.button !== 0) return
    const self = this
    const { map, offscreen } = self
    // send off a mousedown
    if (offscreen) {
      offscreen.postMessage({ type: 'mousedown' })
    } else if (map) { map.dragPan.onMouseDown() }
    // build a listener to mousemovement
    const mouseMoveFunc = self._onMouseMove.bind(self)
    window.addEventListener('mousemove', mouseMoveFunc)
    // upon eventual mouseup, let the map know
    window.addEventListener('mouseup', (e) => {
      const rect = self._canvas.getBoundingClientRect()
      const { clientX, clientY } = e
      window.removeEventListener('mousemove', mouseMoveFunc)
      if (offscreen) {
        offscreen.postMessage({ type: 'mouseup', clientX, clientY, rect })
      } else if (map) { map.dragPan.onMouseUp(clientX - rect.left - (rect.width / 2), (rect.height / 2) - clientY - rect.top) }
    }, { once: true })
  }

  _onMouseMove (e: MouseEvent) {
    const { map, offscreen } = this
    const { movementX, movementY } = e
    if (offscreen) {
      offscreen.postMessage({ type: 'mousemove', movementX, movementY })
    } else if (map) { map.dragPan.onMouseMove(movementX, movementY) }
  }

  _onCanvasMouseMove (e: MouseEvent) {
    const { map, offscreen, _canvasContainer, _canvasMultiplier } = this
    const { pageX, pageY } = e

    const x = (pageX - _canvasContainer.offsetLeft) * _canvasMultiplier
    const y = (pageY - _canvasContainer.offsetTop) * _canvasMultiplier

    if (offscreen) offscreen.postMessage({ type: 'canvasmousemove', x, y })
    else if (map) map.onCanvasMouseMove(x, y)
  }

  _updateCompass (bearing: number, pitch: number) {
    this.bearing = -bearing
    this.pitch = pitch
    this._compass.style.transform = `translate(-50%, -50%) rotate(${this.bearing}deg)`
  }

  _onCompassMouseDown (e) {
    e.preventDefault()
    const self = this
    const { map, offscreen } = self
    const { abs } = Math
    let totalMovementX = 0
    let totalMovementY = 0
    const mouseMoveFunc = function ({ movementX, movementY }) {
      if (movementX !== 0) {
        totalMovementX += abs(movementX)
        totalMovementY += abs(movementY)
        if (offscreen) offscreen.postMessage({ type: 'updateCompass', bearing: movementX })
        else if (map) map.updateCompass(movementX)
      }
    }
    window.addEventListener('mousemove', mouseMoveFunc)
    window.addEventListener('mouseup', () => {
      window.removeEventListener('mousemove', mouseMoveFunc)
      if (!totalMovementX && !totalMovementY) {
        if (offscreen) offscreen.postMessage({ type: 'resetCompass' })
        else map.resetCompass()
      } else {
        if (offscreen) offscreen.postMessage({ type: 'mouseupCompass' })
        else map.mouseupCompass()
      }
    }, { once: true })
  }

  _onCompassClick () {
    const { map, offscreen } = this
    if (offscreen) offscreen.postMessage({ type: 'resetCompass' })
    else map.resetCompass()
  }

  _resize () {
    const { map, offscreen, _container, _canvasMultiplier } = this
    // rebuild the proper width and height using the container as a guide
    if (offscreen) {
      offscreen.postMessage({
        type: 'resize',
        width: _container.clientWidth * _canvasMultiplier,
        height: _container.clientHeight * _canvasMultiplier
      })
    } else if (map) { map.resize(_container.clientWidth * _canvasMultiplier, _container.clientHeight * _canvasMultiplier) }
  }

  _navEvent (ctrl: 'zoomIn' | 'zoomOut') {
    const { map, offscreen } = this
    if (offscreen) offscreen.postMessage({ type: 'nav', ctrl })
    else if (map) map.navEvent(ctrl)
  }

  _setColorMode () {
    const { map, offscreen, _colorBlind } = this
    this.colorMode++
    if (this.colorMode > 3) this.colorMode = 0
    // update the icon
    const cM = this.colorMode
    _colorBlind.id = `s2-colorblind${(cM === 0) ? '-default' : (cM === 1) ? '-proto' : (cM === 2) ? '-deut' : '-trit'}`
    // tell the map to update
    if (offscreen) offscreen.postMessage({ type: 'colorMode', mode: cM })
    else if (map) map.colorMode(cM)
  }

  /* API */

  delete () {
    const { offscreen, map, _canvas, _container } = this
    if (offscreen) {
      offscreen.postMessage({ type: 'delete' })
      offscreen.terminate()
    } else if (map) { map.delete() }
    // reset the worker pool
    window.S2WorkerPool.delete()
    // remove all canvas listeners via cloning
    _canvas.replaceWith(_canvas.cloneNode(true))
    // cleanup the html
    while (_container.lastChild) _container.removeChild(_container.lastChild)
  }

  getContainer (): HTMLElement {
    return this._container
  }

  getCanvasContainer (): HTMLElement {
    return this._canvasContainer
  }

  getContainerDimensions (): null | [number, number] {
    if (this._container) return [this._container.clientWidth, this._container.clientHeight]
    else return null
  }

  // in this case, reset the style from scratch
  setStyle (style: Object, ignorePosition: boolean = true) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'setStyle', style, ignorePosition })
    else if (map) map.setStyle(style, ignorePosition)
  }

  // in this case, check for changes and update accordingly
  updateStyle (style: Object) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'updateStyle', style })
    else if (map) map.updateStyle(style)
  }

  setMoveState (state: boolean) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'moveState', state })
    else if (map) map.setMoveState(state)
  }

  setZoomState (state: boolean) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'zoomState', state })
    else if (map) map.setZoomState(state)
  }

  jumpTo (lon: number, lat: number, zoom?: number) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'jumpTo', lon, lat, zoom })
    else if (map) map.jumpTo(lon, lat, zoom)
  }

  easeTo (directions?: AnimationDirections) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'easeTo', directions })
    else if (map) map.animateTo('easeTo', directions)
  }

  flyTo (directions?: AnimationDirections) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'flyTo', directions })
    else if (map) map.animateTo('flyTo', directions)
  }

  getInfo (featureID: number) {
    // 1) tell worker pool we need info data
    window.S2WorkerPool.getInfo(this.id, featureID)
    // 2) clear old info s2json data should it exist
    this.resetSource('_info', true)
  }

  addSource (sourceName: string, href: string) {
    this.updateSource(sourceName, href, false, false)
  }

  updateSource (sourceName: string, href: string, keepCache?: boolean = true,
    awaitReplace?: boolean = true) {
    this.resetSource([sourceName, href], keepCache, awaitReplace)
  }

  resetSource (sourceNames: string | Array<string> | Array<[string, string | null]>,
    keepCache?: boolean = false, awaitReplace?: boolean = false) {
    const { offscreen, map } = this
    if (!Array.isArray(sourceNames)) sourceNames = [sourceNames]
    if (!Array.isArray(sourceNames[0])) sourceNames = [sourceNames]
    // clear old info s2json data should it exist
    if (offscreen) offscreen.postMessage({ type: 'resetSource', sourceNames })
    else if (map) map.resetSource(sourceNames, keepCache, awaitReplace)
  }

  deleteSource (sourceNames: string | Array<string> | Array<[string, string | null]>) {
    const { offscreen, map } = this
    if (!Array.isArray(sourceNames)) sourceNames = [sourceNames]
    // 1) tell worker pool we dont need info data anymore
    window.S2WorkerPool.deleteSource(this.id, sourceNames)
    // 2) clear old info s2json data should it exist
    if (offscreen) offscreen.postMessage({ type: 'clearSource', sourceNames })
    else if (map) map.clearSource(sourceNames)
  }

  // nameIndex -> if name it goes BEFORE the layer name specified. If layer name not found, it goes at the end
  // if no nameIndex, it goes at the end
  addLayer (layer: Layer, nameIndex?: number | string) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'addLayer', layer, nameIndex })
    else if (map) map.addLayer(layer, nameIndex)
  }

  // fullUpdate -> if false, don't ask webworkers to reupdate
  // nameIndex -> if name it finds the layer name to update, otherwise gives up
  updateLayer (layer: Layer, nameIndex?: number | string, fullUpdate?: boolean = true) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'updateLayer', layer, nameIndex, fullUpdate })
    else if (map) map.updateLayer(layer, nameIndex, fullUpdate)
  }

  // nameIndex -> if name it finds the layer name to update, otherwise gives up
  removeLayer (nameIndex: number | string) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'removeLayer', nameIndex })
    else if (map) map.removeLayer(nameIndex)
  }

  // { [+from]: +to }
  reorderLayers (layerChanges: { [string | number]: number }) {
    const { offscreen, map } = this
    if (offscreen) offscreen.postMessage({ type: 'reorderLayers', layerChanges })
    else if (map) map.reorderLayers(layerChanges)
  }

  addMarker (markers: Marker | Array<Marker>, sourceName?: string = '_markers') {
    if (!Array.isArray(markers)) markers = [markers]
    // 1) let the worker pool know we have new marker(s)
    window.S2WorkerPool.addMarkers(this.id, markers, sourceName)
    // 2) tell the map that (a) new marker(s) has/have been added
    this.resetSource(sourceName, true, true)
  }

  removeMarker (ids: number | Array<number>, sourceName?: string = '_markers') {
    if (!Array.isArray(ids)) ids = [ids]
    // 1) let the worker pool know we need to remove marker(s)
    window.S2WorkerPool.removeMarkers(this.id, ids, sourceName)
    // 2) tell the map that (a) marker(s) has/have to be removed
    this.resetSource(sourceName, true, true)
  }

  screenshot (): Promise<null | Uint8Array> {
    const self = this
    const { offscreen, map } = self
    return new Promise(resolve => {
      self.addEventListener('screenshot', (data: { detail: null | Uint8Array }) => { resolve(data.detail) }, { once: true })
      if (offscreen) offscreen.postMessage({ type: 'screenshot' })
      else if (map) map.screenshot()
    })
  }
}

if (window) window.S2Map = S2Map

// get money back from spectrum
// fix google email / cleanup dead emails
// clean room + vacuum
// set all files in s3maps bucket to lifespan of 1 day

// TODO NOW:
// WEBSITE: create projection example
// WEBSITE: write first blog post
// WEBSITE: write projection explination
// STUDIO: studio working
// CLI: s2maps-cli working
// WEBSITE: finish front page
// WEBSITE: legal + data
// WEBSITE: sign-in and sign-up
// WEBSITE: maps + styles page
// WEBSITE: account page working
// WEBSITE: cli page
// API: API working + safety from abuse
// LETS GO

// migrate old S2Tiles to new S2DB + zooms with division should be pre-divided (first 7 zooms)
// s2maps-gl S2DB

// studio
// website
// s2maps-cli
// S2MAPS BETA
// places
// isochrones

// S2MAPS BETA:
// 1) markers/popups with html
// 2) fix glyph filter overlap / interact should be the same as filter overlap
// 3) glyph icon + text pairs (required checking if same id overlap)
// 4) text along path
// 5) road signs
// 6) dashed lines + rounded joins
// 7) interact with points, lines, and fills
// 8) hillshade and line data fixes
// 9) redo roads -> working for road signs
// 10) screenshot
// 11) movement predictive tile caching
// 12) bearing
// 13) cluster points
// 14) on mouse location + scroll (zoom) use projection.cursorToLonLat for movement instead of current implementation

// S2MAPS BUGS:
// * find shortest longitude for easeTo
// * zoom too fast at low zoom renders the wrong tile
// * smooth transitions to parent tiles sometimes loses some features (buildings as an example)
// * overlap of text rarely (salt lake city as an ex)
// * colorblind support is missing for some renderings (heatmap)
// * heatmap doesn't work well in webgl1
// * icons don't render with text (overlap issues)
// * zooming into new tiles hover/interact over glyph doesn't work on different zoom (be sure to check parent as well essentially)

// S2MAPS (FUTURE)
// * webgpu
// * 3D points
// * 3D buildings (shapes)
// * 3D terrain
// * view at angle + camera system upgrade + pitch
// * keep children in view on zoom out if current tile does not exist and parent does not exist (IDEA: only show children for center tile to not completely lose visual position)
// * geocoding
// * isochrones

// S2MAPS-CLI
// * move over to s2maps-cli
// * make sure s2tiles and s2json are working for basic set of examples
// * get npm -g working
// * make geojson/pbf/etc. are working as inputs
// * sometimes poly around the pole has the wrong rotation

// * points include a merging (clustering) system
// * improve poly "merge" algorithm (use same as msdf) (https://github.com/doodlewind/skia-rs)
// * adjust fills so low zoom (0-7) so front-end doesn't have to split
// * update to s2-vector-tile v2

// WEBSITE:
// 1) cover page
// 2) maps + styles page
// 3) login/register
// 4) TOS / Privacy / Data
// 5) blog + first blog post
// 6) projection page (about projection)
// 7) s2maps about
// 8) contact
// 9) account
// 10) cli
// 11) studio
// 12) tiles
// 13) places
// 14) search
// 15) isochrones
// 16) elevation
// 17) s2maps (about)
// 18) careers
// 19) contact
// 20) pricing
// 21) press
// 22) documentation (getting started / tutorials / examples / support / etc.)
// 23) changelog

// STUDIO:
// MAP: updateLayer
// reorder layers
// add layer -> filter & select source & select layer from source
// remove layer
// click layer -> edit -> fill/line/glyph/backgroundFill/point/shade
// click layer -> readjust layer (during the add layer phase)
// edit wallpaper -> vector / wallpaper
// meta details
// see before/after

// PLACES:
// 1) build dynamoDB system using S2Cells
// 2) build places + POI data + starter address data + starter parcel data (track timelines of when I pull from OSM)
// 3) create API system for fetching (and properly catagorize everything)

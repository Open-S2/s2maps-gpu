/* eslint-env browser */
import { CorsWorker as Worker } from './util/corsWorker'
import Info from './ui/info'
import { isChrome, isSafari } from './util/polyfill'

import type S2MapUI from './ui/s2mapUI'
import type { MapOptions } from './ui/s2mapUI'
import type { Attributions, LayerStyle, StyleDefinition } from './style/style.spec'
import type { MarkerDefinition } from './workers/source/markerSource'
import type { AnimationDirections } from './ui/camera/animator'
import type { UserTouchEvent } from './ui/camera/dragPan'
import type {
  MapGLMessage,
  ResetSourceMessage,
  SourceWorkerMessage,
  TileWorkerMessage
} from './workers/worker.spec'

export type ColorMode = 0 | 1 | 2 | 3

type Ready = (s2map: S2Map) => void

// S2Map is called by the user and includes the API to interact with the mapping engine
export default class S2Map extends EventTarget {
  #container: HTMLElement
  #canvasContainer!: HTMLElement
  #navigationContainer!: HTMLElement
  #canvasMultiplier: number
  _canvas: HTMLCanvasElement
  #attributionPopup?: HTMLDivElement
  #compass?: HTMLElement
  #colorBlind?: HTMLElement
  #attributions: Attributions = {}
  bearing = 0 // degrees
  pitch = 0 // degrees
  colorMode: ColorMode = 0 // 0: none - 1: protanopia - 2: deuteranopia - 3: tritanopia
  map?: S2MapUI
  offscreen?: Worker
  info?: Info
  id: string = Math.random().toString(36).replace('0.', '')
  #ready?: Ready
  constructor (
    options: MapOptions = {
      canvasMultiplier: window.devicePixelRatio ?? 2,
      interactive: true,
      style: {}
    },
    ready?: Ready
  ) {
    super()
    options.canvasMultiplier = this.#canvasMultiplier = Math.max(2, options.canvasMultiplier ?? 2)
    // get the container
    if (typeof options.container === 'string') {
      const container = window.document.getElementById(options.container)
      if (container === null) throw new Error('Container not found.')
      this.#container = container
    } else if (options.container instanceof HTMLElement) {
      this.#container = options.container
    } else { throw new Error('Invalid type: "container" must be a String or HTMLElement.') }
    // we now remove container from options for potential webworker
    delete options.container
    // prep container, creating the canvas
    const canvas = this._canvas = this.#setupContainer(options)
    // create map via a webworker if possible, otherwise just load it in directly
    void this.#setupCanvas(canvas, options)
    // store ready for later use
    this.#ready = ready
  }

  ready (): void {
    this.#onCanvasReady()
    // TODO: FIX THIS
    // this.#ready?.(this)
  }

  /* BUILD */

  #setupContainer (options: MapOptions): HTMLCanvasElement {
    // prep container
    const container = this.#container
    container.classList.add('s2-map')
    // build canvas-container
    const canvasContainer = this.#canvasContainer = window.document.createElement('div')
    canvasContainer.className = 's2-canvas-container'
    container.prepend(canvasContainer)
    // build canvas
    const canvas = window.document.createElement('canvas')
    canvas.className = 's2-canvas'
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', 'S2Map')
    canvas.width = container.clientWidth * this.#canvasMultiplier
    canvas.height = container.clientHeight * this.#canvasMultiplier
    canvasContainer.appendChild(canvas)
    // add infoLayers should they exist
    if (Array.isArray(options.infoLayers)) this.info = new Info(this, container, options.infoLayers)

    return canvas
  }

  async #setupCanvas (canvas: HTMLCanvasElement, options: MapOptions): Promise<void> {
    // prep the ready function should it exist
    // prep webgpu/webgl type
    let tmpContext: RenderingContext | null = null
    if (options.contextType === undefined) {
      const tryContext = (name: string): boolean => {
        tmpContext = document.createElement('canvas').getContext(name)
        return tmpContext !== null
      }
      // TODO: ADD 3 when webgpu is ready
      // options.contextType = (tryContext('webgpu'))
      //   ? 3
      //   : (!isChrome && !isSafari && tryContext('webgl2'))
      //       ? 2
      //       : 1
      options.contextType = (!isSafari && tryContext('webgl2')) ? 2 : 1
    }
    // @ts-expect-error - if webgl2 context was found, lose the context
    if (options.contextType === 2) tmpContext?.getExtension('WEBGL_lose_context').loseContext()
    // if browser supports it, create an instance of the mapWorker
    if (typeof canvas.transferControlToOffscreen === 'function') {
      const offscreenCanvas = canvas.transferControlToOffscreen()
      const mapWorker = this.offscreen = new Worker(new URL('./workers/map.worker', import.meta.url), { name: 'map-worker', type: 'module' })
      mapWorker.onmessage = this.#mapMessage.bind(this)
      mapWorker.postMessage({ type: 'canvas', options, canvas: offscreenCanvas, id: this.id }, [offscreenCanvas as Transferable])
    } else {
      const Map = await import('./ui/s2mapUI').then(m => m.default)
      this.map = new Map(options, canvas, this.id, this)
    }
    // now that canvas is setup, add control containers as necessary
    this.#setupControlContainer(options)
    // if we interact with the map, we need to both allow interaction with styling
    // and watch how the mouse moves on the canvas
    const canvasContainer = this.#canvasContainer
    if (options.interactive ?? true) {
      canvasContainer.classList.add('s2-interactive')
      canvasContainer.addEventListener('mousemove', this.#onCanvasMouseMove.bind(this))
      canvasContainer.addEventListener('contextmenu', this.#onCompassMouseDown.bind(this))
      canvasContainer.addEventListener('mouseleave', this.#onCanvasMouseLeave.bind(this))
      if (options.scrollZoom ?? true) canvasContainer.addEventListener('wheel', this.#onScroll.bind(this))
      canvasContainer.addEventListener('mousedown', this.#onMouseDown.bind(this))
      canvasContainer.addEventListener('touchstart', (e: TouchEvent) => this.#onTouch(e, 'touchstart'))
      canvasContainer.addEventListener('touchend', (e: TouchEvent) => this.#onTouch(e, 'touchend'))
      canvasContainer.addEventListener('touchmove', (e: TouchEvent) => this.#onTouch(e, 'touchmove'))
    }
  }

  // If mouse leaves the canvas, clear out any features considered "active"
  #onCanvasMouseLeave (): void {
    this._canvas.style.cursor = 'default'
    this.dispatchEvent(new CustomEvent('mouseleave', { detail: null }))
  }

  #setupControlContainer (options: MapOptions): void {
    const {
      attributions,
      controls,
      zoomController,
      compassController,
      colorblindController,
      darkMode,
      attributionOff
    } = options
    // add info bar with our jollyRoger
    const isDarkMode = darkMode === true
    if (attributionOff !== true) {
      const attribution = window.document.createElement('div')
      attribution.id = 's2-attribution'
      const info = window.document.createElement('div')
      info.className = info.id = 's2-info'
      if (isDarkMode) info.classList.add('s2-info-dark')
      info.onclick = function () { attribution.classList.toggle('show') }
      const popup = this.#attributionPopup = window.document.createElement('div')
      popup.className = 's2-popup-container'
      if (isDarkMode) popup.classList.add('s2-popup-container-dark')
      popup.innerHTML = '<div>Rendered with ❤ by</div><a href="https://s2maps.io" target="popup"><div class="s2-jolly-roger"></div></a>'
      // add attributions
      if (attributions !== undefined) {
        for (const name in attributions) {
          if (this.#attributions[name] === undefined) {
            this.#attributions[name] = attributions[name]
            popup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`
          }
        }
      }
      attribution.appendChild(info)
      attribution.appendChild(popup)
      this.#container.appendChild(attribution)
    }
    // if zoom or compass controllers, add
    if (controls !== false) {
      let navSep
      const darkModeEnd = (isDarkMode ? '-dark' : '')
      // first create the container
      const navigationContainer = this.#navigationContainer = window.document.createElement('div')
      navigationContainer.className = 's2-nav-container'
      if (isDarkMode) navigationContainer.classList.add('s2-nav-dark')
      this.#container.appendChild(navigationContainer)
      if (zoomController !== false) {
        // plus
        const zoomPlus = window.document.createElement('button')
        zoomPlus.className = 's2-control-button s2-zoom-plus'
        zoomPlus.setAttribute('aria-hidden', '')
        zoomPlus.tabIndex = -1
        navigationContainer.appendChild(zoomPlus)
        zoomPlus.addEventListener('click', () => this.#navEvent('zoomIn'))
        // seperator
        navSep = window.document.createElement('div')
        navSep.className = 's2-nav-sep' + darkModeEnd
        navigationContainer.appendChild(navSep)
        // minus
        const zoomMinus = window.document.createElement('button')
        zoomMinus.className = 's2-control-button s2-zoom-minus'
        zoomMinus.setAttribute('aria-hidden', '')
        zoomMinus.tabIndex = -1
        navigationContainer.appendChild(zoomMinus)
        zoomMinus.addEventListener('click', () => this.#navEvent('zoomOut'))
      }
      if (compassController !== false) {
        // seperator
        navSep = window.document.createElement('div')
        navSep.className = 's2-nav-sep' + darkModeEnd
        navigationContainer.appendChild(navSep)
        // compass button
        const compassContainer = window.document.createElement('button')
        compassContainer.className = 's2-control-button'
        compassContainer.setAttribute('aria-hidden', '')
        compassContainer.tabIndex = -1
        navigationContainer.appendChild(compassContainer)
        const compass = this.#compass = window.document.createElement('div')
        compass.className = 's2-compass'
        compass.setAttribute('aria-hidden', '')
        compass.tabIndex = -1
        compassContainer.appendChild(compass)
        compassContainer.addEventListener('mousedown', this.#onCompassMouseDown.bind(this))
      }
      if (colorblindController !== false) {
        // seperator
        navSep = window.document.createElement('div')
        navSep.className = 's2-nav-sep' + darkModeEnd
        navigationContainer.appendChild(navSep)
        // colorblind button
        const colorBlind = this.#colorBlind = window.document.createElement('button')
        colorBlind.className = 's2-control-button s2-colorblind-button'
        colorBlind.id = 's2-colorblind-default'
        colorBlind.setAttribute('aria-hidden', '')
        colorBlind.tabIndex = -1
        navigationContainer.appendChild(colorBlind)
        colorBlind.addEventListener('click', () => this.#setColorMode())
      }
    }
  }

  /* INTERNAL API */

  injectData (data: SourceWorkerMessage | TileWorkerMessage): void {
    const { type } = data
    const { map, offscreen } = this
    if (type === 'attributions') {
      this.#addAttributions(data.attributions)
    } else if (type === 'setStyle') {
      void this.setStyle(data.style, data.ignorePosition)
    } else if (type === 'info') {
      if (this.info !== undefined) this.info.injectInfo(data.json)
    } else if (offscreen !== undefined) {
      if (type === 'fill') offscreen.postMessage(data, [data.vertexBuffer, data.indexBuffer, data.fillIDBuffer, data.codeTypeBuffer, data.featureGuideBuffer])
      else if (type === 'line') offscreen.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer])
      else if (type === 'glyph') offscreen.postMessage(data, [data.glyphFilterBuffer, data.glyphFilterIDBuffer, data.glyphQuadBuffer, data.glyphQuadIDBuffer, data.glyphColorBuffer, data.featureGuideBuffer])
      else if (type === 'glyphimages') offscreen.postMessage(data, data.images.map(i => i.data) as Transferable[])
      else if (type === 'raster') offscreen.postMessage(data, [data.image])
      else if (type === 'point') offscreen.postMessage(data, [data.vertexBuffer, data.featureGuideBuffer])
      else if (type === 'heatmap') offscreen.postMessage(data, [data.vertexBuffer, data.weightBuffer, data.featureGuideBuffer])
      else if (type === 'interactive') offscreen.postMessage(data, [data.interactiveGuideBuffer, data.interactiveDataBuffer])
      else offscreen.postMessage(data)
    } else if (map !== undefined) {
      map.injectData(data)
    }
  }

  #mapMessage ({ data }: { data: MapGLMessage }): void {
    const { mapID, type } = data
    if (type === 'tilerequest') {
      window.S2WorkerPool.tileRequest(mapID, data.tiles, data.sources)
    } else if (type === 'timerequest') {
      window.S2WorkerPool.timeRequest(mapID, data.tiles, data.sourceNames)
    } else if (type === 'mouseenter') {
      const { feature } = data
      this._canvas.style.cursor = feature.__cursor
      this.dispatchEvent(new CustomEvent('mouseenter', { detail: feature }))
    } else if (type === 'mouseleave') {
      const { feature } = data
      this._canvas.style.cursor = 'default'
      this.dispatchEvent(new CustomEvent('mouseleave', { detail: feature }))
    } else if (type === 'click') {
      const { feature, lon, lat } = data
      this.info?.click(feature, lon, lat)
      this.dispatchEvent(new CustomEvent('click', { detail: { feature, lon, lat } }))
    } else if (type === 'pos') {
      const { zoom, lon, lat } = data
      this.dispatchEvent(new CustomEvent('pos', { detail: { zoom, lon, lat } }))
    } else if (type === 'requestStyle') {
      window.S2WorkerPool.requestStyle(mapID, data.style, data.analytics, data.apiKey)
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
    } else if (type === 'ready') {
      this.ready()
    }
  }

  /* INTERNAL FUNCTIONS */

  #onCanvasReady (): void {
    // set color mode
    const mode = parseInt(localStorage.getItem('s2maps:gpu:colorBlindMode') ?? '0') as ColorMode
    this.#setColorMode(mode)
    // now that canvas is setup, support resizing
    if ('ResizeObserver' in window) new ResizeObserver(this.#resize.bind(this)).observe(this.#container)
    // @ts-expect-error window isn't found currently. bad ts implementation?
    else window.addEventListener('resize', this.#resize.bind(this))
    // let the S2WorkerPool know of this maps existance
    window.S2WorkerPool.addMap(this)
  }

  #addAttributions (attributions: Attributions = {}): void {
    if (this.#attributionPopup !== undefined) {
      for (const name in attributions) {
        if (this.#attributions[name] === undefined) {
          this.#attributions[name] = attributions[name]
          this.#attributionPopup.innerHTML += `<div><a href="${attributions[name]}" target="popup">${name}</a></div>`
        }
      }
    }
  }

  #onTouch (e: TouchEvent, type: 'touchstart' | 'touchend' | 'touchmove'): void {
    const { map, offscreen } = this
    const canvasContainer = this.#canvasContainer
    e.preventDefault()
    const { touches } = e
    const { length } = touches
    const touchEvent: UserTouchEvent = { length }

    for (let i = 0; i < length; i++) {
      const { clientX, clientY, pageX, pageY } = touches[i]
      const x = (pageX - canvasContainer.offsetLeft) * this.#canvasMultiplier
      const y = (pageY - canvasContainer.offsetTop) * this.#canvasMultiplier
      touchEvent[i] = { clientX, clientY, x, y }
    }
    offscreen?.postMessage({ type, touchEvent })
    if (map !== undefined) {
      if (type === 'touchstart') map.onTouchStart(touchEvent)
      else if (type === 'touchend') map.dragPan.onTouchEnd(touchEvent)
      else if (type === 'touchmove') map.dragPan.onTouchMove(touchEvent)
    }
  }

  #onScroll (e: WheelEvent): void {
    e.preventDefault()
    const { map, offscreen } = this
    const { clientX, clientY, deltaY } = e
    const rect = this._canvas.getBoundingClientRect()
    offscreen?.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY })
    map?.onZoom(deltaY, clientX - rect.left, clientY - rect.top)
  }

  #onMouseDown (e: MouseEvent): void {
    if (e.button !== 0) return
    const { map, offscreen } = this
    // send off a mousedown
    offscreen?.postMessage({ type: 'mousedown' })
    map?.dragPan.onMouseDown()
    // build a listener to mousemovement
    const mouseMoveFunc = this.#onMouseMove.bind(this)
    window.addEventListener('mousemove', mouseMoveFunc)
    // upon eventual mouseup, let the map know
    window.addEventListener('mouseup', (e) => {
      const rect = this._canvas.getBoundingClientRect()
      const { clientX, clientY } = e
      window.removeEventListener('mousemove', mouseMoveFunc)
      offscreen?.postMessage({ type: 'mouseup', clientX, clientY, rect })
      map?.dragPan.onMouseUp(
        clientX - rect.left - (rect.width / 2),
        (rect.height / 2) - clientY - rect.top
      )
    }, { once: true })
  }

  #onMouseMove (e: MouseEvent): void {
    const { map, offscreen } = this
    const { movementX, movementY } = e
    offscreen?.postMessage({ type: 'mousemove', movementX, movementY })
    map?.dragPan.onMouseMove(movementX, movementY)
  }

  #onCanvasMouseMove (e: MouseEvent): void {
    const { map, offscreen } = this
    const { layerX, layerY } = e
    const x = layerX * this.#canvasMultiplier
    const y = layerY * this.#canvasMultiplier

    offscreen?.postMessage({ type: 'canvasmousemove', x, y })
    map?.onCanvasMouseMove(x, y)
  }

  _updateCompass (bearing: number, pitch: number): void {
    this.bearing = -bearing
    this.pitch = pitch
    if (this.#compass !== undefined) {
      this.#compass.style.transform = `translate(-50%, -50%) rotate(${this.bearing}deg)`
    }
  }

  #onCompassMouseDown (e: MouseEvent): void {
    e.preventDefault()
    const { map, offscreen } = this
    const { abs } = Math
    let totalMovementX = 0
    let totalMovementY = 0
    const mouseMoveFunc = ({ movementX, movementY }: { movementX: number, movementY: number }): void => {
      if (movementX !== 0) {
        totalMovementX += abs(movementX)
        totalMovementY += abs(movementY)
        offscreen?.postMessage({ type: 'updateCompass', bearing: movementX })
        map?.updateCompass(movementX)
      }
    }
    window.addEventListener('mousemove', mouseMoveFunc)
    window.addEventListener('mouseup', () => {
      window.removeEventListener('mousemove', mouseMoveFunc)
      if (totalMovementX === 0 && totalMovementY === 0) {
        offscreen?.postMessage({ type: 'resetCompass' })
        map?.resetCompass()
      } else {
        offscreen?.postMessage({ type: 'mouseupCompass' })
        map?.mouseupCompass()
      }
    }, { once: true })
  }

  // #onCompassClick (): void {
  //   const { map, offscreen } = this
  //   offscreen?.postMessage({ type: 'resetCompass' })
  //   map?.resetCompass()
  // }

  #resize (): void {
    const { map, offscreen } = this
    const container = this.#container
    const canvasMultiplier = this.#canvasMultiplier
    // rebuild the proper width and height using the container as a guide
    offscreen?.postMessage({
      type: 'resize',
      width: container.clientWidth * canvasMultiplier,
      height: container.clientHeight * canvasMultiplier
    })
    map?.resize(container.clientWidth * canvasMultiplier, container.clientHeight * canvasMultiplier)
  }

  #navEvent (ctrl: 'zoomIn' | 'zoomOut'): void {
    const { map, offscreen } = this
    offscreen?.postMessage({ type: 'nav', ctrl })
    map?.navEvent(ctrl)
  }

  #setColorMode (mode?: ColorMode): void {
    const { map, offscreen } = this
    if (mode !== undefined) this.colorMode = mode
    else this.colorMode++
    if (this.colorMode > 3) this.colorMode = 0
    localStorage.setItem('s2maps:gpu:colorBlindMode', String(this.colorMode))
    // update the icon
    const cM = this.colorMode
    if (this.#colorBlind !== undefined) this.#colorBlind.id = `s2-colorblind${(cM === 0) ? '-default' : (cM === 1) ? '-proto' : (cM === 2) ? '-deut' : '-trit'}`
    // tell the map to update
    offscreen?.postMessage({ type: 'colorMode', mode: cM })
    map?.colorMode(cM)
  }

  /* API */

  delete (): void {
    const { offscreen, map, _canvas } = this
    offscreen?.postMessage({ type: 'delete' })
    offscreen?.terminate()
    map?.delete()
    // reset the worker pool
    window.S2WorkerPool.delete()
    // remove all canvas listeners via cloning
    _canvas.replaceWith(_canvas.cloneNode(true))
    // cleanup the html
    while (this.#container.lastChild !== null) this.#container.removeChild(this.#container.lastChild)
  }

  getContainer (): HTMLElement {
    return this.#container
  }

  getCanvasContainer (): HTMLElement {
    return this.#canvasContainer
  }

  getContainerDimensions (): null | [number, number] {
    return [this.#container.clientWidth, this.#container.clientHeight]
  }

  // in this case, reset the style from scratch
  async setStyle (style: StyleDefinition, ignorePosition = true): Promise<void> {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'setStyle', style, ignorePosition })
    await map?.setStyle(style, ignorePosition)
  }

  // in this case, check for changes and update accordingly
  updateStyle (style: StyleDefinition): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'updateStyle', style })
    map?.updateStyle(style)
  }

  setMoveState (state: boolean): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'moveState', state })
    map?.setMoveState(state)
  }

  setZoomState (state: boolean): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'zoomState', state })
    map?.setZoomState(state)
  }

  jumpTo (lon: number, lat: number, zoom?: number): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'jumpTo', lon, lat, zoom })
    map?.jumpTo(lon, lat, zoom)
  }

  easeTo (directions?: AnimationDirections): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'easeTo', directions })
    map?.animateTo('easeTo', directions)
  }

  flyTo (directions?: AnimationDirections): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'flyTo', directions })
    map?.animateTo('flyTo', directions)
  }

  getInfo (featureID: number): void {
    // TODO:
    // // 1) tell worker pool we need info data
    // window.S2WorkerPool.getInfo(this.id, featureID)
    // // 2) clear old info s2json data should it exist
    // this.resetSource([['_info']], true)
  }

  addSource (sourceName: string, href: string): void {
    this.updateSource(sourceName, href, false, false)
  }

  updateSource (
    sourceName: string,
    href: string,
    keepCache = true,
    awaitReplace = true
  ): void {
    this.resetSource([[sourceName, href]], keepCache, awaitReplace)
  }

  resetSource (
    sourceNames: Array<[string, string | undefined]>,
    keepCache = false,
    awaitReplace = false
  ): void {
    const { offscreen, map } = this
    // clear old info s2json data should it exist
    const msg: ResetSourceMessage = { type: 'resetSource', sourceNames, keepCache, awaitReplace }
    offscreen?.postMessage(msg)
    map?.resetSource(sourceNames, keepCache, awaitReplace)
  }

  deleteSource (sourceNames: string | string[]): void {
    const { offscreen, map } = this
    if (!Array.isArray(sourceNames)) sourceNames = [sourceNames]
    // 1) tell worker pool we dont need info data anymore
    window.S2WorkerPool.deleteSource(this.id, sourceNames)
    // 2) clear old info s2json data should it exist
    offscreen?.postMessage({ type: 'clearSource', sourceNames })
    map?.clearSource(sourceNames)
  }

  // nameIndex -> if name it goes BEFORE the layer name specified. If layer name not found, it goes at the end
  // if no nameIndex, it goes at the end
  addLayer (layer: LayerStyle, nameIndex: number | string): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'addLayer', layer, nameIndex })
    map?.addLayer(layer, nameIndex)
  }

  // fullUpdate -> if false, don't ask webworkers to reupdate
  // nameIndex -> if name it finds the layer name to update, otherwise gives up
  updateLayer (layer: LayerStyle, nameIndex: number | string, fullUpdate = true): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'updateLayer', layer, nameIndex, fullUpdate })
    map?.updateLayer(layer, nameIndex, fullUpdate)
  }

  // nameIndex -> if name it finds the layer name to update, otherwise gives up
  removeLayer (nameIndex: number | string): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'removeLayer', nameIndex })
    map?.removeLayer(nameIndex)
  }

  // { [+from]: +to }
  reorderLayers (layerChanges: { [key: string | number]: number }): void {
    const { offscreen, map } = this
    offscreen?.postMessage({ type: 'reorderLayers', layerChanges })
    map?.reorderLayers(layerChanges)
  }

  addMarker (
    markers: MarkerDefinition | MarkerDefinition[],
    sourceName = '_markers'
  ): void {
    if (!Array.isArray(markers)) markers = [markers]
    // 1) let the worker pool know we have new marker(s)
    window.S2WorkerPool.addMarkers(this.id, markers, sourceName)
    // 2) tell the map that (a) new marker(s) has/have been added
    this.resetSource([[sourceName, undefined]], true, true)
  }

  removeMarker (
    ids: number | number[],
    sourceName = '_markers'
  ): void {
    if (!Array.isArray(ids)) ids = [ids]
    // 1) let the worker pool know we need to remove marker(s)
    window.S2WorkerPool.removeMarkers(this.id, ids, sourceName)
    // 2) tell the map that (a) marker(s) has/have to be removed
    this.resetSource([[sourceName, undefined]], true, false)
  }

  async screenshot (): Promise<null | Uint8Array> {
    const { offscreen, map } = this
    return await new Promise<null | Uint8Array>(resolve => {
      this.addEventListener(
        'screenshot',
        (data: any) => { resolve(data.detail) },
        { once: true }
      )
      offscreen?.postMessage({ type: 'screenshot' })
      map?.screenshot()
    })
  }
}

window.S2Map = S2Map

// TODO PART 2:
// * webgl1 -> sorting by featureCode does NOT now because only webgl1 Code is shipped (just ).
// * parent tiles update on new data?
// * store session token locally incase of app refresh.
// * improve zooming in webgl1 for fill just like heatmap

// * dashed lines
// * glyphs: add alpha fade support
// * glyphs (icon + text pairs)
// * glyphs along path

// TODO PART 3:
// * snapshot post flush
// * zoom out keeps children tiles
// * pull out colorBlind changing from Color
// * pull out interpolate and sinebows from Color
// * raster fade-in from parent
// * zooming fast interactive data search doesn't check parent tiles, so clicking does nothing.

// SOLUTION:
// we need to store ID, type, x, y, width, and height for texture lookups
// use 16bit texture for x, y, width, and height (or radius instead of width and height)
// store ID as 8bit RGB, and type as alpha
// when drawing, use alpha channel as additive (increase or decrease depending upon whether filter says yes or no)
// TWO input textures:
// [x, y, width, height] OR [x, y, radius, radius]
// [r, g, b, type]

// 2 draws for filter:
// 1:
// read each filter block and check against all others
// if overlap from previous filters and id is not the same, add to total, do NOT add to sum
// otherwise add to total AND add to sum
// [total, sum]
// 2:
// if total === sum, add [opacity + 0.1] to filter solution
// if total !== sum, add [opacity - 0.1] to filter solution

// 2 indexes
// 1) index to glyph set position for lookups (+ offset when drawing)
// 2) index "ID" that represents the color of the glyph

// pair id + type
// pair x and y
// pair width and height OR store radius
// [id-type(circle or square), x-y, width-height OR radius]

// NEXT: GLYPHS ALONG PATH:

// * WebGPU working (except for glyphs)
// * Part 1 above complete
// * API:
// ** D1 working for tracking usage data
// ** user -> login/register/change password/change email
// ** key -> create/delete/update/get/refresh default
// ** payment -> card-add/card-remove/card-update/package-upgrade/package-downgrade
// ** tests: user, key, payment
// * Website:
// ** login/register
// ** add/delete keys
// ** buy packages

// AUGUST 2022:
// 330.min.js                    6.83 kB       2.98 kB      2.69 kB
// 552.min.js                    34.43 kB      12.83 kB     11.38 kB
// 556.min.js                    16.11 kB      4.75 kB      4.27 kB
// 785.min.js                    3.24 kB       1.31 kB      1.17 kB
// map-worker.min.js             6.35 kB       2.45 kB      2.24 kB
// s2maps-gpu.min.js             20.06 kB      6.33 kB      5.56 kB
// source-worker.min.js          28.99 kB      10.17 kB     9.14 kB
// tile-worker.min.js            54.62 kB      18.77 kB     16.79 kB
// all major packages            170.63 kB     59.59 kB     53.24 kB

// TODO NOW:
// 1) Get working in web/s2maps.io

// 3) Support local -> locahost-api
// 4) Do last Part 1s above
// 6) API 100%
// 7) Website ready
// 8) Create contract with cloudflare
// 9) WebGPU support
// 10) Support glyphs + icons
// 11) Support glyphs along path
// 12) Support dashed lines

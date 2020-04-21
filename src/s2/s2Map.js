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
    window.addEventListener('resize', this._resize.bind(this))
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
    canvas.width = container.clientWidth * this._canvasMultiplier | 0
    canvas.height = container.clientHeight * this._canvasMultiplier | 0
    canvasContainer.appendChild(canvas)
    return canvas
  }

  _setupCanvas (canvas: HTMLCanvasElement, options: MapOptions) {
    // if browser supports it, create an instance of the mapWorker
    if (canvas.transferControlToOffscreen) {
      if (options.interactive === undefined || options.interactive === true) {
        if (options.scrollZoom === undefined || options.scrollZoom === true) canvas.addEventListener('wheel', this._onScroll.bind(this))
        canvas.addEventListener('mousedown', this._onMouseDown.bind(this))
        canvas.addEventListener('mouseup', this._onMouseUp.bind(this))
        canvas.addEventListener('mousemove', this._onMouseMove.bind(this))
      }
      const offscreen = canvas.transferControlToOffscreen()
      this._offscreen = true
      this.map = new Worker('./workers/map.worker.js', { type: 'module' })
      this.map.onmessage = this._mapMessage.bind(this)
      options.canvasWidth = this._container.clientWidth
      options.canvasHeight = this._container.clientHeight
      this.map.postMessage({ type: 'canvas', options, canvas: offscreen, id: this.id }, [offscreen])
    } else {
      const self = this
      import('./ui/map').then(map => {
        self.map = new map.default(options, canvas, this.id)
      })
    }
  }

  _onScroll (e) {
    e.preventDefault()
    const { clientX, clientY, deltaY } = e
    const rect = this._canvas.getBoundingClientRect()
    this.map.postMessage({ type: 'scroll', rect, clientX, clientY, deltaY })
  }

  _onMouseDown () {
    this.map.postMessage({ type: 'mousedown' })
  }

  _onMouseUp () {
    this.map.postMessage({ type: 'mouseup' })
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
    // rebuild the proper width and height using the container as a guide
    if (this._offscreen) this.map.postMessage({
      type: 'resize',
      width: this._canvasContainer.clientWidth,
      height: this._canvasContainer.clientHeight
    })
    else this.map.resize()
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

  injectVectorSourceData (source: string, tileID: string, parentLayers, vertexBuffer: ArrayBuffer, indexBuffer: ArrayBuffer, codeOffsetBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer) {
    if (this._offscreen) {
      this.map.postMessage({ type: 'vectordata', source, tileID, parentLayers, vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer }, [vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer])
    } else {
      this.map.injectVectorSourceData(source, tileID, parentLayers, vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer)
    }
  }

  injectTextSourceData (source: string, tileID: string, vertexBuffer: ArrayBuffer, texPositionBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer, imageBitmap: ImageBitmap) {
    if (this._offscreen) {
      this.map.postMessage({ type: 'textdata', source, tileID, vertexBuffer, texPositionBuffer, featureGuideBuffer, imageBitmap }, [vertexBuffer, texPositionBuffer, featureGuideBuffer, imageBitmap])
    } else {
      this.map.injectTextSourceData(source, tileID, vertexBuffer, texPositionBuffer, featureGuideBuffer, imageBitmap)
    }
  }

  injectRasterData (source: string, tileID: string, image: ImageBitmap, leftShift: number, bottomShift: number) {
    if (this._offscreen) {
      this.map.postMessage({ type: 'rasterdata', source, tileID, image, leftShift, bottomShift }, [image])
    } else {
      this.map.injectRasterData(source, tileID, image, leftShift, bottomShift)
    }
  }

  injectMaskGeometry (tileID: string, vertexBuffer: ArrayBuffer, indexBuffer: ArrayBuffer, radiiBuffer: ArrayBuffer) {
    if (this._offscreen) {
      this.map.postMessage({ type: 'maskdata', tileID, vertexBuffer, indexBuffer, radiiBuffer }, [vertexBuffer, indexBuffer, radiiBuffer])
    } else {
      this.map.injectMaskGeometry(tileID, vertexBuffer, indexBuffer, radiiBuffer)
    }
  }
}

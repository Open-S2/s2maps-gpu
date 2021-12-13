// @flow
/* eslint-env browser */
import Color from './color'
import Map from '../ui/map'
import { Wallpaper, Skybox, Tile } from '../source'
import buildColorRamp from './buildColorRamp'
import { encodeLayerAttribute, parseFeatureFunction, orderLayer } from './conditionals'

import type { MapOptions } from '../ui/map'
import type { Sources, Layer, Mask, WallpaperStyle } from './styleSpec'
import type { TileRequest } from '../workers/workerPool'

export type Analytics = {
  gpu: number,
  context: number,
  language: string,
  width: number,
  height: number
}

export default class Style {
  map: Map
  glType: number
  webworker: boolean = false
  interactive: boolean = false // this is seperate from the options. If a layer is interactive then we draw more
  apiKey: string
  zoom: number = 0
  minzoom: number = 0
  maxzoom: number = 20
  zoomOffset: number = 0
  minLatPosition: number = 70
  maxLatRotation: number = 89.99999
  lon: number = 0
  lat: number = 0
  bearing: number = 0
  pitch: number = 0
  zNear: number = 0.5
  zFar: number = 100_000_000
  sources: Sources = {}
  fonts: Sources = {}
  icons: Sources = {}
  layers: Array<Layer> = []
  mask: Mask
  rasterLayers: { [string]: Layer } = {} // rasterLayers[sourceName]: Layer
  wallpaper: typeof undefined | Wallpaper | Skybox
  wallpaperStyle: typeof undefined | WallpaperStyle
  clearColor: typeof undefined | [number, number, number, number]
  maskLayers: Array<Layer> = []
  analytics: Analytics = {}
  dirty: boolean = true
  constructor (options: MapOptions, map: Map) {
    const { webworker, apiKey } = options
    if (webworker) this.webworker = true
    this.apiKey = apiKey
    const { painter } = this.map = map
    // grap the painter type, so we can tell the webworkers if we are using WEBGL, WEBGL2, or WEBGPU
    const { gl, renderer, type } = painter.context
    this.glType = type
    this._buildAnalytics(renderer, type, gl.canvas.width, gl.canvas.height)
  }

  _buildAnalytics (gpu: string, context: number = -1, width: number, height: number) {
    this.analytics = {
      gpu,
      context,
      language: navigator.language.split('-')[0] || 'en',
      width,
      height
    }
  }

  async buildStyle (style: string | Object) {
    const self = this
    if (typeof style === 'string') {
      style = await fetch(style.replace('s2maps://', 'https://data.s2maps.io/'))
        .then(res => res.json())
        .catch(err => { console.error(`failed to fetch style json`, err) })
    }
    if (typeof style !== 'object') return
    self.dirty = true
    style = JSON.parse(JSON.stringify(style))
    // check style & fill default params
    this._prebuildStyle(style)
    // Before manipulating the style, send it off to the worker pool manager
    this._sendStyleDataToWorkers(style)
    // extract starting values
    if (style.center && Array.isArray(style.center)) {
      self.lon = style.center[0]
      self.lat = style.center[1]
    }
    if (!isNaN(style.zoom)) self.zoom = style.zoom
    if (!isNaN(style.zNear)) self.zNear = style.zNear
    if (!isNaN(style.zFar)) self.zFar = style.zFar
    if (!isNaN(style.minLatPosition)) self.minLatPosition = style.minLatPosition
    if (!isNaN(style.maxLatRotation)) self.maxLatRotation = style.maxLatRotation
    if (!isNaN(style.minzoom) && style.minzoom >= -2) self.minzoom = style.minzoom
    if (!isNaN(style.maxzoom)) {
      if (style.maxzoom <= self.minzoom) self.maxzoom = self.minzoom + 1
      else if (style.maxzoom <= 20) self.maxzoom = style.maxzoom
    }
    if (!isNaN(style.bearing)) self.bearing = style.bearing
    if (!isNaN(style.pitch)) self.pitch = style.pitch
    // set zoom offset if applicable
    if (style['zoom-offset']) self.zoomOffset = style['zoom-offset']
    // extract sources
    if (style.sources) self.sources = style.sources
    if (style.fonts) self.fonts = style.fonts
    if (style.icons) self.icons = style.icons
    // build wallpaper and sphere background if applicable
    if (style.wallpaper) self._buildWallpaper(style.wallpaper)
    // build the layers
    if (style.layers) self.layers = style.layers
    await self._buildLayers()
  }

  deleteSources (sourceNames: Array<string>) {
    for (const sourceName of sourceNames) delete this.sources[sourceName]
  }

  _prebuildStyle (style: Object) {
    // reset maskLayers
    this.maskLayers = []
    // ensure certain default layer values exist. If it is a raster layer: seggregate
    for (let i = 0, sl = style.layers.length; i < sl; i++) this._prebuildLayer(style.layers[i], i)
    // ensure if wallpaper, we have proper default values
    if (style.background) {
      if (style.background.skybox) {
        if (!style.background.size) style.background.size = 1024
        if (!style.background.type) style.background.type = 'png'
        if (!style.background.loadingBackground) style.background.loadingBackground = 'rgb(0, 0, 0)'
      } else if (style.background['background-color']) {
        if (!style.background['fade-1']) style.background['fade-1'] = 'rgb(138, 204, 255)'
        if (!style.background['fade-2']) style.background['fade-2'] = 'rgb(217, 255, 255)'
        if (!style.background.halo) style.background.halo = 'rgb(230, 255, 255)'
      }
    }
    // create mask if it doesn't exist (just incase)
    if (!style.mask) style.mask = {}
    if (!style.mask.exaggeration) style.mask.exaggeration = 1
  }

  _prebuildLayer (layer: Layer, index: number) {
    if (!layer.minzoom) layer.minzoom = 0
    if (!layer.maxzoom) layer.maxzoom = 20
    if (!layer.layer) layer.layer = 'default'
    if (layer.source === 'mask') this.maskLayers.push(layer)
    if (layer.interactive) this.interactive = true
    layer.layerIndex = index
  }

  _sendStyleDataToWorkers (style: Object) {
    const { apiKey, analytics } = this
    const { sources, fonts, icons, layers, minzoom, maxzoom } = style
    // now that we have various source data, package up the style objects we need and send it off:
    const stylePackage = { glType: this.glType, sources, fonts, icons, layers, minzoom, maxzoom, apiKey, analytics }
    // If the map engine is running on the main thread, directly send the stylePackage to the worker pool.
    // Otherwise perhaps this map instance is a web worker and has a global instance of postMessage
    if (this.webworker) {
      postMessage({ mapID: this.map.id, type: 'style', style: stylePackage })
    } else {
      window.S2WorkerPool.injectStyle(this.map.id, stylePackage)
    }
  }

  _buildWallpaper (background: WallpaperStyle) {
    if (background.skybox) {
      // grab clear color and set inside painter
      const clearColor = this.clearColor = (new Color(background.loadingBackground)).getRGB()
      this.map.painter.context.setClearColor(clearColor)
      // grab wallpaper data
      this.wallpaper = new Skybox(background, this.map.projector)
    } else if (background['background-color']) {
      // create the wallpaper
      this.wallpaper = new Wallpaper(this, this.map.projector)
      // prep style
      this.wallpaperStyle = {
        uBackgroundColor: new Color(background['background-color']),
        uFade1Color: new Color(background['fade-1']),
        uFade2Color: new Color(background['fade-2']),
        uHaloColor: new Color(background.halo)
      }
    }
  }

  // 1) ensure "bad" layers are removed (missing important keys or subkeys)
  // 2) ensure the order is correct for when WebGL eventually parses the encodings
  async _buildLayers () {
    // now we build our program set simultaneous to encoding our layers
    const programs = new Set([(this.wallpaper && this.wallpaper.skybox) ? 'skybox' : (this.wallpaper) ? 'wallpaper' : null, 'fill'])
    for (let i = 0, ll = this.layers.length; i < ll; i++) this._buildLayer(this.layers[i], i + 1, programs)
    // tell the painter what we are using
    await this.map.painter.buildPrograms(programs)
    // prebuild wallpaper
    if (this.wallpaper) {
      const { skybox } = this.wallpaper
      const wallpaperProgram = this.map.painter.programs[skybox ? 'skybox' : 'wallpaper']
      if (skybox) wallpaperProgram.injectImages(this.wallpaper, this.map)
    }
  }

  _buildLayer (layer: Layer, depthPos: number, programs: Set<string>) {
    const { type } = layer
    // TODO: if bad layer, remove
    programs.add(layer.type)
    // add depth position
    layer.depthPos = depthPos
    // order layers for GPU
    orderLayer(layer)
    // if webgl2 or greater, we build layerCode
    if (this.glType > 1) {
      const code = []
      // LAYOUTS
      for (const key in layer.layout) {
        if (key === 'cap' || key === 'join') continue
        code.push(...encodeLayerAttribute(layer.layout[key]))
      }
      // PAINTS
      for (const key in layer.paint) {
        code.push(...encodeLayerAttribute(layer.paint[key], layer.lch))
      }
      if (code.length) layer.code = new Float32Array(code)
      if (layer.iconPaint) layer.iconCode = new Float32Array(encodeLayerAttribute(layer.iconPaint['icon-size'], layer.lch))
    } else if (this.glType === 1 && layer.source === 'mask') {
      for (const l in layer.layout) layer.layout[l] = parseFeatureFunction(layer.layout[l], l)
      for (const p in layer.paint) layer.paint[p] = parseFeatureFunction(layer.paint[p], p)
    }
    // build color ramp image if applicable
    if (type === 'heatmap' && layer.colorRamp) {
      layer.colorRamp = this.map.painter.context.buildTexture(buildColorRamp(layer.colorRamp), 256, 1)
    }
  }

  addLayer (layer: Layer, nameIndex?: number | string, tileRequests: Array<TileRequest>) {
    const { painter } = this.map
    const programs = new Set()
    // prebuild & convert nameIndex to index
    const index = this._findLayerIndex(nameIndex)
    this._prebuildLayer(layer, index)
    // let the workers know
    if (this.webworker) { // $FlowIgnore
      postMessage({ mapID: this.map.id, type: 'addLayer', layer, index, tileRequests })
    } else {
      window.S2WorkerPool.addLayer(this.map.id, layer, index, tileRequests)
    }
    // insert layer into layers, updating positions of other layers as necessary
    const { layers } = this
    layers.splice(index, 0, layer)
    for (let i = index + 1, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex++
      layer.depthPos++
    }
    // build layer
    this._buildLayer(layer, index + 1, programs)
    // tell the painter that we might be using a new program
    painter.buildPrograms(programs)
  }

  removeLayer (nameIndex?: number | string): number {
    // grab the index
    const index = this._findLayerIndex(nameIndex)
    // let the workers know
    if (this.webworker) { // $FlowIgnore
      postMessage({ mapID: this.map.id, type: 'removeLayer', index })
    } else {
      window.S2WorkerPool.removeLayer(this.map.id, index)
    }
    // remove index from layers and update layerIndex & depthPos
    const { layers } = this
    layers.splice(index, 1)
    for (let i = index, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex--
      layer.depthPos--
    }

    return index
  }

  reorderLayers (layerChanges: { [string | number]: number }) {
    const { layers } = this
    const newLayers = []
    // move the layer to its new position
    for (const [from, to] of Object.entries(layerChanges)) {
      const layer = layers[+from]
      layer.layerIndex = to
      layer.depthPos = to + 1
      newLayers[to] = layer
    }
    // store the new layers
    this.layers = newLayers
    // let the webworkers know about the reorder
    if (this.webworker) { // $FlowIgnore
      postMessage({ mapID: this.map.id, type: 'reorderLayers', layerChanges })
    } else {
      window.S2WorkerPool.reorderLayers(this.map.id, layerChanges)
    }
  }

  requestTiles (tiles: Array<Tile>) {
    if (!tiles) return
    const tileRequests: Array<TileRequest> = []
    tiles.forEach(tile => {
      // grab request values
      const { id, face, i, j, zoom, bbox, division, size } = tile
      // build tileRequests
      tileRequests.push({ id, face, i, j, zoom, bbox, division, size })
    })
    // send the tiles over to the worker pool manager to split the workload
    if (this.webworker) { // $FlowIgnore
      postMessage({ mapID: this.map.id, type: 'tilerequest', tiles: tileRequests })
    } else {
      window.S2WorkerPool.tileRequest(this.map.id, tileRequests)
    }
  }

  _findLayerIndex (nameIndex: number | string) {
    const length = this.layers.length
    if (typeof nameIndex === 'number') {
      return nameIndex
    } else if (typeof nameIndex === 'string') {
      for (let i = 0; i < length; i++) {
        const layer = this.layers[i]
        if (layer.name === nameIndex) {
          return i
        }
      }
    }

    return length
  }
}

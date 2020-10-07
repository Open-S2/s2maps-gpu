// @flow
/* global postMessage */
import Color from './color'
import Map from '../ui/map'
import { Wallpaper, Skybox, Tile } from '../source'
import requestData from '../util/fetch'
import { encodeLayerAttribute, parseFeatureFunction, orderLayer } from './conditionals'

import type { MapOptions } from '../ui/map'
import type { Sources, Layer, Mask, WallpaperStyle } from './styleSpec'
import type { TileRequest } from '../workers/tile.worker'

export default class Style {
  map: Map
  glType: number
  webworker: boolean = false
  zoom: number = 0
  minzoom: number = 0
  maxzoom: number = 14.5
  lon: number = 0
  lat: number = 0
  sources: Sources = {}
  fonts: Sources = {}
  billboards: Sources = {}
  layers: Array<Layer> = []
  mask: Mask
  colorBlind: boolean = false
  rasterLayers: { [string]: Layer } = {} // rasterLayers[sourceName]: Layer
  wallpaper: typeof undefined | Wallpaper | Skybox
  wallpaperStyle: typeof undefined | WallpaperStyle
  clearColor: typeof undefined | [number, number, number, number]
  maskLayers: Array<Layer> = []
  dirty: boolean = true
  constructor (options: MapOptions, map: Map) {
    const { webworker } = options
    if (webworker) this.webworker = true
    const { painter } = this.map = map
    // grap the painter type, so we can tell the webworkers if we are using WEBGL, WEBGL2, or WEBGPU
    const { type } = painter.context
    this.glType = type
  }

  buildStyle (style: string | Object) {
    const self = this
    self.dirty = true
    if (typeof style === 'string') {
      requestData(style, 'json', (res) => {
        if (res) { self.buildStyle(res) }
      })
    } else if (typeof style === 'object') {
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
      if (!isNaN(style.minzoom) && style.minzoom >= 0) self.minzoom = style.minzoom
      if (!isNaN(style.maxzoom)) {
        if (style.maxzoom <= self.minzoom) self.maxzoom = self.minzoom + 1
        else if (style.maxzoom <= 14.5) self.maxzoom = style.maxzoom
      }
      // extract sources
      if (style.sources) self.sources = style.sources
      if (style.fonts) self.fonts = style.fonts
      if (style.billboards) self.billboards = style.billboards
      if (style.colorBlind) self.colorBlind = style.colorBlind
      // build wallpaper and sphere background if applicable
      if (style.wallpaper) self._buildWallpaper(style.wallpaper)
      // build the layers
      if (style.layers) self.layers = style.layers
      self._buildLayers()
    }
  }

  _prebuildStyle (style: Object) {
    // ensure certain default layer values exist. If it is a raster layer: seggregate
    for (let i = 0, sl = style.layers.length; i < sl; i++) {
      const layer = style.layers[i]
      layer.layerIndex = i
      if (!layer.minzoom) layer.minzoom = 0
      if (!layer.maxzoom) layer.maxzoom = 30
      if (!layer.layer) layer.layer = 'default'
      if (layer.source === 'mask') this.maskLayers.push(layer)
    }
    // ensure if wallpaper, we have proper default values
    if (style.background) {
      if (style.background.skybox) {
        if (!style.background.size) style.background.size = 1024
        if (!style.background.type) style.background.type = 'png'
        if (!style.background.loadingBackground) style.background.loadingBackground = 'rgb(0, 0, 0)'
      } else if (style.background['background-color']) {
        if (!style.background['fade-1']) style.background['fade-1'] = 'rgb(138, 204, 255)'
        if (!style.background['fade-2']) style.background['fade-2'] = 'rgb(217, 255, 255)'
        if (!style.background['halo']) style.background['halo'] = 'rgb(230, 255, 255)'
      }
    }
    // create mask if it doesn't exist (just incase)
    if (!style.mask) style.mask = {}
    if (!style.mask.exaggeration) style.mask.exaggeration = 1
  }

  _sendStyleDataToWorkers (style: Object) {
    // now that we have various source data, package up the style objects we need and send it off:
    let stylePackage = {
      glType: this.glType,
      sources: style.sources,
      fonts: style.fonts,
      billboards: style.billboards,
      layers: style.layers
    }
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
      this.map.painter.setClearColor(clearColor)
      // grab wallpaper data
      this.wallpaper = new Skybox(background, this.map.projection)
    } else if (background['background-color']) {
      // create the wallpaper
      this.wallpaper = new Wallpaper(this, this.map.projection)
      // prep style
      this.wallpaperStyle = {
        uBackgroundColor: new Color(background['background-color']),
        uFade1Color: new Color(background['fade-1']),
        uFade2Color: new Color(background['fade-2']),
        uHaloColor: new Color(background['halo'])
      }
    }
  }

  // 1) ensure "bad" layers are removed (missing important keys or subkeys)
  // 2) ensure the order is correct for when WebGL eventually parses the encodings
  _buildLayers () {
    const { colorBlind } = this
    // now we build our program set simultaneous to encoding our layers
    const programs = new Set()
    for (let i = 0, ll = this.layers.length; i < ll; i++) {
      const layer: Layer = this.layers[i]
      // TODO: if bad layer, remove
      programs.add(layer.type)
      // if webgl2 or greater, we build layerCode
      if (this.glType > 1) {
        const code = []
        // order layers for GPU
        orderLayer(layer)
        // LAYOUTS
        for (let key in layer.layout) {
          if (key === 'cap' || key === 'join') continue
          code.push(...encodeLayerAttribute(layer.layout[key]))
        }
        // PAINTS
        for (let key in layer.paint) {
          code.push(...encodeLayerAttribute(layer.paint[key], layer.lch, colorBlind))
        }
        if (code.length) layer.code = new Float32Array(code)
      } else if (this.glType === 1 && layer.source === 'mask') {
        for (const l in layer.layout) layer.layout[l] = parseFeatureFunction(layer.layout[l], l)
        for (const p in layer.paint) layer.paint[p] = parseFeatureFunction(layer.paint[p], p)
      }
    }
    // tell the painter what we are using
    this.map.painter.prebuildPrograms(programs)
    // prebuild wallpaper
    if (this.wallpaper) {
      const { skybox } = this.wallpaper
      const wallpaperProgram = this.map.painter.getProgram(skybox ? 'skybox' : 'wallpaper')
      if (skybox) wallpaperProgram.injectImages(this.wallpaper, this.map)
    }
  }

  requestTiles (tiles: Array<Tile>) {
    if (!tiles) return
    const tileRequests: Array<TileRequest> = []
    tiles.forEach(tile => {
      // grab request values
      const { id, face, zoom, x, y, division, size } = tile
      // build tileRequests
      tileRequests.push({ hash: id, face, zoom, x, y, division, size })
    })
    // send the tiles over to the worker pool manager to split the workload
    if (this.webworker) { // $FlowIgnore
      postMessage({ mapID: this.map.id, type: 'request', tiles: tileRequests })
    } else {
      window.S2WorkerPool.tileRequest(this.map.id, tileRequests)
    }
  }
}

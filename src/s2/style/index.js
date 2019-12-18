// @flow
import Color from './color'
import Map from '../ui/map'
import { Tile } from '../source'
import requestData from '../util/xmlHttpRequest'
import { encodeLayerAttribute } from './conditionals'

import type { TileRequest } from '../workers/tile.worker'

type SourceType = {
  path: string,
  type: 'vector' | 'raster' | 'font' | 'billboard',
  fileType: 'json' | 's2json' | 'pbf' | 's2tile' | 'png' | 'jpeg' | 'ttf' | 'woff',
  sourceName?: string // if you want to make requests without getting metadata, you need this
}

type SourceTypes = { [string]: SourceType }

type DrawType = 'fill' | 'line' | 'text' | 'billboard'

type StyleLayout = {
  'line-cap'?: 'butt' | 'square' | 'round',
  'line-edge'?: 'bevel' | 'miter' | 'round',
  'text-size'?: number,
  'text-family'?: string,
  'text-field'?: string | Array<string>, // ['name_en', 'name'] or just 'name'
  'text-size'?: number,
  'text-family'?: string | Array<string>, //
  'symbol-placement'?: string // "point" or "line" or nothing which equates to both
}

type StylePaint = {
  'color'?: string,
}

type StyleFilter = Array<any> // ["any", ["class", "==", "ocean"], ["class", "==", "river"]]

export type StyleLayer = {
  id: string,
  source: string,
  layer: string,
  minzoom: number,
  maxzoom: number,
  type?: Array<DrawType> | DrawType, // if no type, it can be "any"
  filter: StyleFilter,
  layout: StyleLayout,
  paint: StylePaint,
  code: Float32Array
}

type StyleLayers = Array<StyleLayer>

export type WallpaperStyle = {
  backgroundColor: Color,
  fade1Color: Color,
  fade2Color: Color,
  haloColor: Color
}

export type StylePackage = {
  sources: SourceTypes,
  fonts: SourceTypes,
  billboards: SourceTypes,
  layers: StyleLayers
}

export default class Style {
  map: Map
  webworker: boolean = false
  zoom: number = 0
  lon: number = 0
  lat: number = 0
  sources: SourceTypes = {}
  fonts: SourceTypes = {}
  billboards: SourceTypes = {}
  layers: StyleLayers = []
  wallpaper: WallpaperStyle
  sphereBackground: void | Float32Array // Attribute Code - limited to input-range or input-condition
  dirty: boolean = true
  constructor (options: MapOptions, map: Map) {
    const { style } = options
    if (options.webworker) this.webworker = true
    this.map = map
    this._buildStyle(style)
  }

  _buildStyle (style: string | Object) {
    const self = this
    if (typeof style === 'string') {
      requestData(style, 'json', (res) => {
        if (res) { self._buildStyle(res) }
      })
    } else if (typeof style === 'object') {
      // Before manipulating the style, send it off to the worker pool manager
      this._sendStyleDataToWorkers(style)
      // extract starting values
      if (style.center) {
        self.lon = style.center[0]
        self.lat = style.center[1]
      }
      if (style.zoom) self.zoom = style.zoom
      // extract sources
      if (style.sources) self.sources = style.sources
      if (style.fonts) self.fonts = style.fonts
      if (style.billboards) self.billboards = style.billboards
      // build wallpaper and sphere background if applicable
      self._buildWallpaper(style.wallpaper || {})
      self._buildSphereBackground(style['sphere-background'])
      // build the layers
      if (style.layers) self.layers = style.layers
      self._buildLayers()
    }
  }

  _sendStyleDataToWorkers (style: Object) {
    // now that we have various source data, package up the style objects we need and send it off:
    let stylePackage = {
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

  _buildWallpaper (background: Object) {
    this.wallpaper = {
      backgroundColor: new Color(background['background-color']),
      fade1Color: new Color(background['fade-1']),
      fade2Color: new Color(background['fade-2']),
      haloColor: new Color(background['halo'])
    }
  }

  _buildSphereBackground (sphereBackground?: Object) {
    if (sphereBackground) this.sphereBackground = encodeLayerAttribute(sphereBackground['background-color'])
  }

  // TODO: prep color, line-color, text-color, fill-color, text-size, text-halo-color, text-halo-width, and/or line-width, conditions
  // TODO+: ensure the order is correct when WebGL eventually parses the eoncdings
  _buildLayers () {
    // now we build our program set simultaneous to encoding our layers
    const programs = new Set()
    for (const layer of this.layers) {
      const code = []
      programs.add(layer.type)
      // LAYOUTS
      for (let key in layer.layout) {
        code.push(...encodeLayerAttribute(layer.layout[key]))
      }
      // PAINTS
      for (let key in layer.paint) {
        code.push(...encodeLayerAttribute(layer.paint[key]))
      }
      layer.code = new Float32Array(code)
    }
    this.map.painter.prebuildPrograms(programs)
  }

  requestTiles (tiles: Array<Tile>) {
    const tileRequests: Array<TileRequest> = []
    tiles.forEach(tile => {
      // grab request values
      const { id, face, zoom, x, y, bbox, division, extent } = tile
      // build tileRequests
      tileRequests.push({ hash: id, face, zoom, x, y, bbox, division, extent })
    })
    // send the tiles over to the worker pool manager to split the workload
    if (this.webworker) {
      postMessage({ mapID: this.map.id, type: 'request', tiles: tileRequests })
    } else {
      window.S2WorkerPool.tileRequest(this.map.id, tileRequests)
    }
  }
}

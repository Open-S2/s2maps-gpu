// @flow
import Color from './color'
import Map from '../ui/map'
import { Tile } from '../source'
import requestData from '../util/xmlHttpRequest'
import { parseConditionDecode } from './conditionals'

import type { TileRequest } from '../workers/tile.worker'

type SourceType = {
  path: string,
  type: 'vector' | 'raster' | 'font' | 'billboard',
  fileType: 'json' | 's2json' | 'pbf' | 's2tile' | 'png' | 'jpeg' | 'ttf' | 'woff',
  sourceName?: string // if you want to make requests without getting metadata, you need this
}

type SourceTypes = {
  [string]: SourceType
}

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
  paint: StylePaint
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

type SphereBackgroundStyle = Color

export default class Style {
  map: Map
  zoom: number = 0
  lon: number = 0
  lat: number = 0
  sources: SourceTypes = {}
  fonts: SourceTypes = {}
  billboards: SourceTypes = {}
  layers: StyleLayers = []
  wallpaper: WallpaperStyle
  sphereBackground: void | SphereBackgroundStyle
  dirty: boolean = true
  constructor (style: Style | Object | string, map: Map) {
    this.map = map
    if (style instanceof Style) return style // we are inputing a built style (multiple maps on one page)
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
    if (window && window.S2WorkerPool) {
      window.S2WorkerPool.injectStyle(this.map.id, stylePackage)
    } else if (typeof postMessage === 'function') {
      postMessage({ mapID: this.map.id, type: 'style', style: stylePackage })
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
    if (sphereBackground) this.sphereBackground = parseConditionDecode(sphereBackground['background-color'])
  }

  // TODO: prep color, line-color, text-color, fill-color, text-size, text-halo-color, text-halo-width, and/or line-width, conditions
  _buildLayers () {
    const programs = new Set()
    for (const layer of this.layers) {
      programs.add(layer.type)
      // LAYOUTS
      for (let key in layer.layout) layer.layout[key] = parseConditionDecode(layer.layout[key])
      // PAINTS
      for (let key in layer.paint) layer.paint[key] = parseConditionDecode(layer.paint[key])
    }
    this.map.painter.prebuildPrograms(programs)
  }

  requestTiles (tiles: Array<Tile>) {
    const self = this
    const tileRequests: Array<TileRequest> = []
    tiles.forEach(tile => {
      // inject layers into tile
      tile.layers = self.layers
      // grab request values
      const { id, face, zoom, x, y, center, bbox, division, extent } = tile
      // build tileRequests
      tileRequests.push({ hash: id, face, zoom, x, y, center, bbox, division, extent })
    })
    // send the tiles over to the worker pool manager to split the workload
    if (window && window.S2WorkerPool) { // otherwise a main thread, just get the worker pool from window
      window.S2WorkerPool.tileRequest(this.map.id, tileRequests)
    } else if (typeof postMessage === 'function') { // perhaps this map instance is a web worker and has a global instance of postMessage
      postMessage({ mapID: this.map.id, type: 'request', tiles: tileRequests })
    }
  }
}

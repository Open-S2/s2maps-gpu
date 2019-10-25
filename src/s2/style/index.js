// @flow
import Color from './color'
import Map from '../ui/map'
import { Tile } from '../source'
import { requestData } from '../util/xmlHttpRequest'

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
  'line-cap'?: 'round' | 'bevel' | 'square',
  'line-edge'?: 'round' | '',
  'text-size'?: number,
  'text-family'?: string
  "text-field"?: string | Array<string>, // ["name_en", "name"] or just "name"
  "text-size"?: number,
  "text-family"?: string | Array<string>, //
  "symbol-placement"?: string // "point" or "line" or nothing which equates to both
}

type StylePaint = {
  'color'?: string,
  'fill-color'?: string,
  'line-color'?: string,
  'text-color'?: string
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
  sphereBackground: SphereBackgroundStyle
  dirty: boolean = true
  constructor (style: Style | Object | string, map: Map) {
    this.map = map
    if (style instanceof Style) return style // we are inputing a built style (multiple maps on one page)
    this._buildStyle(style)
  }

  _sendStyleDataToWorkers () {
    // now that we have various source data, package up the style objects we need and send it off:
    let stylePackage = {
      sources: this.sources,
      fonts: this.fonts,
      billboards: this.billboards,
      layers: this.layers
    }
  }

  _buildStyle (style: string | Object) {
    const self = this
    if (typeof style === 'string') {
      requestData(style, 'json')
        .then(res => self._buildStyle(res))
        .catch(err => console.log('could not acquire the style', err))
    } else if (typeof style === 'object') {
      // TODO: before manipulating the style, send it off to the worker pool manager

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
      self._buildSphereBackground(style['sphere-background'] || {})
      // build the layers
      if (style.layers) self.layers = style.layers
      self._buildLayers()
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

  _buildSphereBackground (sphereBackground: Object) {
    this.sphereBackground = new Color(sphereBackground['background-color'])
  }

  // prep color, line-color, text-color, fill-color, text-size, text-halo-color, text-halo-width, and/or line-width, conditions
  _buildLayers () {
    for (const layer of this.layers) {

    }
  }

  requestTiles (tiles: Array<Tile>) {
    const self = this
    // inject layers into tile
    tiles.forEach(tile => tile.layers = self.layers)
    // TODO: send the tiles over to the worker pool manager to split the workload
  }
}

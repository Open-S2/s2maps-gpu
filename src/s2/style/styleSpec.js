// @flow
/** SOURCES **/
type SourceType = {
  path: string,
  type: 'vector' | 'raster' | 'font' | 'billboard',
  fileType: 'json' | 's2json' | 'pbf' | 's2tile' | 'png' | 'jpeg' | 'ttf' | 'woff',
  sourceName?: string // if you want to make requests without getting metadata, you need this
}
type SourceTypes = { [string]: SourceType }

/** WORKER PACKAGE **/
export type StylePackage = {
  sources: SourceTypes,
  fonts: SourceTypes,
  billboards: SourceTypes,
  layers: Array<Layer>
}

/** WALLPAPER **/
export type WallpaperStyle = {
  backgroundColor: Color,
  fade1Color: Color,
  fade2Color: Color,
  haloColor: Color
}

/** Layer **/
export type Layer = {
  id: string,
  source: string,
  layer: string,
  minzoom: number,
  maxzoom: number,
  type: 'fill' | 'line' | 'line3D' | 'billboard' | 'text',
  filter: Array<any>, // ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
  layout: LineLayout | TextLayout | BillboardLayout,
  paint: FillPaint | LinePaint | TextPaint | BillboardPaint,
  code: Float32Array
}

/** FILL **/
export type FillPaint = {
  color: string | Array<any>
}

/** LINE **/
export type Cap = 'butt' | 'square' | 'round'
export type Join = 'bevel' | 'miter' | 'round'
export type LineLayout = {
  cap?: Cap,
  join?: Join
}
export type LinePaint = {
  color: string | Array<any>,
  width: number | Array<any>,
  dasharray?: string | Array<any>,
  gapwidth?: number | Array<any>,
  blur?:number | Array<any>
}

/** TEXT **/
export type TextLayout = {
  family: string | Array<any>,
  field: string | Array<string> | Array<any>,
  offset?: number | Array<any>,
  padding?: number | Array<any>
}
export type TextPaint = {
  color: string | Array<any>,
  size: number | Array<any>,
  halowidth?: number | Array<any>,
  halocolor?: string | Array<any>
}

/** BILLBOARD **/
export type BillboardLayout = {
  field: string | Array<string> | Array<any>,
  offset?: number | Array<any>,
  padding?: number | Array<any>
}
export type BillboardPaint = {
  size: number | Array<any>,
  opacity?: number | Array<any>
}

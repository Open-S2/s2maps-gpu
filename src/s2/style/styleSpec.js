// @flow
/** SOURCES **/
type Source = {
  path: string,
  type: 'vector' | 'json' | 'raster' | 'mask' | 'font' | 'billboard',
  fileType: 'json' | 's2json' | 'pbf' | 'png' | 'jpg',
  sourceName?: string // if you want to make requests without getting metadata, you need this
}
type Sources = { [string]: Source }

/** WORKER PACKAGE **/
export type StylePackage = {
  sources: Sources,
  fonts: Sources,
  billboards: Sources,
  layers: Array<Layer>
}

/** WALLPAPER **/
export type WallpaperStyle = {
  skybox: string,
  type: string,
  backgroundColor: string,
  fade1Color: string,
  fade2Color: string,
  haloColor: string
}

/** Layer **/
export type Layer = {
  id: string,
  source: string,
  layer: string,
  minzoom: number,
  maxzoom: number,
  type: 'raster' | 'fill' | 'fill3D' | 'line' | 'line3D' | 'billboard' | 'text',
  filter: Array<any>, // ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
  layout: LineLayout | TextLayout | BillboardLayout,
  paint: FillPaint | LinePaint | TextPaint | BillboardPaint,
  code?: Float32Array
}

/** MASK **/
export type Mask = {
  exaggeration: string | Array<any>
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

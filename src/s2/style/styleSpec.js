// @flow
/* global WebGLTexture WebGLFramebuffer */

/** SOURCES **/
export type Source = {
  path: string,
  type: 'vector' | 'json' | 'raster' | 'mask' | 'font' | 'billboard',
  fileType: 'json' | 's2json' | 'pbf' | 'png' | 'jpg',
  sourceName?: string // if you want to make requests without getting metadata, you need this
}
export type Sources = { [string]: Source }

/** MASK **/
export type Mask = {
  exaggeration: string | Array<any>
}

/** FILL **/
export type FillPaint = {
  color: string | Array<any>
  opacity: number | Array<any>
}

/** POINT **/
export type PointPaint = {
  color: string | Array<any>,
  radius: number | Array<any>,
  stroke: string | Array<any>,
  strokeWidth: number | Array<any>,
  opacity: number | Array<any>
}

/** HEATMAP **/
export type HeatmapLayout = {
  intensity: number | Array<any>
}
export type HeatmapPaint = {
  radius: number | Array<any>,
  opacity: number | Array<any>
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
  gapwidth?: number | Array<any>
}

/** TEXT **/
export type TextLayout = {
  family: string | Array<any>,
  field: string | Array<string> | Array<any>,
  anchor?: string,
  offset?: number | Array<any>, // default: [0, 0]
  padding?: number | Array<any> // default: [0, 0]
}
export type TextPaint = {
  size: number | Array<any>,
  fillStyle: string | Array<any>,
  strokeStyle?: number | Array<any>,
  strokeWidth?: string | Array<any>
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

/** Layer **/
export type Layer = {
  id: string,
  layerIndex: number,
  source: string,
  layer: string,
  minzoom: number,
  maxzoom: number,
  type: 'raster' | 'fill' | 'fill3D' | 'line' | 'line3D' | 'glyph' | 'point',
  filter: Array<any>, // ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
  layout: LineLayout | TextLayout | BillboardLayout,
  paint: FillPaint | PointPaint | LinePaint | TextPaint | BillboardPaint,
  lch: boolean,
  code?: Float32Array
}

export type HeatmapLayer = {
  id: string,
  layerIndex: number,
  source: string,
  layer: string,
  minzoom: number,
  maxzoom: number,
  type: 'heatmap',
  filter: Array<any>, // ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
  layout: HeatmapLayout,
  paint: HeatmapPaint,
  code?: Float32Array,
  colorRamp: WebGLTexture,
  fbo: WebGLFramebuffer,
  canvasTexture: WebGLTexture
}

/** WORKER PACKAGE **/
export type GLType = 1 | 2 | 3
export type StylePackage = {
  glType: GLType,
  sources: Sources,
  fonts: Sources,
  billboards: Sources,
  layers: Array<Layer>
}

/** WALLPAPER **/
export type WallpaperImageType = 'png' | 'jpg' | 'jpeg'
export type WallpaperStyle = {
  skybox: string,
  type: WallpaperImageType,
  size: number,
  backgroundColor: string,
  fade1Color: string,
  fade2Color: string,
  haloColor: string
}

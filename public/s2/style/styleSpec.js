// @flow
/* eslint-env browser */

/** SOURCES **/
export type Source = {
  path: string,
  type: 'vector' | 'json' | 'raster' | 'mask' | 'glyph' | 'heatmap' | 'point',
  fileType: 'json' | 's2json' | 'pbf' | 'png' | 'jpg' | 'webp',
  encoding: 'gz' | 'br' | 'none',
  sourceName?: string // if you want to make requests without getting metadata, you need this
}
export type Sources = { [string]: Source }

/** FACE **/
export type Face = 0 | 1 | 2 | 3 | 4 | 5

/** XYZ **/
export type XYZ = [number, number, number]

/** MASK **/
export type Mask = {
  exaggeration: string | Array<any>
}

/** FILL **/
export type FillPaint = {
  color: string | Array<any>,
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

/** GLYPH **/
export type GlyphLayout = {
  'text-family': string | Array<any>,
  'text-field': string | Array<string> | Array<any>,
  'text-anchor'?: string,
  'text-offset'?: number | Array<any>, // default: [0, 0]
  'text-padding'?: number | Array<any>, // default: [0, 0]
  'text-word-wrap'?: number | Array<any>,
  'text-align'?: string | Array<any>,
  'text-kerning'?: string | Array<any>,
  'text-line-height'?: string | Array<any>,
  'icon-family': string | Array<any>,
  'icon-field': string | Array<string> | Array<any>,
  'icon-anchor'?: string,
  'icon-offset'?: number | Array<any>, // default: [0, 0]
  'icon-padding'?: number | Array<any> // default: [0, 0]
}
export type GlyphPaint = {
  'text-size': number | Array<any>,
  'text-fill': string | Array<any>,
  'text-stroke'?: number | Array<any>,
  'text-stroke-width'?: string | Array<any>,
  'icon-size': number | Array<any>
}

/** Layer **/
export type Layer = {
  name: string,
  layerIndex: number,
  depthPos: number,
  opaque?: boolean,
  invert?: boolean,
  overdraw?: boolean,
  interactive?: boolean,
  source: string,
  layer: string,
  minzoom: number,
  maxzoom: number,
  type: 'raster' | 'fill' | 'fill3D' | 'line' | 'line3D' | 'glyph' | 'point',
  filter: Array<any>, // ["any", ["class", "==", "ocean"], ["class", "==", "river"]]
  layout: LineLayout | GlyphLayout,
  paint: FillPaint | PointPaint | LinePaint | GlyphPaint,
  iconPaint?: { 'icon-size': string | Array<any> },
  colorRamp?: Uint8ClampedArray,
  lch?: boolean,
  code?: Float32Array,
  iconCode?: Float32Array // special case for icon sizing
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
  icons: Sources,
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

import type { TileGL, TileGPU } from '../../source/tile.spec'
import type { GPUType, Resampling } from '../../style/style.spec'
import type { SensorTextureDefinition } from '../../ui/camera/timeCache'

// type Merge<X, Y> = {
//   [K in (keyof X | keyof Y)]:
//   (K extends keyof X ? X[K] : never)
//   | (K extends keyof Y ? Y[K] : never)
// }

export interface MaskSource {
  type: 'mask'
  vertexBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  count: number
  offset: number
  vao: WebGLVertexArrayObject
}

export interface FillSource {
  type: 'fill'
  vertexBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  fillIDBuffer: WebGLBuffer
  codeTypeBuffer: WebGLBuffer
  vao: WebGLVertexArrayObject
}

export interface GlyphSource {
  type: 'glyph'
  filterVAO: WebGLVertexArrayObject
  vao: WebGLVertexArrayObject // quad vao
  glyphFilterBuffer: WebGLBuffer
  glyphFilterIDBuffer: WebGLBuffer
  glyphQuadBuffer: WebGLBuffer
  glyphQuadIDBuffer: WebGLBuffer
  glyphColorBuffer: WebGLBuffer
}

export interface HeatmapSource {
  type: 'heatmap'
  vertexBuffer: WebGLBuffer
  weightBuffer: WebGLBuffer
  vao: WebGLVertexArrayObject
}

export interface LineSource {
  type: 'line'
  // fillIDBuffer: WebGLBuffer
  vertexBuffer: WebGLBuffer
  lengthSoFarBuffer?: WebGLBuffer
  vao: WebGLVertexArrayObject
}

export interface PointSource {
  type: 'point'
  vertexBuffer: WebGLBuffer
  fillIDBuffer: WebGLBuffer
  vao: WebGLVertexArrayObject
}

// Uses MaskSource vao, count, and offset
export interface RasterSource {
  type: 'raster'
  texture: WebGLTexture
}

export interface SensorSource {
  texture?: WebGLTexture
  delete?: undefined
}

export type FeatureSource = MaskSource | FillSource | LineSource | PointSource | HeatmapSource | RasterSource | GlyphSource

/* FEATURE GUIDES */

export interface FeatureGuideBase {
  tile: TileGL | TileGPU
  parent?: TileGL | TileGPU
  layerIndex: number
  sourceName: string
  layerCode: number[]
  lch: boolean
  opaque?: boolean
  interactive?: boolean
  featureCode: number[] // webgl2
  bounds?: [number, number, number, number]
}

// ** FILL **
export interface FillFeatureGuide extends FeatureGuideBase {
  type: 'fill'
  maskLayer: boolean
  source: FillSource | MaskSource
  count: number
  offset: number
  invert: boolean
  interactive: boolean
  opaque: boolean
  color?: number[] // webgl1
  opacity?: number[] // webgl1
  mode: number
}

// ** GLYPH + GLYPH FILTER **
export type GlyphType = 'text' | 'icon'
export interface GlyphFeatureGuide extends FeatureGuideBase {
  type: 'glyph'
  source: GlyphSource
  count: number
  offset: number
  filterCount: number
  filterOffset: number
  overdraw: boolean
  isIcon: boolean
  interactive: boolean
  bounds?: [number, number, number, number]
  size?: number
  fill?: [number, number, number, number]
  stroke?: [number, number, number, number]
  strokeWidth?: number
}

// ** HEATMAP **
export interface HeatmapFeatureGuide extends FeatureGuideBase {
  type: 'heatmap'
  source: HeatmapSource
  count: number
  offset: number
  colorRamp: WebGLTexture
  radiusLo?: number // webgl1
  opacityLo?: number // webgl1
  intensityLo?: number // webgl1
  radiusHi?: number // webgl1
  opacityHi?: number // webgl1
  intensityHi?: number // webgl1
  bounds?: [number, number, number, number]
}

// ** LINE **
export interface LineFeatureGuide extends FeatureGuideBase {
  type: 'line'
  source: LineSource
  interactive: boolean
  count: number
  offset: number
  dashed: boolean
  dashTexture?: WebGLTexture
  cap: number
  color?: [number, number, number, number] // webgl1
  opacity?: number // webgl1
  width?: number // webgl1
  gapwidth?: number // webgl1
}

// ** POINT **
export interface PointFeatureGuide extends FeatureGuideBase {
  type: 'point'
  source: PointSource
  count: number
  offset: number
  color?: [number, number, number, number] // webgl1
  radius?: number // webgl1
  stroke?: [number, number, number, number] // webgl1
  strokeWidth?: number // webgl1
  opacity?: number // webgl1
  bounds?: [number, number, number, number]
}

// ** RASTER **
export interface RasterFeatureGuide extends FeatureGuideBase {
  type: 'raster'
  source: RasterSource
  resampling: Resampling
  fadeDuration: number
  fadeStartTime: number
  opacity?: number // webgl1
  contrast?: number // webgl1
  saturation?: number // webgl1
}

// ** SENSOR **
export interface SensorFeatureGuide extends FeatureGuideBase {
  type: 'sensor'
  fadeDuration: number
  fadeStartTime: number
  colorRamp: WebGLTexture
  getTextures: () => SensorTextureDefinition
  opacity?: number // webgl1
}

export interface ShadeFeatureGuide extends FeatureGuideBase {
  tile: TileGL | TileGPU
  layerIndex: number
  sourceName: string
  type: 'shade'
  maskLayer: boolean
  source: MaskSource
  count: number
  offset: number
}

export type FeatureGuide =
  FillFeatureGuide | GlyphFeatureGuide | HeatmapFeatureGuide |
  LineFeatureGuide | PointFeatureGuide | RasterFeatureGuide |
  SensorFeatureGuide | ShadeFeatureGuide

/* CONTEXTS */

export interface Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  type: GPUType
  renderer: string
  devicePixelRatio: number
  interactive: boolean
  depthState: boolean
  cullState: boolean
  blendState: boolean
  blendMode: number
  zTestMode: number
  zLow: number
  zHigh: number
  clearColorRGBA: [number, number, number, number]
  featurePoint: Uint8Array
  masks: Map<number, MaskSource>
  vao: WebGLVertexArrayObject
  vertexBuffer?: WebGLBuffer
  interactTexture?: WebGLTexture
  stencilBuffer?: WebGLRenderbuffer
  interactFramebuffer?: WebGLFramebuffer

  // SETUP INTERACTIVE BUFFER
  resize: () => void
  resizeInteract: () => void
  getFeatureAtMousePosition: (x: number, y: number) => undefined | number
  delete: () => void

  /** CONSTRUCTION **/
  _createDefaultQuad: () => void
  getMask: (zoom: number) => MaskSource
  drawQuad: () => void

  /** PREP PHASE **/
  resetViewport: () => void
  bindMainBuffer: () => void
  setClearColor: (clearColor: [number, number, number, number]) => void
  newScene: () => void
  clearInteractBuffer: () => void
  clearColor: () => void
  clearColorDepthBuffers: () => void
  clearColorBuffer: () => void

  /** TEXTURE **/
  buildTexture: (imageData: ArrayBufferView, width: number, height: number) => WebGLTexture

  /** DEPTH **/
  enableDepthTest: () => void
  disableDepthTest: () => void
  alwaysDepth: () => void
  lessDepth: () => void
  lequalDepth: () => void
  setDepthRange: (depthPos: number) => void
  resetDepthRange: () => void

  /** WALLPAPER **/
  wallpaperState: () => void

  /** CULLING **/
  enableCullFace: () => void
  disableCullFace: () => void

  /** BLENDING **/
  enableBlend: () => void
  disableBlend: () => void
  defaultBlend: () => void
  shadeBlend: () => void
  inversionBlend: () => void
  zeroBlend: () => void
  oneBlend: () => void

  /** STENCILING **/
  enableStencilTest: () => void
  disableStencilTest: () => void
  stencilFuncAlways: (ref: number) => void
  stencilFuncEqual: (ref: number) => void
  stencilInvert: () => void
  stencilZero: () => void

  /** MASKING **/
  enableMaskTest: () => void

  /** CLEANUP **/
  cleanup: () => void
}

import type { BBox } from 'geometry'
import type { TileGL as Tile } from 'source/tile.spec'
import type { ColorArray } from 'style/color'
import type {
  FillWorkflowLayerGuide,
  GPUType,
  GlyphWorkflowLayerGuide,
  HeatmapWorkflowLayerGuide,
  HillshadeWorkflowLayerGuide,
  LineWorkflowLayerGuide,
  PointWorkflowLayerGuide,
  RasterWorkflowLayerGuide,
  Resampling,
  SensorWorkflowLayerGuide,
  ShadeDefinition,
  UnpackData
} from 'style/style.spec'
import type { SensorTextureDefinition } from 'ui/camera/timeCache'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { SpriteImageMessage } from 'workers/worker.spec'

export interface FBO {
  width: number
  height: number
  texSize: number[]
  texture: WebGLTexture
  stencil: WebGLRenderbuffer
  glyphFramebuffer: WebGLFramebuffer
}

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
  idBuffer: WebGLBuffer
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
  // idBuffer: WebGLBuffer
  vertexBuffer: WebGLBuffer
  lengthSoFarBuffer: WebGLBuffer
  vao: WebGLVertexArrayObject
}

export interface PointSource {
  type: 'point'
  vertexBuffer: WebGLBuffer
  idBuffer: WebGLBuffer
  vao: WebGLVertexArrayObject
}

// Uses MaskSource vao, count, and offset
export interface RasterSource {
  type: 'raster'
  texture: WebGLTexture
  size: number
}

export interface SensorSource {
  texture?: WebGLTexture
  delete?: undefined
}

export type FeatureSource = MaskSource | FillSource | LineSource | PointSource | HeatmapSource | RasterSource | GlyphSource
export type LayerGuides = FillWorkflowLayerGuide | GlyphWorkflowLayerGuide | HeatmapWorkflowLayerGuide | LineWorkflowLayerGuide | PointWorkflowLayerGuide | RasterWorkflowLayerGuide | HillshadeWorkflowLayerGuide | SensorWorkflowLayerGuide | ShadeDefinition

/* FEATURE GUIDES */

export interface FeatureGuideBase {
  tile: Tile
  parent?: Tile
  maskLayer?: boolean
  layerGuide: LayerGuides
  sourceName: string
  layerCode: number[]
  lch: boolean
  opaque?: boolean
  interactive?: boolean
  featureCode: number[] // webgl2
  bounds?: BBox
}

// ** FILL **
export interface FillFeatureGuide extends FeatureGuideBase {
  type: 'fill'
  maskLayer: boolean
  source: FillSource | MaskSource
  layerGuide: FillWorkflowLayerGuide
  count: number
  offset: number
  invert: boolean
  patternXY: [x: number, y: number]
  patternWH: [w: number, h: number]
  patternMovement: number
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
  layerGuide: GlyphWorkflowLayerGuide
  count: number
  offset: number
  filterCount: number
  filterOffset: number
  overdraw: boolean
  isIcon: boolean
  interactive: boolean
  textureName?: string
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
  layerGuide: HeatmapWorkflowLayerGuide
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
  layerGuide: LineWorkflowLayerGuide
  interactive: boolean
  count: number
  offset: number
  dashed: boolean
  dashCount: number
  dashLength: number
  dashTexture: WebGLTexture
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
  layerGuide: PointWorkflowLayerGuide
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
  layerGuide: RasterWorkflowLayerGuide
  resampling: Resampling
  fadeDuration: number
  fadeStartTime: number
  opacity?: number // webgl1
  contrast?: number // webgl1
  saturation?: number // webgl1
}

// ** HILLSHADE **
export interface HillshadeFeatureGuide extends FeatureGuideBase {
  type: 'hillshade'
  source: RasterSource
  layerGuide: HillshadeWorkflowLayerGuide
  fadeDuration: number
  fadeStartTime: number
  unpack: UnpackData
  opacity?: number // webgl1
  shadowColor?: [number, number, number, number] // webgl1
  accentColor?: [number, number, number, number] // webgl1
  highlightColor?: [number, number, number, number] // webgl1
  azimuth?: number // webgl1
  altitude?: number // webgl1
}

// ** SENSOR **
export interface SensorFeatureGuide extends FeatureGuideBase {
  type: 'sensor'
  fadeDuration: number
  fadeStartTime: number
  colorRamp: WebGLTexture
  layerGuide: SensorWorkflowLayerGuide
  getTextures: () => SensorTextureDefinition
  opacity?: number // webgl1
}

export interface ShadeFeatureGuide extends FeatureGuideBase {
  sourceName: string
  type: 'shade'
  maskLayer: boolean
  source: MaskSource
  layerGuide: ShadeDefinition
  count: number
  offset: number
}

export type FeatureGuide =
  FillFeatureGuide | GlyphFeatureGuide | HeatmapFeatureGuide |
  LineFeatureGuide | PointFeatureGuide | RasterFeatureGuide |
  SensorFeatureGuide | ShadeFeatureGuide | HillshadeFeatureGuide

/* CONTEXTS */

export interface Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  type: GPUType
  presentation: { width: number, height: number }
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
  clearColorRGBA: ColorArray
  featurePoint: Uint8Array
  masks: Map<number, MaskSource>
  vao: WebGLVertexArrayObject
  vertexBuffer?: WebGLBuffer
  interactTexture?: WebGLTexture
  stencilBuffer?: WebGLRenderbuffer
  interactFramebuffer?: WebGLFramebuffer
  defaultBounds: BBox
  nullTexture: WebGLTexture
  sharedFBO: FBO

  // MANAGE IMAGE IMPORTS
  injectImages: (maxHeight: number, images: GlyphImages) => void
  injectSpriteImage: (data: SpriteImageMessage) => void

  // SETUP INTERACTIVE BUFFER
  resize: () => void
  setInteractive: (interactive: boolean) => void
  resizeInteract: () => void
  getFeatureAtMousePosition: (x: number, y: number) => Promise<number[]>
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
  buildTexture: (
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height?: number,
    repeat?: boolean
  ) => WebGLTexture
  updateTexture: (
    texture: WebGLTexture,
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height: number
  ) => void

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
  flushMask: () => void

  /** VAO **/
  buildVAO: () => WebGLVertexArrayObject

  /** Attributes **/
  bindEnableVertexAttr: (
    ab: ArrayBufferView,
    indx: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    instance?: boolean
  ) => WebGLBuffer
  bindEnableVertexAttrMulti: (
    ab: ArrayBufferView,
    // [indx, size, type, normalized, stride, offset]
    attributes: Array<[index: number, size: number, type: number, normalized: boolean, stride: number, offset: number]>,
    instance?: boolean
  ) => WebGLBuffer
  bindAndBuffer: (ab: ArrayBufferView) => WebGLBuffer
  defineBufferState: (
    indx: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    instance?: boolean
  ) => void
  bindElementArray: (ab: ArrayBufferView) => WebGLBuffer

  /** CLEANUP **/
  cleanup: () => void
}

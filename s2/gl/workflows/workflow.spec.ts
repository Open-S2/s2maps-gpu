import type { ColorMode } from 's2Map'
import type { BBox, Point } from 'geometry'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuide,
  GlyphDefinition,
  GlyphStyle,
  GlyphWorkflowLayerGuide,
  HeatmapDefinition,
  HeatmapStyle,
  HeatmapWorkflowLayerGuide,
  HillshadeDefinition,
  HillshadeStyle,
  HillshadeWorkflowLayerGuide,
  LayerDefinitionBase,
  LineDefinition,
  LineStyle,
  LineWorkflowLayerGuide,
  PointDefinition,
  PointStyle,
  PointWorkflowLayerGuide,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuide,
  SensorDefinition,
  SensorStyle,
  SensorWorkflowLayerGuide,
  ShadeDefinition,
  ShadeStyle,
  ShadeWorkflowLayerGuide,
  StyleDefinition
} from 'style/style.spec'
import type { SensorTextureDefinition } from 'ui/camera/timeCache'
import type Projector from 'ui/camera/projector'
import type S2MapUI from 'ui/s2mapUI'
import type TimeCache from 'ui/camera/timeCache'
import type { Scheme } from './wallpaperWorkflow'
import type {
  FillData,
  GlyphData,
  HeatmapData,
  HillshadeData,
  LineData,
  PointData,
  RasterData,
  SensorData
} from 'workers/worker.spec'
import type Context from '../context/context'
import type { ColorArray } from 'style/color'

export type Uniforms = Record<string, string>

export type Attributes = Record<string, string>

export type AttributeLocations = Record<string, number>

/* SOURCES */

export interface ShaderSource {
  source: string
  uniforms: Uniforms
  attributes: Attributes
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
export type LayerGuides = FillWorkflowLayerGuide | GlyphWorkflowLayerGuide | HeatmapWorkflowLayerGuide | LineWorkflowLayerGuide | PointWorkflowLayerGuide | RasterWorkflowLayerGuide | HillshadeWorkflowLayerGuide | SensorWorkflowLayerGuide | ShadeWorkflowLayerGuide

/* FEATURE GUIDES */

export interface FeatureBase {
  tile: Tile
  parent?: Tile
  layerGuide: LayerGuides
  featureCode: number[] // webgl2
  bounds?: BBox
  draw: (interactive?: boolean) => void
  destroy: () => void
  duplicate?: (tile: Tile, parent?: Tile, bounds?: BBox) => FeatureBase
}

// ** FILL **
export interface FillFeature extends FeatureBase {
  type: 'fill'
  maskLayer: boolean
  workflow: FillWorkflow
  source: FillSource | MaskSource
  layerGuide: FillWorkflowLayerGuide
  count: number
  offset: number
  patternXY: Point
  patternWH: [w: number, h: number]
  patternMovement: number
  color?: number[] // webgl1
  opacity?: number[] // webgl1
  mode: number
  duplicate: (tile: Tile, parent?: Tile) => FillFeature
}

// ** GLYPH + GLYPH FILTER **
export type GlyphType = 'text' | 'icon'
export interface GlyphFeature extends FeatureBase {
  type: 'glyph'
  source: GlyphSource
  layerGuide: GlyphWorkflowLayerGuide
  count: number
  offset: number
  filterCount: number
  filterOffset: number
  isIcon: boolean
  textureName?: string
  size?: number // webgl1
  fill?: ColorArray // webgl1
  stroke?: ColorArray // webgl1
  strokeWidth?: number // webgl1
}

// ** HEATMAP **
export interface HeatmapFeature extends FeatureBase {
  type: 'heatmap'
  source: HeatmapSource
  layerGuide: HeatmapWorkflowLayerGuide
  count: number
  offset: number
  radiusLo?: number // webgl1
  opacityLo?: number // webgl1
  intensityLo?: number // webgl1
  radiusHi?: number // webgl1
  opacityHi?: number // webgl1
  intensityHi?: number // webgl1
}

// ** LINE **
export interface LineFeature extends FeatureBase {
  type: 'line'
  source: LineSource
  layerGuide: LineWorkflowLayerGuide
  count: number
  offset: number
  cap: number
  color?: ColorArray // webgl1
  opacity?: number // webgl1
  width?: number // webgl1
  gapwidth?: number // webgl1
}

// ** POINT **
export interface PointFeature extends FeatureBase {
  type: 'point'
  source: PointSource
  layerGuide: PointWorkflowLayerGuide
  count: number
  offset: number
  color?: ColorArray // webgl1
  radius?: number // webgl1
  stroke?: ColorArray // webgl1
  strokeWidth?: number // webgl1
  opacity?: number // webgl1
}

// ** RASTER **
export interface RasterFeature extends FeatureBase {
  type: 'raster'
  source: RasterSource
  layerGuide: RasterWorkflowLayerGuide
  fadeStartTime: number
  opacity?: number // webgl1
  contrast?: number // webgl1
  saturation?: number // webgl1
}

// ** HILLSHADE **
export interface HillshadeFeature extends FeatureBase {
  type: 'hillshade'
  source: RasterSource
  layerGuide: HillshadeWorkflowLayerGuide
  fadeStartTime: number
  opacity?: number // webgl1
  shadowColor?: ColorArray // webgl1
  accentColor?: ColorArray // webgl1
  highlightColor?: ColorArray // webgl1
  azimuth?: number // webgl1
  altitude?: number // webgl1
}

// ** SENSOR **
export interface SensorFeature extends FeatureBase {
  type: 'sensor'
  fadeStartTime: number
  layerGuide: SensorWorkflowLayerGuide
  getTextures: () => SensorTextureDefinition
  opacity?: number // webgl1
}

export interface ShadeFeature extends FeatureBase {
  type: 'shade'
  maskLayer: boolean
  source: MaskSource
  layerGuide: ShadeWorkflowLayerGuide
}

export type Features =
  FillFeature | GlyphFeature | HeatmapFeature |
  LineFeature | PointFeature | RasterFeature |
  SensorFeature | ShadeFeature | HillshadeFeature

export interface Workflows {
  fill?: FillWorkflow
  glyphFilter?: GlyphFilterWorkflow
  glyph?: GlyphWorkflow
  heatmap?: HeatmapWorkflow
  line?: LineWorkflow
  point?: PointWorkflow
  raster?: RasterWorkflow
  hillshade?: HillshadeWorkflow
  sensor?: SensorWorkflow
  shade?: ShadeWorkflow
  wallpaper?: WallpaperWorkflow
  skybox?: SkyboxWorkflow
  background?: WallpaperWorkflow | SkyboxWorkflow
}

export interface WorkflowImports {
  fill: () => Promise<FillWorkflow>
  glyphFilter: () => Promise<GlyphFilterWorkflow>
  glyph: () => Promise<GlyphWorkflow>
  heatmap: () => Promise<HeatmapWorkflow>
  hillshade: () => Promise<HillshadeWorkflow>
  line: () => Promise<LineWorkflow>
  point: () => Promise<PointWorkflow>
  raster: () => Promise<RasterWorkflow>
  sensor: () => Promise<{ default: (context: Context) => Promise<SensorWorkflow> }>
  shade: () => Promise<ShadeWorkflow>
  skybox: () => Promise<SkyboxWorkflow>
  wallpaper: () => Promise<WallpaperWorkflow>
}

export type WorkflowKey = keyof Workflows
export type WorkflowType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor' | 'shade' | 'skybox' | 'wallpaper'

export interface WorkflowSpec {
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  radii: boolean
  context: Context
  gl: WebGLRenderingContext | WebGL2RenderingContext
  type: 1 | 2
  glProgram: WebGLProgram
  updateColorBlindMode: null | ColorMode
  updateMatrix: null | Float32Array
  updateInputs: null | Float32Array
  updateAspect: null | Point
  curMode: number
  LCH?: boolean

  buildShaders: (vertex: ShaderSource, fragment: ShaderSource, attributeLocations?: AttributeLocations) => void
  setupUniforms: (uniforms: Uniforms) => void
  setupAttributes: (attributes: Attributes, attributeLocations: AttributeLocations) => void
  delete: () => void
  use: () => void
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: Point) => void
  flush: () => void
  // set uniforms:
  setTileUniforms: (tile: Tile) => void
  setDevicePixelRatio: (ratio: number) => void
  setColorBlindMode: (colorMode: ColorMode) => void
  setMatrix: (matrix: Float32Array) => void
  setInputs: (inputs: Float32Array) => void
  setAspect: (aspect: Point) => void
  setFaceST: (faceST: number[]) => void
  setTilePos: (bottomTop: Float32Array) => void
  setLayerCode: (layerCode: number[], lch: boolean) => void
  setInteractive: (interactive: boolean) => void
  setFeatureCode: (featureCode: number[]) => void
  setMode: (mode: number) => void
}

export interface FillWorkflow extends WorkflowSpec {
  uniforms: { [key in FillWorkflowUniforms]: WebGLUniformLocation }
  layerGuides: Map<number, FillWorkflowLayerGuide>

  buildMaskFeature: (maskLayer: FillDefinition, tile: Tile) => void
  buildSource: (fillData: FillData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillStyle) => FillDefinition
  draw: (featureGuide: FillFeature, interactive?: boolean) => void
  drawMask: (mask: MaskSource) => void
}

export interface GlyphFilterWorkflow extends WorkflowSpec {
  quadTexture: WebGLTexture
  resultTexture: WebGLTexture
  quadFramebuffer: WebGLFramebuffer
  resultFramebuffer: WebGLFramebuffer
  indexOffset: number
  mode: 1 | 2
  uniforms: { [key in GlyphFilterUniforms]: WebGLUniformLocation }

  resize: () => void
  setMode: (mode: number) => void
  bindResultTexture: () => void
  bindQuadFrameBuffer: () => void
  bindResultFramebuffer: () => void
  draw: (featureGuide: GlyphFeature, interactive: boolean) => void
}

export interface GlyphWorkflow extends WorkflowSpec {
  stepBuffer?: WebGLBuffer
  uvBuffer?: WebGLBuffer
  glyphFilterWorkflow: GlyphFilterWorkflow
  layerGuides: Map<number, GlyphWorkflowLayerGuide>
  uniforms: { [key in GlyphWorkflowUniforms]: WebGLUniformLocation }

  injectFilter: (glyphFilterWorkflow: GlyphFilterWorkflow) => void
  buildSource: (glyphData: GlyphData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphStyle) => GlyphDefinition
  draw: (featureGuide: GlyphFeature, interactive: boolean) => void
}

export interface HeatmapWorkflow extends WorkflowSpec {
  texture: WebGLTexture
  nullTextureA: WebGLTexture
  nullTextureB: WebGLTexture
  framebuffer: WebGLFramebuffer
  extentBuffer?: WebGLBuffer
  layerGuides: Map<number, HeatmapWorkflowLayerGuide>
  uniforms: { [key in HeatmapWorkflowUniforms]: WebGLUniformLocation }

  buildSource: (heatmapData: HeatmapData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapStyle) => HeatmapDefinition
  setupTextureDraw: () => void
  resize: () => void
  drawTexture: (featureGuide: HeatmapFeature) => void
  draw: (featureGuide: HeatmapFeature) => void
}

export interface LineWorkflow extends WorkflowSpec {
  curTexture: number
  typeBuffer?: WebGLBuffer
  layerGuides: Map<number, LineWorkflowLayerGuide>
  uniforms: { [key in LineWorkflowUniforms]: WebGLUniformLocation }

  buildSource: (lineData: LineData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineStyle) => LineDefinition
  draw: (featureGuide: LineFeature, interactive: boolean) => void
}

export interface PointWorkflow extends WorkflowSpec {
  extentBuffer?: WebGLBuffer
  layerGuides: Map<number, PointWorkflowLayerGuide>
  uniforms: { [key in PointWorkflowUniforms]: WebGLUniformLocation }

  buildSource: (pointData: PointData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointStyle) => PointDefinition
  draw: (featureGuide: PointFeature, interactive: boolean) => void
}

export interface RasterWorkflow extends WorkflowSpec {
  curSample: 'none' | 'linear' | 'nearest'
  layerGuides: Map<number, RasterWorkflowLayerGuide>
  uniforms: { [key in RasterWorkflowUniforms]: WebGLUniformLocation }

  buildSource: (rasterData: RasterData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterStyle) => RasterDefinition
  draw: (featureGuide: RasterFeature, interactive?: boolean) => void
}

export interface HillshadeWorkflow extends WorkflowSpec {
  layerGuides: Map<number, HillshadeWorkflowLayerGuide>
  uniforms: { [key in HillshadeWorkflowUniforms]: WebGLUniformLocation }

  buildSource: (hillshadeData: HillshadeData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HillshadeStyle) => HillshadeDefinition
  draw: (featureGuide: HillshadeFeature, interactive: boolean) => void
}

export interface SensorWorkflow extends WorkflowSpec {
  nullTexture: WebGLTexture
  timeCache?: TimeCache
  layerGuides: Map<number, SensorWorkflowLayerGuide>
  uniforms: { [key in SensorWorkflowUniforms]: WebGLUniformLocation }

  buildSource: (sensorData: SensorData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorStyle) => SensorDefinition
  injectTimeCache: (timeCache: TimeCache) => void
  draw: (featureGuide: SensorFeature, interactive: boolean) => void
}

export interface ShadeWorkflow extends WorkflowSpec {
  uniforms: { [key in ShadeWorkflowUniforms]: WebGLUniformLocation }

  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeStyle) => ShadeDefinition
  buildMaskFeature: (maskLayer: ShadeDefinition, tile: Tile) => void
  draw: (feature: ShadeFeature) => void
}

export interface SkyboxWorkflow extends Omit<WorkflowSpec, 'draw'> {
  cubeMap: WebGLTexture
  facesReady: number
  ready: boolean
  fov: number
  angle: number
  matrix: Float32Array
  uniforms: { [key in SkyboxWorkflowUniforms]: WebGLUniformLocation }

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI, urlMap?: Record<string, string>) => void
  draw: (projector: Projector) => void
}

export interface WallpaperWorkflow extends Omit<WorkflowSpec, 'draw'> {
  scheme: Scheme
  tileSize: number
  scale: Point
  uniforms: { [key in WallpaperWorkflowUniforms]: WebGLUniformLocation }

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI) => void
  draw: (projector: Projector) => void
}

export type Workflow =
  FillWorkflow | GlyphFilterWorkflow | GlyphWorkflow | HeatmapWorkflow |
  LineWorkflow | PointWorkflow | RasterWorkflow | HillshadeWorkflow | SensorWorkflow |
  ShadeWorkflow | SkyboxWorkflow | WallpaperWorkflow

export enum WorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uMode = 'uMode',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind'
}

export enum FillWorkflowUniforms {
  uMatrix = 'uMatrix',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uCBlind = 'uCBlind',
  uTexSize = 'uTexSize',
  uPatternXY = 'uPatternXY',
  uPatternWH = 'uPatternWH',
  uPatternMovement = 'uPatternMovement',
  uColors = 'uColors', // WEBGL1
  uOpacity = 'uOpacity' // WEBGL1
}

export enum GlyphFilterUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uMode = 'uMode',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uIndexOffset = 'uIndexOffset',
  uSize = 'uSize' // WEBGL1
}

export enum GlyphWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uOverdraw = 'uOverdraw',
  uTexSize = 'uTexSize',
  uIsIcon = 'uIsIcon',
  uBounds = 'uBounds',
  uIsStroke = 'uIsStroke',
  uFeatures = 'uFeatures',
  uGlyphTex = 'uGlyphTex',
  uSize = 'uSize', // WEBGL1
  uFill = 'uFill', // WEBGL1
  uStroke = 'uStroke', // WEBGL1
  uSWidth = 'uSWidth' // WEBGL1
}

export enum HeatmapWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uIntensityHi = 'uIntensityHi',
  uDrawState = 'uDrawState',
  uImage = 'uImage',
  uColorRamp = 'uColorRamp',
  uBounds = 'uBounds',
  uRadiusLo = 'uRadiusLo', // WEBGL1
  uOpacityLo = 'uOpacityLo', // WEBGL1
  uIntensityLo = 'uIntensityLo', // WEBGL1
  uRadiusHi = 'uRadiusHi', // WEBGL1
  uOpacityHi = 'uOpacityHi' // WEBGL1
}

export enum LineWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uCap = 'uCap',
  uDashed = 'uDashed',
  uDashCount = 'uDashCount',
  uDashArray = 'uDashArray',
  uSize = 'uSize', // WEBGL1
  uColor = 'uColor', // WEBGL1
  uOpacity = 'uOpacity', // WEBGL1
  uWidth = 'uWidth', // WEBGL1
  uTexLength = 'uTexLength' // WEBGL1
}

export enum PointWorkflowUniforms {
  uMatrix = 'uMatrix',
  uAspect = 'uAspect',
  uMode = 'uMode',
  uLCH = 'uLCH',
  uInteractive = 'uInteractive',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uInputs = 'uInputs',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uCBlind = 'uCBlind',
  uColor = 'uColor',
  uRadius = 'uRadius',
  uStroke = 'uStroke',
  uSWidth = 'uSWidth',
  uOpacity = 'uOpacity',
  uBounds = 'uBounds'
}

export enum RasterWorkflowUniforms {
  uMatrix = 'uMatrix',
  uInputs = 'uInputs',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uCBlind = 'uCBlind',
  uFade = 'uFade',
  uTexture = 'uTexture',
  uOpacity = 'uOpacity', // WEBGL1
  uSaturation = 'uSaturation', // WEBGL1
  uContrast = 'uContrast' // WEBGL1
}

export enum HillshadeWorkflowUniforms {
  uMatrix = 'uMatrix',
  uInputs = 'uInputs',
  uLCH = 'uLCH',
  uFaceST = 'uFaceST',
  uBottom = 'uBottom',
  uTop = 'uTop',
  uLayerCode = 'uLayerCode',
  uFeatureCode = 'uFeatureCode',
  uCBlind = 'uCBlind',
  uFade = 'uFade',
  uTexture = 'uTexture',
  uUnpack = 'uUnpack',
  uOpacity = 'uOpacity', // WEBGL1
  uShadowColor = 'uShadowColor', // WEBGL1
  uHighlightColor = 'uHighlightColor', // WEBGL1
  uAccentColor = 'uAccentColor', // WEBGL1
  uAzimuth = 'uAzimuth', // WEBGL1
  uAltitude = 'uAltitude', // WEBGL1
  uTexLength = 'uTexLength' // WEBGL1
}

export enum SensorWorkflowUniforms {
  uBottom = 'uBottom',
  uCBlind = 'uCBlind',
  uFaceST = 'uFaceST',
  uFeatureCode = 'uFeatureCode',
  uInputs = 'uInputs',
  uLCH = 'uLCH',
  uLayerCode = 'uLayerCode',
  uMatrix = 'uMatrix',
  uTop = 'uTop',
  uColorRamp = 'uColorRamp',
  uImage = 'uImage',
  uNextImage = 'uNextImage',
  uTime = 'uTime',
  uOpacity = 'uOpacity' // WEBGL1
}

export enum ShadeWorkflowUniforms {
  uAspect = 'uAspect',
  uMatrix = 'uMatrix',
  uFaceST = 'uFaceST',
  uInputs = 'uInputs',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uBottom = 'uBottom',
  uTop = 'uTop',
}

export enum SkyboxWorkflowUniforms {
  uMatrix = 'uMatrix',
  uSkybox = 'uSkybox'
}

export enum WallpaperWorkflowUniforms {
  uScale = 'uScale',
  uBackground = 'uBackground',
  uHalo = 'uHalo',
  uFade1 = 'uFade1',
  uFade2 = 'uFade2'
}

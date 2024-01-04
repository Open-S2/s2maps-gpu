import type { ColorMode } from 's2Map'
import type { TileGL as Tile } from 'source/tile.spec'
import type {
  FillLayerDefinition,
  FillLayerStyle,
  FillWorkflowLayerGuide,
  GlyphLayerDefinition,
  GlyphLayerStyle,
  GlyphWorkflowLayerGuide,
  HeatmapLayerDefinition,
  HeatmapLayerStyle,
  HeatmapWorkflowLayerGuide,
  HillshadeLayerDefinition,
  HillshadeLayerStyle,
  HillshadeWorkflowLayerGuide,
  LayerDefinitionBase,
  LineLayerDefinition,
  LineLayerStyle,
  LineWorkflowLayerGuide,
  PointLayerDefinition,
  PointLayerStyle,
  PointWorkflowLayerGuide,
  RasterLayerDefinition,
  RasterLayerStyle,
  RasterWorkflowLayerGuide,
  SensorLayerDefinition,
  SensorLayerStyle,
  SensorWorkflowLayerGuide,
  ShadeLayerDefinition,
  ShadeLayerStyle,
  StyleDefinition
} from 'style/style.spec'
import type Projector from 'ui/camera/projector'
import type S2MapUI from 'ui/s2mapUI'
import type TimeCache from 'ui/camera/timeCache'
import type { Scheme } from './wallpaperProgram'
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
import type {
  Context,
  FillFeatureGuide,
  GlyphFeatureGuide,
  HeatmapFeatureGuide,
  HillshadeFeatureGuide,
  LineFeatureGuide,
  MaskSource,
  PointFeatureGuide,
  RasterFeatureGuide,
  SensorFeatureGuide,
  ShadeFeatureGuide
} from '../contexts/context.spec'

export type Uniforms = Record<string, string>

export type Attributes = Record<string, string>

export type AttributeLocations = Record<string, number>

export interface ShaderSource {
  source: string
  uniforms: Uniforms
  attributes: Attributes
}

export interface Workflows {
  fill?: FillProgram
  glyphFilter?: GlyphFilterProgram
  glyph?: GlyphProgram
  heatmap?: HeatmapProgram
  line?: LineProgram
  point?: PointProgram
  raster?: RasterProgram
  hillshade?: HillshadeProgram
  sensor?: SensorProgram
  shade?: ShadeProgram
  wallpaper?: WallpaperProgram
  skybox?: SkyboxProgram
  background?: WallpaperProgram | SkyboxProgram
}

export interface WorkflowImports {
  fill: () => Promise<{ default: (context: Context) => Promise<FillProgram> }>
  glyphFilter: () => Promise<{ default: (context: Context) => Promise<GlyphFilterProgram> }>
  glyph: () => Promise<{ default: (context: Context) => Promise<GlyphProgram> }>
  heatmap: () => Promise<{ default: (context: Context) => Promise<HeatmapProgram> }>
  line: () => Promise<{ default: (context: Context) => Promise<LineProgram> }>
  point: () => Promise<{ default: (context: Context) => Promise<PointProgram> }>
  raster: () => Promise<{ default: (context: Context) => Promise<RasterProgram> }>
  hillshade: () => Promise<{ default: (context: Context) => Promise<HillshadeProgram> }>
  sensor: () => Promise<{ default: (context: Context) => Promise<SensorProgram> }>
  shade: () => Promise<{ default: (context: Context) => Promise<ShadeProgram> }>
  wallpaper: () => Promise<{ default: (context: Context) => Promise<WallpaperProgram> }>
  skybox: () => Promise<{ default: (context: Context) => Promise<SkyboxProgram> }>
}

export type WorkflowKey = keyof Workflows
export type WorkflowType = 'fill' | 'glyph' | 'heatmap' | 'line' | 'point' | 'raster' | 'hillshade' | 'sensor' | 'shade' | 'skybox' | 'wallpaper'

export interface ProgramSpec {
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
  updateAspect: null | [number, number]
  curMode: number
  LCH?: boolean

  buildShaders: (vertex: ShaderSource, fragment: ShaderSource, attributeLocations?: AttributeLocations) => void
  setupUniforms: (uniforms: Uniforms) => void
  setupAttributes: (attributes: Attributes, attributeLocations: AttributeLocations) => void
  delete: () => void
  use: () => void
  injectFrameUniforms: (matrix: Float32Array, view: Float32Array, aspect: [number, number]) => void
  flush: () => void
  // set uniforms:
  setTileUniforms: (tile: Tile) => void
  setDevicePixelRatio: (ratio: number) => void
  setColorBlindMode: (colorMode: ColorMode) => void
  setMatrix: (matrix: Float32Array) => void
  setInputs: (inputs: Float32Array) => void
  setAspect: (aspect: [number, number]) => void
  setFaceST: (faceST: number[]) => void
  setTilePos: (bottomTop: Float32Array) => void
  setLayerCode: (layerCode: number[], lch: boolean) => void
  setInteractive: (interactive: boolean) => void
  setFeatureCode: (featureCode: number[]) => void
  setMode: (mode: number) => void
}

export interface FillProgram extends ProgramSpec {
  uniforms: { [key in FillProgramUniforms]: WebGLUniformLocation }
  layerGuides: Map<number, FillWorkflowLayerGuide>

  buildMaskFeature: (maskLayer: FillLayerDefinition, tile: Tile) => void
  buildSource: (fillData: FillData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: FillLayerStyle) => FillLayerDefinition
  draw: (featureGuide: FillFeatureGuide, interactive: boolean) => void
  drawMask: (mask: MaskSource) => void
}

export interface GlyphFilterProgram extends ProgramSpec {
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
  draw: (featureGuide: GlyphFeatureGuide, interactive: boolean) => void
}

export interface GlyphProgram extends ProgramSpec {
  stepBuffer?: WebGLBuffer
  uvBuffer?: WebGLBuffer
  glyphFilterProgram: GlyphFilterProgram
  layerGuides: Map<number, GlyphWorkflowLayerGuide>
  uniforms: { [key in GlyphProgramUniforms]: WebGLUniformLocation }

  injectFilter: (glyphFilterProgram: GlyphFilterProgram) => void
  buildSource: (glyphData: GlyphData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: GlyphLayerStyle) => GlyphLayerDefinition
  draw: (featureGuide: GlyphFeatureGuide, interactive: boolean) => void
}

export interface HeatmapProgram extends ProgramSpec {
  texture: WebGLTexture
  nullTextureA: WebGLTexture
  nullTextureB: WebGLTexture
  framebuffer: WebGLFramebuffer
  extentBuffer?: WebGLBuffer
  layerGuides: Map<number, HeatmapWorkflowLayerGuide>
  uniforms: { [key in HeatmapProgramUniforms]: WebGLUniformLocation }

  buildSource: (heatmapData: HeatmapData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HeatmapLayerStyle) => HeatmapLayerDefinition
  setupTextureDraw: () => void
  resize: () => void
  drawTexture: (featureGuide: HeatmapFeatureGuide) => void
  draw: (featureGuide: HeatmapFeatureGuide) => void
}

export interface LineProgram extends ProgramSpec {
  curTexture: number
  typeBuffer?: WebGLBuffer
  layerGuides: Map<number, LineWorkflowLayerGuide>
  uniforms: { [key in LineProgramUniforms]: WebGLUniformLocation }

  buildSource: (lineData: LineData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: LineLayerStyle) => LineLayerDefinition
  draw: (featureGuide: LineFeatureGuide, interactive: boolean) => void
}

export interface PointProgram extends ProgramSpec {
  extentBuffer?: WebGLBuffer
  layerGuides: Map<number, PointWorkflowLayerGuide>
  uniforms: { [key in PointProgramUniforms]: WebGLUniformLocation }

  buildSource: (pointData: PointData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: PointLayerStyle) => PointLayerDefinition
  draw: (featureGuide: PointFeatureGuide, interactive: boolean) => void
}

export interface RasterProgram extends ProgramSpec {
  curSample: 'none' | 'linear' | 'nearest'
  layerGuides: Map<number, RasterWorkflowLayerGuide>
  uniforms: { [key in RasterProgramUniforms]: WebGLUniformLocation }

  buildSource: (rasterData: RasterData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: RasterLayerStyle) => RasterLayerDefinition
  draw: (featureGuide: RasterFeatureGuide, interactive: boolean) => void
}

export interface HillshadeProgram extends ProgramSpec {
  layerGuides: Map<number, HillshadeWorkflowLayerGuide>
  uniforms: { [key in HillshadeProgramUniforms]: WebGLUniformLocation }

  buildSource: (hillshadeData: HillshadeData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: HillshadeLayerStyle) => HillshadeLayerDefinition
  draw: (featureGuide: HillshadeFeatureGuide, interactive: boolean) => void
}

export interface SensorProgram extends ProgramSpec {
  nullTexture: WebGLTexture
  timeCache?: TimeCache
  layerGuides: Map<number, SensorWorkflowLayerGuide>
  uniforms: { [key in SensorProgramUniforms]: WebGLUniformLocation }

  buildSource: (sensorData: SensorData, tile: Tile) => void
  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: SensorLayerStyle) => SensorLayerDefinition
  injectTimeCache: (timeCache: TimeCache) => void
  draw: (featureGuide: SensorFeatureGuide, interactive: boolean) => void
}

export interface ShadeProgram extends ProgramSpec {
  uniforms: { [key in ShadeProgramUniforms]: WebGLUniformLocation }

  buildLayerDefinition: (layerBase: LayerDefinitionBase, layer: ShadeLayerStyle) => ShadeLayerDefinition
  buildMaskFeature: (maskLayer: ShadeLayerDefinition, tile: Tile) => void
  draw: (feature: ShadeFeatureGuide) => void
}

export interface SkyboxProgram extends ProgramSpec {
  cubeMap: WebGLTexture
  facesReady: number
  renderable: boolean
  fov: number
  angle: number
  matrix: Float32Array
  uniforms: { [key in SkyboxProgramUniforms]: WebGLUniformLocation }

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI) => void
  draw: (projector: Projector) => void
}

export interface WallpaperProgram extends ProgramSpec {
  scheme: Scheme
  tileSize: number
  scale: [number, number]
  uniforms: { [key in WallpaperProgramUniforms]: WebGLUniformLocation }

  updateStyle: (style: StyleDefinition, s2mapGL: S2MapUI) => void
  draw: (projector: Projector) => void
}

export type Program =
  FillProgram | GlyphFilterProgram | GlyphProgram | HeatmapProgram |
  LineProgram | PointProgram | RasterProgram | HillshadeProgram | SensorProgram |
  ShadeProgram | SkyboxProgram | WallpaperProgram

export enum ProgramUniforms {
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

export enum FillProgramUniforms {
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

export enum GlyphProgramUniforms {
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

export enum HeatmapProgramUniforms {
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

export enum LineProgramUniforms {
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

export enum PointProgramUniforms {
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

export enum RasterProgramUniforms {
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

export enum HillshadeProgramUniforms {
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

export enum SensorProgramUniforms {
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

export enum ShadeProgramUniforms {
  uAspect = 'uAspect',
  uMatrix = 'uMatrix',
  uFaceST = 'uFaceST',
  uInputs = 'uInputs',
  uDevicePixelRatio = 'uDevicePixelRatio',
  uBottom = 'uBottom',
  uTop = 'uTop',
}

export enum SkyboxProgramUniforms {
  uMatrix = 'uMatrix',
  uSkybox = 'uSkybox'
}

export enum WallpaperProgramUniforms {
  uScale = 'uScale',
  uBackground = 'uBackground',
  uHalo = 'uHalo',
  uFade1 = 'uFade1',
  uFade2 = 'uFade2'
}

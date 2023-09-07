import type { TileGPU as Tile } from 's2/source/tile.spec'
import WebGPUContext from './context'
import type { GPUType } from 's2/style/style.spec'

export interface MaskSource {
  type: 'mask'
  vertexArray: Int16Array
  indexArray: Uint32Array
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  count: number
  offset: number
  vao: WebGLVertexArrayObject
}

export interface FeatureGuideBase {
  // TODO:
  type: any
  tile: Tile
  parent?: Tile
  layerIndex: number
  sourceName: string
  layerCode: number[]
  lch: boolean
  opaque?: boolean
  interactive?: boolean
  featureCode: number[] // webgl2
}

export interface FeatureGuide extends FeatureGuideBase {}

/* CONTEXTS */

export interface Context {
  gpu: WebGPUContext
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

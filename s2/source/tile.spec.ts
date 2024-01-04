import type {
  FeatureGuide as FeatureGuideGL,
  MaskSource as MaskSourceGL,
  Context as WebGLContext
} from 'gl/contexts/context.spec'
import type WebGPUContext from 'gpu/context/context'
import type {
  Features as FeaturesGPU,
  TileMaskSource as MaskSourceGPU
} from 'gpu/workflows/workflow.spec'
import type { BBox, Face, XYZ } from 'geometry'
import type { FlushData, InteractiveObject } from 'workers/worker.spec'
import type { LayerDefinition } from 'style/style.spec'
import type Projector from 'ui/camera/projector'

export interface Corners {
  topLeft: XYZ
  topRight: XYZ
  bottomLeft: XYZ
  bottomRight: XYZ
}

// gets all viable keys from all interfaces in a union.
export type AllKeysOf<T> = T extends any ? keyof T : never
// basically does T[K] but when T is a union it only gives T[K] for the members of the union for which it is a valid key.
export type Get<T, K extends keyof any, Fallback=undefined> = T extends Record<K, any> ? T[K] : Fallback
// takes a union of interfaces and merges them so that any common key is a union of possibilities.
export type Combine<T> = { [K in AllKeysOf<T>]: Get<T, K> }

export type SharedContext = Combine<WebGLContext | WebGPUContext>
export type SharedFeatureGuide = Combine<FeatureGuideGL | FeaturesGPU>
export type SharedMaskSource = Combine<MaskSourceGL | MaskSourceGPU>

export type FaceST = [face: number, zoom: number, sLow: number, deltaS: number, tLow: number, deltaT: number]
// export type Bottom = [bottomLeftX: number, bottomLeftY: number, bottomRightX: number, bottomRightY: number]
// export type Top = [topLeftX: number, topLeftY: number, topRightX: number, topRightY: number]

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously build spherical background
// data to ensure we get no awkward visuals.

export interface TileBase<C, F, M> {
  id: bigint
  face: Face
  i: number
  j: number
  zoom: number
  bbox: BBox
  division: number
  tmpMaskID: number
  interactiveGuide: Map<number, InteractiveObject>
  uniforms: Float32Array
  rendered: boolean
  bottomTop: Float32Array
  state: 'loading' | 'loaded' | 'deleted'
  type: 'S2' | 'WM'
  // S2 specific features
  faceST: FaceST
  corners?: Corners
  // WM specific features
  matrix: Float32Array

  context: C
  featureGuides: F[]
  mask: M

  flush: (data: FlushData) => void
  removeLayer: (index: number) => void
  reorderLayers: (layerChanges: Record<number, number>) => void

  // we don't parse the interactiveData immediately to save time
  injectInteractiveData: (
    interactiveGuide: Uint32Array,
    interactiveData: Uint8Array
  ) => void

  getInteractiveFeature: (id: number) => undefined | InteractiveObject

  injectParentTile: (parent: TileBase<C, F, M>, layers: LayerDefinition[]) => void
  // given a matrix, compute the corners screen positions
  setScreenPositions: (projector: Projector) => void
  addFeatures: (features: F[]) => void

  // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
  delete: () => void
  deleteSources: (sourceNames: string[]) => void
}

export type Tile = TileBase<SharedContext, SharedFeatureGuide, SharedMaskSource>
export type TileGL = TileBase<WebGLContext, FeatureGuideGL, MaskSourceGL>
export type TileGPU = TileBase<WebGPUContext, FeaturesGPU, MaskSourceGPU>
export type TileShared = TileGL & TileGPU

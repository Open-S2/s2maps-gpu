import type {
  Context as ContextGL,
  FeatureGuide as FeatureGuideGL,
  MaskSource as MaskSourceGL
} from 'gl/contexts/context.spec'
import type {
  Context as ContextGPU,
  FeatureGuide as FeatureGuideGPU,
  MaskSource as MaskSourceGPU
} from 'gpu/context/context.spec'
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

export type FaceST = [face: number, zoom: number, sLow: number, deltaS: number, tLow: number, deltaT: number]
export type Bottom = [bottomLeftX: number, bottomLeftY: number, bottomRightX: number, bottomRightY: number]
export type Top = [topLeftX: number, topLeftY: number, topRightX: number, topRightY: number]

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously build spherical background
// data to ensure we get no awkward visuals.

export interface TileBase {
  id: bigint
  face: Face
  i: number
  j: number
  zoom: number
  size: number
  bbox: BBox
  division: number
  tmpMaskID: number
  interactiveGuide: Map<number, InteractiveObject>
  rendered: boolean

  flush: (data: FlushData) => void
  removeLayer: (index: number) => void
  reorderLayers: (layerChanges: Record<number, number>) => void

  // we don't parse the interactiveData immediately to save time
  injectInteractiveData: (
    interactiveGuide: Uint32Array,
    interactiveData: Uint8Array
  ) => void

  getInteractiveFeature: (id: number) => undefined | InteractiveObject

  // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
  delete: () => void
  deleteSources: (sourceNames: string[]) => void
}

export interface TileGLBase extends TileBase {
  mask: MaskSourceGL
  featureGuides: FeatureGuideGL[]
  context: ContextGL

  injectParentTile: (parent: TileGLBase, layers: LayerDefinition[]) => void
  // given a matrix, compute the corners screen positions
  setScreenPositions: (projector: Projector) => void
  addFeatures: (features: FeatureGuideGL[]) => void
}

export interface TileGPUBase extends TileBase {
  mask: MaskSourceGPU
  featureGuides: FeatureGuideGPU[]
  context: ContextGPU

  injectParentTile: (parent: TileGPUBase, layers: LayerDefinition[]) => void
  // given a matrix, compute the corners screen positions
  setScreenPositions: (projector: Projector) => void
  addFeatures: (features: FeatureGuideGPU[]) => void
}

export interface S2Tile extends TileBase {
  type: 'S2'
  faceST: FaceST
  corners?: Corners
  bottom: Bottom
  top: Top
}
export interface S2TileGL extends S2Tile, TileGLBase {}
export interface S2TileGPU extends S2Tile, TileGPUBase {}

export interface WMTile extends TileBase {
  type: 'WM'
  matrix: Float32Array
}
export interface WMTileGL extends WMTile, TileGLBase {}
export interface WMTileGPU extends WMTile, TileGPUBase {}

export type Tile = S2Tile | WMTile
export type TileGL = S2TileGL | WMTileGL
export type TileGPU = S2TileGPU | WMTileGPU

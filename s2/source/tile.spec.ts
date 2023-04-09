import type { FeatureGuide, MaskSource as GLMaskSource, WebGL2Context, WebGLContext } from 's2/gl/contexts'
import type Projector from 's2/ui/camera/projector'
import type { Face, XYZ } from 's2/geometry'
import type { FlushData, InteractiveObject } from 's2/workers/worker.spec'
import type { LayerDefinition } from 's2/style/style.spec'
import type { MaskSource as GPUMaskSource, WebGPUContext } from 's2/gpu/context'

export interface Corners {
  topLeft: XYZ
  topRight: XYZ
  bottomLeft: XYZ
  bottomRight: XYZ
}

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously build spherical background
// data to ensure we get no awkward visuals.
export interface TileGL {
  id: bigint
  face: Face
  i: number
  j: number
  zoom: number
  size: number
  tmpMaskID: number
  mask: GLMaskSource
  bbox: [number, number, number, number]
  faceST: [number, number, number, number, number, number]
  corners?: Corners
  bottom: [number, number, number, number]
  top: [number, number, number, number]
  division: number
  featureGuides: FeatureGuide[]
  context: WebGLContext | WebGL2Context
  interactiveGuide: Map<number, InteractiveObject>
  rendered: boolean

  injectParentTile: (parent: TileGL, layers: LayerDefinition[]) => void
  // given a matrix, compute the corners screen positions
  setScreenPositions: (projector: Projector) => void
  addFeatures: (features: FeatureGuide[]) => void
  flush: (data: FlushData) => void
  removeLayer: (index: number) => void
  reorderLayers: (layerChanges: { [key: number]: number }) => void

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

export interface TileGPU {
  id: bigint
  face: Face
  i: number
  j: number
  zoom: number
  size: number
  tmpMaskID: number
  mask: GPUMaskSource
  bbox: [number, number, number, number]
  faceST: [number, number, number, number, number, number]
  corners?: Corners
  bottom: [number, number, number, number]
  top: [number, number, number, number]
  division: number
  featureGuides: FeatureGuide[]
  context: WebGPUContext
  interactiveGuide: Map<number, InteractiveObject>
  rendered: boolean

  injectParentTile: (parent: TileGL, layers: LayerDefinition[]) => void
  // given a matrix, compute the corners screen positions
  setScreenPositions: (projector: Projector) => void
  addFeatures: (features: FeatureGuide[]) => void
  flush: (data: FlushData) => void
  removeLayer: (index: number) => void
  reorderLayers: (layerChanges: { [key: number]: number }) => void

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

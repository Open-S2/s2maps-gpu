import type { LayerDefinition } from 'style/style.spec.js';
import type Projector from 'ui/camera/projector/index.js';
import type WebGLContext from 'gl/context/context.js';
import type WebGPUContext from 'gpu/context/context.js';
import type { BBox, Face, VectorPoint } from 'gis-tools/index.js';
import type {
  Features as FeaturesGL,
  TileMaskSource as MaskSourceGL,
} from 'gl/workflows/workflow.spec.js';
import type {
  Features as FeaturesGPU,
  TileMaskSource as MaskSourceGPU,
} from 'gpu/workflows/workflow.spec.js';
import type {
  InteractiveObject,
  SourceFlushMessage,
  TileFlushMessage,
} from 'workers/worker.spec.js';

/** A tile's 4 corners. */
export interface Corners {
  topLeft: VectorPoint;
  topRight: VectorPoint;
  bottomLeft: VectorPoint;
  bottomRight: VectorPoint;
}

/** gets all viable keys from all interfaces in a union. */
export type AllKeysOf<T> = T extends unknown ? keyof T : never;
// basically does T[K] but when T is a union it only gives T[K] for the members of the union for which it is a valid key.

/** Allows a type to be extracted from a union. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Get<T, K extends keyof any, Fallback = undefined> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<K, any> ? T[K] : Fallback;
/** takes a union of interfaces and merges them so that any common key is a union of possibilities. */
export type Combine<T> = { [K in AllKeysOf<T>]: Get<T, K> };

/** Shared Context found in both WebGLContext and WebGPUContext. */
export type SharedContext = Combine<WebGLContext | WebGPUContext>;
/** Shared Features found in both WebGLContext and WebGPUContext. */
export type SharedFeatures = Combine<FeaturesGL | FeaturesGPU>;
/** Shared MaskSource found in both WebGLContext and WebGPUContext. */
export type SharedMaskSource = Combine<MaskSourceGL | MaskSourceGPU>;

/** A FaceST that will be encoded into the GPU */
export type FaceST = [
  face: number,
  zoom: number,
  sLow: number,
  deltaS: number,
  tLow: number,
  deltaT: number,
];

/**
 * # Tile Base Interface
 *
 * tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
 * whenever rerenders are called, they will access these tile objects for the layer data / (vaos/bindgroups)
 * before managing sources asyncronously, a tile needs to synchronously build spherical background
 * data to ensure we get no awkward visuals.
 */
export interface TileBase<C, F, M> {
  id: bigint;
  face: Face;
  i: number;
  j: number;
  zoom: number;
  bbox: BBox;
  division: number;
  tmpMaskID: number;
  interactiveGuide: Map<number, InteractiveObject>;
  uniforms: Float32Array;
  bottomTop: Float32Array;
  state: 'loading' | 'loaded' | 'deleted';
  type: 'S2' | 'WG';
  // S2 specific features
  faceST: FaceST;
  corners?: Corners;
  // WM specific features
  outofBounds: boolean;
  dependents: Array<TileBase<C, F, M>>;
  matrix: Float32Array;

  context: C;
  featureGuides: F[];
  mask: M;

  layersLoaded: Set<number>;
  layersToBeLoaded?: Set<number>;

  flush: (data: TileFlushMessage | SourceFlushMessage) => void;
  deleteLayer: (index: number) => void;
  reorderLayers: (layerChanges: Record<number, number>) => void;

  // we don't parse the interactiveData immediately to save time
  injectInteractiveData: (interactiveGuide: Uint32Array, interactiveData: Uint8Array) => void;

  getInteractiveFeature: (id: number) => undefined | InteractiveObject;

  injectParentTile: (parent: TileBase<C, F, M>, layers: LayerDefinition[]) => void;
  injectWrappedTile: (wrapped: TileBase<C, F, M>) => void;
  // given a matrix, compute the corners screen positions
  setScreenPositions: (projector: Projector) => void;
  addFeatures: (features: F[]) => void;

  // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
  delete: () => void;
  deleteSources: (sourceNames: string[]) => void;
}

/** TileBase with shared context. */
export type Tile = TileBase<SharedContext, SharedFeatures, SharedMaskSource>;
/** TileGL context */
export type TileGL = TileBase<WebGLContext, FeaturesGL, MaskSourceGL>;
/** TileGPU context */
export type TileGPU = TileBase<WebGPUContext, FeaturesGPU, MaskSourceGPU>;
/** Shared context found in both WebGLContext and WebGPUContext. */
export type TileShared = TileGL & TileGPU;

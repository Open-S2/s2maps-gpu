// import type { DOMContext } from 'dom/context.js';
// import type { LayerDefinition } from 'style/style.spec.js';
// import type WebGLContext from 'gl/context/context.js';
// import type WebGPUContext from 'gpu/context/context.js';
// import type { BBox, Face, S2CellId, VectorPoint } from 'gis-tools/index.js';
// import type {
//   Features as FeaturesDOM,
//   TileMaskSource as MaskSourceDOM,
// } from 'dom/workflows/workflow.spec.js';
// import type {
//   Features as FeaturesGL,
//   TileMaskSource as MaskSourceGL,
// } from 'gl/workflows/workflow.spec.js';
// import type {
//   Features as FeaturesGPU,
//   TileMaskSource as MaskSourceGPU,
// } from 'gpu/workflows/workflow.spec.js';
// import type {
//   InteractiveObject,
//   SourceFlushMessage,
//   TileFlushMessage,
// } from 'workers/worker.spec.js';
// import type { Projector, TmpWMID } from 'ui/camera/projector/index.js';

use crate::ui::Vec4;
use bytemuck::{Pod, Zeroable};

/// A tile's 4 corners.
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
pub struct Corners {
    pub top_left: Vec4,
    pub top_right: Vec4,
    pub bottom_left: Vec4,
    pub bottom_right: Vec4,
}

/// A FaceST that will be encoded into the GPU
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
pub struct FaceST {
    pub face: f64,
    pub zoom: f64,
    pub s_low: f64,
    pub delta_s: f64,
    pub t_low: f64,
    pub delta_t: f64,
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub enum TileState {
    #[default]
    Loading,
    Loaded,
    Deleted,
}

/**
 * # Tile Base Interface
 *
 * tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
 * whenever rerenders are called, they will access these tile objects for the layer data / (vaos/bindgroups)
 * before managing sources asyncronously, a tile needs to synchronously build spherical background
 * data to ensure we get no awkward visuals.
 */
pub trait TileBase {
    //   id: S2CellId;
    //   face: Face;
    //   i: number;
    //   j: number;
    //   zoom: number;
    //   bbox: BBox;
    //   division: number;
    //   tmpMaskID: number;
    //   interactiveGuide: Map<number, InteractiveObject>;
    //   uniforms: Float32Array;
    //   bottomTop: Float32Array;
    fn state(&self) -> TileState;
    //   type: 'S2' | 'WM';
    //   // S2 specific features
    //   faceST: FaceST;
    //   corners?: Corners;
    //   // WM specific features
    //   wrappedID?: TmpWMID;
    //   dependents: Array<TileBase<C, F, M>>;
    //   matrix: Float32Array;

    //   context: Context;
    //   featureGuides: Feature[];
    //   mask: Mask;

    //   layersLoaded: Set<number>;
    //   layersToBeLoaded?: Set<number>;

    //   flush: (data: TileFlushMessage | SourceFlushMessage) => void;
    //   deleteLayer: (index: number) => void;
    //   reorderLayers: (layerChanges: Record<number, number>) => void;

    //   // we don't parse the interactiveData immediately to save time
    //   injectInteractiveData: (interactiveGuide: Uint32Array, interactiveData: Uint8Array) => void;

    //   getInteractiveFeature: (id: number) => undefined | InteractiveObject;

    //   injectParentTile: (parent: TileBase<C, F, M>, layers: LayerDefinition[]) => void;
    //   injectWrappedTile: (wrapped: TileBase<C, F, M>) => void;
    //   // given a matrix, compute the corners screen positions
    //   set_screen_positions: (projector: Projector) => void;
    //   addFeatures: (features: F[]) => void;

    //   // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
    //   delete: () => void;
    //   deleteSources: (sourceNames: string[]) => void;
}

// /** TileBase with shared context. */
// export type Tile = TileBase<SharedContext, SharedFeatures, SharedMaskSource>;
// /** TileDOM context */
// export type TileDOM = TileBase<DOMContext, FeaturesDOM, MaskSourceDOM>;
// /** TileGL context */
// export type TileGL = TileBase<WebGLContext, FeaturesGL, MaskSourceGL>;
// /** TileGPU context */
// export type TileGPU = TileBase<WebGPUContext, FeaturesGPU, MaskSourceGPU>;
// /** Shared context found in both WebGLContext and WebGPUContext. */
// export type TileShared = TileGL & TileGPU & TileDOM;

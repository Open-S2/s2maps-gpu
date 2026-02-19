// import { earclip } from 'earclip';
// import parseFeature from 's2/style/parseFeature.js';
// import parseFilter from 'style/parseFilter.js';
// import VectorWorker, { colorFunc, idToRGB } from './vectorWorker.js';
// import { featureSort, scaleShiftClipPolys } from './util/index.js';

// import type { CodeDesign } from './vectorWorker.js';
// import type ImageStore from './image_store.js';
// import type { S2CellId } from 'gis-tools/index.js';
// import type { FillData, TileRequest } from '../worker.spec.js';
// import type { FillDefinition, FillWorkerLayer, GPUType } from 'style/style.spec.js';
// import type {
//   FillFeature,
//   FillWorker as FillWorkerSpec,
//   IDGen,
//   VTFeature,
// } from './process.spec.js';

use crate::{
    style::{FillDefinition, FillWorkerLayer, GPUType},
    workers::{FillFeature, IDGen, ImageStore, MapID, TileRequest, VectorWorker},
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use gistools::geometry::S2CellId;
use open_vector_tile::VectorFeature;

/// Maximum number of features to process at once for Fill type
pub const MAX_FEATURE_BATCH_SIZE: usize = 1 << 6; // 64

/** Worker for processing fill data */
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct FillWorker {
    pub base: VectorWorker,
    /// tile_id -> features
    pub feature_store: BTreeMap<String, Vec<FillFeature>>,
    pub invert_layers: BTreeMap<u32, FillWorkerLayer>,
    pub image_store: Rc<RefCell<ImageStore>>,
}
impl FillWorker {
    /**
     * @param id_gen - id generator to ensure features don't overlap
     * @param gpu_type - the GPU context of the map renderer (WebGL(1|2) | WebGPU)
     * @param image_store - the image store to pull/request the needed pattern images
     */
    pub fn new(
        id_gen: Rc<RefCell<IDGen>>,
        gpu_type: GPUType,
        image_store: Rc<RefCell<ImageStore>>,
    ) -> FillWorker {
        FillWorker {
            base: VectorWorker::new(id_gen, gpu_type),
            feature_store: BTreeMap::new(),
            invert_layers: BTreeMap::new(),
            image_store,
        }
    }

    /**
     * Setup a fill layer for processing
     * @param fill_layer - the fill layer
     * @returns the worker layer to process future fill data
     */
    pub fn setup_layer(&self, fill_layer: &FillDefinition) -> FillWorkerLayer {
        //     const {
        //       name,
        //       layerIndex,
        //       source,
        //       layer,
        //       minzoom,
        //       maxzoom,
        //       pattern,
        //       patternFamily,
        //       patternMovement,
        //       filter,
        //       color,
        //       opacity,
        //       invert,
        //       interactive,
        //       cursor,
        //       opaque,
        //       lch,
        //     } = fill_layer;

        //     // build featureCode design
        //     // radius -> opacity
        //     const design: CodeDesign = [[color, colorFunc(lch)], [opacity]];

        //     const fill_worker_layer: FillWorkerLayer = {
        //       type: 'fill',
        //       name,
        //       layerIndex,
        //       source,
        //       layer,
        //       minzoom,
        //       maxzoom,
        //       filter: parseFilter(filter),
        //       getCode: this.buildCode(design),
        //       pattern: pattern !== undefined ? parseFeature<string, string>(pattern) : undefined,
        //       patternFamily: parseFeature<string, string>(patternFamily),
        //       patternMovement: parseFeature<boolean>(patternMovement),
        //       invert,
        //       interactive,
        //       cursor,
        //       opaque,
        //     };

        //     if (invert) this.invert_layers.set(layerIndex, fill_worker_layer);

        //     return fill_worker_layer;
        todo!()
    }

    /**
     * Build a fill feature from input vector features
     * @param tile - the tile request
     * @param extent - the tile extent
     * @param feature - the vector tile feature
     * @param fill_layer - the fill worker layer
     * @param map_id - the map id to ship the data back to
     * @param source_name - the source name the data to belongs to
     * @returns true if the feature was built
     */
    pub async fn build_feature(
        &self,
        tile: &TileRequest,
        extent: f64,
        feature: &VectorFeature<'_>,
        fill_layer: &FillWorkerLayer,
        map_id: MapID,
        source_name: String,
    ) -> bool {
        //     const { gpu_type, image_store } = this;
        //     // pull data
        //     const { zoom, division } = tile;
        //     const { properties } = feature;
        //     const { getCode, interactive, layerIndex } = fill_layer;
        //     const type = feature.geoType();
        //     // only accept polygons and multipolygons
        //     if (type !== 'Polygon' && type !== 'MultiPolygon') return false;
        //     // get pattern
        //     const pattern = fill_layer.pattern?.([], properties, zoom);
        //     const patternFamily = fill_layer.patternFamily([], properties, zoom);
        //     const patternMovement = fill_layer.patternMovement([], properties, zoom);
        //     let missing = false;
        //     if (pattern !== undefined) {
        //       await image_store.getReady(map_id);
        //       missing = image_store.addMissingGlyph(map_id, tile.id, [pattern], [patternFamily]);
        //     }
        //     const hasParent = tile.parent !== undefined;
        //     const [geometry, indices] =
        //       !hasParent && 'loadGeometryFlat' in feature ? feature.loadGeometryFlat!() : [[], []];
        //     let vertices: number[] = [];
        //     if (geometry === undefined) return false;

        //     // if not parent and indices, the polygon has already been "solved"
        //     if (hasParent || indices.length === 0) {
        //       const [geometry] = feature.loadPolys() ?? [];
        //       if (geometry === undefined) return false;
        //       // preprocess geometry
        //       const clip = scaleShiftClipPolys(geometry, extent, tile);
        //       // create multiplier
        //       const multiplier = 1 / extent;
        //       // process
        //       for (const poly of clip) {
        //         // create triangle mesh
        //         const data = earclip(poly, extent / division, vertices.length / 2);
        //         // store vertices
        //         for (let i = 0, vl = data.vertices.length; i < vl; i++) {
        //           vertices.push(data.vertices[i] * multiplier);
        //         }
        //         // store indices
        //         for (let i = 0, il = data.indices.length; i < il; i++) {
        //           indices.push(data.indices[i]);
        //         }
        //       }
        //     } else {
        //       vertices = geometry as number[];
        //     }

        //     // if geometry is empty, skip
        //     if (vertices.length === 0 || indices.length === 0) return false;

        //     const id = !isNaN(properties.__id as number) ? Number(properties.__id) : this.id_gen.getNum();
        //     const [gl1Code, gl2Code] = getCode(zoom, properties);
        //     const fillFeature: FillFeature = {
        //       vertices,
        //       indices,
        //       layerIndex,
        //       code: gpu_type === 1 ? gl1Code : gl2Code,
        //       gl2Code,
        //       pattern,
        //       patternFamily,
        //       patternMovement,
        //       idRGB: idToRGB(id),
        //       missing,
        //     };

        //     // if interactive, store interactive properties
        //     if (interactive) this._addInteractiveFeature(id, properties, fill_layer);

        //     const storeID: string = `${map_id}:${tile.id}:${source_name}`;
        //     if (!this.feature_store.has(storeID)) this.feature_store.set(storeID, [] as FillFeature[]);
        //     const features = this.feature_store.get(storeID);
        //     features?.push(fillFeature);
        //     return true;
        todo!()
    }

    /**
     * Flush the fill feature data to be shipped out
     * @param map_id - id of the map to ship the data back to
     * @param tile - tile request
     * @param source_name - source name the data to belongs to
     * @param wait - this promise must be resloved before flushing. Ensures pattern data is ready
     */
    pub async fn flush(
        &self,
        map_id: MapID,
        tile: TileRequest,
        source_name: String,
        // wait: Promise<void>,
    ) {
        //     const storeID: string = `${map_id}:${tile.id}:${source_name}`;
        //     const features = this.feature_store.get(storeID) ?? [];
        //     // If `invert_layers` is non-empty, we should check if `features`
        //     // does not have said invert layers. If it doesn't, we need to add
        //     // a dummy feature that is empty for said layers.
        //     for (const [layerIndex, fill_worker_layer] of this.invert_layers) {
        //       if (fill_worker_layer.source !== source_name) continue;
        //       if (!features.some((feature) => feature.layerIndex === layerIndex)) {
        //         const feature = await this._build_invert_feature(tile, fill_worker_layer, map_id, source_name);
        //         if (feature !== undefined) features.push(feature);
        //       }
        //     }

        //     if (features.length !== 0) {
        //       // check if we need to wait for a response of missing data
        //       const missing = features.some((feature) => feature.missing);
        //       if (missing) await wait;
        //       this.#flush(map_id, source_name, tile.id);
        //     }
        //     // finish the flush
        //     await super.flush(map_id, tile, source_name, wait);
        //     this.feature_store.delete(storeID);
        todo!()
    }

    /**
     * Build inverted features if necessary
     * NOTE: You can not build invert features that require properties data
     * @param tile - tile request
     * @param fill_worker_layer - the fill worker layer that guides the feature processing
     * @param map_id - the map id that the feature belongs to
     * @param source_name - the source name that the feature belongs to
     * @returns the inverted fill data to be rendered if it exists
     */
    async fn _build_invert_feature(
        &self,
        tile: &TileRequest,
        fill_worker_layer: FillWorkerLayer,
        map_id: MapID,
        source_name: String,
    ) -> Option<FillFeature> {
        //     const { gpu_type, image_store } = this;
        //     const { zoom } = tile;
        //     const { getCode, minzoom, maxzoom, layerIndex } = fill_worker_layer;
        //     // respect zoom range
        //     if (zoom < minzoom || zoom > maxzoom) return;
        //     // get pattern
        //     const pattern = fill_worker_layer.pattern?.([], {}, zoom);
        //     const patternFamily = fill_worker_layer.patternFamily([], {}, zoom);
        //     const patternMovement = fill_worker_layer.patternMovement([], {}, zoom);
        //     // get if missing
        //     let missing = false;
        //     if (pattern !== undefined) {
        //       await image_store.getReady(map_id);
        //       missing = image_store.addMissingGlyph(map_id, tile.id, [pattern], [patternFamily]);
        //     }
        //     // build feature
        //     const id = this.id_gen.getNum();
        //     const [gl1Code, gl2Code] = getCode(zoom, {});
        //     const feature: FillFeature = {
        //       vertices: [-0.1, -0.1, 1.1, -0.1, 1.1, 1.1, -0.1, 1.1],
        //       indices: [0, 2, 1, 2, 0, 3],
        //       layerIndex,
        //       code: gpu_type === 1 ? gl1Code : gl2Code,
        //       gl2Code,
        //       pattern,
        //       patternFamily,
        //       patternMovement,
        //       idRGB: idToRGB(id),
        //       missing,
        //     };

        //     const storeID: string = `${map_id}:${tile.id}:${source_name}`;
        //     if (!this.feature_store.has(storeID)) this.feature_store.set(storeID, [] as FillFeature[]);
        //     const features = this.feature_store.get(storeID);
        //     features?.push(feature);
        //     return feature;
        todo!()
    }

    /**
     * Flush the fill data to the main thread
     * @param map_id - map id to ship the data back to
     * @param source_name - source name the data to belongs to
     * @param tile_id - tile id the data to belongs to
     */
    fn _flush(&self, map_id: MapID, source_name: String, tile_id: S2CellId) {
        //     const storeID: string = `${map_id}:${tile_id}:${source_name}`;
        //     const features = this.feature_store.get(storeID) ?? [];
        //     if (features.length === 0) return;
        //     // now that we have created all triangles, let's merge into bundled buffer sets
        //     // for the main thread to build VAOs.

        //     // Step 1: Sort by layerIndex, than sort by feature code.
        //     features.sort(featureSort);

        //     // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
        //     // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
        //     // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
        //     const vertices: number[] = [];
        //     const indices: number[] = [];
        //     const ids: number[] = [];
        //     const codeType: number[] = [];
        //     const featureGuide: number[] = [];
        //     let encodings: number[] = [];
        //     let indices_offset = 0;
        //     let vertex_offset = 0;
        //     let encoding_indexes: Record<string, number> = { '': 0 };
        //     let encoding_index = 0;
        //     let curlayer_index = features[0].layerIndex;
        //     let cur_pattern = features[0].pattern;
        //     let cur_pattern_family = features[0].patternFamily;
        //     let cur_pattern_movement = features[0].patternMovement;

        //     for (const {
        //       code,
        //       layerIndex,
        //       vertices: _vertices,
        //       indices: _indices,
        //       idRGB,
        //       pattern,
        //       patternFamily,
        //       patternMovement,
        //     } of features) {
        //       // on layer change or max encoding size, we have to setup a new featureGuide, encodings, and encoding_indexes
        //       if (curlayer_index !== layerIndex || encodings.length + code.length > MAX_FEATURE_BATCH_SIZE) {
        //         const indexSize = indices.length - indices_offset;
        //         if (indexSize === 0) continue; // skip if no indices
        //         // only store if count is actually greater than 0
        //         featureGuide.push(curlayer_index, indexSize, indices_offset, encodings.length, ...encodings); // layerIndex, count, offset, encoding size, encodings
        //         // describe pattern
        //         const { texX, texY, texW, texH } = this.image_store.getPattern(
        //           map_id,
        //           patternFamily,
        //           pattern,
        //         );
        //         featureGuide.push(texX, texY, texW, texH, patternMovement ? 1 : 0);
        //         // update variables for reset
        //         indices_offset = indices.length;
        //         encodings = [];
        //         encoding_indexes = { '': 0 };
        //       }
        //       // setup encodings data. If we didn't have current feature's encodings already, create and set index
        //       const feKey = code.toString();
        //       encoding_index = encoding_indexes[feKey];
        //       if (encoding_index === undefined) {
        //         encoding_index = encoding_indexes[feKey] =
        //           this.gpu_type === 1 ? encodings.length / 5 : encodings.length;
        //         encodings.push(...code);
        //       }
        //       // store
        //       vertex_offset = vertices.length / 2;
        //       // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
        //       // so we just do a for loop
        //       for (let f = 0, fl = _vertices.length; f < fl; f++) {
        //         vertices.push(_vertices[f]);
        //       }
        //       for (let f = 0, fl = _indices.length; f < fl; f++) {
        //         const index = _indices[f] + vertex_offset;
        //         indices.push(index);
        //         codeType[index] = encoding_index;
        //         // store id RGB value
        //         const idRGBIndex = index * 4;
        //         ids[idRGBIndex] = idRGB[0];
        //         ids[idRGBIndex + 1] = idRGB[1];
        //         ids[idRGBIndex + 2] = idRGB[2];
        //         ids[idRGBIndex + 3] = 0;
        //       }
        //       // update previous layerIndex and pattern
        //       curlayer_index = layerIndex;
        //       cur_pattern = pattern;
        //       cur_pattern_family = patternFamily;
        //       cur_pattern_movement = patternMovement;
        //     }
        //     // store the very last featureGuide batch
        //     if (indices.length - indices_offset > 0) {
        //       featureGuide.push(
        //         curlayer_index,
        //         indices.length - indices_offset,
        //         indices_offset,
        //         encodings.length,
        //         ...encodings,
        //       ); // layerIndex, count, offset, encoding size, encodings
        //       // describe pattern
        //       const { texX, texY, texW, texH } = this.image_store.getPattern(
        //         map_id,
        //         cur_pattern_family,
        //         cur_pattern,
        //       );
        //       featureGuide.push(texX, texY, texW, texH, cur_pattern_movement ? 1 : 0);
        //     }

        //     // Upon building the batches, convert to buffers and ship.
        //     const vertexBuffer = new Float32Array(vertices).buffer;
        //     const indexBuffer = new Uint32Array(indices).buffer;
        //     const idBuffer = new Uint8ClampedArray(ids).buffer; // pre-store each id as an rgb value
        //     const codeTypeBuffer =
        //       this.gpu_type === 3 ? new Uint32Array(codeType).buffer : new Uint8Array(codeType).buffer;
        //     const featureGuideBuffer = new Float32Array(featureGuide).buffer;
        //     // ship the vector data.
        //     const message: FillData = {
        //       map_id,
        //       type: 'fill',
        //       source_name,
        //       tile_id,
        //       vertexBuffer,
        //       indexBuffer,
        //       idBuffer,
        //       codeTypeBuffer,
        //       featureGuideBuffer,
        //     };
        //     postMessage(message, [vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer, featureGuideBuffer]);
        todo!()
    }
}

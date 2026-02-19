// import parseFeature from 's2/style/parseFeature.js';
// import parseFilter from 'style/parseFilter.js';
// import VectorWorker, { colorFunc, idToRGB } from './vectorWorker.js';
// import { drawLine, featureSort, scaleShiftClipLines } from './util/index.js';

// import type { CodeDesign } from './vectorWorker.js';
// import type { S2CellId } from 'gis-tools/index.js';
// import type { Cap, Join, LineDefinition, LineWorkerLayer } from 'style/style.spec.js';
// import type { LineData, TileRequest } from '../worker.spec.js';
// import type { LineFeature, LineWorker as LineWorkerSpec, VTFeature } from './process.spec.js';

use crate::{
    style::{Cap, GPUType, LineDefinition, LineWorkerLayer},
    workers::{IDGen, LineFeature, MapID, TileRequest, VectorWorker},
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use gistools::geometry::S2CellId;
use open_vector_tile::VectorFeature;

/** Worker for processing line data */
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct LineWorker {
    pub base: VectorWorker,
    /// tile_id -> features
    pub feature_store: BTreeMap<String, Vec<LineFeature>>, // = new Map<string, LineFeature[]>(); // tile_id -> features
}
impl LineWorker {
    /**
     * @param id_gen - id generator to ensure features don't overlap
     * @param gpu_type - the GPU context of the map renderer (WebGL(1|2) | WebGPU)
     * @param image_store - the image store to pull/request the needed pattern images
     */
    pub fn new(id_gen: Rc<RefCell<IDGen>>, gpu_type: GPUType) -> LineWorker {
        LineWorker { base: VectorWorker::new(id_gen, gpu_type), feature_store: BTreeMap::new() }
    }

    /**
     * Setup the worker layer to process future line data
     * @param line_layer - input style layer guide
     * @returns the worker layer to process future line vector data
     */
    pub fn setup_layer(&self, line_layer: &LineDefinition) -> LineWorkerLayer {
        //     const {
        //       name,
        //       layerIndex,
        //       source,
        //       layer,
        //       minzoom,
        //       maxzoom,
        //       filter,
        //       dashed,
        //       geoFilter,
        //       interactive,
        //       cursor,
        //       lch,
        //       cap,
        //       join,
        //       color,
        //       opacity,
        //       width,
        //       gapWidth,
        //     } = line_layer;

        //     // build feature code design
        //     // color -> opacity -> width -> gapWidth
        //     const design: CodeDesign = [[color, colorFunc(lch)], [opacity], [width], [gapWidth]];

        //     return {
        //       type: 'line',
        //       name,
        //       layerIndex,
        //       source,
        //       layer,
        //       minzoom,
        //       maxzoom,
        //       cap: parseFeature<Cap, Cap>(cap),
        //       join: parseFeature<Join, Join>(join),
        //       filter: parseFilter(filter),
        //       getCode: this.buildCode(design),
        //       dashed,
        //       geoFilter,
        //       interactive,
        //       cursor,
        //     };
        todo!()
    }

    /**
     * Build a line feature
     * @param tile - the tile request
     * @param extent - the tile extent
     * @param feature - the vector tile feature
     * @param line_layer - the line worker layer
     * @param map_id - the map id to ship the data back to
     * @param source_name - the name of the source the data belongs to
     * @returns true if the feature was built
     */
    pub fn build_feature(
        &self,
        tile: &TileRequest,
        extent: f64,
        feature: VectorFeature<'_>,
        line_layer: LineWorkerLayer,
        map_id: MapID,
        source_name: String,
    ) -> bool {
        //     const { gpuType } = this;
        //     const { zoom, division } = tile;
        //     const { properties } = feature;
        //     const { getCode, layerIndex, geoFilter } = line_layer;
        //     const type = feature.geoType();
        //     if (type === 'Point' || type === 'MultiPoint') return false;
        //     if (geoFilter.includes('line') && (type === 'LineString' || type === 'MultiLineString'))
        //       return false;
        //     if (geoFilter.includes('poly') && (type === 'Polygon' || type === 'MultiPolygon')) return false;
        //     // load geometry
        //     const [geometry] = feature.loadLines() ?? [];
        //     if (geometry === undefined) return false;
        //     const cap = line_layer.cap([], properties, zoom);
        //     const vertices: number[] = [];
        //     const lengthSoFar: number[] = [];

        //     // create multiplier
        //     const multiplier = 1 / extent;
        //     // find a max distance to modify lines too large (round off according to the sphere)
        //     const maxDistance = division === 1 ? 0 : extent / division;
        //     // preprocess geometry
        //     const geo = scaleShiftClipLines(geometry, extent, tile);
        //     // draw
        //     for (const lineString of geo) {
        //       // build the vertex, normal, and index data
        //       const { prev, curr, next, lengthSoFar: _lsf } = drawLine(lineString, cap, maxDistance);
        //       for (let i = 0, vc = curr.length; i < vc; i += 2) {
        //         vertices.push(
        //           prev[i] * multiplier,
        //           prev[i + 1] * multiplier,
        //           curr[i] * multiplier,
        //           curr[i + 1] * multiplier,
        //           next[i] * multiplier,
        //           next[i + 1] * multiplier,
        //         );
        //       }
        //       for (const l of _lsf) lengthSoFar.push(l * multiplier);
        //     }

        //     // skip empty geometry
        //     if (vertices.length === 0) return false;

        //     const id = this.idGen.getNum();
        //     const [gl1Code, gl2Code] = getCode(zoom, properties);
        //     const lineFeature: LineFeature = {
        //       cap,
        //       vertices,
        //       lengthSoFar,
        //       layerIndex,
        //       code: gpuType === 1 ? gl1Code : gl2Code,
        //       gl2Code,
        //       idRGB: idToRGB(id),
        //     };

        //     const storeID: string = `${map_id}:${tile.id}:${source_name}`;
        //     if (!this.feature_store.has(storeID)) this.feature_store.set(storeID, [] as LineFeature[]);
        //     const store = this.feature_store.get(storeID);
        //     store?.push(lineFeature);
        //     return true;
        todo!()
    }

    /**
     * Flush a tile-request's result line data to the render thread
     * @param map_id - id of the map to ship the data back to
     * @param tile - tile request
     * @param source_name - name of the source the data belongs to
     */
    pub async fn flush(&self, map_id: MapID, tile: TileRequest, source_name: String) {
        //     const storeID: string = await `${map_id}:${tile.id}:${source_name}`;
        //     const features = this.feature_store.get(storeID) ?? [];
        //     if (features.length === 0) return;
        //     this.#flush(map_id, source_name, tile.id, features);
        //     this.feature_store.delete(storeID);
        todo!()
    }

    /**
     * Flush a tile-request's result line data to the render thread
     * @param map_id - id of the map to ship the data back to
     * @param source_name - name of the source the data belongs to
     * @param tile_id - the id of the tile that requested the lines
     * @param features - the features to flush to the render thread
     */
    fn _flush(
        &self,
        map_id: MapID,
        source_name: String,
        tile_id: S2CellId,
        features: &[LineFeature],
    ) {
        //     // Step 1: Sort by layerIndex, than sort by feature code.
        //     features.sort(featureSort);

        //     // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
        //     // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
        //     // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
        //     const vertices: number[] = [];
        //     const lengthSoFar: number[] = [];
        //     const featureGuide: number[] = [];
        //     let encodings: number[] = features[0].code;
        //     let indexCount = 0;
        //     let indexOffset = 0;
        //     let curFeatureCode = encodings.toString();
        //     let curlayerIndex = features[0].layerIndex;
        //     let curCap = 0;

        //     for (const { layerIndex, code, cap, vertices: _vertices, lengthSoFar: _lsf } of features) {
        //       // on layer change or max feature code change, we have to setup a new featureGuide
        //       if (indexCount > 0 && (curlayerIndex !== layerIndex || curFeatureCode !== code.toString())) {
        //         // store the current feature
        //         featureGuide.push(
        //           curCap,
        //           curlayerIndex,
        //           indexCount,
        //           indexOffset,
        //           encodings.length,
        //           ...encodings,
        //         ); // layerIndex, count, offset, encoding size, encodings
        //         // update indexOffset
        //         indexOffset += indexCount;
        //         // reset indexCount
        //         indexCount = 0;
        //         // update to new encoding set
        //         encodings = code;
        //         // update what the current encoding is
        //         curFeatureCode = encodings.toString();
        //       }
        //       // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
        //       // so we just do a for loop. Store vertices and feature code for each vertex set
        //       const fl: number = _vertices.length;
        //       for (let f = 0; f < fl; f++) vertices.push(_vertices[f]);
        //       for (const l of _lsf) lengthSoFar.push(l);
        //       // update previous layerIndex
        //       curlayerIndex = layerIndex;
        //       // store the cap type
        //       curCap = encodeCap(cap);
        //       // increment indexCount
        //       indexCount += fl / 6;
        //     }
        //     // store the very last featureGuide batch if not yet stored
        //     if (indexCount > 0) {
        //       featureGuide.push(
        //         curCap,
        //         curlayerIndex,
        //         indexCount,
        //         indexOffset,
        //         encodings.length,
        //         ...encodings,
        //       ); // layerIndex, count, offset, encoding size, encodings
        //     }

        //     // Upon building the batches, convert to buffers and ship.
        //     const vertexBuffer = new Float32Array(vertices).buffer;
        //     const lengthSoFarBuffer = new Float32Array(lengthSoFar).buffer;
        //     const featureGuideBuffer = new Float32Array(featureGuide).buffer;
        //     // ship the vector data.
        //     const data: LineData = {
        //       map_id,
        //       type: 'line',
        //       source_name,
        //       tile_id,
        //       vertexBuffer,
        //       lengthSoFarBuffer,
        //       featureGuideBuffer,
        //     };
        //     postMessage(data, [vertexBuffer, featureGuideBuffer]);
        todo!()
    }
}

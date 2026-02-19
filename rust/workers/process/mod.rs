// import FillWorker from './fill.js';
// import GlyphWorker from './glyph/index.js';
// import { IDGen } from './process.spec.js';
// import ImageStore from './image_store.js';
// import LineWorker from './line.js';
// import PointWorker from './point.js';
// import RasterWorker from './raster.js';

// import type { Glyph } from './glyph/familySource.js';
// import type { GlyphMetadata } from 'workers/source/glyphSource.js';
// import type { ImageSourceMetadata } from 'workers/source/imageSource.js';
// import type {
//   GPUType,
//   HillshadeWorkerLayer,
//   LayerDefinition,
//   LayerType,
//   RasterWorkerLayer,
//   SensorWorkerLayer,
//   StylePackage,
//   WorkerLayer,
// } from 'style/style.spec.js';
// import type { TileFlushMessage, TileRequest } from '../worker.spec.js';
// import type { VTTile, VectorWorker, Workers } from './process.spec.js';

/// Fill Worker
pub mod fill;
/// Processing Tools for Glyphs, Lines, Points, Rasters, etc.
pub mod glyph;
/// Image Store
pub mod image_store;
/// Line Worker
pub mod line;
/// Point Worker
pub mod point;
/// Specification for the Process Manager
pub mod process_spec;
/// Raster Worker
pub mod raster;
/// Processing Utilities
pub mod util;
/// Vector Worker
pub mod vector_worker;

use crate::{
    style::{GPUType, LayerDefinition, LayerType, StylePackage, WorkerLayer},
    util::{MsgReceiver, MsgSender},
    workers::{
        GlyphMetadata, ImageSourceMetadata, MapID, SourceWorkerMessages, TileRequest,
        TileWorkerMessageOutput,
    },
};
use alloc::{
    collections::{BTreeMap, BTreeSet},
    string::String,
};
pub use fill::*;
use gistools::data_structures::Tile;
pub use glyph::*;
pub use image_store::*;
pub use line::*;
pub use point::*;
pub use process_spec::*;
pub use raster::*;
pub use util::*;
pub use vector_worker::*;

/// # Process Manager
///
/// A managment class for all input vector/raster work for the Tile Worker thread.
/// Handles all input data cases and handles shipping the resultant render data back to the main thread
#[derive(Debug)]
#[allow(missing_docs)]
pub struct ProcessManager {
    pub id: usize,
    pub gpu_type: GPUType,
    pub id_gen: IDGen,
    pub experimental: bool,
    pub source_worker: MsgSender<SourceWorkerMessages>,
    pub layers: BTreeMap<String, Vec<WorkerLayer>>,
    pub workers: BTreeMap<String, Workers>,
    pub image_store: ImageStore,
    pub map_styles: BTreeMap<String, StylePackage>,
}
impl ProcessManager {
    /// Internal function to setup the process manager
    pub fn new(
        id: usize,
        total_workers: usize,
        source_worker: MsgSender<SourceWorkerMessages>,
    ) -> Self {
        let id_gen = IDGen::new(id, total_workers);
        Self {
            id,
            gpu_type: GPUType::WebGPU,
            id_gen,
            experimental: false,
            source_worker: source_worker.clone(),
            layers: BTreeMap::new(),
            workers: BTreeMap::new(),
            image_store: ImageStore::setup(id_gen, source_worker),
            map_styles: BTreeMap::new(),
        }
    }

    /**
     * Setup a map style
     * @param map_id - the id of the map to setup the style for
     * @param style - the style to setup
     */
    pub fn setup_style(map_id: MapID, style: StylePackage) {
        //     this.map_styles[map_id] = style;
        //     const { layers, gpu_type, experimental } = style;
        //     this.gpu_type = gpu_type;
        //     this.experimental = experimental;
        //     const workerTypes = new Set<LayerType>();

        //     // first we need to build the workers
        //     for (const layer of layers) workerTypes.add(layer.type);
        //     this.#buildWorkers(workerTypes, style);

        //     // Convert LayerDefinition to WorkerLayer and store in layers
        //     const workerLayers = layers
        //       .map((layer): WorkerLayer | undefined => this.setup_layer(layer))
        //       .filter((layer) => layer !== undefined) as WorkerLayer[];
        //     this.layers[map_id] = workerLayers;

        //     // setup image_store
        //     this.image_store.setupMap(map_id);
        todo!()
    }

    /**
     * Setup a style layer into a "worker layer" that can process input data into renderable data
     * @param layer - the layer to setup
     * @returns the worker layer
     */
    pub fn setup_layer(layer: LayerDefinition) -> Option<WorkerLayer> {
        //     if (layer.type === 'shade') return;
        //     return this.workers[layer.type]?.setup_layer(layer as never);
        todo!()
    }

    /**
     * Build the workers needed for the style
     * @param names - the names of the workers
     * @param style - the style that has layers describing the workers it needs
     */
    fn _build_workers(names: BTreeSet<LayerType>, style: StylePackage) {
        //     const { id_gen, gpu_type, workers, source_worker, image_store } = this;
        //     const { tileSize } = style;
        //     // setup image_store
        //     image_store.setup(id_gen, source_worker);
        //     for (const name of names) {
        //       if (name === 'fill') {
        //         workers.fill = new FillWorker(id_gen, gpu_type, image_store);
        //       } else if (name === 'line') {
        //         workers.line = new LineWorker(id_gen, gpu_type);
        //       } else if (name === 'point' || name === 'heatmap') {
        //         workers.point = workers.heatmap = new PointWorker(id_gen, gpu_type);
        //       } else if (name === 'glyph') {
        //         workers.glyph = new GlyphWorker(id_gen, gpu_type, source_worker, image_store, tileSize);
        //       } else if (
        //         (name === 'raster' || name === 'sensor' || name === 'hillshade') &&
        //         this.workers.raster === undefined
        //       ) {
        //         workers.hillshade = workers.sensor = workers.raster = new RasterWorker(gpu_type);
        //       }
        //     }
        todo!()
    }

    /**
     * Process the input vector data
     * @param map_id - the map that made the request
     * @param tile - the tile request
     * @param source_name - the name of the source the data belongs to
     * @param vector_tile - the input vector tile to parse
     */
    async fn process_vector(
        map_id: MapID,
        tile: TileRequest,
        source_name: String,
        vector_tile: Tile,
    ) {
        //     const { workers } = this;
        //     const { zoom, parent } = tile;
        //     const { layerIndexes } = parent ?? tile;
        //     // filter layers to those that source metadata explains exists in this tile
        //     const sourceLayers = this.layers[map_id].filter((layer) =>
        //       layerIndexes === undefined ? true : layerIndexes.includes(layer.layerIndex),
        //     );
        //     // prep a layerIndex tracker for an eventual generic flush.
        //     // Some layerIndexes will never be updated, so it's good to know
        //     const layers: Record<number, number> = {};
        //     sourceLayers.forEach((l) => {
        //       layers[l.layerIndex] = 0;
        //     });

        //     // TODO: features is repeated through too many times. Simplify this down.
        //     for (const sourceLayer of sourceLayers) {
        //       if (!('filter' in sourceLayer)) continue;
        //       const { type, filter, minzoom, maxzoom, layerIndex, layer } = sourceLayer;
        //       if (minzoom > zoom || maxzoom < zoom) continue;
        //       // grab the layer of interest from the vector_tile and it's extent
        //       const vectorLayer = vector_tile.layers[layer];
        //       if (vectorLayer === undefined) continue;
        //       // iterate over the vector features, filter as necessary
        //       for (let f = 0; f < vectorLayer.length; f++) {
        //         const feature = vectorLayer.feature?.(f);
        //         if (feature === undefined) continue;
        //         const { properties } = feature;
        //         // filter out features that are not applicable, otherwise tell the vectorWorker to build
        //         if (filter(properties)) {
        //           const wasBuilt = await workers[type]?.buildFeature(
        //             tile,
        //             vectorLayer.extent,
        //             feature,
        //             sourceLayer as never,
        //             map_id,
        //             source_name,
        //           );
        //           if (wasBuilt === true && layers[layerIndex] !== undefined) layers[layerIndex]++;
        //         }
        //       }
        //     }
        //     // now flush the workers
        //     this.flush(map_id, tile, source_name, layers);
        todo!()
    }

    /**
     * Flush all data produced from a tile input.
     * @param map_id - the map that made the request
     * @param tile - the tile request
     * @param source_name - the name of the source the data belongs to
     * @param layers - the layers that were built
     */
    pub fn flush(
        map_id: MapID,
        tile: TileRequest,
        source_name: String,
        layers: BTreeMap<u32, u32>,
    ) {
        //     const { image_store } = this;
        //     const tileID = tile.id;
        //     // first see if any data was missing. If so, we may need to wait for it to be processed
        //     const wait = image_store.processMissingData(map_id, tileID, source_name);
        //     // flush each worker
        //     for (const worker of Object.values(this.workers)) {
        //       void (worker as VectorWorker).flush(map_id, tile, source_name, wait);
        //     }

        //     const deadLayers: number[] = [];
        //     for (const [id, count] of Object.entries(layers)) if (count === 0) deadLayers.push(Number(id));
        //     const msg: TileFlushMessage = {
        //       type: 'flush',
        //       from: 'tile',
        //       tileID,
        //       map_id,
        //       source_name,
        //       deadLayers,
        //     };
        //     postMessage(msg);
        todo!()
    }

    /**
     * Process RGBA based data
     * @param map_id - the map that made the request
     * @param tile - the tile request
     * @param source_name - the name of the source the data belongs to
     * @param data - the input data
     * @param size - the size of the input data
     */
    pub fn process_raster(
        map_id: MapID,
        tile: TileRequest,
        source_name: String,
        data: Vec<u8>,
        size: u32,
    ) {
        //     const subSourceName = source_name.split(':')[0];
        //     // filter layers to source
        //     const sourceLayers = this.layers[map_id].filter(
        //       (layer) => layer.source === subSourceName,
        //     ) as Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>;

        //     void this.workers.raster?.buildTile(map_id, source_name, sourceLayers, tile, data, size);
        todo!()
    }

    /**
     * Process glyph/icon/sprite/image metadata
     * @param map_id - the map that made the request
     * @param glyph_metadata - the glyph/icon metadatas
     * @param image_metadata - the sprite/image metadatas
     */
    pub fn process_metadata(
        map_id: MapID,
        glyph_metadata: Vec<GlyphMetadata>,
        image_metadata: Vec<ImageSourceMetadata>,
    ) {
        //     this.image_store.process_metadata(map_id, glyph_metadata, image_metadata);
        todo!()
    }

    /**
     * Process glyph/icon response from the source worker
     * @param map_id - the map that made the request
     * @param req_id - the id of the request
     * @param glyph_metadata - the glyph metadata
     * @param family_name - the name of the family
     */
    pub fn process_glyph_response(
        map_id: MapID,
        req_id: String,
        glyph_metadata: Vec<Glyph>,
        family_name: String,
    ) {
        //     this.image_store.process_glyph_response(map_id, req_id, glyph_metadata, family_name);
        todo!()
    }
}

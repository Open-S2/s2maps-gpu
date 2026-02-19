// import type { MarkerDefinition } from './source/markerSource.js';
// import type S2Map from '../s2Map.js';
// import type { UrlMap } from 'util/index.js';
// import type {
//   AddLayerMessageGL,
//   AddMarkersMessage,
//   AddSourceMessage,
//   DeleteLayerMessageGL,
//   DeleteMarkersMessage,
//   DeleteSourceMessage,
//   ReorderLayersMessageGL,
//   RequestStyleMessage,
//   SourceWorkerMessage,
//   StyleMessage,
//   TileRequest,
//   TileRequestMessage,
//   TileWorkerMessage,
//   TimeRequestMessage,
//   WorkerPoolPortMessage,
// } from './worker.spec.js';
// import type { Analytics, LayerDefinition, Source, StylePackage } from 'style/style.spec.js';

use crate::{
    s2map::S2Map,
    style::{LayerDefinition, S2MapsAnalytics, Source, StylePackage},
    util::{UrlMap, available_parallelism},
    workers::{
        MapID, MarkerDefinition, SourceName, SourceWorker, SourceWorkerMessage, TileRequest,
        TileWorker, TileWorkerMessage,
    },
};
use alloc::collections::BTreeMap;
use core::cell::RefCell;

struct Singleton<T>(T);
unsafe impl<T> Sync for Singleton<T> {}

static WORKER_POOL: Singleton<RefCell<Option<WorkerPool>>> = Singleton(RefCell::new(None));

/// # Worker Pool
///
/// Manages the tile workers and the source worker
///
/// The Source worker manages sources, builds/fetches requests, and sends them to the tile workers to be processed
///
/// The Tile Workers process the raw data into renderable / interactive data for the GPU or end user.
///
/// Communications channels are created for:
/// - SourceWorker<->TileWorker
/// - TileWorker->Map Object
/// - SourceWorker->Map Object
///
/// There is a two way channel for SourceWorker<->TileWorker mostly because of glyphs,images, etc.
pub struct WorkerPool {
    /// The number of workers to use
    pub worker_count: usize,
    /// The Tile workers take data fetched from the source worker and shape it into renderable/usable data
    pub workers: Vec<TileWorker>, // = [];
    /// The source worker manages how to access data
    pub source_worker: SourceWorker,
    /// The maps that are using this worker pool
    pub maps: BTreeMap<MapID, S2Map>, // MapID: S2Map
}
impl WorkerPool {
    /// Create a new worker pool
    pub fn new() -> Self {
        Self {
            worker_count: usize::max(usize::min(available_parallelism(), 6), 2),
            workers: vec![],
            source_worker: SourceWorker::new(todo!()),
            maps: BTreeMap::new(),
        }

        // setup workers and channels between all

        //     // create source worker
        //     const source_worker = (this.source_worker = new Worker(
        //       new URL('./source.worker', import.meta.url),
        //       { name: 'source-worker', type: 'module' },
        //     ));
        //     source_worker.onmessage = this.#onMessage.bind(this);
        //     // create process workers
        //     for (let i = 0; i < this.worker_count; i++) {
        //       const tileWorker = new Worker(new URL('./tile.worker', import.meta.url), {
        //         name: 'tile-worker',
        //         type: 'module',
        //       });
        //       tileWorker.onmessage = this.#onMessage.bind(this);
        //       this.workers.push(tileWorker);
        //       // build communication channels; port1 can postMessage, and port2 can onMessage
        //       const channelA = new MessageChannel();
        //       const channelB = new MessageChannel();
        //       const portMessage: WorkerPoolPortMessage = {
        //         type: 'port',
        //         id: i,
        //         totalWorkers: this.worker_count,
        //       };
        //       source_worker.postMessage(portMessage, [channelA.port1, channelB.port2]);
        //       tileWorker.postMessage(portMessage, [channelB.port1, channelA.port2]);
        //     }
    }
    /// Get immutable access to the pool
    pub fn get() -> core::cell::Ref<'static, WorkerPool> {
        let mut borrow = WORKER_POOL.0.borrow_mut();
        if borrow.is_none() {
            *borrow = Some(WorkerPool::new());
        }
        drop(borrow); // Release mutable borrow before taking immutable one

        core::cell::Ref::map(WORKER_POOL.0.borrow(), |opt| opt.as_ref().unwrap())
    }
    /// Get mutable access to the pool.
    pub fn get_mut() -> core::cell::RefMut<'static, WorkerPool> {
        let mut borrow = WORKER_POOL.0.borrow_mut();
        if borrow.is_none() {
            *borrow = Some(WorkerPool::new());
        }

        core::cell::RefMut::map(borrow, |opt| opt.as_mut().unwrap())
    }

    /// Given a message from a TileWorker, ship it off to the right map
    fn _on_message_tile(&self, msg: TileWorkerMessage) {
        todo!()
    }

    /// Given a message from a SourceWorker, ship it off to the right map
    fn _on_message_source(&self, msg: SourceWorkerMessage) {
        todo!()
    }

    /**
     * Add a map to the worker pool for communication
     * @param map - the s2map
     */
    pub fn add_map(&mut self, map: S2Map) {
        self.maps.insert(map.id, map);
    }

    /**
     * Request the source worker load a style
     * @param map_id - the id of the map
     * @param style - the style url to fetch
     * @param analytics - basic analytics
     * @param api_key - the api key if needed
     * @param url_map - the url map
     */
    pub fn request_style(
        &self,
        map_id: MapID,
        style: String,
        analytics: S2MapsAnalytics,
        api_key: Option<String>,
        url_map: Option<UrlMap>,
    ) {
        //     const msg: RequestStyleMessage = {
        //       map_id,
        //       type: 'requestStyle',
        //       style,
        //       api_key,
        //       url_map,
        //       analytics,
        //     };
        //     this.source_worker.postMessage(msg);
        todo!()
    }

    /**
     * Inject a style. The style is already built, so just send it to the workers
     * @param map_id - the id of the map
     * @param style - the style data
     */
    pub fn inject_style(&self, map_id: MapID, style: StylePackage) {
        //     const msg: StyleMessage = { map_id, type: 'style', style };
        //     this.source_worker.postMessage(msg);
        //     for (const worker of this.workers) worker.postMessage(msg);
        todo!()
    }

    // NOTE: TEMPORARY SOLUTION :(

    /** delete the worker pool. This is a temporary solution as the worker pool should be a singleton. */
    pub fn delete(&self) {
        // this.source_worker.terminate();
        // for (const worker of this.workers) worker.terminate();
        // window.S2WorkerPool = new WorkerPool();

        // maybe: this.source_worker.postMessage({ map_id, type: 'delete' })

        todo!()
    }

    /**
     * Request tiles
     * @param map_id - the id of the map
     * @param tiles - the tiles to fetch data for
     * @param sources - the sources to fetch data for. If empty request data for all sources
     */
    pub fn tile_request(
        &self,
        map_id: MapID,
        tiles: Vec<TileRequest>,
        sources: Option<Vec<SourceName>>, // Array<[source_name: string, href: string | undefined]> = [],
    ) {
        //     const msg: TileRequestMessage = { map_id, type: 'tilerequest', tiles, sources };
        //     this.source_worker.postMessage(msg);
        todo!()
    }

    /**
     * Request temporal tile data
     * @param map_id - the id of the map
     * @param tiles - the tiles to fetch data for
     * @param source_names - the sources to fetch data for. If empty request data for all sources
     */
    pub fn time_request(map_id: MapID, tiles: Vec<TileRequest>, source_names: Option<Vec<String>>) {
        let source_names = source_names.unwrap_or_default();
        //     const msg: TimeRequestMessage = { map_id, type: 'timerequest', tiles, source_names };
        //     this.source_worker.postMessage(msg);
        todo!()
    }

    /**
     * Add marker(s) to the map
     * @param map_id - the id of the map to add marker(s) to
     * @param markers - the marker(s) to add
     * @param source_name - the name of the source to add the marker(s) to
     */
    pub fn add_markers(map_id: MapID, markers: Vec<MarkerDefinition>, source_name: String) {
        //     const msg: AddMarkersMessage = { map_id, type: 'addMarkers', markers, source_name };
        //     this.source_worker.postMessage(msg);
        todo!()
    }

    /**
     * Delete marker(s) from the map
     * @param map_id - the id of the map to delete marker(s) from
     * @param ids - the id(s) of the marker(s) to delete
     * @param source_name - the name of the source to delete the marker(s) from
     */
    pub fn delete_markers(map_id: MapID, ids: Vec<u64>, source_name: String) {
        //     const msg: DeleteMarkersMessage = { map_id, type: 'delete_markers', ids, source_name };
        //     this.source_worker.postMessage(msg);
        todo!()
    }

    /**
     * Add a source to the map
     * @param map_id - the id of the map to add the source to
     * @param source_name - the name of the source to add the source to
     * @param source - the source
     * @param tile_request - the list of tiles of all existing tiles in the map already to build this source data for
     */
    pub fn add_source(
        map_id: MapID,
        source_name: String,
        source: Source,
        tile_request: Vec<TileRequest>,
    ) {
        //     const msg: AddSourceMessage = { map_id, type: 'add_source', source_name, source, tile_request };
        //     this.source_worker.postMessage(msg);
        //     for (const worker of this.workers) worker.postMessage(msg);
        todo!()
    }

    /**
     * Delete a source from the map
     * @param map_id - the id of the map to delete the source from
     * @param source_names - the name(s) of the source(s) to delete
     */
    pub fn delete_source(map_id: MapID, source_names: Vec<String>) {
        //     const msg: DeleteSourceMessage = { map_id, type: 'delete_source', source_names };
        //     this.source_worker.postMessage(msg);
        //     for (const worker of this.workers) worker.postMessage(msg);
        todo!()
    }

    /**
     * Add a style layer to the map
     * @param map_id - the id of the map to add the layer to
     * @param layer - the style layer
     * @param index - the index to add the layer at
     * @param tile_request - the list of tiles of all existing tiles in the map already to adjust
     */
    pub fn add_layer(
        map_id: MapID,
        layer: LayerDefinition,
        index: Option<u64>,
        tile_request: Vec<TileRequest>,
    ) {
        //     const msg: AddLayerMessageGL = { map_id, type: 'add_layer', layer, index, tile_request };
        //     this.source_worker.postMessage(msg);
        //     for (const worker of this.workers) worker.postMessage(msg);
        todo!()
    }

    /**
     * Delete a style layer from the map
     * @param map_id - the id of the map to delete the layer from
     * @param index - the index of the style layer to delete
     */
    pub fn delete_layer(map_id: MapID, index: u32) {
        //     const msg: DeleteLayerMessageGL = { map_id, type: 'delete_layer', index };
        //     this.source_worker.postMessage(msg);
        //     for (const worker of this.workers) worker.postMessage(msg);
        todo!()
    }

    /**
     * Reorder style layers
     * @param map_id - the id of the map
     * @param layer_changes - the layer changes to make
     */
    pub fn reorder_layers(map_id: MapID, layer_changes: BTreeMap<u32, u32>) {
        //     const msg: ReorderLayersMessageGL = { map_id, type: 'reorderLayers', layer_changes };
        //     this.source_worker.postMessage(msg);
        //     for (const worker of this.workers) worker.postMessage(msg);
        todo!()
    }
}

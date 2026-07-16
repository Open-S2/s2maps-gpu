// import { adjustURL } from '../util/index.js';
// import {
//   GlyphSource,
//   ImageSource,
//   JSONSource,
//   LocalSource,
//   MarkerSource,
//   S2PMTilesSource,
//   S2TilesSource,
//   Session,
//   Source,
//   SpriteSource,
//   TexturePack,
// } from './source/index.js';

// import type { ImageSourceMetadata } from './source/imageSource.js';
// import type { MarkerDefinition } from './source/markerSource.js';
// import type { UrlMap } from 'util/index.js';
// import type {
//   Analytics,
//   GPUType,
//   ImageExtensions,
//   LayerDefinition,
//   Projection,
//   SourceMetadata,
//   StylePackage,
//   Source as StyleSource,
// } from 'style/style.spec.js';
// import type { GlyphMetadata, GlyphMetadataUnparsed } from './source/glyphSource.js';
// import type {
//   GlyphMetadataMessage,
//   SourceFlushMessage,
//   SourceWorkerMessages,
//   TileRequest,
// } from './worker.spec.js';

use crate::{
    style::{
        GPUType, LayerDefinition, Projection, S2MapsAnalytics, Source as StyleSource, StylePackage,
    },
    util::{MsgReceiver, MsgSender, UrlMap},
    workers::{
        GlyphMetadataUnparsed, GlyphSource, ImageSource, ImageSourceMetadata, MapID,
        MarkerDefinition, MarkerSource, Session, Source, SourceWorkerMessageOutput,
        SourceWorkerMessages, SpriteSource, TexturePack, TileRequest, TileWorkerMessage,
    },
};
use alloc::{collections::BTreeMap, rc::Rc};
use std::cell::RefCell;

/// Each map has it's own store of these properties
#[derive(Debug)]
#[allow(missing_docs)]
pub struct SessionMap {
    pub projection: Projection,
    pub gpu_type: GPUType,
    pub minzoom: u8,
    pub maxzoom: u8,
    pub analytics: S2MapsAnalytics,
    pub experimental: bool,
    pub sources: BTreeMap<String, Source>,
    pub layers: Vec<LayerDefinition>,
    pub glyphs: BTreeMap<String, GlyphSource>,
    pub sprites: BTreeMap<String, SpriteSource>,
    /// e.g. { apiURL: string, ... }
    pub urls: UrlMap,
    pub texture_pack: Rc<TexturePack>,
    pub images: ImageSource,
}

/// # SOURCE WORKER
///
/// The source worker builds the appropriate module defined
/// by the style "sources" object. All tile requests are forwarded to the source
/// worker, where the worker properly builds the requests. Upon creation of a request,
/// the request string is passed to a tile worker to run the fetch and then consequently
/// process.
///
/// GEOJSON / S2JSON is a unique case where the source worker just builds the json
/// locally to avoid processing the same json multiple times per tile worker.
///
/// The glyph map is processed by the source worker. All data is localized to
/// the source worker. When a tile worker requests glyph data, the source will
/// scale up the map and send off the x-y position along with the width-height of
/// each glyph requested.
///
/// SOURCE TYPES
/// S2Tile -> a compact s2tiles file where we request tiles of many file types and compression types
/// (S2)PMTile -> a compact file where we request tiles of many file types and compression types
/// GeoJSON -> a json file containing geo-spatial data
/// S2JSON -> a json file modeled much like geojson
/// Marker -> a json file containing point data or user defined markers
/// Glyph -> either a font or icon file stored in a pbf structure
/// Local -> local build tile information
/// Image -> a collection of images
/// Sprite -> a sprite sheet with json guide of how to use it
/// default -> assumed the location has a metadata. json at root with a "[face/]zoom/x/y.ext" file structure
///
/// SESSION TOKEN
/// This is a pre-approved JWT token for any calls made to api.opens2.com or api.s2maps.io
/// when building requests, we take the current time, run a black box digest to hash, and return:
/// { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
/// (now - timestamp) / 1000 = seconds passed
#[derive(Debug)]
#[allow(missing_docs)]
pub struct SourceWorker {
    pub workers: Vec<MsgSender<TileWorkerMessage>>,
    pub session: Rc<RefCell<Session>>,
    /// { [map_id]: Map }
    pub maps: BTreeMap<MapID, SessionMap>,
    /// The worker pool to send messages to
    pub worker_pool: MsgSender<SourceWorkerMessageOutput>,
}
impl SourceWorker {
    /// Create a new SourceWorker
    pub fn new(worker_pool: MsgSender<SourceWorkerMessageOutput>) -> Self {
        Self {
            workers: vec![],
            session: Rc::new(RefCell::new(Session::new(worker_pool.clone()))),
            maps: BTreeMap::new(),
            worker_pool,
        }
    }

    /// The execution loop. Note the 'async' and taking 'self' by value.
    pub async fn run(mut self, mut receiver: MsgReceiver<SourceWorkerMessages>) -> ! {
        loop {
            let msg = receiver.recv().await;
            self.on_message(msg);
        }
    }

    /// Handle source worker's messages
    ///
    /// ## Parameters
    /// - `msg`: incoming message
    fn on_message(&mut self, msg: SourceWorkerMessages) {
        //     const { data, ports } = msg;
        //     const { type } = data;
        // if (type === 'port') this._load_worker_port(ports[0], ports[1], data.id);
        //     else {
        //       const { map_id } = data;
        //       if (type === 'request_style')
        //         this._request_style(map_id, data.style, data.analytics, data.api_key, data.url_map);
        //       else if (type === 'style') this._load_style(map_id, data.style);
        //       else if (type === 'tilerequest') void this._request_tile(map_id, data.tiles, data.sources);
        //       else if (type === 'timerequest') void this._request_time(map_id, data.tiles, data.source_names);
        //       else if (type === 'glyphrequest')
        //         this._glyph_request(map_id, data.worker_id, data.req_id, data.glyphList);
        //       else if (type === 'addMarkers') this._add_markers(map_id, data.markers, data.source_name);
        //       else if (type === 'deleteMarkers') this._delete_markers(map_id, data.ids, data.source_name);
        //       else if (type === 'deleteSource') this._delete_source(map_id, data.source_names);
        //       else if (type === 'addLayer') this._add_layer(map_id, data.layer, data.index, data.tileRequest);
        //       else if (type === 'deleteLayer') this._delete_layer(map_id, data.index);
        //       else if (type === 'reorderLayers') this._reorder_layers(map_id, data.layer_changes);
        //     }
        todo!()
    }

    /// Load worker. First message that comes in upon creation of this worker
    ///
    /// ## Parameters
    /// - `messagePort`: the communication port to talk listen to a tile worker's messages
    /// - `postPort`: the communication port to send messages to the tile worker
    /// - `id`: the id of the tile worker
    pub fn _load_worker_port(&mut self, post_port: MsgSender<TileWorkerMessage>, id: usize) {
        if self.workers.len() <= id {
            self.workers.resize(id + 1, post_port.clone());
        } else {
            self.workers[id] = post_port.clone();
        }
        self.session.borrow_mut().load_worker(post_port, id);
    }

    /// Request map style given an href
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map asking for the style
    /// - `style`: the href of the style
    /// - `analytics`: basic analytics to know what this browser can handle
    /// - `api_key`: the api key
    /// - `url_map`: the url map
    async fn _request_style(
        &mut self,
        map_id: MapID,
        style: String,
        analytics: Option<S2MapsAnalytics>,
        api_key: Option<String>,
        url_map: Option<UrlMap>,
    ) {
        let session = &mut self.session.borrow_mut();
        // build maps session
        session.load_style(map_id, analytics, api_key);
        // request style
        session.request_style(map_id, style, url_map).await;
    }

    /// Load a style object for a map
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to load the style for
    /// - `style`: the style
    fn _load_style(&self, map_id: MapID, style: StylePackage) {
        //     // pull style data
        //     const {
        //       projection,
        //       gpuType,
        //       minzoom,
        //       maxzoom,
        //       layers,
        //       analytics,
        //       experimental,
        //       api_key,
        //       url_map,
        //     } = style;
        //     let texture_pack = new TexturePack::new();
        //     this.maps[map_id] = {
        //       projection,
        //       gpuType,
        //       minzoom,
        //       maxzoom,
        //       analytics,
        //       experimental,
        //       sources: {},
        //       layers,
        //       glyphs: {},
        //       sprites: {},
        //       urls: url_map ?? {},
        //       texture_pack,
        //       images: new ImageSource('__images', '', texture_pack, this.session),
        //     };
        //     // create a session with the style
        //     this.session.load_style(map_id, analytics, api_key);
        //     // now build sources
        //     void this._build_sources(map_id, style);
        todo!()
    }

    /// Add a style layer to a map
    /// - `map_id`: the id of the map to add the layer to
    /// - `layer`: the style layer
    /// - `index`: the index to add the layer at
    /// - `_tile_request`: the list of tiles of all existing tiles in the map already to adjust
    fn _add_layer(
        &self,
        map_id: MapID,
        layer: LayerDefinition,
        index: Option<u32>,
        _tile_request: Vec<TileRequest>,
    ) {
        //     // add the layer to the tile
        //     const { layers } = this.maps[map_id];
        //     if (index === undefined) layers.push(layer);
        //     else layers.splice(index, 0, layer);
        //     if (index === undefined) index = layers.length;
        //     for (let i = index + 1, ll = layers.length; i < ll; i++) {
        //       const layer = layers[i];
        //       layer.layerIndex++;
        //     }
        //     // tell the correct source to request the tiles and build the layer of interest
        //     // const source = this.sources[map_id][layer.source]
        //     // for (const tile of tiles) source.tileRequest(map_id, { ...tile }, [index])
        todo!()
    }

    /// Delete a style layer
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to delete the layer from
    /// - `index`: the index to delete the layer from
    fn _delete_layer(&mut self, map_id: MapID, index: usize) {
        if let Some(map) = self.maps.get_mut(&map_id) {
            let layers = &mut map.layers;
            layers.remove(index);
            for i in index..layers.len() {
                let layer = &mut layers[i];
                layer.set_layer_index(layer.layer_index() - 1);
            }
        }
    }

    /// Reorder style layers
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to reorder the layers
    /// - `layer_changes`: the layer changes to make
    fn _reorder_layers(&mut self, map_id: MapID, layer_changes: BTreeMap<u32, u32>) {
        let mut size = 1;
        for (from, to) in &layer_changes {
            size = u32::max(size, u32::max(*from, *to) + 1);
        }
        let mut new_layers: Vec<LayerDefinition> = vec![LayerDefinition::default(); size as usize];
        if let Some(map) = self.maps.get_mut(&map_id) {
            let layers = &mut map.layers;
            // move the layer to its new position
            for (from, to) in layer_changes {
                let layer = &mut layers[from as usize];
                layer.set_layer_index(to);
                new_layers[to as usize] = layer.clone();
            }
            // because other classes depend upon the current array, we just update array items
            for i in 0..layers.len() {
                layers[i] = core::mem::take(&mut new_layers[i]);
            }
        }
    }

    /// Build sources for a map given an style object
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `style`: the style object to pull source from
    async fn _build_sources(&self, map_id: MapID, style: StylePackage) {
        //     const { urls, images: mapImages } = this.maps[map_id];
        //     const { sources, layers, fonts, icons, glyphs, sprites, images } = style;
        //     // sources
        //     for (const [name, source] of Object.entries(sources)) {
        //       this._create_source(
        //         map_id,
        //         name,
        //         source,
        //         layers.filter((layer) => layer.source === name),
        //       );
        //     }
        //     // fonts & icons
        //     const glyphAwaits: Array<Promise<undefined | GlyphMetadataUnparsed>> = [];
        //     for (const [name, source] of Object.entries({ ...fonts, ...icons, ...glyphs })) {
        //       glyphAwaits.push(this._create_glyph_source(map_id, name, source));
        //     }
        //     // sprites
        //     const imageAwaits: Array<Promise<undefined | ImageSourceMetadata>> = [];
        //     for (const [name, source] of Object.entries(sprites)) {
        //       if (typeof source === 'object') {
        //         const path = adjustURL(source.path, urls);
        //         imageAwaits.push(this._create_sprite_sheet(map_id, name, path, source.file_type));
        //       } else {
        //         imageAwaits.push(this._create_sprite_sheet(map_id, name, source));
        //       }
        //     }
        //     // images
        //     for (const [name, href] of Object.entries(images)) {
        //       const path = adjustURL(href, urls);
        //       imageAwaits.push(mapImages.addImage(map_id, name, path));
        //     }

        //     // ship the glyph metadata
        //     const glyphMetadata = await Promise.all(glyphAwaits);
        //     const filteredMetadata = glyphMetadata.filter(
        //       (m) => m?.metadata !== undefined,
        //     ) as GlyphMetadata[];
        //     const imageMetadata = await Promise.all(imageAwaits);
        //     const filteredImageMetadata = imageMetadata.filter(
        //       (m) => m !== undefined,
        //     ) as ImageSourceMetadata[];
        //     for (const worker of this.workers) {
        //       const message: GlyphMetadataMessage = {
        //         map_id,
        //         type: 'glyphmetadata',
        //         glyphMetadata: filteredMetadata,
        //         imageMetadata: filteredImageMetadata,
        //       };
        //       worker.postMessage(message);
        //     }
        todo!()
    }

    /// Create a source
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `name`: the name of the source
    /// - `input`: the path to the source
    /// - `layers`: the layers that use this source
    fn _create_source(
        &self,
        map_id: MapID,
        name: String,
        input: StyleSource,
        layers: Vec<LayerDefinition>,
    ) {
        //     const { maps, session } = this;
        //     const { urls, projection, sources } = maps[map_id];
        //     // prepare variables to build appropriate source type
        //     let metadata: SourceMetadata | undefined;
        //     let ext: string | undefined;
        //     if (typeof input === 'object') {
        //       metadata = input as SourceMetadata;
        //       ext = 'extension' in input ? input.extension : input.type;
        //       input = 'path' in input ? (input.path ?? '') : '';
        //     }
        //     if (ext === undefined) ext = (input.split('.').pop() ?? '').toLowerCase();
        //     const needsToken = session.hasAPIKey(map_id);
        //     const path = adjustURL(input, urls);
        //     // create the proper source type
        //     let source;
        //     if (ext === 's2pmtiles' || ext === 'pmtiles') {
        //       source = new S2PMTilesSource(name, projection, layers, path, needsToken, session);
        //     } else if (ext === 's2tiles') {
        //       source = new S2TilesSource(name, projection, layers, path, needsToken, session);
        //     } else if (ext === 'json' || ext === 's2json' || ext === 'geojson') {
        //       source = new JSONSource(name, projection, layers, path, needsToken, session);
        //     } else if (input === '_local') {
        //       source = new LocalSource(name, session, layers);
        //     } else if (input === '_markers') {
        //       source = new MarkerSource(name, session, projection, layers);
        //     } else source = new Source(name, projection, layers, path, needsToken, session); // default -> folder structure
        //     // store & build
        //     sources[name] = source;
        //     void source.build(map_id, metadata);
        todo!()
    }

    /// Create a glyph source and build
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `name`: the name of the source
    /// - `input`: the path to the source
    ///
    /// ## Returns
    /// A list of glyph metadata that's yet to be parsed
    async fn _create_glyph_source(
        &self,
        map_id: MapID,
        name: String,
        input: String,
    ) -> Option<GlyphMetadataUnparsed> {
        //     const { maps, session } = this;
        //     const { urls, texture_pack, glyphs } = maps[map_id];
        //     // check if already exists
        //     if (glyphs[name] !== undefined) return;
        //     const source = new GlyphSource(name, adjustURL(input, urls), texture_pack, session);
        //     glyphs[name] = source;
        //     return await source.build(map_id);
        todo!()
    }

    /// Create a sprite sheet given an input source
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to build the source for
    /// - `name`: the name of the source sprite
    /// - `input`: the path to the source
    /// - `file_type`: the file type (extension)
    ///
    /// ## Returns
    /// The image metadata if successful
    async fn _create_sprite_sheet(
        &mut self,
        map_id: MapID,
        name: String,
        input: String,
        file_type: Option<String>,
    ) -> Option<ImageSourceMetadata> {
        if let Some(map) = self.maps.get_mut(&map_id) {
            // check if already exists
            if map.sprites.contains_key(&name) {
                return None;
            }
            let path = map.urls.adjust_url(input);
            let mut source = SpriteSource::new(
                name.clone(),
                path,
                map.texture_pack.clone(),
                self.session.clone(),
                file_type,
                self.worker_pool.clone(),
            );
            // store & build
            let result = source.build(map_id).await;
            // store for later use
            map.sprites.insert(name, source);

            return result;
        }
        None
    }

    /// Given a tile request, ship out requests for data from all sources
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tiles`: the tile requests
    /// - `sources`: the sources to modify if needed.
    async fn _request_tile(
        &self,
        map_id: MapID,
        tiles: Vec<TileRequest>,
        sources: Option<Vec<(String, Option<String>)>>,
    ) {
        let sources = sources.unwrap_or(vec![]);
        //     const { sources: mapSources } = this.maps[map_id];
        //     const newHrefs = sources.filter((s) => s[1] !== undefined) as Array<
        //       [source_name: string, href: string]
        //     >;
        //     const source_names = sources.map((s) => s[0]);
        //     // if new hrefs update sources
        //     for (const [source_name, href] of newHrefs) {
        //       const source = mapSources[source_name];
        //       if (source !== undefined) {
        //         // steal the layer data and rebuild
        //         this._create_source(map_id, source_name, href, source.styleLayers);
        //       }
        //     }
        //     // build requests
        //     for (const tile of tiles) {
        //       const flush: SourceFlushMessage = {
        //         type: 'flush',
        //         from: 'source',
        //         map_id,
        //         tileID: tile.id,
        //         layersToBeLoaded: new Set<number>(),
        //       };
        //       for (const source of Object.values(mapSources)) {
        //         if (source_names.length > 0 && !source_names.includes(source.name)) continue;
        //         if (source.isTimeFormat) continue;
        //         await source.tileRequest(map_id, { ...tile }, flush);
        //       }
        //       postMessage(flush);
        //     }
        todo!()
    }

    /// Request temporal source data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tiles`: the tile requests with time stamps
    /// - `source_names`: the sources to fetch data for
    async fn _request_time(
        &self,
        map_id: MapID,
        tiles: Vec<TileRequest>,
        source_names: Option<Vec<String>>,
    ) {
        let source_names = source_names.unwrap_or(vec![]);
        //     const { sources: mapSources } = this.maps[map_id];
        //     // build requests
        //     for (const tile of tiles) {
        //       const flush: SourceFlushMessage = {
        //         type: 'flush',
        //         from: 'source',
        //         map_id,
        //         tileID: tile.id,
        //         layersToBeLoaded: new Set<number>(),
        //       };
        //       for (const source of Object.values(mapSources)) {
        //         if (!source.isTimeFormat || !source_names.includes(source.name)) continue;
        //         await source.tileRequest(map_id, { ...tile }, flush);
        //       }
        //       postMessage(flush);
        //     }
        todo!()
    }

    /// Request glyph data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map that needs the glyphs
    /// - `worker_id`: the Tile ID making the request
    /// - `req_id`: the request id, an encoded string tracking metadata about the request
    /// - `source_glyphs`: the glyphs to request, their sources, etc.
    fn _glyph_request(
        &self,
        map_id: MapID,
        worker_id: usize,
        req_id: String,
        source_glyphs: BTreeMap<String, Vec<String>>,
    ) {
        //     // prep
        //     const { maps, workers } = this;
        //     const { glyphs } = maps[map_id];
        //     // iterate the glyph sources for the unicodes
        //     for (const [name, codes] of Object.entries(source_glyphs)) {
        //       void glyphs[name].glyphRequest(codes, map_id, req_id, workers[worker_id]);
        //     }
        todo!()
    }

    /// Add marker(s) to the map
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to add marker(s) to
    /// - `markers`: the marker(s) to add
    /// - `source_name`: the name of the source to add the marker(s) to
    fn _add_markers(&self, map_id: MapID, markers: Vec<MarkerDefinition>, source_name: String) {
        if let Some(marker_source) = self._get_marker_source(map_id, source_name) {
            for marker in markers {
                marker_source.add_marker(marker);
            }
        }
    }

    /// Delete marker(s) from the map
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to delete marker(s) from
    /// - `ids`: the id(s) of the marker(s) to delete
    /// - `source_name`: the name of the source to delete the marker(s) from
    fn _delete_markers(&self, map_id: MapID, ids: Vec<u64>, source_name: String) {
        if let Some(marker_source) = self._get_marker_source(map_id, source_name) {
            marker_source.delete_markers(&ids);
        }
    }

    /// Get the marker source
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `source_name`: the name of the source
    ///
    /// ## Returns
    /// The marker source if found
    fn _get_marker_source(&self, map_id: MapID, source_name: String) -> Option<&mut MarkerSource> {
        //     const { sources, layers, projection } = self.maps[map_id];
        //     if (sources === undefined) throw new Error(`Map ${map_id} does not exist`);
        //     if (sources[source_name] === undefined)
        //       sources[source_name] = new MarkerSource(source_name, self.session, projection, layers);
        //     return sources[source_name] as MarkerSource | undefined;
        todo!()
    }

    /// Delete source(s) from the map
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to delete the source from
    /// - `source_names`: the name(s) of the source(s) to delete
    fn _delete_source(&mut self, map_id: MapID, source_names: Vec<String>) {
        let map = self.maps.get_mut(&map_id).unwrap();
        for source_name in source_names {
            map.sources.remove(&source_name);
        }
    }
}

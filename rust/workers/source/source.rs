// import { idParent, idToIJ } from 'gis-tools/index.js';
// import type { Session } from './index.js';
// import type {
//   Attributions,
//   Encoding,
//   LayerDefinition,
//   LayersMetaData,
//   Projection,
//   Scheme,
//   SourceMetadata,
//   SourceType,
//   VectorLayer,
// } from 'style/style.spec.js';
// import type { ParentLayers, SourceFlush_message, TileRequest } from '../worker.spec.js';
use crate::{
    style::{LayerDefinition, Projection, SourceMetadata},
    workers::{MapID, Session, SourceFlushMessage, TileRequest},
};
use alloc::{collections::BTreeSet, string::String, vec::Vec};
use s2_tilejson::{Attributions, Encoding, LayersMetaData, Scheme, SourceType};
use s2json::Face;
use serde::de::DeserializeOwned;

/// # Generic Data Source Methods
pub trait Source {
    /// Grab the Base Source for fundamental attributes used by all sources
    fn base(&mut self) -> &mut BaseSource;

    // if this function runs, we assume default tile source
    /**
     * If this function runs, we assume a default quad-tree tile source
     * @param map_id - the id of the map that is requesting data
     * @param metadata - the metadata for the source
     */
    async fn build(&mut self, map_id: MapID, metadata: Option<SourceMetadata>) {
        // if (metadata === undefined)
        //   metadata = await this._fetch<SourceMetadata>(`${this.path}/metadata.json`, map_id, true);
        // if (metadata === undefined) {
        //   this.active = false;
        //   console.error(`FAILED TO extrapolate ${this.path} metadata`);
        // } else {
        //   this._build_metadata(metadata, map_id);
        // }
    }

    /**
     * If no data, we still have to let the tile worker know so it can prepare a proper flush
     * as well as manage cases like "invert" type data.
     * @param map_id - the id of the map
     * @param tile - the tile request
     * @param source_name - the source name the data to belongs to
     */
    fn flush(&mut self, map_id: MapID, tile: TileRequest, source_name: String) {
        // // compress
        // const data = textEncoder.encode('{"layers":{}}').buffer;
        // // send off
        // const worker = session.requestWorker();
        // worker.postMessage({ map_id, type: 'jsondata', tile, source_name, data }, [data]);
        todo!()
    }

    /// All tile requests undergo a basic check on whether that data exists
    /// within the metadata boundaries. layerIndexes exists to set a boundary
    /// of what layers the map is interested in (caused by style change add/edit layer)
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tile`: the tile request
    /// - `source_name`: the name of the source
    async fn tile_request(
        &mut self,
        map_id: MapID,
        tile: TileRequest,
        flush_message: SourceFlushMessage,
    ) {
        //     const { layersToBeLoaded } = flush_message;
        //     // if the source isn't ready yet, we wait for the metadata to be built
        //     await this.ready;
        //     // inject layerIndexes
        //     this.#getLayerIndexes(tile, layersToBeLoaded);
        //     // now make requests for parent data as necessary
        //     this.#getParentData(map_id, tile, layersToBeLoaded);
        //     // pull out data, check if data exists in bounds, then request
        //     const { active, minzoom, maxzoom, faces, name } = this;
        //     const { face, zoom } = tile;
        //     if (
        //       // massive quality check to not over burden servers / lambdas with duds
        //       active && // we have the correct properties to make proper requests
        //       minzoom <= zoom &&
        //       maxzoom >= zoom && // check zoom bounds
        //       faces.has(face) // check the face exists
        //     ) {
        //       // request
        //       void this._tileRequest(map_id, tile, name);
        //     } else {
        //       // flush to let tile know what layers should be cleaned
        //       this._flush(map_id, tile, name);
        //     }
    }

    /// If this function runs, we assume default quad-tree tile source.
    /// In the default case, we want the worker to process the data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tile`: the tile request
    /// - `source_name`: the name of the source
    async fn _tile_request(&mut self, map_id: MapID, tile: TileRequest, source_name: String) {
        let BaseSource { path, session, r#type, extension, size, .. } = self.base();
        // const { parent } = tile;
        // const { time, face, zoom, i, j } = parent ?? tile;
        // const location =
        //   `${time !== undefined ? String(time) + '/' : ''}` +
        //   (this.scheme === 'xyz'
        //     ? `${zoom}/${i}/${j}.${extension}`
        //     : `${face}/${zoom}/${i}/${j}.${extension}`);

        // const data = await this._fetch<ArrayBuffer>(`${path}/${location}`, map_id);
        // if (data !== undefined) {
        //   const worker = session.requestWorker();
        //   worker.postMessage({ map_id, type, tile, source_name, data, size }, [data]);
        // } else {
        //   this._flush(map_id, tile, source_name);
        // }
    }

    /**
     * Internal tool to builds the metadata for the source
     * @param metadata - the source metadata
     * @param map_id - the id of the map that we will be shipping the render data to
     */
    fn _build_metadata(&mut self, metadata: SourceMetadata, map_id: MapID) {
        self.base().active = true; // incase we use a "broken" aproach for metadata and insert later
        // let minzoom = metadata.minzoom();
        // let maxzoom = metadata.maxzoom();
        //     this.minzoom = !isNaN(minzoom) ? minzoom : 0;
        //     this.maxzoom = Math.min(!isNaN(maxzoom) ? maxzoom : 20, this.maxzoom);
        //     if (Array.isArray(metadata.faces)) this.faces = new Set(metadata.faces ?? [0, 1, 2, 3, 4, 5]);
        //     if (typeof metadata.extension === 'string') this.extension = metadata.extension;
        //     this.attributions = metadata.attributions ?? {};
        //     this.type = parse_meta_type(metadata.type);
        //     if (typeof metadata.size === 'number') this.size = metadata.size;
        //     this.encoding = metadata.encoding ?? 'none';
        //     if (typeof metadata.layers === 'object') {
        //       // cleanup the fields property
        //       this.layers = metadata.layers;
        //     }
        //     // other engines that have built data store layer data differently  :
        //     const vectorLayers = Array.isArray(metadata.vector_layers)
        //       ? metadata.vector_layers
        //       : typeof metadata.json === 'string'
        //         ? (JSON.parse(metadata.json).vector_layers as VectorLayer[])
        //         : undefined;
        //     if (vectorLayers !== undefined) {
        //       this.layers = {};
        //       for (const layer of vectorLayers) {
        //         if (layer.id === undefined) continue;
        //         const { minzoom, maxzoom } = layer;
        //         this.layers[layer.id] = {
        //           minzoom: minzoom ?? 0,
        //           maxzoom: maxzoom ?? this.maxzoom,
        //           drawTypes: [],
        //           shape: {},
        //         };
        //       }
        //     }
        //     // time series data check
        //     if (metadata.scheme !== undefined) this.scheme = metadata.scheme;
        //     else if (metadata.format !== undefined && metadata.format !== 'pbf') {
        //       this.scheme = metadata.format as Scheme;
        //       this.is_time_format = metadata.format === 'tfzxy';
        //     }
        //     if (this.scheme === 'xyz') this.faces.add(0);
        //     if (this.is_time_format) {
        //       postMessage({
        //         map_id,
        //         type: 'timesource',
        //         source_name: this.name,
        //         interval: metadata.interval,
        //       });
        //     }
        //     // once the metadata is complete, we should check if any tiles were queued
        //     this.resolve();
        //     // if attributions, we send them off
        //     const attributions = { ...this.attributions };
        //     if (Object.keys(attributions).length > 0)
        //       postMessage({ map_id, type: 'attributions', attributions });
    }

    /**
     * Fetch a tile
     * @param path - the base path to the tile data
     * @param map_id - the id of the map
     * @param json - flag indicating if the data is json
     * @returns the raw data or JSON metadata if found
     */
    async fn _fetch<T: DeserializeOwned>(path: String, map_id: MapID) -> T {
        //     const headers: { Authorization?: string } = {};
        //     if (this.needs_token) {
        //       const Authorization = await this.session.requestSessionToken(map_id);
        //       if (Authorization === 'failed') return;
        //       if (Authorization !== undefined) headers.Authorization = Authorization;
        //     }
        //     const res = await fetch(path, { headers });
        //     if (res.status !== 200 && res.status !== 206) return;
        //     if (json || (res.headers.get('content-type') ?? '').includes('application/json'))
        //       return await res.json();
        //     return (await res.arrayBuffer()) as unknown as Promise<T>;
        todo!()
    }
}

/**
 * # Generic Data Source Container
 *
 * This class is wrapped by many other source types. It serves to handle all the generic cases
 * of data sources like fetching metadata, handling flushes, and so on.
 */
#[derive(Debug)]
pub struct BaseSource {
    /// Flag indicating if the source is active/working
    pub active: bool, // = true;
    // /// Resolver letting us know when the source is built
    //   resolve: (value: void | PromiseLike<void>) => void = () => {};
    //   ready = new Promise<void>((resolve) => {
    //     this.resolve = resolve;
    //   });
    /// Name of the source
    pub name: String,
    /// URL Path to the source
    pub path: String,
    /// Type of the source
    pub r#type: SourceType, // = 'vector'; // how to process the result
    /// Extension of the source
    pub extension: String, // = 'pbf';
    /// Encoding of the source
    pub encoding: Encoding, // = 'none';
    /// Scheme of the source
    pub scheme: Scheme, // = 'xyz';
    /// Either WM or S2
    pub projection: Projection,
    /// Flag indicating if the source is a time series
    pub is_time_format: bool, // = false;
    /// Attributions
    pub attributions: Attributions, // = {};
    /// Style layers
    pub style_layers: Vec<LayerDefinition>,
    /// Layer metadata if available
    pub layers: Option<LayersMetaData>,
    /// Minimum zoom level
    pub minzoom: u8, // = 0;
    /// Maximum zoom level
    pub maxzoom: u8, // = 20;
    /// Size - used for raster type sources
    pub size: u32, // = 512,
    /// Faces - used as filter for S2 sources
    pub faces: BTreeSet<Face>, // = new Set<number>();
    /// Flag indicating if the source needs a token
    pub needs_token: bool,
    /// Time
    pub time: Option<f64>,
    /// The session should it be neeeded
    pub session: Session,
}
impl Default for BaseSource {
    fn default() -> Self {
        Self {
            active: false,
            name: "".into(),
            path: "".into(),
            r#type: SourceType::Vector,
            extension: String::from("pbf"),
            encoding: Encoding::None,
            scheme: Scheme::Xyz,
            projection: Projection::S2,
            is_time_format: false,
            attributions: Attributions::new(),
            layers: None,
            minzoom: 0,
            maxzoom: 20,
            size: 512,
            faces: BTreeSet::new(),
            style_layers: Vec::new(),
            needs_token: false,
            time: None,
            session: Session::default(),
        }
    }
}
impl BaseSource {
    /**
     * @param name - name of the source
     * @param projection - the projection used
     * @param layers - the style layers that are associated with this source
     * @param path - the path to the source to fetch data
     * @param needs_token - flag indicating if the source requires a token in the fetch
     * @param session - the session that works with the token to make valid fetch requests on source data behind an API
     */
    pub fn new(
        name: String,
        projection: Projection,
        style_layers: Vec<LayerDefinition>,
        path: String,
        needs_token: Option<bool>, // = false,
        session: Session,
    ) -> Self {
        let needs_token = needs_token.unwrap_or(false);
        Self { name, path, projection, style_layers, session, needs_token, ..Default::default() }
    }
}

//   /**
//    * Get the layer indexes that this tile is interested in
//    * @param tile - the tile request
//    * @param layersToLoad - the set of layers to load we are going to modify
//    */
//   #getLayerIndexes(tile: TileRequest, layersToLoad: Set<number>): void {
//     const { layers, style_layers } = this;
//     const { zoom } = tile;
//     const layerIndexes: number[] = [];
//     if (layers === undefined) return;

//     for (let l = 0, ll = style_layers.length; l < ll; l++) {
//       const layer = style_layers[l];
//       if (layer === undefined || layers[layer.layer] === undefined) continue;
//       const { minzoom, maxzoom } = layers[layer.layer];
//       if (minzoom <= zoom && maxzoom >= zoom) layerIndexes.push(layer.layerIndex);
//     }

//     tile.layerIndexes = layerIndexes;
//     for (const index of layerIndexes) layersToLoad.add(index);
//   }

//   /**
//    * Get the parent data that this tile is interested in
//    * @param map_id - the id of the map that is requesting
//    * @param tile - the tile request
//    * @param layersToLoad - the set of layers to load
//    */
//   #getParentData(map_id: MapID, tile: TileRequest, layersToLoad: Set<number>): void {
//     const { layers, style_layers, name } = this;
//     if (layers === undefined) return;
//     // pull out data
//     const { time, face, zoom, id } = tile;
//     // setup parentLayers
//     const parentLayers: ParentLayers = {};
//     // iterate over layers and found any data doesn't exist at current zoom but the style asks for
//     for (const { layer, layerIndex, maxzoom } of style_layers) {
//       const sourceLayer = layers[layer];
//       const sourceLayerMaxZoom = sourceLayer?.maxzoom;
//       if (maxzoom > zoom && sourceLayer !== undefined && sourceLayerMaxZoom < zoom) {
//         // we have passed the limit at which this data is stored. Rather than
//         // processing the data more than once, we reference where to look for the layer
//         let pZoom = zoom;
//         let newID = id;
//         while (pZoom > sourceLayerMaxZoom) {
//           pZoom--;
//           newID = idParent(newID);
//         }
//         const newIDString = newID.toString();
//         // pull out i & j
//         const [, i, j] = idToIJ(newID, pZoom);
//         // store parent reference
//         if (parentLayers[newIDString] === undefined) {
//           parentLayers[newIDString] = {
//             time,
//             face,
//             id: newID,
//             zoom: pZoom,
//             i,
//             j,
//             layerIndexes: [],
//           };
//         }
//         parentLayers[newIDString].layerIndexes.push(layerIndex);
//         // filter out the index from the tile
//         tile.layerIndexes?.filter((index) => index !== layerIndex);
//       }
//     }
//     // if we stored any parent layers, make the necessary requests
//     for (const parent of Object.values(parentLayers)) {
//       for (const index of parent.layerIndexes) layersToLoad.add(index);
//       void this._tileRequest(map_id, { ...tile, parent }, name);
//     }
//   }
// }

// /**
//  * Basic parsing tool to ensure the source type is valid
//  * @param type - the source type
//  * @returns the parsed source type
//  */
// fn parse_meta_type(type: string = '') -> SourceType {
//   if (['vector', 'json', 'raster', 'raster-dem', 'sensor', 'overlay'].includes(type))
//     return type as SourceType;
//   return 'vector';
// }

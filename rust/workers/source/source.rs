use crate::{
    style::{LayerDefinition, Projection, SourceMetadata},
    util::Promise,
    workers::{
        AttributionsMessage, JSONDataMessage, MapID, RasterMessage, Session, SourceFlushMessage,
        SourceWorkerMessage, SourceWorkerMessageOutput, TileLayer, TileRequest, TileWorkerMessage,
        TileWorkerMessages, TimeSourceMessage, VectorMessage,
    },
};
use alloc::{collections::BTreeSet, rc::Rc, string::String, vec::Vec};
use core::cell::RefCell;
use gistools::{data_structures::Tile, geometry::S2CellId, util::fetch_url};
use s2_tilejson::{Encoding, LayersMetaData, Scheme, SourceType, VectorLayer};
use s2json::{Attributions, Face};
use serde::de::DeserializeOwned;
use std::collections::BTreeMap;

/// # Generic Data Source Methods
pub trait SourceSpec<M: Clone + Default + DeserializeOwned = ()> {
    /// Grab the Base Source for fundamental attributes used by all sources
    fn base(&mut self) -> &mut BaseSource;

    /// If this function runs, we assume a default quad-tree tile source
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map that is requesting data
    /// - `metadata`: the metadata for the source
    #[allow(async_fn_in_trait)]
    async fn build(&mut self, map_id: MapID, mut metadata: Option<SourceMetadata<M>>) {
        let path = format!("{:?}/metadata.json", self.base().path);
        if metadata.is_none() {
            metadata = self._fetch::<SourceMetadata<M>>(path, map_id).await;
        }
        if metadata.is_none() {
            self.base().active = false;
            // panic!("FAILED TO extrapolate {path} metadata");
            return;
        } else {
            self._build_metadata(metadata.unwrap(), map_id).await;
        }
    }

    /// If no data, we still have to let the tile worker know so it can prepare a proper flush
    /// as well as manage cases like "invert" type data.
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tile`: the tile request
    /// - `source_name`: the source name the data to belongs to
    #[allow(async_fn_in_trait)]
    async fn flush(&mut self, map_id: MapID, tile: TileRequest, source_name: String) {
        // send off
        let session = &mut self.base().session.borrow_mut();
        let worker = session.request_worker();
        worker
            .send(TileWorkerMessage {
                map_id,
                message: TileWorkerMessages::JSONData(Box::new(JSONDataMessage {
                    tile: tile.clone(),
                    source_name,
                    vector_tile: Tile::new(tile.layer.id),
                })),
            })
            .await;
    }

    /// All tile requests undergo a basic check on whether that data exists
    /// within the metadata boundaries. layer_indexes exists to set a boundary
    /// of what layers the map is interested in (caused by style change add/edit layer)
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tile`: the tile request
    /// - `source_name`: the name of the source
    #[allow(async_fn_in_trait)]
    async fn tile_request(
        &mut self,
        map_id: MapID,
        tile: &mut TileRequest,
        flush_message: &mut SourceFlushMessage,
    ) {
        // if the source isn't ready yet, we wait for the metadata to be built
        self.base().ready.wait().await;
        // inject layer_indexes
        self._get_layer_indexes(tile, &mut flush_message.layers_to_be_loaded);
        // now make requests for parent data as necessary
        self._get_parent_data(map_id, tile, &mut flush_message.layers_to_be_loaded).await;
        // pull out data, check if data exists in bounds, then request
        let BaseSource { active, minzoom, maxzoom, .. } = *self.base();
        let name = self.base().name.clone();
        let TileLayer { face, zoom, .. } = tile.layer;
        if
        // massive quality check to not over burden servers / lambdas with duds
        active && // we have the correct properties to make proper requests
              minzoom <= zoom &&
              maxzoom >= zoom && // check zoom bounds
              self.base().faces.contains(&face)
        // check the face exists
        {
            // request
            self._tile_request(map_id, tile.clone(), name).await;
        } else {
            // flush to let tile know what layers should be cleaned
            self.flush(map_id, tile.clone(), name).await;
        }
    }

    /// If this function runs, we assume default quad-tree tile source.
    /// In the default case, we want the worker to process the data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tile`: the tile request
    /// - `source_name`: the name of the source
    #[allow(async_fn_in_trait)]
    async fn _tile_request(&mut self, map_id: MapID, tile: TileRequest, source_name: String) {
        let TileLayer { time, face, zoom, i, j, .. } = tile.parent.as_ref().unwrap_or(&tile.layer);
        let face: u8 = (*face).into();
        let path = self.base().path.clone();
        let extension = self.base().extension.clone();
        let mut location = format!("{face}/{zoom}/{i}/{j}.{extension}");
        if let Some(time) = time {
            location = format!("{time}/{location}");
        }

        let data: Option<Vec<u8>> = self._fetch(format!("{path}/{location}"), map_id).await;
        if let Some(data) = data {
            let r#type = self.base().r#type.clone();
            let size = self.base().size;
            let session = &mut self.base().session.borrow_mut();
            let worker = session.request_worker();
            let message: TileWorkerMessages = if r#type == SourceType::Vector {
                TileWorkerMessages::Vector(Box::new(VectorMessage { tile, source_name, data }))
            } else {
                TileWorkerMessages::Raster(Box::new(RasterMessage {
                    tile,
                    source_name,
                    data,
                    size,
                }))
            };
            worker.send(TileWorkerMessage { map_id, message }).await;
        } else {
            self.flush(map_id, tile.clone(), source_name).await;
        }
    }

    /// Internal tool to builds the metadata for the source
    ///
    /// ## Parameters
    /// - `metadata`: the source metadata
    /// - `map_id`: the id of the map that we will be shipping the render data to
    #[allow(async_fn_in_trait)]
    async fn _build_metadata(&mut self, metadata: SourceMetadata<M>, map_id: MapID) {
        let metadata = metadata.meta();
        if metadata.is_none() {
            self.base().active = false;
            return;
        }
        let metadata = metadata.unwrap();
        let base = &mut self.base();
        base.active = true;
        // incase we use a "broken" aproach for metadata and insert later
        let minzoom = metadata.minzoom;
        let maxzoom = metadata.maxzoom;
        base.minzoom = minzoom;
        base.maxzoom = u8::min(u8::min(maxzoom, 20), base.maxzoom);
        if !metadata.faces.is_empty() {
            base.faces = metadata.faces.clone().into_iter().collect();
        }
        base.extension = metadata.extension.clone();
        base.attributions = metadata.attributions.clone();
        base.r#type = metadata.r#type.clone();
        base.encoding = metadata.encoding.clone();
        base.layers = metadata.layers.clone();
        // other engines that have built data store layer data differently
        base.vector_layers = metadata.vector_layers.clone();
        // time series data check
        base.scheme = metadata.scheme.clone();
        base.is_time_format = base.scheme == Scheme::Tfzxy || base.scheme == Scheme::Txyz;
        if base.is_time_format {
            let session = &mut base.session.borrow_mut();
            session
                .worker_pool
                .send(SourceWorkerMessageOutput {
                    map_id,
                    message: SourceWorkerMessage::TimeSource(TimeSourceMessage {
                        source_name: base.name.clone(),
                        interval: metadata.interval.unwrap_or_default(),
                    }),
                })
                .await;
        }
        // once the metadata is complete, we should check if any tiles were queued
        base.ready.resolve();
        // if attributions, we send them off
        if !base.attributions.is_empty() {
            let session = &mut base.session.borrow_mut();
            session
                .worker_pool
                .send(SourceWorkerMessageOutput {
                    map_id,
                    message: SourceWorkerMessage::Attributions(AttributionsMessage {
                        attributions: base.attributions.clone(),
                    }),
                })
                .await;
        }
    }

    /// Fetch a tile
    ///
    /// ## Parameters
    /// - `path`: the base path to the tile data
    /// - `map_id`: the id of the map
    /// - `json`: flag indicating if the data is json
    ///
    /// ## Returns
    /// The raw data or JSON metadata if found
    #[allow(async_fn_in_trait)]
    async fn _fetch<T: DeserializeOwned>(&mut self, path: String, map_id: MapID) -> Option<T> {
        let mut headers: Vec<(&str, &str)> = vec![];
        let authorization: Option<String>;
        let session = &mut self.base().session.borrow_mut();
        if session.has_api_key(&map_id) {
            authorization = session.request_session_token(map_id).await;
            if authorization.is_none() || authorization == Some("failed".into()) {
                return None;
            }
            headers.push(("Authorization", authorization.as_ref().unwrap().as_str()));
        }

        let res = fetch_url::<()>(&path, &headers, None, None).await;
        if res.is_err() {
            return None;
        }

        let data = res.unwrap();
        let json = serde_json::from_slice(&data).unwrap();
        Some(json)
    }

    /// Get the parent data that this tile is interested in
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map that is requesting
    /// - `tile`: the tile request
    /// - `layers_to_load`: the set of layers to load
    #[allow(async_fn_in_trait)]
    async fn _get_parent_data(
        &mut self,
        map_id: MapID,
        tile: &mut TileRequest,
        layers_to_load: &mut BTreeSet<u32>,
    ) {
        let name = self.base().name.clone();
        // setup parent_layers
        let mut parent_layers = BTreeMap::<S2CellId, TileLayer>::new();
        {
            let BaseSource { layers, style_layers, .. } = self.base();
            if layers.is_empty() {
                return;
            }
            // pull out data
            let TileLayer { time, face, zoom, id, .. } = tile.layer;
            // iterate over layers and found any data doesn't exist at current zoom but the style asks for
            for style_layer in style_layers {
                let layer = style_layer.layer();
                let layer_index = style_layer.layer_index();
                let maxzoom = style_layer.base().maxzoom;
                let Some(source_layer) = layers.get(&layer) else { continue };
                let source_layer_max_zoom = source_layer.maxzoom;
                if maxzoom > zoom && source_layer_max_zoom < zoom {
                    // we have passed the limit at which this data is stored. Rather than
                    // processing the data more than once, we reference where to look for the layer
                    let mut p_zoom = zoom;
                    let mut new_id = id;
                    while p_zoom > source_layer_max_zoom {
                        p_zoom -= 1;
                        new_id = new_id.parent(None);
                    }
                    // pull out i & j
                    let (_, i, j, _) = new_id.to_face_ij_orientation(Some(p_zoom));
                    // store parent reference
                    if !parent_layers.contains_key(&new_id) {
                        parent_layers.insert(
                            new_id,
                            TileLayer {
                                time,
                                face,
                                id: new_id,
                                zoom: p_zoom,
                                i,
                                j,
                                layer_indexes: vec![],
                            },
                        );
                    }
                    parent_layers.get_mut(&new_id).unwrap().layer_indexes.push(layer_index);
                    // filter out the index from the tile
                    tile.layer.layer_indexes = tile
                        .layer
                        .layer_indexes
                        .clone()
                        .into_iter()
                        .filter(|index| *index != layer_index)
                        .collect();
                }
            }
        }
        // if we stored any parent layers, make the necessary requests
        for parent in parent_layers.values() {
            for index in &parent.layer_indexes {
                layers_to_load.insert(*index);
            }
            // make the request
            let mut tile_clone = tile.clone();
            tile_clone.parent = Some(parent.clone());
            self._tile_request(map_id, tile_clone, name.clone()).await;
        }
    }

    /// Get the layer indexes that this tile is interested in
    ///
    /// ## Parameters
    /// - `tile`: the tile request
    /// - `layers_to_load`: the set of layers to load we are going to modify
    fn _get_layer_indexes(&mut self, tile: &mut TileRequest, layers_to_load: &mut BTreeSet<u32>) {
        let BaseSource { layers, style_layers, .. } = self.base();
        if layers.is_empty() {
            return;
        }
        let zoom = tile.layer.zoom;
        let mut layer_indexes: Vec<u32> = vec![];

        for l in 0..style_layers.len() {
            let layer = &style_layers[l];
            if let Some(layer_meta) = layers.get_mut(&layer.layer()) {
                if layer_meta.minzoom <= zoom && layer_meta.maxzoom >= zoom {
                    layer_indexes.push(layer.layer_index());
                }
            }
        }

        for index in &layer_indexes {
            layers_to_load.insert(*index);
        }
        tile.layer.layer_indexes = layer_indexes;
    }
}

/// # Generic Data Source Container
///
/// This class is wrapped by many other source types. It serves to handle all the generic cases
/// of data sources like fetching metadata, handling flushes, and so on.

#[derive(Debug)]
pub struct BaseSource {
    /// Flag indicating if the source is active/working
    pub active: bool,
    /// Promise letting us know when the source is built
    pub ready: Promise,
    /// Name of the source
    pub name: String,
    /// URL Path to the source
    pub path: String,
    /// Type of the source
    pub r#type: SourceType, // how to process the result
    /// Extension of the source
    pub extension: String,
    /// Encoding of the source
    pub encoding: Encoding,
    /// Scheme of the source
    pub scheme: Scheme,
    /// Either WM or S2
    pub projection: Projection,
    /// Flag indicating if the source is a time series
    pub is_time_format: bool,
    /// Attributions
    pub attributions: Attributions,
    /// Style layers
    pub style_layers: Vec<LayerDefinition>,
    /// Layer metadata if available
    pub layers: LayersMetaData,
    /// Vector Layer metadata if available
    pub vector_layers: Vec<VectorLayer>,
    /// Minimum zoom level
    pub minzoom: u8,
    /// Maximum zoom level
    pub maxzoom: u8,
    /// Size - used for raster type sources
    pub size: u32,
    /// Faces - used as filter for S2 sources
    pub faces: BTreeSet<Face>,
    /// Flag indicating if the source needs a token
    pub needs_token: bool,
    /// Time
    pub time: Option<f64>,
    /// The session should it be neeeded
    pub session: Rc<RefCell<Session>>,
}
impl BaseSource {
    /// Create a new source
    ///
    /// ## Parameters
    /// - `name`: name of the source
    /// - `projection`: the projection used
    /// - `layers`: the style layers that are associated with this source
    /// - `path`: the path to the source to fetch data
    /// - `needs_token`: flag indicating if the source requires a token in the fetch
    /// - `session`: the session that works with the token to make valid fetch requests on source data behind an API
    pub fn new(
        name: String,
        projection: Projection,
        style_layers: Vec<LayerDefinition>,
        path: String,
        needs_token: Option<bool>,
        session: Rc<RefCell<Session>>,
    ) -> Self {
        let needs_token = needs_token.unwrap_or(false);
        Self {
            name,
            path,
            projection,
            style_layers,
            session,
            needs_token,
            active: true,
            ready: Promise::new(),
            r#type: SourceType::Vector,
            extension: String::from("pbf"),
            encoding: Encoding::None,
            scheme: Scheme::Xyz,
            is_time_format: false,
            attributions: Attributions::new(),
            layers: BTreeMap::new(),
            vector_layers: vec![],
            minzoom: 0,
            maxzoom: 20,
            size: 512,
            faces: BTreeSet::from([0.into(), 1.into(), 2.into(), 3.into(), 4.into(), 5.into()]),
            time: None,
        }
    }
}

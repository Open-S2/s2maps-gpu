use crate::{
    style::{LayerDefinition, Projection, SourceMetadata},
    workers::{
        JSONDataMessage, MapID, Session, SourceFlushMessage, TileLayer, TileRequest,
        TileWorkerMessage, TileWorkerMessages,
    },
};
use alloc::{collections::BTreeMap, rc::Rc, string::String};
use core::cell::RefCell;
use gistools::{
    data_structures::{Layer, Tile, TransformVectorGeometry},
    geometry::convert,
};
use s2json::{BBox, Face, JSONCollection, Properties, VectorFeature, VectorGeometry, VectorPoint};
use serde::{Deserialize, Serialize};

/// Marker metadata
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarkerMetadata {
    /// HTMLElement as a string
    pub html: Option<String>,
}

/// Marker definition tracking lon/lat, html, and properties associated with it
#[derive(Debug, Default, Clone, PartialEq)]
pub struct MarkerDefinition {
    /// The id of the marker
    pub id: Option<u64>,
    /// The face of the marker
    pub face: Face,
    /// The properties of the marker
    pub properties: Properties,
    /// The point of the marker
    pub point: VectorPoint,
    /// The metadata of the marker
    pub metadata: Option<MarkerMetadata>,
}

/// A storage container for Marker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct Marker {
    pub id: u64,
    pub metadata: Option<MarkerMetadata>,
    pub properties: Properties,
    pub geometry: VectorPoint,
}

/// # Marker Source
///
/// Store, process, and render markers. Handles both WM and S2 projections
#[derive(Debug)]
#[allow(missing_docs)]
pub struct MarkerSource {
    pub name: String,
    pub projection: Projection,
    pub is_time_format: bool,
    pub style_layers: Vec<LayerDefinition>,
    pub id_gen: u64,
    pub _0: BTreeMap<u64, Marker>,
    pub _1: BTreeMap<u64, Marker>,
    pub _2: BTreeMap<u64, Marker>,
    pub _3: BTreeMap<u64, Marker>,
    pub _4: BTreeMap<u64, Marker>,
    pub _5: BTreeMap<u64, Marker>,
    pub session: Rc<RefCell<Session>>,
}
impl MarkerSource {
    /// Create a new marker source
    ///
    /// ## Parameters
    /// - `name`: name of the source
    /// - `session`: the session associated with the source data
    /// - `projection`: the projection to use (WM or S2)
    /// - `layers`: the style layers associated with this source
    pub fn new(
        &self,
        name: String,
        session: Rc<RefCell<Session>>,
        projection: Projection,
        style_layers: Vec<LayerDefinition>,
    ) -> Self {
        Self {
            name,
            session,
            projection,
            style_layers,
            is_time_format: false,
            id_gen: 0,
            _0: BTreeMap::new(),
            _1: BTreeMap::new(),
            _2: BTreeMap::new(),
            _3: BTreeMap::new(),
            _4: BTreeMap::new(),
            _5: BTreeMap::new(),
        }
    }

    /// Grab the store give a face
    pub fn get_face(&self, face: Face) -> &BTreeMap<u64, Marker> {
        match face {
            Face::Face0 => &self._0,
            Face::Face1 => &self._1,
            Face::Face2 => &self._2,
            Face::Face3 => &self._3,
            Face::Face4 => &self._4,
            Face::Face5 => &self._5,
        }
    }

    /// Grab the store give a face
    pub fn get_face_mut(&mut self, face: Face) -> &mut BTreeMap<u64, Marker> {
        match face {
            Face::Face0 => &mut self._0,
            Face::Face1 => &mut self._1,
            Face::Face2 => &mut self._2,
            Face::Face3 => &mut self._3,
            Face::Face4 => &mut self._4,
            Face::Face5 => &mut self._5,
        }
    }

    /// Build the source
    ///
    /// ## Parameters
    /// - `_map_id`: the id of the map (unused)
    /// - `metadata`: the metadata associated with the source
    pub fn build(&mut self, _map_id: MapID, metadata: Option<SourceMetadata<MarkerMetadata>>) {
        let json: Option<JSONCollection<MarkerMetadata>> = metadata.map(|m| m.data).unwrap();
        if let Some(json) = json {
            let features = convert(self.projection.into(), &json, Some(true), Some(true));
            for feature in &features {
                let VectorFeature { id, face, properties, geometry, .. } = feature;
                if matches!(geometry, VectorGeometry::Point(_)) {
                    self.add_marker(MarkerDefinition {
                        point: geometry.point().unwrap().clone(),
                        face: face.clone(),
                        properties: properties.clone(),
                        id: id.clone(),
                        metadata: feature.metadata.clone(),
                    });
                } else if matches!(geometry, VectorGeometry::MultiPoint(_)) {
                    for point in geometry.multipoint().unwrap() {
                        self.add_marker(MarkerDefinition {
                            point: point.clone(),
                            face: face.clone(),
                            properties: properties.clone(),
                            id: id.clone(),
                            metadata: feature.metadata.clone(),
                        });
                    }
                }
            }
        }
    }

    /// Add marker to the source
    ///
    /// ## Parameters
    /// - `marker`: the marker to add
    pub fn add_marker(&mut self, marker: MarkerDefinition) {
        let MarkerDefinition { point, face, mut properties, id, metadata } = marker;
        let mut id = id.clone();
        // if no id, let's create one
        if id.is_none() {
            self.id_gen += 1;
            id = Some(self.id_gen);
            if self.id_gen >= u64::MAX {
                self.id_gen = 0;
            }
        }
        let id = id.unwrap();
        // store
        properties.insert("__marker_id".into(), id.into());
        let marker = Marker { id, metadata, properties, geometry: point };
        let face_store = self.get_face_mut(face);
        face_store.insert(id, marker);
    }

    /// Delete marker(s)
    ///
    /// ## Parameters
    /// - `ids`: the id(s) of the marker(s) to delete
    pub fn delete_markers(&mut self, ids: &[u64]) {
        for id in ids {
            self._0.remove(id);
            self._1.remove(id);
            self._2.remove(id);
            self._3.remove(id);
            self._4.remove(id);
            self._5.remove(id);
        }
    }

    /// Process a tile request
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map that is requesting data
    /// - `tile`: the tile request
    /// - `flush_message`: the flush message function to call on completion
    pub async fn tile_request(
        &mut self,
        map_id: MapID,
        tile: &TileRequest,
        flush_message: &mut SourceFlushMessage,
    ) {
        let TileRequest { bbox, .. } = tile;
        let TileLayer { face, zoom, i, j, .. } = tile.layer;
        let tile_zoom = (1 << (zoom as u64)) as f64;
        let mut features: Vec<VectorFeature> = vec![];
        // get bounds of tile
        let BBox { left: min_s, bottom: min_y, right: max_s, top: max_t } = *bbox;
        // find all markers in st bounds
        for (_, marker) in self.get_face(face).iter() {
            let Marker { id, properties, geometry, .. } = marker;
            let VectorPoint { x, y, .. } = *geometry;
            if x >= min_s && x < max_s && y >= min_y && y < max_t {
                let mut geometry: VectorPoint = geometry.into();
                geometry.transform(tile_zoom, i as f64, j as f64);
                features.push(VectorFeature::new_wm(
                    Some(*id),
                    properties.clone(),
                    VectorGeometry::new_point(geometry, Some((*bbox).into())),
                    None,
                ))
            }
        }
        // if markers fit within bounds, create a tile
        let length = features.len();
        // Flush and return
        if length == 0 {
            self._flush(map_id, tile).await;
            return;
        }
        // build data object
        let vector_tile = Tile {
            id: tile.layer.id,
            transformed: false,
            layers: BTreeMap::from([(
                "default".into(),
                Layer { name: "default".into(), features },
            )]),
        };
        // request a worker and post
        let session = &mut self.session.borrow_mut();
        let worker = session.request_worker();
        worker
            .send(TileWorkerMessage {
                map_id,
                message: TileWorkerMessages::JSONData(Box::new(JSONDataMessage {
                    tile: tile.clone(),
                    source_name: self.name.clone(),
                    vector_tile,
                })),
            })
            .await;
        // let the source know we are loading a layer
        self._source_flush(flush_message);
    }

    /// If no data, we still have to let the tile worker know so it can prepare a proper flush
    /// as well as manage cases like "invert" type data.
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map that is requesting data
    /// - `tile`: the tile request
    async fn _flush(&mut self, map_id: MapID, tile: &TileRequest) {
        // send off
        let session = &mut self.session.borrow_mut();
        let worker = session.request_worker();
        worker
            .send(TileWorkerMessage {
                map_id,
                message: TileWorkerMessages::JSONData(Box::new(JSONDataMessage {
                    tile: tile.clone(),
                    source_name: self.name.clone(),
                    vector_tile: Tile::new(tile.layer.id),
                })),
            })
            .await;
    }

    /// Flush protocol for the source
    ///
    /// ## Parameters
    /// - `flush_message`: the flush message function
    fn _source_flush(&self, flush_message: &mut SourceFlushMessage) {
        let layers: Vec<&LayerDefinition> =
            self.style_layers.iter().filter(|layer| layer.source() == self.name).collect();
        for layer in layers {
            flush_message.layers_to_be_loaded.insert(layer.layer_index());
        }
    }
}

use crate::{
    style::{LayerDefinition, SourceActualMetadata, SourceMetadata},
    workers::{
        BaseSource, JSONDataMessage, MapID, Session, SourceSpec, TileRequest, TileWorkerMessage,
        TileWorkerMessages,
    },
};
use alloc::rc::Rc;
use core::cell::RefCell;
use gistools::{
    data_structures::{LocalClusterStore, Tile, TileStore},
    geometry::CellId,
};
use s2_tilejson::Metadata;
use s2json::{Face, JSONCollection, Projection};

#[derive(Debug)]
#[allow(missing_docs)]
pub enum JSONData {
    TileStore(TileStore),
    PointCluster(LocalClusterStore),
    // No data built yet
    None,
}
impl JSONData {
    /// Get the tile at the given id
    pub fn get_tile(&mut self, id: CellId) -> Option<Tile> {
        match self {
            JSONData::TileStore(tile_store) => tile_store.get_tile(id).cloned(),
            JSONData::PointCluster(point_cluster) => Some(point_cluster.get_tile(id)),
            JSONData::None => None,
        }
    }
    /// Grab the faces that are active
    pub fn faces(&self) -> Vec<Face> {
        match self {
            JSONData::TileStore(tile_store) => tile_store.faces.clone().into_iter().collect(),
            JSONData::PointCluster(_) => {
                vec![Face::Face0, Face::Face1, Face::Face2, Face::Face3, Face::Face4, Face::Face5]
            }
            JSONData::None => vec![],
        }
    }
    /// Grab the Projections
    pub fn projection(&self) -> Projection {
        match self {
            JSONData::TileStore(tile_store) => tile_store.projection,
            JSONData::PointCluster(point_cluster) => point_cluster.projection,
            JSONData::None => Projection::S2,
        }
    }
    /// Grab the minzoom
    pub fn minzoom(&self) -> u8 {
        match self {
            JSONData::TileStore(tile_store) => tile_store.minzoom,
            JSONData::PointCluster(point_cluster) => point_cluster.minzoom,
            JSONData::None => 0,
        }
    }
    /// Grab the maxzoom
    pub fn maxzoom(&self) -> u8 {
        match self {
            JSONData::TileStore(tile_store) => tile_store.maxzoom,
            JSONData::PointCluster(point_cluster) => point_cluster.maxzoom,
            JSONData::None => 0,
        }
    }
}

/// # JSON Source
///
/// ## Description
/// A source that is a json file that contains geojson or s2json data.
///
/// The json can be stored as a tile store or a point cluster.
#[derive(Debug)]
#[allow(missing_docs)]
pub struct JSONSource {
    pub base: BaseSource,
    pub json: JSONData,
}
impl JSONSource {
    /// Create a new JSONSource
    pub fn new(
        name: String,
        projection: crate::style::Projection,
        style_layers: Vec<LayerDefinition>,
        path: String,
        needs_token: Option<bool>,
        session: Rc<RefCell<Session>>,
    ) -> Self {
        Self {
            base: BaseSource::new(name, projection, style_layers, path, needs_token, session),
            json: JSONData::None,
        }
    }
}
impl SourceSpec for JSONSource {
    fn base(&mut self) -> &mut BaseSource {
        &mut self.base
    }

    async fn build(&mut self, map_id: MapID, metadata: Option<SourceMetadata<()>>) {
        if metadata.is_none() {
            return;
        }
        let metadata = metadata.unwrap();
        let mut json = metadata.data;
        if json.is_none() {
            let path = self.base().path.clone();
            json = self._fetch::<JSONCollection>(path, map_id).await;
        }
        if json.is_none() {
            self.base().active = false;
            // panic!("FAILED TO extrapolate {path} json data");
            return;
        }
        if let SourceActualMetadata::ClusterOptions(cluster_options) = metadata.metadata {
            let mut cluster = LocalClusterStore::new(Some(cluster_options.as_ref().clone()), None);
            cluster.insert_feature(json.unwrap());
            self.json = JSONData::PointCluster(cluster);
        } else {
            let json_options = metadata.metadata.tile_options();
            self.json = JSONData::TileStore(TileStore::new(
                json.unwrap(),
                json_options.unwrap_or_default(),
            ));
        }
        let attributions = self.base().attributions.clone();
        self._build_metadata(
            SourceMetadata::<()> {
                metadata: SourceActualMetadata::Metadata(Box::new(Metadata {
                    r#type: s2_tilejson::SourceType::Vector,
                    extension: if self.json.projection() == Projection::S2 {
                        "s2json".into()
                    } else {
                        "geojson".into()
                    },
                    minzoom: self.json.minzoom(),
                    maxzoom: self.json.maxzoom(),
                    faces: self.json.faces(),
                    attributions,
                    ..Default::default()
                })),
                ..Default::default()
            },
            map_id,
        )
        .await;
    }

    async fn _tile_request(&mut self, map_id: MapID, tile: TileRequest, _source_name: String) {
        let name = self.base().name.clone();
        // grab the data
        if let Some(vector_tile) = self.json.get_tile(tile.layer.id)
            && vector_tile.len() == 0
        {
            let sesion = &mut self.base().session.borrow_mut();
            let worker = sesion.request_worker();
            worker
                .send(TileWorkerMessage {
                    map_id,
                    message: TileWorkerMessages::JSONData(Box::new(JSONDataMessage {
                        tile,
                        source_name: name,
                        vector_tile,
                    })),
                })
                .await;
        } else {
            self.flush(map_id, tile, name).await;
        }
    }
}

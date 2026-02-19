use crate::{
    style::{LayerDefinition, Projection, SourceMetadata},
    workers::{
        BaseSource, JSONDataMessage, MapID, Session, SourceFlushMessage, SourceSpec, TileLayer,
        TileRequest, TileWorkerMessage, TileWorkerMessages,
    },
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use gistools::data_structures::{Layer, Tile};
use s2json::{
    MValue, Properties, ValuePrimitive, VectorFeature, VectorFeatureType, VectorGeometry,
    VectorPoint,
};
use serde::{Deserialize, Serialize};

/// Local Tile Properties
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, MValue, ValuePrimitive)]
#[allow(missing_docs)]
pub struct LocalTileProperties {
    pub id: String,
    pub face: u8,
    pub zoom: u8,
    pub i: u64,
    pub j: u64,
}

/// Local Tile
pub type LocalTile = Tile<(), Properties, MValue>;

/// Local Source
#[derive(Debug)]
#[allow(missing_docs)]
pub struct LocalSource {
    pub base: BaseSource,
    pub name: String,
    pub is_time_format: bool,
    pub style_layers: Vec<LayerDefinition>,
    pub session: Rc<RefCell<Session>>,
}
impl LocalSource {
    /// Create a new local source
    pub fn new(
        name: String,
        projection: Projection,
        session: Rc<RefCell<Session>>,
        style_layers: Vec<LayerDefinition>,
    ) -> LocalSource {
        let base = BaseSource::new(
            name.clone(),
            projection,
            style_layers.clone(),
            "".into(),
            Some(false),
            session.clone(),
        );
        LocalSource { base, name, is_time_format: false, style_layers, session }
    }

    /// Flush the source
    ///
    /// ## Parameters
    ///  - `flushMessage`: flushMessage
    fn _flush(&mut self, flush_message: &mut SourceFlushMessage) {
        let layers: Vec<&LayerDefinition> =
            self.style_layers.iter().filter(|layer| layer.source() == self.name).collect();
        for layer in layers {
            flush_message.layers_to_be_loaded.insert(layer.layer_index());
        }
    }
}
impl SourceSpec for LocalSource {
    fn base(&mut self) -> &mut BaseSource {
        &mut self.base
    }

    async fn build(&mut self, _map_id: MapID, _metadata: Option<SourceMetadata<()>>) {
        /* no-op */
    }

    async fn tile_request(
        &mut self,
        map_id: MapID,
        tile: &mut TileRequest,
        flush_message: &mut SourceFlushMessage,
    ) {
        // flush first
        self._flush(flush_message);
        // setup properties
        let TileLayer { id, face, zoom, i, j, .. } = tile.layer;
        let properties = LocalTileProperties {
            id: id.to_string(),
            face: face.into(),
            zoom,
            i: i as u64,
            j: j as u64,
        };
        let properties: MValue = properties.into();

        // creat the tile
        let vector_tile = LocalTile {
            id,
            transformed: false,
            layers: BTreeMap::from([
                (
                    "boundary".into(),
                    Layer {
                        name: "boundary".into(),
                        features: vec![VectorFeature {
                            _type: VectorFeatureType::VectorFeature,
                            id: Some(id.into()),
                            face,
                            properties: properties.clone(),
                            geometry: VectorGeometry::new_polygon(
                                vec![vec![
                                    VectorPoint::new_xy(0.0, 0.0, None),
                                    VectorPoint::new_xy(1.0, 0.0, None),
                                    VectorPoint::new_xy(1.0, 1.0, None),
                                    VectorPoint::new_xy(0.0, 1.0, None),
                                    VectorPoint::new_xy(0.0, 0.0, None),
                                ]],
                                None,
                            ),
                            metadata: None,
                        }],
                    },
                ),
                (
                    "name".into(),
                    Layer {
                        name: "name".into(),
                        features: vec![VectorFeature {
                            _type: VectorFeatureType::VectorFeature,
                            id: Some(id.into()),
                            face,
                            properties,
                            geometry: VectorGeometry::new_point(
                                VectorPoint::new_xy(0.5, 0.5, None),
                                None,
                            ),
                            metadata: None,
                        }],
                    },
                ),
            ]),
        };
        // request a worker and ship
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
    }
}

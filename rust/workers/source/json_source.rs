use crate::{
    style::SourceMetadata,
    workers::{
        BaseSource, JSONDataMessage, MapID, Source, TileRequest, TileWorkerMessage,
        TileWorkerMessages,
    },
};
use gistools::{
    data_structures::{LocalClusterStore, Tile, TileStore},
    geometry::CellId,
};

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
}

/**
 * # JSON Source
 *
 * ## Description
 * A source that is a json file that contains geojson or s2json data.
 *
 * The json can be stored as a tile store or a point cluster.
 */
#[derive(Debug)]
#[allow(missing_docs)]
pub struct JSONSource {
    pub base: BaseSource,
    pub json: JSONData,
}
impl JSONSource {
    /// Create a new JSONSource
    pub fn new() -> Self {
        Self { base: BaseSource::default(), json: JSONData::None }
    }
}
impl Source for JSONSource {
    fn base(&mut self) -> &mut BaseSource {
        &mut self.base
    }

    async fn build(&mut self, map_id: MapID, metadata: Option<SourceMetadata>) {
        if metadata.is_none() {
            return;
        }
        //     const json = metadata?.data ?? (await this._fetch<JSONCollection>(`${this.path}`, mapID, true));
        //     if (json === undefined) {
        //       this.active = false;
        //       console.error(`FAILED TO extrapolate ${this.path} json data`);
        //       return;
        //     }
        //     if (metadata?.cluster === true) {
        //       this.json = new WMPointCluster(metadata);
        //       this.json.addManyPoints(json);
        //       this.json.cluster();
        //     } else {
        //       // use the projection from the style
        //       this.json = new TileStore(json, {
        //         ...metadata,
        //         projection: this.projection === 'S2' ? 'S2' : 'WG',
        //       });
        //     }
        //     const { projection, minzoom, maxzoom, faces } = this.json;
        //     this._build_metadata(
        //       {
        //         type: 'vector',
        //         minzoom,
        //         maxzoom,
        //         faces: [...faces],
        //         layers: { default: { minzoom, maxzoom, drawTypes: [], shape: {} } },
        //         extension: projection === 'S2' ? 's2json' : 'geojson',
        //         attributions: 'attributions' in json ? json.attributions : {},
        //       },
        //       mapID,
        //     );
        todo!()
    }

    async fn _tile_request(&mut self, map_id: MapID, tile: TileRequest, _source_name: String) {
        let name = self.base().name.clone();
        // grab the data
        if let Some(vector_tile) = self.json.get_tile(tile.layer.id)
            && vector_tile.len() == 0
        {
            let worker = self.base().session.request_worker();
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
            self.flush(map_id, tile, name);
        }
    }
}

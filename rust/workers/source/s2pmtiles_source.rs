use crate::{
    style::{Projection, SourceMetadata},
    workers::{
        BaseSource, MapID, Source, TileLayer, TileRequest, TileWorkerMessage, TileWorkerMessages,
        VectorMessage,
    },
};
use gistools::{parsers::FetchReader, readers::PMTilesReader};

/// # S2 PMTiles Source
///
/// Wrapper for the [`PMTilesReader`]. Fetch tiles as needed.
#[derive(Debug)]
pub struct S2PMTilesSource {
    /// The Base source
    pub base: BaseSource,
    /// The PMTiles reader version. Most modern PMTiles is version 3. S2PMTiles is version 1.
    pub version: u32, // = 1,
    /// The PMTiles reader
    pub reader: PMTilesReader<FetchReader>,
}
impl S2PMTilesSource {
    /// Create a new S2PMTilesSource
    pub fn new(base: BaseSource) -> Self {
        let reader = PMTilesReader::new(FetchReader::new(base.path.clone(), true), None);
        Self { base, version: 1, reader }
    }
}
impl Source for S2PMTilesSource {
    fn base(&mut self) -> &mut BaseSource {
        &mut self.base
    }

    async fn build(&mut self, map_id: MapID, _metadata: Option<SourceMetadata>) {
        let mut metadata = self.reader.get_metadata().clone();
        // modify the type to ensure we are using a vector
        metadata.r#type = s2_tilejson::SourceType::Vector;
        self._build_metadata(metadata.into(), map_id);
    }

    /// Here, we use the memory mapped file directory tree system to find our data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    /// - `tile`: the tile request
    /// - `source_name`: the name of the source
    async fn _tile_request(&mut self, map_id: MapID, tile: TileRequest, source_name: String) {
        let TileLayer { face, zoom, i, j, .. } = tile.parent.clone().unwrap_or(tile.layer.clone());
        let bytes = match tile.r#type {
            Projection::S2 => self.reader.get_tile_s2(face, zoom, i.into(), j.into()).await,
            Projection::WM => self.reader.get_tile_wm(zoom, i.into(), j.into()).await,
        };
        let BaseSource { session, .. } = self.base();

        if let Some(data) = bytes {
            let worker = session.request_worker();
            worker
                .send(TileWorkerMessage {
                    map_id,
                    message: TileWorkerMessages::Vector(Box::new(VectorMessage {
                        tile,
                        source_name,
                        data,
                    })),
                })
                .await;
        } else {
            self.flush(map_id, tile, source_name);
        }
    }
}

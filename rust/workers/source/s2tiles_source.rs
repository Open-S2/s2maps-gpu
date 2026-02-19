use crate::{
    style::{Projection, SourceMetadata},
    workers::{
        BaseSource, MapID, SourceSpec, TileLayer, TileRequest, TileWorkerMessage,
        TileWorkerMessages, VectorMessage,
    },
};
use gistools::{parsers::FetchReader, readers::S2TilesReader};

/// # S2 Tiles Source
///
/// Wrapper for the [`S2TilesReader`]. Fetch tiles as needed.
#[derive(Debug)]
pub struct S2TilesSource {
    /// The Base source
    pub base: BaseSource,
    /// The PMTiles reader version. Most modern PMTiles is version 3. S2PMTiles is version 1.
    pub version: u32, // = 1,
    /// The PMTiles reader
    pub reader: S2TilesReader<FetchReader>,
}
impl S2TilesSource {
    /// Create a new S2TilesSource
    pub fn new(base: BaseSource) -> Self {
        let reader = S2TilesReader::new(FetchReader::new(base.path.clone(), true), None);
        Self { base, version: 1, reader }
    }
}
impl SourceSpec for S2TilesSource {
    fn base(&mut self) -> &mut BaseSource {
        &mut self.base
    }

    async fn build(&mut self, map_id: MapID, _metadata: Option<SourceMetadata<()>>) {
        let metadata = self.reader.get_metadata().await.clone();
        self._build_metadata(metadata.into(), map_id).await;
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
            Projection::S2 => self.reader.get_tile_s2(face, zoom, i, j).await,
            Projection::WM => self.reader.get_tile_wm(zoom, i, j).await,
        };

        if let Some(data) = bytes {
            let session = &mut self.base().session.borrow_mut();
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
            self.flush(map_id, tile, source_name).await;
        }
    }
}

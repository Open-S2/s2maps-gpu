// import type Session from './session.js';
// import type { Face, LayerDefinition } from 'style/style.spec.js';
// import type { SourceFlushMessage, TileRequest } from '../worker.spec.js';
// import type { VectorPointGeometry, VectorPolygonGeometry } from 'gis-tools/index.js';

use crate::{
    style::{LayerDefinition, SourceMetadata},
    workers::{BaseSource, MapID, Session, Source, SourceFlushMessage, TileRequest},
};
use gistools::data_structures::Tile;
use s2json::{MValue, ValuePrimitive, VectorPointGeometry, VectorPolygonGeometry};
use serde::{Deserialize, Serialize};

/** Local Tile Properties */
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, MValue, ValuePrimitive)]
#[allow(missing_docs)]
pub struct LocalTileProperties {
    pub id: String,
    pub face: u8,
    pub zoom: u8,
    pub i: u64,
    pub j: u64,
}

/// Boundary describing the tile shape
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FeatureBoundary {
    pub extent: f64,
    pub properties: LocalTileProperties,
    pub geometry: VectorPolygonGeometry,
}

/// Point describing the tile
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GetFeatureName {
    pub extent: f64,
    pub properties: LocalTileProperties,
    pub geometry: VectorPointGeometry,
}

/** Local Tile */
pub type LocalTile = Tile<(), LocalTileProperties, MValue>;
// pub struct LocalTile {
//   face: Face;
//   zoom: number;
//   i: number;
//   j: number;
//   extent: number;
//   layers: {
//     boundary: {
//       extent: 1;
//       length: 1;
//       features: FeatureBoundary[];
//     };
//     name: {
//       extent: 1;
//       length: 1;
//       features: GetFeatureName[];
//     };
//   };
// }

/// Local Source
#[derive(Debug)]
#[allow(missing_docs)]
pub struct LocalSource {
    pub base: BaseSource,
    pub name: String,
    pub is_time_format: bool,
    pub style_layers: Vec<LayerDefinition>,
    pub session: Session,
}
impl LocalSource {
    /// Create a new local source
    pub fn new(name: String, session: Session, style_layers: Vec<LayerDefinition>) -> LocalSource {
        let base = BaseSource::default();
        LocalSource { base, name, is_time_format: false, style_layers, session }
    }

    /// @param flushMessage - flushMessage
    fn _flush(&mut self, flush_message: &mut SourceFlushMessage) {
        // const layers = this.style_layers.filter((layer) => layer.source === this.name);
        let layers: Vec<&LayerDefinition> =
            self.style_layers.iter().filter(|layer| layer.source() == self.name).collect();
        // for (const { layerIndex } of layers) flush_message.layersToBeLoaded.add(layerIndex);
        for layer in layers {
            flush_message.layers_to_be_loaded.insert(layer.layer_index());
        }
    }
}
impl Source for LocalSource {
    fn base(&mut self) -> &mut BaseSource {
        &mut self.base
    }

    async fn build(&mut self, _map_id: MapID, _metadata: Option<SourceMetadata>) {
        /* no-op */
    }

    async fn tile_request(
        &mut self,
        map_id: MapID,
        tile: TileRequest,
        flush_message: SourceFlushMessage,
    ) {
        todo!()
        //     const { id, face, zoom, i, j } = tile;

        //     this.#flush(flushMessage);

        //     const data: LocalTile = {
        //       face,
        //       zoom,
        //       i,
        //       j,
        //       extent: 1,
        //       layers: {
        //         boundary: {
        //           extent: 1,
        //           length: 1,
        //           features: [
        //             {
        //               extent: 1,
        //               properties: { id: String(id), face, zoom, i, j },
        //               geometry: {
        //                 type: 'Polygon',
        //                 is3D: false,
        //                 coordinates: [
        //                   [
        //                     { x: 0, y: 0 },
        //                     { x: 1, y: 0 },
        //                     { x: 1, y: 1 },
        //                     { x: 0, y: 1 },
        //                     { x: 0, y: 0 },
        //                   ],
        //                 ],
        //               },
        //             },
        //           ],
        //         },
        //         name: {
        //           extent: 1,
        //           length: 1,
        //           features: [
        //             {
        //               extent: 1,
        //               properties: { id: String(id), face, zoom, i, j },
        //               geometry: {
        //                 type: 'Point',
        //                 is3D: false,
        //                 coordinates: { x: 0.5, y: 0.5 },
        //               },
        //             },
        //           ],
        //         },
        //       },
        //     };
        //     // encode for transfer
        //     const uint8data = this.textEncoder.encode(JSON.stringify(data)).buffer;
        //     // request a worker and post
        //     const worker = this.session.requestWorker();
        //     worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data: uint8data }, [
        //       uint8data,
        //     ]);
    }
}

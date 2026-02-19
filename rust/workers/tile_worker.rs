use crate::{
    style::LayerDefinition,
    util::{MsgReceiver, MsgSender},
    workers::{MapID, ProcessManager, SourceWorkerMessages, TileWorkerMessageOutput},
};
use alloc::collections::BTreeMap;

/// # Tile Worker
///
/// A TileWorker has one job: prebuild tile data for the WebGL / WebGPU instance
/// During construction, the tileworker is given the map's id to send the data to the correct
/// recepient and also the style sheet to build the proper source data
///
/// A TileWorker maintains map references to know how and who to send data back to
pub type TileWorker = ProcessManager;
impl TileWorker {
    /// The execution loop. Note the 'async' and taking 'self' by value.
    pub async fn run(mut self, mut receiver: MsgReceiver<TileWorkerMessageOutput>) -> ! {
        loop {
            let msg = receiver.recv().await;
            self.on_message(msg);
        }
    }

    /**
     * Given a tile message, process it according to its type
     * @param tile_message - the tile message
     */
    fn on_message(&mut self, tile_message: TileWorkerMessageOutput) {
        //     const { data, ports } = tile_message;
        //     const { type } = data;
        // if (type === 'port') this._load_worker_port(ports[0], ports[1], data.id, data.totalWorkers);
        //     else {
        //       const { map_id } = data;
        //       if (type === 'style') self.setup_style(map_id, data.style)
        //       else if (type === 'vector')
        //         void this.processVector(
        //           map_id,
        //           data.tile,
        //           data.source_name,
        //           new VectorTile(new Uint8Array(data.data)),
        //         );
        //       else if (type === 'raster')
        //         this.processRaster(map_id, data.tile, data.source_name, data.data, data.size);
        //       else if (type === 'jsondata')
        //         self.process_vector(map_id, data.tile, data.source_name, data.data)
        //       else if (type === 'glyphmetadata')
        //         this.processMetadata(map_id, data.glyphMetadata, data.imageMetadata);
        //       else if (type === 'glyphresponse')
        //         this.processGlyphResponse(map_id, data.reqID, data.glyphMetadata, data.familyName);
        //       else if (type === 'addLayer') this._add_layer(map_id, data.layer, data.index);
        //       else if (type === 'deleteLayer') this._delete_layer(map_id, data.index);
        //       else if (type === 'reorderLayers') this._reorder_layers(map_id, data.layerChanges);
        //     }
        todo!()
    }

    /**
     * Add a new style layer to a map
     * @param _map_id - the map id to add the layer to
     * @param _layer - the layer to add
     * @param _index - the index to add it at
     */
    fn _add_layer(_map_id: MapID, _layer: LayerDefinition, _index: u32) {
        todo!()
    }

    /**
     * Delete a style layer from a map
     * @param _map_id - the map id to delete the layer from
     * @param _index - the index to delete
     */
    fn _delete_layer(_map_id: MapID, _index: u32) {
        todo!()
    }

    /**
     * Reorder style layers
     * @param _map_id - the map id to reorder
     * @param _layer_changes - the layer changes
     */
    fn _reorder_layers(_map_id: MapID, _layer_changes: BTreeMap<u32, u32>) {
        todo!()
    }
}

declare const self: DedicatedWorkerGlobalScope;

import ProcessManager from './process/index.js';
import { VectorTile } from 'open-vector-tile';
import { rebuildVectorTile } from './process/util/rebuildVectorTile.js';

import type { VTTile } from './process/process.spec.js';
import type { LayerDefinition, StylePackage } from 'style/style.spec.js';
import type { TileRequest, TileWorkerMessages } from './worker.spec.js';

/**
 * # Tile Worker
 *
 * A TileWorker has one job: prebuild tile data for the WebGL / WebGPU instance
 * During construction, the tileworker is given the map's id to send the data to the correct recepient
 * and also the style sheet to build the proper source data
 *
 * A TileWorker maintains map references to know how and who to send data back to
 */
export default class TileWorker extends ProcessManager {
  /**
   * Given a tile message, process it according to its type
   * @param tileMessage - the tile message
   */
  onMessage(tileMessage: MessageEvent<TileWorkerMessages>): void {
    const { data, ports } = tileMessage;
    const { type } = data;
    if (type === 'port') this.#loadWorkerPort(ports[0], ports[1], data.id, data.totalWorkers);
    else {
      const { mapID } = data;
      if (type === 'style') this.#loadStyle(mapID, data.style);
      else if (type === 'vector')
        void this.processVector(
          mapID,
          data.tile,
          data.sourceName,
          new VectorTile(new Uint8Array(data.data)),
        );
      else if (type === 'raster')
        this.processRaster(mapID, data.tile, data.sourceName, data.data, data.size);
      else if (type === 'jsondata')
        this.#processJSONData(mapID, data.tile, data.sourceName, data.data);
      else if (type === 'glyphmetadata')
        this.processMetadata(mapID, data.glyphMetadata, data.imageMetadata);
      else if (type === 'glyphresponse')
        this.processGlyphResponse(mapID, data.reqID, data.glyphMetadata, data.familyName);
      else if (type === 'addLayer') this.#addLayer(mapID, data.layer, data.index);
      else if (type === 'deleteLayer') this.#deleteLayer(mapID, data.index);
      else if (type === 'reorderLayers') this.#reorderLayers(mapID, data.layerChanges);
    }
  }

  /**
   * Load a message channel with the source worker
   * @param messagePort - the message port to recieve messages from the source worker
   * @param postPort - the post port to talk to the source worker
   * @param id - the worker id
   * @param totalWorkers - the total number of tile workers
   */
  #loadWorkerPort(
    messagePort: MessageChannel['port1'],
    postPort: MessageChannel['port2'],
    id: number,
    totalWorkers: number,
  ): void {
    // maintain communication channel with source worker
    messagePort.onmessage = this.onMessage.bind(this);
    this.sourceWorker = postPort; // Source Worker
    this.messagePort = messagePort; // WorkerPool
    this.id = id;
    this._buildIDGen(totalWorkers);
  }

  /**
   * pull in the layers and preprocess them
   * @param mapID - the map id to build data for
   * @param style - the style package associated with the map
   */
  #loadStyle(mapID: string, style: StylePackage): void {
    this.setupStyle(mapID, style);
  }

  /**
   * Add a new style layer to a map
   * @param _mapID - the map id to add the layer to
   * @param _layer - the layer to add
   * @param _index - the index to add it at
   */
  #addLayer(_mapID: string, _layer: LayerDefinition, _index: number): void {
    // const layers = this.maps[mapID]
    // layers.splice(index, 0, layer)
    // for (let i = index + 1, ll = layers.length; i < ll; i++) {
    //   const layer = layers[i]
    //   layer.layerIndex++
    // }
  }

  /**
   * Delete a style layer from a map
   * @param _mapID - the map id to delete the layer from
   * @param _index - the index to delete
   */
  #deleteLayer(_mapID: string, _index: number): void {
    // const layers = this.maps[mapID]
    // layers.splice(index, 1)
    // for (let i = index, ll = layers.length; i < ll; i++) {
    //   const layer = layers[i]
    //   layer.layerIndex--
    // }
  }

  /**
   * Reorder style layers
   * @param _mapID - the map id to reorder
   * @param _layerChanges - the layer changes
   */
  #reorderLayers(_mapID: string, _layerChanges: Record<number, number>): void {
    // const layers = this.maps[mapID]
    // const newLayers: LayerDefinition[] = []
    // // move the layer to its new position
    // for (const [from, to] of Object.entries<number>(layerChanges)) {
    //   const layer = layers[+from]
    //   layer.layerIndex = to
    //   newLayers[to] = layer
    // }
    // // because other classes depend upon the current array, we just update array items
    // for (let i = 0; i < layers.length; i++) layers[i] = newLayers[i]
  }

  /**
   * Process vector data
   * @param mapID - the map id to build data for
   * @param tile - the tile request associated with the data
   * @param sourceName - the name of the source the data to belongs to
   * @param data - the tile vector data
   */
  #processJSONData(mapID: string, tile: TileRequest, sourceName: string, data: ArrayBuffer): void {
    // step 1: convert data to a JSON object
    const vectorTile: VTTile = JSON.parse(this.textDecoder.decode(new Uint8Array(data)));
    // step 2: build functions back into the vector tile and its layers & features
    rebuildVectorTile(vectorTile);
    // step 3: process the vector data
    void this.processVector(mapID, tile, sourceName, vectorTile);
  }
}

// create the tileworker
const tileWorker = new TileWorker();
// expose and bind the onmessage function
self.onmessage = tileWorker.onMessage.bind(tileWorker);

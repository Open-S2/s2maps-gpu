import { VectorTile } from 's2-vector-tile'
// import { parseLayers } style/conditionals'
import ProcessManager from './process'

import type { LayerDefinition, StylePackage } from 'style/style.spec'
import type { TileRequest, TileWorkerMessages } from './worker.spec'
import type { JSONVectorTile } from './source/jsonVT/tile'

// A TileWorker has one job: prebuild tile data for the WebGL / WebGPU instance
// During construction, the tileworker is given the map's id to send the data to the correct recepient
// and also the style sheet to build the proper source data

// A TileWorker maintains map references

export default class TileWorker extends ProcessManager {
  onMessage ({ data, ports }: MessageEvent<TileWorkerMessages>): void {
    const { type } = data
    if (type === 'port') this.#loadWorkerPort(ports[0], ports[1], data.id, data.totalWorkers)
    else {
      const { mapID } = data
      if (type === 'style') this.#loadStyle(mapID, data.style)
      else if (type === 'vector') void this.processVector(mapID, data.tile, data.sourceName, new VectorTile(new Uint8Array(data.data)))
      else if (type === 'raster') this.processRaster(mapID, data.tile, data.sourceName, data.data, data.size)
      else if (type === 'jsondata') this.#processJSONData(mapID, data.tile, data.sourceName, data.data)
      else if (type === 'glyphmetadata') this.processMetadata(mapID, data.glyphMetadata, data.imageMetadata)
      else if (type === 'glyphresponse') this.processGlyphResponse(mapID, data.reqID, data.glyphMetadata, data.familyName)
      else if (type === 'addLayer') this.#addLayer(mapID, data.layer, data.index)
      else if (type === 'deleteLayer') this.#deleteLayer(mapID, data.index)
      else if (type === 'reorderLayers') this.#reorderLayers(mapID, data.layerChanges)
    }
  }

  #loadWorkerPort (
    messagePort: MessageChannel['port1'],
    postPort: MessageChannel['port2'],
    id: number,
    totalWorkers: number
  ): void {
    // maintain communication channel with source worker
    messagePort.onmessage = this.onMessage.bind(this)
    this.sourceWorker = postPort // Source Worker
    this.messagePort = messagePort // WorkerPool
    this.id = id
    this._buildIDGen(totalWorkers)
  }

  // pull in the layers and preprocess them
  #loadStyle (mapID: string, style: StylePackage): void {
    this.setupStyle(mapID, style)
  }

  #addLayer (mapID: string, layer: LayerDefinition, index: number): void {
    // const layers = this.maps[mapID]
    // layers.splice(index, 0, layer)
    // for (let i = index + 1, ll = layers.length; i < ll; i++) {
    //   const layer = layers[i]
    //   layer.layerIndex++
    // }
  }

  #deleteLayer (mapID: string, index: number): void {
    // const layers = this.maps[mapID]
    // layers.splice(index, 1)
    // for (let i = index, ll = layers.length; i < ll; i++) {
    //   const layer = layers[i]
    //   layer.layerIndex--
    // }
  }

  #reorderLayers (mapID: string, layerChanges: Record<number, number>): void {
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

  #processJSONData (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    data: ArrayBuffer
  ): void {
    // step 1: convert data to a JSON object
    const vectorTile: JSONVectorTile = JSON.parse(this.textDecoder.decode(new Uint8Array(data)))
    // step 2: parse functions
    for (const layer of Object.values(vectorTile.layers)) {
      layer.feature = function (i: number) { return this.features[i] }
      for (const feature of layer.features) feature.loadGeometry = function () { return this.geometry }
    }
    // step 3: process the vector data
    void this.processVector(mapID, tile, sourceName, vectorTile)
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// expose and bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

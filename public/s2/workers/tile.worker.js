// @flow
/* eslint-env worker */
import { VectorTile } from 's2-vector-tile'
import { parseLayers } from '../style/conditionals'
import { VectorManager, processRaster } from './process'

import type { Face, StylePackage, Layer } from '../style/styleSpec'
import type { TileRequest } from './workerPool'
import type { IconMap, ColorMap } from './process/vector/glyph'

export type CancelTileRequest = Array<number> // S2CellIDs of tiles e.g. ['204', '1003', '1245', ...]

export type ParentLayer = {
  face: Face,
  zoom: number,
  x: number,
  y: number,
  layers: Array<number>
}

export type ParentLayers = {
  [string | number]: ParentLayer
}

export type Feature = {
  vertices: Array<number>,
  indices: Array<number>,
  geometry?: Array<Array<number>>,
  featureCode: Array<number>,
  code: Array<number>,
  size: number,
  divisor: number,
  layerIndex: number
}

export type IDGen = { num: number, incrSize: number, maxNum: number, startNum: number }

export type ProcessType = 'vector' | 'raster'

// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 22bit: 4,194,304 --- 16bit: 65,535 --- 7bit: 128
export const ID_MAX_SIZE = 1 << 22

// A TileWorker has one job: prebuild tile data for the WebGL / WebGPU instance
// During construction, the tileworker is given the map's id to send the data to the correct recepient
// and also the style sheet to build the proper source data

// A TileWorker maintains map references

export default class TileWorker {
  id: number
  webgl1: boolean = false
  vectorManager: VectorManager
  rasterManager: RasterManager
  maps: { [string]: Array<Layer> } = {}
  messagePort: MessageChannel.port1
  postPort: MessageChannel.port2

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'port') this._loadWorkerPort(data.messagePort, data.postPort, data.id, data.totalWorkers)
    else if (type === 'style') this._loadStyle(mapID, data.style)
    else if (type === 'vector') this._processPBF(mapID, data.tile, data.sourceName, data.parent, data.data)
    else if (type === 'raster') this._processRaster(mapID, data.tile, data.sourceName, data.parent, data.data)
    else if (type === 'jsondata') this._processJSONData(mapID, data.tile, data.sourceName, data.data)
    else if (type === 'glyphresponse') this._processGlyphResponse(mapID, data.reqID, data.glyphMetadata, data.familyName, data.icons, data.colors)
    else if (type === 'addLayer') this._addLayer(mapID, data.layer, data.index)
    else if (type === 'removeLayer') this._removeLayer(mapID, data.index)
    else if (type === 'reorderLayers') this._reorderLayers(mapID, data.layerChanges)
  }

  _loadWorkerPort (messagePort: MessageChannel.port1, postPort: MessageChannel.port2,
    id: number, totalWorkers: number) {
    // maintain communication channel with source worker
    messagePort.onmessage = this.onMessage.bind(this)
    this.postPort = postPort
    this.messagePort = messagePort
    // set id
    this.id = id
    // setup idGenerator
    const idGen = {
      num: id + 1,
      startNum: id + 1,
      incrSize: totalWorkers,
      maxNum: ID_MAX_SIZE,
      getNum: function () {
        const res = this.num
        this.num += this.incrSize
        if (this.num >= this.maxNum) this.num = this.startNum
        return res
      }
    }
    // setup vectorManager
    this.vectorManager = new VectorManager(postMessage, postPort, id, idGen)
  }

  // pull in the layers and preprocess them
  _loadStyle (mapID: string, style: StylePackage) {
    const { layers, glType } = style
    parseLayers(layers, glType)
    this.maps[mapID] = layers
    this.webgl1 = this.vectorManager.webgl1 = glType === 1
  }

  _addLayer (mapID: string, layer: Layer, index: number) {
    const layers = this.maps[mapID]
    layers.splice(index, 0, layer)
    for (let i = index + 1, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex++
      layer.depthPos++
    }
  }

  _removeLayer (mapID: string, index: number) {
    const layers = this.maps[mapID]
    layers.splice(index, 1)
    for (let i = index, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex--
      layer.depthPos--
    }
  }

  _reorderLayers (mapID: string, layerChanges: { [string | number]: number }) {
    const layers = this.maps[mapID]
    const newLayers = []
    // move the layer to its new position
    for (let [from, to] of Object.entries(layerChanges)) {
      to = +to
      const layer = layers[+from]
      layer.layerIndex = to
      layer.depthPos = to + 1
      newLayers[to] = layer
    }
    // because other classes depend upon the current array, we just update array items
    for (let i = 0; i < layers.length; i++) layers[i] = newLayers[i]
  }

  _processPBF (mapID: string, tile: TileRequest, sourceName: string,
    parent?: ParentLayer, data: ArrayBuffer) {
    this.vectorManager.processVector(mapID, tile, sourceName, new VectorTile(data), this.maps[mapID], parent)
  }

  _processRaster (mapID: string, tile: TileRequest, sourceName: string,
    parent?: ParentLayer, data: ArrayBuffer) {
    processRaster(mapID, this.webgl1, tile, sourceName, parent, data, this.maps[mapID])
  }

  _processJSONData (mapID: string, tile: TileRequest, sourceName: string, data: Object) {
    // step 1: convert data to a JSON object
    data = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(data)))
    // step 2: parse functions
    for (const layer of Object.values(data.layers)) {
      layer.feature = function (i) { return this.features[i] }
      for (const feature of layer.features) feature.loadGeometry = function () { return this.geometry }
    }
    // step 3: process the vector data
    this.vectorManager.processVector(mapID, tile, sourceName, data, this.maps[mapID])
  }

  _processGlyphResponse (mapID: string, reqID: string, glyphMetadata: ArrayBuffer, familyName: string, icons: IconMap, colors: ColorMap) {
    this.vectorManager.glyphManager.processGlyphResponse(reqID, glyphMetadata, familyName, icons, colors)
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

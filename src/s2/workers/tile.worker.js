// @flow
import { VectorTile } from 's2-vector-tile'
import { parseLayers } from '../style/conditionals'
import { VectorManager, processRaster } from './process'
// import { tileHash } from 's2projection'

import type { Face } from 's2projection'
import type { TileRequest } from './workerPool'
import type { StylePackage, Layer } from '../style/styleSpec'

// const { userAgent } = navigator
// const IS_CHROME: boolean = userAgent.indexOf('Chrome') > -1

export type CancelTileRequest = Array<number> // hashe IDs of tiles e.g. ['204', '1003', '1245', ...]

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
  maps: { [string]: Array<Layer> } = {}
  messagePort: MessageChannel.port1
  postPort: MessageChannel.port2

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'port') this._loadWorkerPort(data.messagePort, data.postPort, data.id, data.totalWorkers)
    else if (type === 'style') this._loadStyle(mapID, data.style)
    else if (type === 'iconpacks') this._loadIconPacks(data.iconPacks)
    else if (type === 'pbfdata') this._processPBF(mapID, data.tile, data.sourceName, data.parent, data.data)
    else if (type === 'rasterdata') this._processRaster(mapID, data.tile, data.sourceName, data.parent, data.data)
    else if (type === 'jsondata') this._processJSONData(mapID, data.tile, data.sourceName, data.data)
    else if (type === 'glyphresponse') this._processGlyphResponse(mapID, data.reqID, data.glyphMetadata, data.familyName)
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
    this.vectorManager.webgl1 = this.webgl1 = glType === 1
  }

  _loadIconPacks (iconPacks: IconPacks) {
    this.vectorManager.glyphManager.loadIconsPacks(iconPacks)
  }

  _processPBF (mapID: string, tile: TileRequest, sourceName: string,
    parent: boolean, data: ArrayBuffer) {
    this.vectorManager.processVector(mapID, tile, sourceName, new VectorTile(data), this.maps[mapID], parent)
  }

  _processRaster (mapID: string, tile: TileRequest, sourceName: string,
    parent: boolean, data: ArrayBuffer) {
    processRaster(mapID, tile, sourceName, parent, data, postMessage)
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

  _processGlyphResponse (mapID: string, reqID: string, glyphMetadata: ArrayBuffer, familyName: string) {
    this.vectorManager.glyphManager.processGlyphResponse(reqID, glyphMetadata, familyName)
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker) // eslint-disable-line

/* eslint-env worker */
import GlyphWorker from './glyph'
import FillWorker from './fill'
import LineWorker from './line'
import PointWorker from './point'
import RasterWorker from './raster'

import type { VectorTile } from 's2-vector-tile'
import type { FlushData, TileRequest } from '../worker.spec'
import type {
  GPUType,
  LayerDefinition,
  LayerType,
  RasterWorkerLayer,
  StylePackage,
  VectorWorkerLayer,
  WorkerLayer
} from 's2/style/style.spec'
import type { JSONVectorTile } from '../source/json-vt/tile'
import type { IDGen, Workers } from './process.spec'
import type { ColorMap as ColorMapResponse, IconMap as IconMapResponse } from '../source/glyphSource'

// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 22bit: 4,194,304 --- 16bit: 65,535 --- 7bit: 128
export const ID_MAX_SIZE = 1 << 22

export default class ProcessManager {
  id!: number
  gpuType!: GPUType
  idGen!: IDGen
  messagePort!: MessageChannel['port1']
  sourceWorker!: MessageChannel['port2']
  textDecoder: TextDecoder = new TextDecoder()
  layers: { [mapID: string]: WorkerLayer[] } = {}
  workers: Workers = {}

  _buildIDGen (totalWorkers: number): void {
    this.idGen = buildIDGen(this.id, totalWorkers)
  }

  setupLayers (mapID: string, style: StylePackage): void {
    const { layers, gpuType } = style
    this.gpuType = gpuType
    const workerTypes: Set<LayerType> = new Set()

    // first we need to build the workers
    for (const layer of layers) workerTypes.add(layer.type)
    this.#buildWorkers(workerTypes)

    // Convert LayerDefinition to WorkerLayer and store in layers
    const workerLayers = layers
      .map((layer) => this.setupLayer(layer))
      .filter(layer => layer !== undefined) as WorkerLayer[]
    this.layers[mapID] = workerLayers
  }

  setupLayer (layer: LayerDefinition): undefined | WorkerLayer {
    if (layer.type === 'shade') return
    return this.workers[layer.type]?.setupLayer(layer as any)
  }

  #buildWorkers (names: Set<LayerType>): void {
    const { idGen, gpuType, workers, sourceWorker } = this
    for (const name of names) {
      if (name === 'fill') {
        workers.fill = new FillWorker(idGen, gpuType)
      } else if (name === 'line') {
        workers.line = new LineWorker(idGen, gpuType)
      } else if (name === 'point' || name === 'heatmap') {
        workers.point = workers.heatmap = new PointWorker(idGen, gpuType)
      } else if (name === 'glyph') {
        workers.glyph = new GlyphWorker(idGen, gpuType, sourceWorker)
      } else if (
        (name === 'raster' || name === 'sensor') &&
        this.workers.raster === undefined
      ) {
        workers.sensor = workers.raster = new RasterWorker(gpuType)
      }
    }
  }

  processVector (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    vectorTile: VectorTile | JSONVectorTile
  ): void {
    const { workers } = this
    const { zoom, parent } = tile
    const { layerIndexes } = parent ?? tile
    // filter layers to those that source metadata explains exists in this tile
    const sourceLayers = this.layers[mapID].filter(layer =>
      layerIndexes === undefined ? true : layerIndexes.includes(layer.layerIndex)
    )
    // prep a layerIndex tracker for an eventual generic flush.
    // Some layerIndexes will never be updated, so it's good to know
    const layers: { [key: number]: number } = {}
    sourceLayers.forEach(l => { layers[l.layerIndex] = 0 })

    // TODO: features is repeated through too many times. Simplify this down.
    for (const sourceLayer of sourceLayers) {
      // grab layer name
      const sourceLayerName = sourceLayer.layer
      // pull out the layer properties we need
      const { type, filter, minzoom, maxzoom, layerIndex } = sourceLayer as VectorWorkerLayer
      if (minzoom > zoom || maxzoom < zoom) continue
      // grab the layer of interest from the vectorTile and it's extent
      const vectorLayer = vectorTile.layers[sourceLayerName]
      if (vectorLayer === undefined) continue
      // iterate over the vector features, filter as necessary
      for (let f = 0; f < vectorLayer.length; f++) {
        const feature = vectorLayer.feature?.(f)
        if (feature === undefined) continue
        const { properties } = feature
        // filter out features that are not applicable, otherwise tell the vectorWorker to build
        if (filter(properties)) {
          const wasBuilt = workers[type]?.buildFeature(tile, feature, sourceLayer as any)
          if (wasBuilt === true && layers[layerIndex] !== undefined) layers[layerIndex]++
        }
      }
    }
    // now flush the workers
    this.flush(mapID, tile, sourceName, layers)
  }

  flush (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    layers: { [key: number]: number }
  ): void {
    const { workers } = this
    for (const worker of Object.values(workers)) {
      if (!('flush' in worker)) continue
      worker.flush(mapID, tile, sourceName)
    }

    const msg: FlushData = { type: 'flush', tileID: tile.id, mapID, layers }
    postMessage(msg)
  }

  processRaster (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    data: ArrayBuffer,
    size: number
  ): void {
    const subSourceName = sourceName.split(':')[0]
    // filter layers to source
    const sourceLayers = this.layers[mapID].filter(layer => layer.source === subSourceName) as RasterWorkerLayer[]

    void this.workers.raster?.buildTile(mapID, sourceName, sourceLayers, tile, data, size)
  }

  processGlyphResponse (
    reqID: string,
    glyphMetadata: ArrayBuffer,
    familyName: string,
    icons?: IconMapResponse,
    colors?: ColorMapResponse
  ): void {
    this.workers.glyph?.processGlyphResponse(reqID, glyphMetadata, familyName, icons, colors)
  }
}

function buildIDGen (id: number, totalWorkers: number): IDGen {
  return {
    workerID: id,
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
}

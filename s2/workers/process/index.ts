/* eslint-env worker */
import GlyphWorker from './glyph'
import FillWorker from './fill'
import LineWorker from './line'
import PointWorker from './point'
import RasterWorker from './raster'
import ImageStore from './imageStore'

import type { VectorTile } from 's2-vector-tile'
import type { FlushData, TileRequest } from '../worker.spec'
import type {
  GPUType,
  HillshadeWorkerLayer,
  LayerDefinition,
  LayerType,
  RasterWorkerLayer,
  SensorWorkerLayer,
  StylePackage,
  WorkerLayer
} from 'style/style.spec'
import type { JSONVectorTile } from '../source/json-vt/tile'
import type { IDGen, VectorWorker, Workers } from './process.spec'
import type { Glyph } from './glyph/familySource'
import type { GlyphMetadata } from 'workers/source/glyphSource'
import type { ImageMetadata } from 'workers/source/imageSource'

// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 22bit: 4,194,304 --- 16bit: 65,535 --- 7bit: 128
export const ID_MAX_SIZE = 1 << 22

export default class ProcessManager {
  id!: number
  gpuType!: GPUType
  idGen!: IDGen
  experimental = false
  messagePort!: MessageChannel['port1']
  sourceWorker!: MessageChannel['port2']
  textDecoder: TextDecoder = new TextDecoder()
  layers: Record<string, WorkerLayer[]> = {}
  workers: Workers = {}
  imageStore = new ImageStore()

  _buildIDGen (totalWorkers: number): void {
    this.idGen = buildIDGen(this.id, totalWorkers)
  }

  setupStyle (mapID: string, style: StylePackage): void {
    const { layers, gpuType, experimental } = style
    this.gpuType = gpuType
    this.experimental = experimental
    const workerTypes = new Set<LayerType>()

    // first we need to build the workers
    for (const layer of layers) workerTypes.add(layer.type)
    this.#buildWorkers(workerTypes)

    // Convert LayerDefinition to WorkerLayer and store in layers
    const workerLayers = layers
      .map((layer): WorkerLayer | undefined => this.setupLayer(layer))
      .filter(layer => layer !== undefined) as WorkerLayer[]
    this.layers[mapID] = workerLayers

    // setup imageStore
    this.imageStore.setupMap(mapID)
  }

  setupLayer (layer: LayerDefinition): undefined | WorkerLayer {
    if (layer.type === 'shade') return
    return this.workers[layer.type]?.setupLayer(layer as any)
  }

  #buildWorkers (names: Set<LayerType>): void {
    const { idGen, gpuType, experimental, workers, sourceWorker, imageStore } = this
    // setup imageStore
    imageStore.setup(idGen, sourceWorker)
    for (const name of names) {
      if (name === 'fill') {
        workers.fill = new FillWorker(idGen, gpuType, imageStore)
      } else if (name === 'line') {
        workers.line = new LineWorker(idGen, gpuType)
      } else if (name === 'point' || name === 'heatmap') {
        workers.point = workers.heatmap = new PointWorker(idGen, gpuType)
      } else if (name === 'glyph') {
        workers.glyph = new GlyphWorker(idGen, gpuType, sourceWorker, imageStore, experimental)
      } else if (
        (name === 'raster' || name === 'sensor' || name === 'hillshade') &&
        this.workers.raster === undefined
      ) {
        workers.hillshade = workers.sensor = workers.raster = new RasterWorker(gpuType)
      }
    }
  }

  async processVector (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    vectorTile: VectorTile | JSONVectorTile
  ): Promise<void> {
    const { workers } = this
    const { zoom, parent } = tile
    const { layerIndexes } = parent ?? tile
    // filter layers to those that source metadata explains exists in this tile
    const sourceLayers = this.layers[mapID].filter(layer =>
      layerIndexes === undefined ? true : layerIndexes.includes(layer.layerIndex)
    )
    // prep a layerIndex tracker for an eventual generic flush.
    // Some layerIndexes will never be updated, so it's good to know
    const layers: Record<number, number> = {}
    sourceLayers.forEach(l => { layers[l.layerIndex] = 0 })

    // TODO: features is repeated through too many times. Simplify this down.
    for (const sourceLayer of sourceLayers) {
      if (!('filter' in sourceLayer)) continue
      const { type, filter, minzoom, maxzoom, layerIndex, layer } = sourceLayer
      if (minzoom > zoom || maxzoom < zoom) continue
      // grab the layer of interest from the vectorTile and it's extent
      const vectorLayer = vectorTile.layers[layer]
      if (vectorLayer === undefined) continue
      // iterate over the vector features, filter as necessary
      for (let f = 0; f < vectorLayer.length; f++) {
        const feature = vectorLayer.feature?.(f)
        if (feature === undefined) continue
        const { properties } = feature
        // filter out features that are not applicable, otherwise tell the vectorWorker to build
        if (filter(properties)) {
          const wasBuilt = await workers[type]?.buildFeature(tile, feature, sourceLayer as any, mapID)
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
    layers: Record<number, number>
  ): void {
    const { imageStore } = this
    const tileID = tile.id
    // first see if any data was missing. If so, we may need to wait for it to be processed
    const wait = imageStore.processMissingData(mapID, tileID, sourceName)
    // flush each worker
    for (const worker of Object.values(this.workers)) {
      void (worker as VectorWorker).flush(mapID, tile, sourceName, wait)
    }

    const msg: FlushData = { type: 'flush', tileID, mapID, layers }
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
    const sourceLayers = this.layers[mapID].filter(layer => layer.source === subSourceName) as Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>

    void this.workers.raster?.buildTile(mapID, sourceName, sourceLayers, tile, data, size)
  }

  processMetadata (
    mapID: string,
    glyphMetadata: GlyphMetadata[],
    imageMetadata: ImageMetadata[]
  ): void {
    this.imageStore.processMetadata(mapID, glyphMetadata, imageMetadata)
  }

  processGlyphResponse (
    mapID: string,
    reqID: string,
    glyphMetadata: Glyph[],
    familyName: string
  ): void {
    this.imageStore.processGlyphResponse(mapID, reqID, glyphMetadata, familyName)
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

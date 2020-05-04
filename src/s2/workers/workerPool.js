// @flow
import S2Map from '../s2Map'

import type { StylePackage } from '../style'
import type { TileRequest } from './tile.worker'

// workerPool is designed to manage the workers and when a worker is free, send... work
const AVAILABLE_LOGICAL_PROCESSES = Math.floor((window.navigator.hardwareConcurrency || 4) / 2)

class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_LOGICAL_PROCESSES, 6), 1)
  workers: Array<Worker> = []
  maps: { [string]: S2Map } = {} // MapID: S2Map
  constructor () {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker('./tile.worker.js', { type: 'module' })
      worker.onmessage = this._onMessage.bind(this)
      this.workers.push(worker)
    }
  }

  _onMessage ({ data }) {
    const { type } = data
    if (type === 'vectordata') {
      // a worker has processed tiles, so we are going to send it back to the appropriate mapID
      const { source, mapID, tileID, parentLayers, vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer } = data
      this.maps[mapID].injectVectorSourceData(source, tileID, parentLayers, vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer)
    } else if (type === 'glyphdata') {
      const { source, mapID, tileID, glyphFilterBuffer, glyphVertexBuffer, glyphIndexBuffer, glyphQuadBuffer, colorBuffer, layerGuideBuffer } = data
      this.maps[mapID].injectGlyphSourceData(source, tileID, glyphFilterBuffer, glyphVertexBuffer, glyphIndexBuffer, glyphQuadBuffer, colorBuffer, layerGuideBuffer)
    } else if (type === 'rasterdata') {
      const { source, mapID, tileID, image, leftShift, bottomShift } = data
      this.maps[mapID].injectRasterData(source, tileID, image, leftShift, bottomShift)
    } else if (type === 'maskdata') {
      const { mapID, tileID, vertexBuffer, indexBuffer, radiiBuffer } = data
      this.maps[mapID].injectMaskGeometry(tileID, vertexBuffer, indexBuffer, radiiBuffer)
    }
  }

  addMap (map: S2Map) {
    this.maps[map.id] = map
  }

  injectStyle (mapID: string, style: StylePackage) {
    const totalWorkers = this.workers.length
    this.workers.forEach((worker, id) => { worker.postMessage({ mapID, type: 'style', style, id, totalWorkers }) })
  }

  tileRequest (mapID: string, tiles: Array<TileRequest>) {
    const self = this
    // step1: split the tiles up by workerCount
    const groupedTiles = new Array(self.workerCount)
    for (let i = 0; i < self.workerCount; i++) groupedTiles[i] = []
    tiles.forEach((tile, i) => { groupedTiles[i % self.workerCount].push(tile) })
    // step2: send the tile groups off to each worker
    groupedTiles.forEach((tiles, i) => {
      if (tiles.length) self.workers[i].postMessage({ mapID, type: 'request', tiles })
    })
  }
}

if (!window.S2WorkerPool) window.S2WorkerPool = new WorkerPool()

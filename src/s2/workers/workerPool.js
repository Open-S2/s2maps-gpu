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
      const { source, mapID, tileID, vertexBuffer, indexBuffer, featureIndexBuffer, featureGuideBuffer } = data
      this.maps[mapID].injectVectorSourceData(source, tileID, vertexBuffer, indexBuffer, featureIndexBuffer, featureGuideBuffer)
    }
  }

  addMap (map: S2Map) {
    this.maps[map.id] = map
  }

  injectStyle (mapID: string, style: StylePackage) {
    this.workers.forEach(worker => { worker.postMessage({ mapID, type: 'style', style }) })
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

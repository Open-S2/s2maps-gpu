// @flow
/* global createImageBitmap Worker */
import type S2Map from '../s2Map'
import requestData from '../util/fetch'

import type { StylePackage } from '../style/styleSpec'
import type { TileRequest } from './tile.worker'

// workerPool is designed to manage the workers and when a worker is free, send... work
const AVAILABLE_LOGICAL_PROCESSES = Math.floor((window.navigator.hardwareConcurrency || 4) / 2)

class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_LOGICAL_PROCESSES, 6), 1)
  workers: Array<Worker> = []
  maps: { [string]: S2Map } = {} // MapID: S2Map
  constructor () {
    for (let i = 0; i < this.workerCount; i++) { // $FlowIgnore
      const worker = new Worker('./tile.worker.js', { type: 'module' })
      worker.onmessage = this._onMessage.bind(this)
      this.workers.push(worker)
    }
  }

  _onMessage ({ data }) {
    // a worker has processed tiles, so we are going to send it back to the appropriate mapID
    if (data.type === 'imageBitmap') {
      const { mapID, id, tileID, sourceName, zoom, tileSize, path, fileType } = data
      // build the canvas and draw the image
      requestData(path, fileType, (data) => {
        if (data) {
          createImageBitmap(data)
            .then(image => {
              const canvas = document.createElement('canvas')
              canvas.width = canvas.height = tileSize
              const context = canvas.getContext('2d')
              context.drawImage(image, 0, 0)
              const imageData = context.getImageData(0, 0, tileSize, tileSize)
              const dem = imageData.data.buffer
              this.workers[id].postMessage({ mapID, type: 'buildMesh', tileID, sourceName, zoom, dem, tileSize }, [dem])
            })
        }
      })
    } else { this.maps[data.mapID].injectData(data) }
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

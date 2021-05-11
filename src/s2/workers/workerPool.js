// @flow
import TileWorker from './tile.worker.js'
import SourceWorker from './source.worker.js'

// TODO:
// https://stackoverflow.com/questions/21913673/execute-web-worker-from-different-origin

import type S2Map from '../s2Map'
import type { StylePackage } from '../style/styleSpec'

export type TileRequest = {
  hash: number,
  face: Face,
  zoom: number,
  bbox: [number, number, number, number],
  x: number,
  y: number,
  division: number,
  size: number
}

// workerPool is designed to manage the workers and when a worker is free, send... work
// const AVAILABLE_LOGICAL_PROCESSES = Math.floor((window.navigator.hardwareConcurrency || 4) / 2)

class WorkerPool {
  workerCount: number = 2 // Math.max(Math.min(AVAILABLE_LOGICAL_PROCESSES, 6), 1)
  workers: Array<TileWorker> = []
  sourceWorker: SourceWorker
  maps: { [string]: S2Map } = {} // MapID: S2Map
  constructor () {
    // create source worker
    const sourceWorker = this.sourceWorker = new SourceWorker()
    sourceWorker.onmessage = this._onSourceMessage.bind(this)
    // create process workers
    for (let i = 0; i < this.workerCount; i++) { // $FlowIgnore
      const tileWorker = new TileWorker()
      // const worker = new Worker(new URL('./tile.worker.js', import.meta.url))
      tileWorker.onmessage = this._onProcessMessage.bind(this)
      this.workers.push(tileWorker)
      // build communication channels
      const channel = new MessageChannel()
      const { port1, port2 } = channel
      sourceWorker.postMessage({ type: 'port', port: port1 }, [port1])
      tileWorker.postMessage({ type: 'port', port: port2, id: i, totalWorkers: this.workerCount }, [port2])
    }
  }

  _onProcessMessage ({ data }) {
    this.maps[data.mapID].injectData(data)
  }

  _onSourceMessage ({ data }) {
    this.maps[data.mapID].injectData(data)
  }

  addMap (map: S2Map) {
    this.maps[map.id] = map
  }

  injectStyle (mapID: string, style: StylePackage) {
    const { sourceWorker } = this
    sourceWorker.postMessage({ mapID, type: 'style', style })
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'style', style })
  }

  tileRequest (mapID: string, tiles: Array<TileRequest>) {
    this.sourceWorker.postMessage({ mapID, type: 'request', tiles })
  }
}

if (!window.S2WorkerPool) window.S2WorkerPool = new WorkerPool()

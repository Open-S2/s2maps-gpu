// @flow
// These worker scripts are pre-interpreted by the worker plugin and a string
// with the location of said worker is passed
// import createWorker from '../util/createWorker'
import SourceWorker from './source.worker.js'
import TileWorker from './tile.worker.js'
// import sourceWorkerURL from './source.worker.url.js'
// import tileWorkerURL from './tile.worker.url.js'

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
const AVAILABLE_LOGICAL_PROCESSES = Math.floor((window.navigator.hardwareConcurrency || 4) / 2)

class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_LOGICAL_PROCESSES, 6), 2)
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
      tileWorker.onmessage = this._onProcessMessage.bind(this)
      this.workers.push(tileWorker)
      // build communication channels; port1 can postMessage, and port2 can onMessage
      const channelA = new MessageChannel()
      const channelB = new MessageChannel()
      sourceWorker.postMessage({ type: 'port', messagePort: channelA.port1, postPort: channelB.port2, id: i }, [channelA.port1, channelB.port2])
      tileWorker.postMessage({ type: 'port', messagePort: channelB.port1, postPort: channelA.port2, id: i, totalWorkers: this.workerCount }, [channelB.port1, channelA.port2])
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
    this.sourceWorker.postMessage({ mapID, type: 'tilerequest', tiles })
  }
}

if (!window.S2WorkerPool) window.S2WorkerPool = new WorkerPool()

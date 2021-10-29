// @flow
/* eslint-env browser */
// These worker scripts are pre-interpreted by the worker plugin and a string
// with the location of said worker is passed
import type S2Map from '../s2Map'
import type { Face, StylePackage } from '../style/styleSpec'
import type { Marker } from './source/MarkerSource'

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
const AVAILABLE_LOGICAL_PROCESSES: number = Math.floor((window.navigator.hardwareConcurrency || 4) / 2)

class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_LOGICAL_PROCESSES, 6), 2)
  workers: Array<Worker> = []
  sourceWorker: Worker
  maps: { [string]: S2Map } = {} // MapID: S2Map
  constructor () {
    // create source worker
    const sourceWorker = this.sourceWorker = new Worker(new URL('./source.worker.js', import.meta.url), { name: 'source-worker', type: 'module' })
    sourceWorker.onmessage = this._onSourceMessage.bind(this)
    // create process workers
    for (let i = 0; i < this.workerCount; i++) { // $FlowIgnore
      const tileWorker = new Worker(new URL('./tile.worker.js', import.meta.url), { name: 'tile-worker', type: 'module' })
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
    this.sourceWorker.postMessage({ mapID, type: 'style', style })
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'style', style })
  }

  // NOTE: TEMPORARY SOLUTION :(
  delete () {
    this.sourceWorker.terminate()
    for (const worker of this.workers) worker.terminate()
    window.S2WorkerPool = new WorkerPool()
  }

  // delete (mapID: string) {
  //   this.sourceWorker.postMessage({ mapID, type: 'delete' })
  // }

  tileRequest (mapID: string, tiles: Array<TileRequest>, sourceNames: Array<string>) {
    this.sourceWorker.postMessage({ mapID, type: 'tilerequest', tiles, sourceNames })
  }

  getInfo (mapID: string, featureID: number) {
    this.sourceWorker.postMessage({ mapID, type: 'getInfo', featureID })
  }

  addMarkers (mapID: string, markers: Array<Marker>, sourceName: string) {
    this.sourceWorker.postMessage({ mapID, type: 'addMarkers', markers, sourceName })
  }

  removeMarkers (mapID: string, ids: Array<number>, sourceName: string) {
    this.sourceWorker.postMessage({ mapID, type: 'removeMarkers', ids, sourceName })
  }

  deleteSource (mapID: string, sourceNames: Array<string>) {
    this.sourceWorker.postMessage({ mapID, type: 'deleteSource', sourceNames })
  }
}

if (!window.S2WorkerPool) window.S2WorkerPool = new WorkerPool()

/* eslint-env browser */
// These worker scripts are pre-interpreted by the worker plugin and a string
// with the location of said worker is passed
import { CorsWorker as Worker } from '../util/corsWorker'

import type S2Map from '../s2Map'
import type { Analytics, LayerDefinition, StylePackage } from 'style/style.spec'
import type { MarkerDefinition } from './source/markerSource'
import type { SourceWorkerMessage, TileRequest, TileWorkerMessage, WorkerPoolPortMessage } from './worker.spec'

declare global {
  interface Window { S2WorkerPool: WorkerPool }
}

// workerPool is designed to manage the workers and when a worker is free, send... work
const AVAILABLE_WORKERS: number = Math.floor((global.window.navigator.hardwareConcurrency ?? 4) / 2)
export class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_WORKERS, 6), 2)
  workers: Worker[] = []
  sourceWorker: Worker
  maps: Record<string, S2Map> = {} // MapID: S2Map
  constructor () {
    // create source worker
    const sourceWorker = this.sourceWorker = new Worker(new URL('./source.worker', import.meta.url), { name: 'source-worker', type: 'module' })
    sourceWorker.onmessage = this.#onSourceMessage.bind(this)
    // create process workers
    for (let i = 0; i < this.workerCount; i++) {
      const tileWorker = new Worker(new URL('./tile.worker', import.meta.url), { name: 'tile-worker', type: 'module' })
      tileWorker.onmessage = this.#onTileMessage.bind(this)
      this.workers.push(tileWorker)
      // build communication channels; port1 can postMessage, and port2 can onMessage
      const channelA = new MessageChannel()
      const channelB = new MessageChannel()
      const portMessage: WorkerPoolPortMessage = {
        type: 'port',
        id: i,
        totalWorkers: this.workerCount
      }
      sourceWorker.postMessage(portMessage, [channelA.port1, channelB.port2])
      tileWorker.postMessage(portMessage, [channelB.port1, channelA.port2])
    }
  }

  #onTileMessage ({ data }: { data: TileWorkerMessage }): void {
    this.maps[data.mapID].injectData(data)
  }

  #onSourceMessage ({ data }: { data: SourceWorkerMessage }): void {
    this.maps[data.mapID].injectData(data)
  }

  addMap (map: S2Map): void {
    this.maps[map.id] = map
  }

  requestStyle (mapID: string, style: string, analytics: Analytics, apiKey?: string, apiURL?: string): void {
    this.sourceWorker.postMessage({ mapID, type: 'requestStyle', style, apiKey, apiURL, analytics })
  }

  injectStyle (mapID: string, style: StylePackage): void {
    this.sourceWorker.postMessage({ mapID, type: 'style', style })
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'style', style })
  }

  // NOTE: TEMPORARY SOLUTION :(
  delete (): void {
    this.sourceWorker.terminate()
    for (const worker of this.workers) worker.terminate()
    window.S2WorkerPool = new WorkerPool()
  }

  // delete (mapID: string) {
  //   this.sourceWorker.postMessage({ mapID, type: 'delete' })
  // }

  tileRequest (mapID: string, tiles: TileRequest[], sources?: Array<[string, string | undefined]>): void {
    this.sourceWorker.postMessage({ mapID, type: 'tilerequest', tiles, sources })
  }

  timeRequest (mapID: string, tiles: TileRequest[], sourceNames?: string[]): void {
    this.sourceWorker.postMessage({ mapID, type: 'timerequest', tiles, sourceNames })
  }

  getInfo (mapID: string, featureID: number): void {
    this.sourceWorker.postMessage({ mapID, type: 'getInfo', featureID })
  }

  addMarkers (mapID: string, markers: MarkerDefinition[], sourceName: string): void {
    this.sourceWorker.postMessage({ mapID, type: 'addMarkers', markers, sourceName })
  }

  removeMarkers (mapID: string, ids: number[], sourceName: string): void {
    this.sourceWorker.postMessage({ mapID, type: 'removeMarkers', ids, sourceName })
  }

  deleteSource (mapID: string, sourceNames: string[]): void {
    this.sourceWorker.postMessage({ mapID, type: 'deleteSource', sourceNames })
  }

  addLayer (mapID: string, layer: LayerDefinition, index: number, tileRequest: TileRequest[]): void {
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'addLayer', layer, index })
    this.sourceWorker.postMessage({ mapID, type: 'addLayer', layer, index, tileRequest })
  }

  removeLayer (mapID: string, index: number): void {
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'removeLayer', index })
    this.sourceWorker.postMessage({ mapID, type: 'removeLayer', index })
  }

  reorderLayers (mapID: string, layerChanges: Record<string | number, number>): void {
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'reorderLayers', layerChanges })
    this.sourceWorker.postMessage({ mapID, type: 'reorderLayers', layerChanges })
  }
}

if (window.S2WorkerPool === undefined) window.S2WorkerPool = new WorkerPool()

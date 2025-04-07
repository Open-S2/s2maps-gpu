import SourceWorker from './source.worker';
import TileWorker from './tile.worker';

import type { MarkerDefinition } from './source/markerSource';
import type S2Map from '../s2Map';
import type { WorkerPool as WorkerPoolMain } from './workerPool';
import type { Analytics, LayerDefinition, StylePackage } from 'style/style.spec';
import type {
  SourceWorkerMessage,
  TileRequest,
  TileWorkerMessage,
  WorkerPoolPortMessage,
} from './worker.spec';

// workerPool is designed to manage the workers and when a worker is free, send... work
const AVAILABLE_WORKERS: number = Math.floor((window.navigator.hardwareConcurrency ?? 4) / 2);
/**
 *
 */
export class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_WORKERS, 6), 2);
  workers: Worker[] = [];
  sourceWorker: Worker;
  maps: Record<string, S2Map> = {}; // MapID: S2Map
  /**
   *
   */
  constructor() {
    // create source worker
    const sourceWorker = (this.sourceWorker = new SourceWorker() as unknown as Worker);
    sourceWorker.onmessage = this.#onMessage.bind(this);
    // create process workers
    for (let i = 0; i < this.workerCount; i++) {
      const tileWorker = new TileWorker() as unknown as Worker;
      tileWorker.onmessage = this.#onMessage.bind(this);
      this.workers.push(tileWorker);
      // build communication channels; port1 can postMessage, and port2 can onMessage
      const channelA = new MessageChannel();
      const channelB = new MessageChannel();
      const portMessage: WorkerPoolPortMessage = {
        type: 'port',
        id: i,
        totalWorkers: this.workerCount,
      };
      sourceWorker.postMessage(portMessage, [channelA.port1, channelB.port2]);
      tileWorker.postMessage(portMessage, [channelB.port1, channelA.port2]);
    }
  }

  /**
   * @param root0
   * @param root0.data
   */
  #onMessage({ data }: { data: TileWorkerMessage | SourceWorkerMessage }): void {
    this.maps[data.mapID].injectData(data);
  }

  /**
   * @param map
   */
  addMap(map: S2Map): void {
    this.maps[map.id] = map;
  }

  /**
   * @param mapID
   * @param style
   * @param analytics
   * @param apiKey
   * @param urlMap
   */
  requestStyle(
    mapID: string,
    style: string,
    analytics: Analytics,
    apiKey?: string,
    urlMap?: Record<string, string>,
  ): void {
    this.sourceWorker.postMessage({
      mapID,
      type: 'requestStyle',
      style,
      apiKey,
      urlMap,
      analytics,
    });
  }

  /**
   * @param mapID
   * @param style
   */
  injectStyle(mapID: string, style: StylePackage): void {
    this.sourceWorker.postMessage({ mapID, type: 'style', style });
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'style', style });
  }

  // NOTE: TEMPORARY SOLUTION :(
  /**
   *
   */
  delete(): void {
    this.sourceWorker.terminate();
    for (const worker of this.workers) worker.terminate();
    window.S2WorkerPool = new WorkerPool() as unknown as WorkerPoolMain;
  }
  // delete (mapID: string) {
  //   this.sourceWorker.postMessage({ mapID, type: 'delete' })
  // }

  /**
   * @param mapID
   * @param tiles
   * @param sources
   */
  tileRequest(
    mapID: string,
    tiles: TileRequest[],
    sources?: Array<[string, string | undefined]>,
  ): void {
    this.sourceWorker.postMessage({ mapID, type: 'tilerequest', tiles, sources });
  }

  /**
   * @param mapID
   * @param tiles
   * @param sourceNames
   */
  timeRequest(mapID: string, tiles: TileRequest[], sourceNames?: string[]): void {
    this.sourceWorker.postMessage({ mapID, type: 'timerequest', tiles, sourceNames });
  }

  /**
   * @param mapID
   * @param markers
   * @param sourceName
   */
  addMarkers(mapID: string, markers: MarkerDefinition[], sourceName: string): void {
    this.sourceWorker.postMessage({ mapID, type: 'addMarkers', markers, sourceName });
  }

  /**
   * @param mapID
   * @param ids
   * @param sourceName
   */
  deleteMarkers(mapID: string, ids: number[], sourceName: string): void {
    this.sourceWorker.postMessage({ mapID, type: 'deleteMarkers', ids, sourceName });
  }

  /**
   * @param mapID
   * @param sourceNames
   */
  deleteSource(mapID: string, sourceNames: string[]): void {
    this.sourceWorker.postMessage({ mapID, type: 'deleteSource', sourceNames });
  }

  /**
   * @param mapID
   * @param layer
   * @param index
   * @param tileRequest
   */
  addLayer(mapID: string, layer: LayerDefinition, index: number, tileRequest: TileRequest[]): void {
    for (const worker of this.workers)
      worker.postMessage({ mapID, type: 'addLayer', layer, index });
    this.sourceWorker.postMessage({ mapID, type: 'addLayer', layer, index, tileRequest });
  }

  /**
   * @param mapID
   * @param index
   */
  deleteLayer(mapID: string, index: number): void {
    for (const worker of this.workers) worker.postMessage({ mapID, type: 'deleteLayer', index });
    this.sourceWorker.postMessage({ mapID, type: 'deleteLayer', index });
  }

  /**
   * @param mapID
   * @param layerChanges
   */
  reorderLayers(mapID: string, layerChanges: Record<string | number, number>): void {
    for (const worker of this.workers)
      worker.postMessage({ mapID, type: 'reorderLayers', layerChanges });
    this.sourceWorker.postMessage({ mapID, type: 'reorderLayers', layerChanges });
  }
}

if (window.S2WorkerPool === undefined)
  window.S2WorkerPool = new WorkerPool() as unknown as WorkerPoolMain;

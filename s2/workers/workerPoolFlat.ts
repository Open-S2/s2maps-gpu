import SourceWorker from './source.worker.js';
import TileWorker from './tile.worker.js';

import type { MarkerDefinition } from './source/markerSource.js';
import type S2Map from '../s2Map.js';
import type { UrlMap } from 'util/index.js';
import type { WorkerPool as WorkerPoolMain } from './workerPool.js';
import type {
  AddLayerMessageGL,
  AddMarkersMessage,
  AddSourceMessage,
  DeleteLayerMessageGL,
  DeleteMarkersMessage,
  DeleteSourceMessage,
  ReorderLayersMessageGL,
  RequestStyleMessage,
  SourceWorkerMessage,
  StyleMessage,
  TileRequest,
  TileRequestMessage,
  TileWorkerMessage,
  TimeRequestMessage,
  WorkerPoolPortMessage,
} from './worker.spec.js';
import type { Analytics, LayerDefinition, Source, StylePackage } from 'style/style.spec.js';

const AVAILABLE_WORKERS: number = Math.floor((window.navigator.hardwareConcurrency ?? 4) / 2);
/**
 * # Worker Pool
 *
 * Manages the tile workers and the source worker
 *
 * The Source worker manages sources, builds/fetches requests, and sends them to the tile workers to be processed
 *
 * The Tile Workers process the raw data into renderable / interactive data for the GPU or end user.
 *
 * Communications channels are created for:
 * - SourceWorker<->TileWorker
 * - TileWorker->Worker Pool->Map Object
 * - SourceWorker->Worker Pool->Map Object
 *
 * There is a two way channel for SourceWorker<->TileWorker mostly because of glyphs,images, etc.
 */
export class WorkerPool {
  workerCount: number = Math.max(Math.min(AVAILABLE_WORKERS, 6), 2);
  workers: Worker[] = [];
  sourceWorker: Worker;
  maps: Record<string, S2Map> = {}; // MapID: S2Map
  /** setup workers and channels between all */
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
   * Handle messages from the workers (forward them to the appropriate map)
   * @param message - the message
   */
  #onMessage(message: MessageEvent<TileWorkerMessage | SourceWorkerMessage>): void {
    this.maps[message.data.mapID].injectData(message.data);
  }

  /**
   * Add a map to the worker pool for communication
   * @param map - the s2map
   */
  addMap(map: S2Map): void {
    this.maps[map.id] = map;
  }

  /**
   * Request the source worker load a style
   * @param mapID - the id of the map
   * @param style - the style url to fetch
   * @param analytics - basic analytics
   * @param apiKey - the api key if needed
   * @param urlMap - the url map
   */
  requestStyle(
    mapID: string,
    style: string,
    analytics: Analytics,
    apiKey?: string,
    urlMap?: UrlMap,
  ): void {
    const msg: RequestStyleMessage = {
      mapID,
      type: 'requestStyle',
      style,
      apiKey,
      urlMap,
      analytics,
    };
    this.sourceWorker.postMessage(msg);
  }

  /**
   * Inject a style. The style is already built, so just send it to the workers
   * @param mapID - the id of the map
   * @param style - the style data
   */
  injectStyle(mapID: string, style: StylePackage): void {
    const msg: StyleMessage = { mapID, type: 'style', style };
    this.sourceWorker.postMessage(msg);
    for (const worker of this.workers) worker.postMessage(msg);
  }

  // NOTE: TEMPORARY SOLUTION :(
  /** delete the worker pool. This is a temporary solution as the worker pool should be a singleton. */
  delete(): void {
    this.sourceWorker.terminate();
    for (const worker of this.workers) worker.terminate();
    window.S2WorkerPool = new WorkerPool() as unknown as WorkerPoolMain;
  }
  // delete (mapID: string) {
  //   this.sourceWorker.postMessage({ mapID, type: 'delete' })
  // }

  /**
   * Request tiles
   * @param mapID - the id of the map
   * @param tiles - the tiles to fetch data for
   * @param sources - the sources to fetch data for. If empty request data for all sources
   */
  tileRequest(
    mapID: string,
    tiles: TileRequest[],
    sources: Array<[sourceName: string, href: string | undefined]> = [],
  ): void {
    const msg: TileRequestMessage = { mapID, type: 'tilerequest', tiles, sources };
    this.sourceWorker.postMessage(msg);
  }

  /**
   * Request temporal tile data
   * @param mapID - the id of the map
   * @param tiles - the tiles to fetch data for
   * @param sourceNames - the sources to fetch data for. If empty request data for all sources
   */
  timeRequest(mapID: string, tiles: TileRequest[], sourceNames: string[] = []): void {
    const msg: TimeRequestMessage = { mapID, type: 'timerequest', tiles, sourceNames };
    this.sourceWorker.postMessage(msg);
  }

  /**
   * Add marker(s) to the map
   * @param mapID - the id of the map to add marker(s) to
   * @param markers - the marker(s) to add
   * @param sourceName - the name of the source to add the marker(s) to
   */
  addMarkers(mapID: string, markers: MarkerDefinition[], sourceName: string): void {
    const msg: AddMarkersMessage = { mapID, type: 'addMarkers', markers, sourceName };
    this.sourceWorker.postMessage(msg);
  }

  /**
   * Delete marker(s) from the map
   * @param mapID - the id of the map to delete marker(s) from
   * @param ids - the id(s) of the marker(s) to delete
   * @param sourceName - the name of the source to delete the marker(s) from
   */
  deleteMarkers(mapID: string, ids: number[], sourceName: string): void {
    const msg: DeleteMarkersMessage = { mapID, type: 'deleteMarkers', ids, sourceName };
    this.sourceWorker.postMessage(msg);
  }

  /**
   * Add a source to the map
   * @param mapID - the id of the map to add the source to
   * @param sourceName - the name of the source to add the source to
   * @param source - the source
   * @param tileRequest - the list of tiles of all existing tiles in the map already to build this source data for
   */
  addSource(mapID: string, sourceName: string, source: Source, tileRequest: TileRequest[]): void {
    const msg: AddSourceMessage = { mapID, type: 'addSource', sourceName, source, tileRequest };
    this.sourceWorker.postMessage(msg);
    for (const worker of this.workers) worker.postMessage(msg);
  }

  /**
   * Delete a source from the map
   * @param mapID - the id of the map to delete the source from
   * @param sourceNames - the name(s) of the source(s) to delete
   */
  deleteSource(mapID: string, sourceNames: string[]): void {
    const msg: DeleteSourceMessage = { mapID, type: 'deleteSource', sourceNames };
    this.sourceWorker.postMessage(msg);
    for (const worker of this.workers) worker.postMessage(msg);
  }

  /**
   * Add a style layer to the map
   * @param mapID - the id of the map to add the layer to
   * @param layer - the style layer
   * @param index - the index to add the layer at
   * @param tileRequest - the list of tiles of all existing tiles in the map already to adjust
   */
  addLayer(mapID: string, layer: LayerDefinition, index: number, tileRequest: TileRequest[]): void {
    const msg: AddLayerMessageGL = { mapID, type: 'addLayer', layer, index, tileRequest };
    this.sourceWorker.postMessage(msg);
    for (const worker of this.workers) worker.postMessage(msg);
  }

  /**
   * Delete a style layer from the map
   * @param mapID - the id of the map to delete the layer from
   * @param index - the index of the style layer to delete
   */
  deleteLayer(mapID: string, index: number): void {
    const msg: DeleteLayerMessageGL = { mapID, type: 'deleteLayer', index };
    this.sourceWorker.postMessage(msg);
    for (const worker of this.workers) worker.postMessage(msg);
  }

  /**
   * Reorder style layers
   * @param mapID - the id of the map
   * @param layerChanges - the layer changes to make
   */
  reorderLayers(mapID: string, layerChanges: Record<string | number, number>): void {
    const msg: ReorderLayersMessageGL = { mapID, type: 'reorderLayers', layerChanges };
    this.sourceWorker.postMessage(msg);
    for (const worker of this.workers) worker.postMessage(msg);
  }
}

if (window.S2WorkerPool === undefined)
  window.S2WorkerPool = new WorkerPool() as unknown as WorkerPoolMain;

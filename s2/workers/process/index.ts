import FillWorker from './fill.js';
import GlyphWorker from './glyph/index.js';
import { IDGen } from './process.spec.js';
import ImageStore from './imageStore.js';
import LineWorker from './line.js';
import PointWorker from './point.js';
import RasterWorker from './raster.js';

import type { Glyph } from './glyph/familySource.js';
import type { GlyphMetadata } from 'workers/source/glyphSource.js';
import type { ImageSourceMetadata } from 'workers/source/imageSource.js';
import type {
  GPUType,
  HillshadeWorkerLayer,
  LayerDefinition,
  LayerType,
  RasterWorkerLayer,
  SensorWorkerLayer,
  StylePackage,
  WorkerLayer,
} from 'style/style.spec.js';
import type { TileFlushMessage, TileRequest } from '../worker.spec.js';
import type { VTTile, VectorWorker, Workers } from './process.spec.js';

/**
 * # Process Manager
 *
 * A managment class for all input vector/raster work for the Tile Worker thread.
 * Handles all input data cases and handles shipping the resultant render data back to the main thread
 */
export default class ProcessManager {
  id!: number;
  gpuType!: GPUType;
  idGen!: IDGen;
  experimental = false;
  messagePort!: MessageChannel['port1'];
  sourceWorker!: MessageChannel['port2'];
  textDecoder: TextDecoder = new TextDecoder();
  layers: Record<string, WorkerLayer[]> = {};
  workers: Workers = {};
  imageStore = new ImageStore();
  mapStyles: Record<string, StylePackage> = {};

  /**
   * Internal function to build the id generator
   * @param totalWorkers - the total number of tile workers
   */
  _buildIDGen(totalWorkers: number): void {
    this.idGen = new IDGen(this.id, totalWorkers);
  }

  /**
   * Setup a map style
   * @param mapID - the id of the map to setup the style for
   * @param style - the style to setup
   */
  setupStyle(mapID: string, style: StylePackage): void {
    this.mapStyles[mapID] = style;
    const { layers, gpuType, experimental } = style;
    this.gpuType = gpuType;
    this.experimental = experimental;
    const workerTypes = new Set<LayerType>();

    // first we need to build the workers
    for (const layer of layers) workerTypes.add(layer.type);
    this.#buildWorkers(workerTypes, style);

    // Convert LayerDefinition to WorkerLayer and store in layers
    const workerLayers = layers
      .map((layer): WorkerLayer | undefined => this.setupLayer(layer))
      .filter((layer) => layer !== undefined) as WorkerLayer[];
    this.layers[mapID] = workerLayers;

    // setup imageStore
    this.imageStore.setupMap(mapID);
  }

  /**
   * Setup a style layer into a "worker layer" that can process input data into renderable data
   * @param layer - the layer to setup
   * @returns the worker layer
   */
  setupLayer(layer: LayerDefinition): undefined | WorkerLayer {
    if (layer.type === 'shade') return;
    return this.workers[layer.type]?.setupLayer(layer as never);
  }

  /**
   * Build the workers needed for the style
   * @param names - the names of the workers
   * @param style - the style that has layers describing the workers it needs
   */
  #buildWorkers(names: Set<LayerType>, style: StylePackage): void {
    const { idGen, gpuType, workers, sourceWorker, imageStore } = this;
    const { tileSize } = style;
    // setup imageStore
    imageStore.setup(idGen, sourceWorker);
    for (const name of names) {
      if (name === 'fill') {
        workers.fill = new FillWorker(idGen, gpuType, imageStore);
      } else if (name === 'line') {
        workers.line = new LineWorker(idGen, gpuType);
      } else if (name === 'point' || name === 'heatmap') {
        workers.point = workers.heatmap = new PointWorker(idGen, gpuType);
      } else if (name === 'glyph') {
        workers.glyph = new GlyphWorker(idGen, gpuType, sourceWorker, imageStore, tileSize);
      } else if (
        (name === 'raster' || name === 'sensor' || name === 'hillshade') &&
        this.workers.raster === undefined
      ) {
        workers.hillshade = workers.sensor = workers.raster = new RasterWorker(gpuType);
      }
    }
  }

  /**
   * Process the input vector data
   * @param mapID - the map that made the request
   * @param tile - the tile request
   * @param sourceName - the name of the source the data belongs to
   * @param vectorTile - the input vector tile to parse
   */
  async processVector(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    vectorTile: VTTile,
  ): Promise<void> {
    const { workers } = this;
    const { zoom, parent } = tile;
    const { layerIndexes } = parent ?? tile;
    // filter layers to those that source metadata explains exists in this tile
    const sourceLayers = this.layers[mapID].filter((layer) =>
      layerIndexes === undefined ? true : layerIndexes.includes(layer.layerIndex),
    );
    // prep a layerIndex tracker for an eventual generic flush.
    // Some layerIndexes will never be updated, so it's good to know
    const layers: Record<number, number> = {};
    sourceLayers.forEach((l) => {
      layers[l.layerIndex] = 0;
    });

    // TODO: features is repeated through too many times. Simplify this down.
    for (const sourceLayer of sourceLayers) {
      if (!('filter' in sourceLayer)) continue;
      const { type, filter, minzoom, maxzoom, layerIndex, layer } = sourceLayer;
      if (minzoom > zoom || maxzoom < zoom) continue;
      // grab the layer of interest from the vectorTile and it's extent
      const vectorLayer = vectorTile.layers[layer];
      if (vectorLayer === undefined) continue;
      // iterate over the vector features, filter as necessary
      for (let f = 0; f < vectorLayer.length; f++) {
        const feature = vectorLayer.feature?.(f);
        if (feature === undefined) continue;
        const { properties } = feature;
        // filter out features that are not applicable, otherwise tell the vectorWorker to build
        if (filter(properties)) {
          const wasBuilt = await workers[type]?.buildFeature(
            tile,
            vectorLayer.extent,
            feature,
            sourceLayer as never,
            mapID,
            sourceName,
          );
          if (wasBuilt === true && layers[layerIndex] !== undefined) layers[layerIndex]++;
        }
      }
    }
    // now flush the workers
    this.flush(mapID, tile, sourceName, layers);
  }

  /**
   * Flush all data produced from a tile input.
   * @param mapID - the map that made the request
   * @param tile - the tile request
   * @param sourceName - the name of the source the data belongs to
   * @param layers - the layers that were built
   */
  flush(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    layers: Record<number, number>,
  ): void {
    const { imageStore } = this;
    const tileID = tile.id;
    // first see if any data was missing. If so, we may need to wait for it to be processed
    const wait = imageStore.processMissingData(mapID, tileID, sourceName);
    // flush each worker
    for (const worker of Object.values(this.workers)) {
      void (worker as VectorWorker).flush(mapID, tile, sourceName, wait);
    }

    const deadLayers: number[] = [];
    for (const [id, count] of Object.entries(layers)) if (count === 0) deadLayers.push(Number(id));
    const msg: TileFlushMessage = {
      type: 'flush',
      from: 'tile',
      tileID,
      mapID,
      sourceName,
      deadLayers,
    };
    postMessage(msg);
  }

  /**
   * Process RGBA based data
   * @param mapID - the map that made the request
   * @param tile - the tile request
   * @param sourceName - the name of the source the data belongs to
   * @param data - the input data
   * @param size - the size of the input data
   */
  processRaster(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    data: ArrayBuffer,
    size: number,
  ): void {
    const subSourceName = sourceName.split(':')[0];
    // filter layers to source
    const sourceLayers = this.layers[mapID].filter(
      (layer) => layer.source === subSourceName,
    ) as Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>;

    void this.workers.raster?.buildTile(mapID, sourceName, sourceLayers, tile, data, size);
  }

  /**
   * Process glyph/icon/sprite/image metadata
   * @param mapID - the map that made the request
   * @param glyphMetadata - the glyph/icon metadatas
   * @param imageMetadata - the sprite/image metadatas
   */
  processMetadata(
    mapID: string,
    glyphMetadata: GlyphMetadata[],
    imageMetadata: ImageSourceMetadata[],
  ): void {
    this.imageStore.processMetadata(mapID, glyphMetadata, imageMetadata);
  }

  /**
   * Process glyph/icon response from the source worker
   * @param mapID - the map that made the request
   * @param reqID - the id of the request
   * @param glyphMetadata - the glyph metadata
   * @param familyName - the name of the family
   */
  processGlyphResponse(
    mapID: string,
    reqID: string,
    glyphMetadata: Glyph[],
    familyName: string,
  ): void {
    this.imageStore.processGlyphResponse(mapID, reqID, glyphMetadata, familyName);
  }
}

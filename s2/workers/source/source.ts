import { idParent, idToIJ } from 'gis-tools/index.js';

import type { Session } from './index.js';
import type {
  Attributions,
  Encoding,
  LayerDefinition,
  LayersMetaData,
  Projection,
  Scheme,
  SourceMetadata,
  SourceType,
  VectorLayer,
} from 'style/style.spec.js';
import type { ParentLayers, SourceFlushMessage, TileRequest } from '../worker.spec.js';

/**
 * # Generic Data Source Container
 *
 * This class is wrapped by many other source types. It serves to handle all the generic cases
 * of data sources like fetching metadata, handling flushes, and so on.
 */
export default class Source {
  active = true;
  /** Resolver letting us know when the source is built */
  resolve: (value: void | PromiseLike<void>) => void = () => {};
  ready = new Promise<void>((resolve) => {
    this.resolve = resolve;
  });
  name: string;
  path: string;
  type: SourceType = 'vector'; // how to process the result
  extension = 'pbf';
  encoding: Encoding = 'none';
  scheme: Scheme = 'xyz';
  projection: Projection;
  isTimeFormat = false;
  attributions: Attributions = {};
  styleLayers: LayerDefinition[];
  layers?: LayersMetaData;
  minzoom = 0;
  maxzoom = 20;
  size = 512; // used for raster type sources
  faces = new Set<number>();
  needsToken: boolean;
  time?: number;
  session: Session;
  textEncoder: TextEncoder = new TextEncoder();
  /**
   * @param name - name of the source
   * @param projection - the projection used
   * @param layers - the style layers that are associated with this source
   * @param path - the path to the source to fetch data
   * @param needsToken - flag indicating if the source requires a token in the fetch
   * @param session - the session that works with the token to make valid fetch requests on source data behind an API
   */
  constructor(
    name: string,
    projection: Projection,
    layers: LayerDefinition[],
    path: string,
    needsToken = false,
    session: Session,
  ) {
    this.name = name;
    this.projection = projection;
    this.styleLayers = layers;
    this.path = path;
    this.needsToken = needsToken;
    this.session = session;
  }

  // if this function runs, we assume default tile source
  /**
   * If this function runs, we assume a default quad-tree tile source
   * @param mapID - the id of the map that is requesting data
   * @param metadata - the metadata for the source
   */
  async build(mapID: string, metadata?: SourceMetadata): Promise<void> {
    if (metadata === undefined)
      metadata = await this._fetch<SourceMetadata>(`${this.path}/metadata.json`, mapID, true);
    if (metadata === undefined) {
      this.active = false;
      console.error(`FAILED TO extrapolate ${this.path} metadata`);
    } else {
      this._buildMetadata(metadata, mapID);
    }
  }

  /**
   * Internal tool to builds the metadata for the source
   * @param metadata - the source metadata
   * @param mapID - the id of the map that we will be shipping the render data to
   */
  _buildMetadata(metadata: SourceMetadata, mapID: string): void {
    this.active = true; // incase we use a "broken" aproach for metadata and insert later
    const minzoom = Number(metadata.minzoom);
    const maxzoom = Number(metadata.maxzoom);
    this.minzoom = !isNaN(minzoom) ? minzoom : 0;
    this.maxzoom = Math.min(!isNaN(maxzoom) ? maxzoom : 20, this.maxzoom);
    if (Array.isArray(metadata.faces)) this.faces = new Set(metadata.faces ?? [0, 1, 2, 3, 4, 5]);
    if (typeof metadata.extension === 'string') this.extension = metadata.extension;
    this.attributions = metadata.attributions ?? {};
    this.type = parseMetaType(metadata.type);
    if (typeof metadata.size === 'number') this.size = metadata.size;
    this.encoding = metadata.encoding ?? 'none';
    if (typeof metadata.layers === 'object') {
      // cleanup the fields property
      this.layers = metadata.layers;
    }
    // other engines that have built data store layer data differently  :
    const vectorLayers = Array.isArray(metadata.vector_layers)
      ? metadata.vector_layers
      : typeof metadata.json === 'string'
        ? (JSON.parse(metadata.json).vector_layers as VectorLayer[])
        : undefined;
    if (vectorLayers !== undefined) {
      this.layers = {};
      for (const layer of vectorLayers) {
        if (layer.id === undefined) continue;
        const { minzoom, maxzoom } = layer;
        this.layers[layer.id] = {
          minzoom: minzoom ?? 0,
          maxzoom: maxzoom ?? this.maxzoom,
          drawTypes: [],
          shape: {},
        };
      }
    }
    // time series data check
    if (metadata.scheme !== undefined) this.scheme = metadata.scheme;
    else if (metadata.format !== undefined && metadata.format !== 'pbf') {
      this.scheme = metadata.format as Scheme;
      this.isTimeFormat = metadata.format === 'tfzxy';
    }
    if (this.scheme === 'xyz') this.faces.add(0);
    if (this.isTimeFormat) {
      postMessage({
        mapID,
        type: 'timesource',
        sourceName: this.name,
        interval: metadata.interval,
      });
    }
    // once the metadata is complete, we should check if any tiles were queued
    this.resolve();
    // if attributions, we send them off
    const attributions = { ...this.attributions };
    if (Object.keys(attributions).length > 0)
      postMessage({ mapID, type: 'attributions', attributions });
  }

  /**
   * All tile requests undergo a basic check on whether that data exists
   * within the metadata boundaries. layerIndexes exists to set a boundary
   * of what layers the map is interested in (caused by style change add/edit layer)
   * @param mapID - the id of the map
   * @param tile - the tile
   * @param flushMessage - the flush message
   */
  async tileRequest(
    mapID: string,
    tile: TileRequest,
    flushMessage: SourceFlushMessage,
  ): Promise<void> {
    const { layersToBeLoaded } = flushMessage;
    // if the source isn't ready yet, we wait for the metadata to be built
    await this.ready;
    // inject layerIndexes
    this.#getLayerIndexes(tile, layersToBeLoaded);
    // now make requests for parent data as necessary
    this.#getParentData(mapID, tile, layersToBeLoaded);
    // pull out data, check if data exists in bounds, then request
    const { active, minzoom, maxzoom, faces, name } = this;
    const { face, zoom } = tile;
    if (
      // massive quality check to not over burden servers / lambdas with duds
      active && // we have the correct properties to make proper requests
      minzoom <= zoom &&
      maxzoom >= zoom && // check zoom bounds
      faces.has(face) // check the face exists
    ) {
      // request
      void this._tileRequest(mapID, tile, name);
    } else {
      // flush to let tile know what layers should be cleaned
      this._flush(mapID, tile, name);
    }
  }

  /**
   * Get the layer indexes that this tile is interested in
   * @param tile - the tile request
   * @param layersToLoad - the set of layers to load we are going to modify
   */
  #getLayerIndexes(tile: TileRequest, layersToLoad: Set<number>): void {
    const { layers, styleLayers } = this;
    const { zoom } = tile;
    const layerIndexes: number[] = [];
    if (layers === undefined) return;

    for (let l = 0, ll = styleLayers.length; l < ll; l++) {
      const layer = styleLayers[l];
      if (layer === undefined || layers[layer.layer] === undefined) continue;
      const { minzoom, maxzoom } = layers[layer.layer];
      if (minzoom <= zoom && maxzoom >= zoom) layerIndexes.push(layer.layerIndex);
    }

    tile.layerIndexes = layerIndexes;
    for (const index of layerIndexes) layersToLoad.add(index);
  }

  /**
   * Get the parent data that this tile is interested in
   * @param mapID - the id of the map that is requesting
   * @param tile - the tile request
   * @param layersToLoad - the set of layers to load
   */
  #getParentData(mapID: string, tile: TileRequest, layersToLoad: Set<number>): void {
    const { layers, styleLayers, name } = this;
    if (layers === undefined) return;
    // pull out data
    const { time, face, zoom, id } = tile;
    // setup parentLayers
    const parentLayers: ParentLayers = {};
    // iterate over layers and found any data doesn't exist at current zoom but the style asks for
    for (const { layer, layerIndex, maxzoom } of styleLayers) {
      const sourceLayer = layers[layer];
      const sourceLayerMaxZoom = sourceLayer?.maxzoom;
      if (maxzoom > zoom && sourceLayer !== undefined && sourceLayerMaxZoom < zoom) {
        // we have passed the limit at which this data is stored. Rather than
        // processing the data more than once, we reference where to look for the layer
        let pZoom = zoom;
        let newID = id;
        while (pZoom > sourceLayerMaxZoom) {
          pZoom--;
          newID = idParent(newID);
        }
        const newIDString = newID.toString();
        // pull out i & j
        const [, i, j] = idToIJ(newID, pZoom);
        // store parent reference
        if (parentLayers[newIDString] === undefined) {
          parentLayers[newIDString] = {
            time,
            face,
            id: newID,
            zoom: pZoom,
            i,
            j,
            layerIndexes: [],
          };
        }
        parentLayers[newIDString].layerIndexes.push(layerIndex);
        // filter out the index from the tile
        tile.layerIndexes?.filter((index) => index !== layerIndex);
      }
    }
    // if we stored any parent layers, make the necessary requests
    for (const parent of Object.values(parentLayers)) {
      for (const index of parent.layerIndexes) layersToLoad.add(index);
      void this._tileRequest(mapID, { ...tile, parent }, name);
    }
  }

  /**
   * If this function runs, we assume default quad-tree tile source.
   * In the default case, we want the worker to process the data
   * @param mapID - the id of the map to ship the eventual render data back to
   * @param tile - the tile request
   * @param sourceName - the source name the data to belongs to
   */
  async _tileRequest(mapID: string, tile: TileRequest, sourceName: string): Promise<void> {
    const { path, session, type, extension, size } = this;
    const { parent } = tile;
    const { time, face, zoom, i, j } = parent ?? tile;
    const location =
      `${time !== undefined ? String(time) + '/' : ''}` +
      (this.scheme === 'xyz'
        ? `${zoom}/${i}/${j}.${extension}`
        : `${face}/${zoom}/${i}/${j}.${extension}`);

    const data = await this._fetch<ArrayBuffer>(`${path}/${location}`, mapID);
    if (data !== undefined) {
      const worker = session.requestWorker();
      worker.postMessage({ mapID, type, tile, sourceName, data, size }, [data]);
    } else {
      this._flush(mapID, tile, sourceName);
    }
  }

  /**
   * If no data, we still have to let the tile worker know so it can prepare a proper flush
   * as well as manage cases like "invert" type data.
   * @param mapID - the id of the map
   * @param tile - the tile request
   * @param sourceName - the source name the data to belongs to
   */
  _flush(mapID: string, tile: TileRequest, sourceName: string): void {
    const { textEncoder, session } = this;
    // compress
    const data = textEncoder.encode('{"layers":{}}').buffer;
    // send off
    const worker = session.requestWorker();
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName, data }, [data]);
  }

  /**
   * Fetch a tile
   * @param path - the base path to the tile data
   * @param mapID - the id of the map
   * @param json - flag indicating if the data is json
   * @returns the raw data or JSON metadata if found
   */
  async _fetch<T>(path: string, mapID: string, json = false): Promise<T | undefined> {
    const headers: { Authorization?: string } = {};
    if (this.needsToken) {
      const Authorization = await this.session.requestSessionToken(mapID);
      if (Authorization === 'failed') return;
      if (Authorization !== undefined) headers.Authorization = Authorization;
    }
    const res = await fetch(path, { headers });
    if (res.status !== 200 && res.status !== 206) return;
    if (json || (res.headers.get('content-type') ?? '').includes('application/json'))
      return await res.json();
    return (await res.arrayBuffer()) as unknown as Promise<T>;
  }
}

/**
 * Basic parsing tool to ensure the source type is valid
 * @param type - the source type
 * @returns the parsed source type
 */
function parseMetaType(type: string = ''): SourceType {
  if (['vector', 'json', 'raster', 'raster-dem', 'sensor', 'overlay'].includes(type))
    return type as SourceType;
  return 'vector';
}

import { adjustURL } from '../util/index.js';
import {
  GlyphSource,
  ImageSource,
  JSONSource,
  LocalSource,
  MarkerSource,
  S2PMTilesSource,
  S2TilesSource,
  Session,
  Source,
  SpriteSource,
  TexturePack,
} from './source/index.js';

import type { ImageSourceMetadata } from './source/imageSource.js';
import type { MarkerDefinition } from './source/markerSource.js';
import type { UrlMap } from 'util/index.js';
import type {
  Analytics,
  GPUType,
  ImageExtensions,
  LayerDefinition,
  Projection,
  SourceMetadata,
  StylePackage,
  Source as StyleSource,
} from 'style/style.spec.js';
import type { GlyphMetadata, GlyphMetadataUnparsed } from './source/glyphSource.js';
import type {
  GlyphMetadataMessage,
  SourceFlushMessage,
  SourceWorkerMessages,
  TileRequest,
} from './worker.spec.js';

/** Store map of all source types */
type SourceMap = Record<
  string,
  Source | S2PMTilesSource | S2TilesSource | JSONSource | LocalSource | MarkerSource
>;

/** Each map has it's own store of these properties */
interface Map {
  projection: Projection;
  gpuType: GPUType;
  minzoom: number;
  maxzoom: number;
  analytics: Analytics;
  experimental: boolean;
  sources: SourceMap;
  layers: LayerDefinition[];
  glyphs: Record<string, GlyphSource>;
  sprites: Record<string, SpriteSource>;
  /** e.g. { apiURL: string, ... } */
  urls: Record<string, string>;
  texturePack: TexturePack;
  images: ImageSource;
}

/**
 * # SOURCE WORKER
 *
 * The source worker builds the appropriate module defined
 * by the style "sources" object. All tile requests are forwarded to the source
 * worker, where the worker properly builds the requests. Upon creation of a request,
 * the request string is passed to a tile worker to run the fetch and then consequently
 * process.
 *
 * GEOJSON / S2JSON is a unique case where the source worker just builds the json
 * locally to avoid processing the same json multiple times per tile worker.
 *
 * The glyph map is processed by the source worker. All data is localized to
 * the source worker. When a tile worker requests glyph data, the source will
 * scale up the map and send off the x-y position along with the width-height of
 * each glyph requested.
 *
 * SOURCE TYPES
 * S2Tile - a compact s2tiles file where we request tiles of many file types and compression types
 * GeoJSON - a json file containing geo-spatial data
 * S2JSON - a json file modeled much like geojson
 * Glyph - either a font or icon file stored in a pbf structure
 * LocalSource -> local build tile information
 * default -> assumed the location has a metadata. json at root with a "s2cellid.ext" file structure
 *
 * SESSION TOKEN
 * This is a pre-approved JWT token for any calls made to api.opens2.com or api.s2maps.io
 * when building requests, we take the current time, run a black box digest to hash, and return:
 * { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
 * (now - timestamp) / 1000 = seconds passed
 */
export default class SourceWorker {
  workers: Array<MessageChannel['port2']> = [];
  session: Session = new Session();
  /** { mapID: Map } */
  maps: Record<string, Map> = {};

  /**
   * Handle source worker's messages
   * @param msg - incoming message
   */
  onMessage(msg: MessageEvent<SourceWorkerMessages>): void {
    const { data, ports } = msg;
    const { type } = data;
    if (type === 'port') this.#loadWorkerPort(ports[0], ports[1], data.id);
    else {
      const { mapID } = data;
      if (type === 'requestStyle')
        this.#requestStyle(mapID, data.style, data.analytics, data.apiKey, data.urlMap);
      else if (type === 'style') this.#loadStyle(mapID, data.style);
      else if (type === 'tilerequest') void this.#requestTile(mapID, data.tiles, data.sources);
      else if (type === 'timerequest') void this.#requestTime(mapID, data.tiles, data.sourceNames);
      else if (type === 'glyphrequest')
        this.#glyphRequest(mapID, data.workerID, data.reqID, data.glyphList);
      else if (type === 'addMarkers') this.#addMarkers(mapID, data.markers, data.sourceName);
      else if (type === 'deleteMarkers') this.#deleteMarkers(mapID, data.ids, data.sourceName);
      else if (type === 'deleteSource') this.#deleteSource(mapID, data.sourceNames);
      else if (type === 'addLayer') this.#addLayer(mapID, data.layer, data.index, data.tileRequest);
      else if (type === 'deleteLayer') this.#deleteLayer(mapID, data.index);
      else if (type === 'reorderLayers') this.#reorderLayers(mapID, data.layerChanges);
    }
  }

  /**
   * Load worker. First message that comes in upon creation of this worker
   * @param messagePort - the communication port to talk listen to a tile worker's messages
   * @param postPort - the communication port to send messages to the tile worker
   * @param id - the id of the tile worker
   */
  #loadWorkerPort(
    messagePort: MessageChannel['port1'],
    postPort: MessageChannel['port2'],
    id: number,
  ): void {
    this.workers[id] = postPort;
    messagePort.onmessage = this.onMessage.bind(this);
    this.session.loadWorker(messagePort, postPort, id);
  }

  /**
   * Request map style given an href
   * @param mapID - the id of the map asking for the style
   * @param style - the href of the style
   * @param analytics - basic analytics to know what this browser can handle
   * @param apiKey - the api key
   * @param urlMap - the url map
   */
  #requestStyle(
    mapID: string,
    style: string,
    analytics: Analytics,
    apiKey?: string,
    urlMap?: UrlMap,
  ): void {
    // build maps session
    this.session.loadStyle(mapID, analytics, apiKey);
    // request style
    void this.session.requestStyle(mapID, style, urlMap);
  }

  /**
   * Load a style object for a map
   * @param mapID - the id of the map to load the style for
   * @param style - the style
   */
  #loadStyle(mapID: string, style: StylePackage): void {
    // pull style data
    const {
      projection,
      gpuType,
      minzoom,
      maxzoom,
      layers,
      analytics,
      experimental,
      apiKey,
      urlMap,
    } = style;
    const texturePack = new TexturePack();
    this.maps[mapID] = {
      projection,
      gpuType,
      minzoom,
      maxzoom,
      analytics,
      experimental,
      sources: {},
      layers,
      glyphs: {},
      sprites: {},
      urls: urlMap ?? {},
      texturePack,
      images: new ImageSource('__images', '', texturePack, this.session),
    };
    // create a session with the style
    this.session.loadStyle(mapID, analytics, apiKey);
    // now build sources
    void this.#buildSources(mapID, style);
  }

  /**
   * Add a style layer to a map
   * @param mapID - the id of the map to add the layer to
   * @param layer - the style layer
   * @param index - the index to add the layer at
   * @param _tileRequest - the list of tiles of all existing tiles in the map already to adjust
   */
  #addLayer(
    mapID: string,
    layer: LayerDefinition,
    index: number | undefined,
    _tileRequest: TileRequest[],
  ): void {
    // add the layer to the tile
    const { layers } = this.maps[mapID];
    if (index === undefined) layers.push(layer);
    else layers.splice(index, 0, layer);
    if (index === undefined) index = layers.length;
    for (let i = index + 1, ll = layers.length; i < ll; i++) {
      const layer = layers[i];
      layer.layerIndex++;
    }
    // tell the correct source to request the tiles and build the layer of interest
    // const source = this.sources[mapID][layer.source]
    // for (const tile of tiles) source.tileRequest(mapID, { ...tile }, [index])
  }

  /**
   * Delete a style layer
   * @param mapID - the id of the map to delete the layer from
   * @param index - the index to delete the layer from
   */
  #deleteLayer(mapID: string, index: number): void {
    const { layers } = this.maps[mapID];
    layers.splice(index, 1);
    for (let i = index, ll = layers.length; i < ll; i++) {
      const layer = layers[i];
      layer.layerIndex--;
    }
  }

  /**
   * Reorder style layers
   * @param mapID - the id of the map to reorder the layers
   * @param layerChanges - the layer changes to make
   */
  #reorderLayers(mapID: string, layerChanges: Record<string | number, number>): void {
    const { layers } = this.maps[mapID];
    const newLayers: LayerDefinition[] = [];
    // move the layer to its new position
    for (const [from, to] of Object.entries(layerChanges)) {
      const layer = layers[Number(from)];
      layer.layerIndex = to;
      newLayers[to] = layer;
    }
    // because other classes depend upon the current array, we just update array items
    for (let i = 0; i < layers.length; i++) layers[i] = newLayers[i];
  }

  /**
   * Build sources for a map given an style object
   * @param mapID - the id of the map
   * @param style - the style object to pull source from
   */
  async #buildSources(mapID: string, style: StylePackage): Promise<void> {
    const { urls, images: mapImages } = this.maps[mapID];
    const { sources, layers, fonts, icons, glyphs, sprites, images } = style;
    // sources
    for (const [name, source] of Object.entries(sources)) {
      this.#createSource(
        mapID,
        name,
        source,
        layers.filter((layer) => layer.source === name),
      );
    }
    // fonts & icons
    const glyphAwaits: Array<Promise<undefined | GlyphMetadataUnparsed>> = [];
    for (const [name, source] of Object.entries({ ...fonts, ...icons, ...glyphs })) {
      glyphAwaits.push(this.#createGlyphSource(mapID, name, source));
    }
    // sprites
    const imageAwaits: Array<Promise<undefined | ImageSourceMetadata>> = [];
    for (const [name, source] of Object.entries(sprites)) {
      if (typeof source === 'object') {
        const path = adjustURL(source.path, urls);
        imageAwaits.push(this.#createSpriteSheet(mapID, name, path, source.fileType));
      } else {
        imageAwaits.push(this.#createSpriteSheet(mapID, name, source));
      }
    }
    // images
    for (const [name, href] of Object.entries(images)) {
      const path = adjustURL(href, urls);
      imageAwaits.push(mapImages.addImage(mapID, name, path));
    }

    // ship the glyph metadata
    const glyphMetadata = await Promise.all(glyphAwaits);
    const filteredMetadata = glyphMetadata.filter(
      (m) => m?.metadata !== undefined,
    ) as GlyphMetadata[];
    const imageMetadata = await Promise.all(imageAwaits);
    const filteredImageMetadata = imageMetadata.filter(
      (m) => m !== undefined,
    ) as ImageSourceMetadata[];
    for (const worker of this.workers) {
      const message: GlyphMetadataMessage = {
        mapID,
        type: 'glyphmetadata',
        glyphMetadata: filteredMetadata,
        imageMetadata: filteredImageMetadata,
      };
      worker.postMessage(message);
    }
  }

  /**
   * Create a source
   * @param mapID - the id of the map
   * @param name - the name of the source
   * @param input - the path to the source
   * @param layers - the layers that use this source
   */
  #createSource(mapID: string, name: string, input: StyleSource, layers: LayerDefinition[]): void {
    const { maps, session } = this;
    const { urls, projection, sources } = maps[mapID];
    // prepare variables to build appropriate source type
    let metadata: SourceMetadata | undefined;
    let ext: string | undefined;
    if (typeof input === 'object') {
      metadata = input as SourceMetadata;
      ext = 'extension' in input ? input.extension : input.type;
      input = 'path' in input ? (input.path ?? '') : '';
    }
    if (ext === undefined) ext = (input.split('.').pop() ?? '').toLowerCase();
    const needsToken = session.hasAPIKey(mapID);
    const path = adjustURL(input, urls);
    // create the proper source type
    let source;
    if (ext === 's2pmtiles' || ext === 'pmtiles') {
      source = new S2PMTilesSource(name, projection, layers, path, needsToken, session);
    } else if (ext === 's2tiles') {
      source = new S2TilesSource(name, projection, layers, path, needsToken, session);
    } else if (ext === 'json' || ext === 's2json' || ext === 'geojson') {
      source = new JSONSource(name, projection, layers, path, needsToken, session);
    } else if (input === '_local') {
      source = new LocalSource(name, session, layers);
    } else if (input === '_markers') {
      source = new MarkerSource(name, session, projection, layers);
    } else source = new Source(name, projection, layers, path, needsToken, session); // default -> folder structure
    // store & build
    sources[name] = source;
    void source.build(mapID, metadata);
  }

  /**
   * Create a glyph source and build
   * @param mapID - the id of the map
   * @param name - the name of the source
   * @param input - the path to the source
   * @returns a list of glyph metadata that's yet to be parsed
   */
  async #createGlyphSource(
    mapID: string,
    name: string,
    input: string,
  ): Promise<undefined | GlyphMetadataUnparsed> {
    const { maps, session } = this;
    const { urls, texturePack, glyphs } = maps[mapID];
    // check if already exists
    if (glyphs[name] !== undefined) return;
    const source = new GlyphSource(name, adjustURL(input, urls), texturePack, session);
    glyphs[name] = source;
    return await source.build(mapID);
  }

  /**
   * Create a sprite sheet given an input source
   * @param mapID - the id of the map to build the source for
   * @param name - the name of the source sprite
   * @param input - the path to the source
   * @param fileType - the file type (extension)
   * @returns the image metadata if successful
   */
  async #createSpriteSheet(
    mapID: string,
    name: string,
    input: string,
    fileType?: ImageExtensions,
  ): Promise<undefined | ImageSourceMetadata> {
    const { maps, session } = this;
    const { urls, texturePack, sprites } = maps[mapID];
    // check if already exists
    if (sprites[name] !== undefined) return;
    const source = new SpriteSource(name, adjustURL(input, urls), texturePack, session, fileType);
    // store & build
    sprites[name] = source;
    return await source.build(mapID);
  }

  /**
   * Given a tile request, ship out requests for data from all sources
   * @param mapID - the id of the map
   * @param tiles - the tile requests
   * @param sources - the sources to modify if needed.
   */
  async #requestTile(
    mapID: string,
    tiles: TileRequest[],
    sources: Array<[sourceName: string, href: string | undefined]> = [],
  ): Promise<void> {
    const { sources: mapSources } = this.maps[mapID];
    const newHrefs = sources.filter((s) => s[1] !== undefined) as Array<
      [sourceName: string, href: string]
    >;
    const sourceNames = sources.map((s) => s[0]);
    // if new hrefs update sources
    for (const [sourceName, href] of newHrefs) {
      const source = mapSources[sourceName];
      if (source !== undefined) {
        // steal the layer data and rebuild
        this.#createSource(mapID, sourceName, href, source.styleLayers);
      }
    }
    // build requests
    for (const tile of tiles) {
      const flush: SourceFlushMessage = {
        type: 'flush',
        from: 'source',
        mapID,
        tileID: tile.id,
        layersToBeLoaded: new Set<number>(),
      };
      for (const source of Object.values(mapSources)) {
        if (sourceNames.length > 0 && !sourceNames.includes(source.name)) continue;
        if (source.isTimeFormat === true) continue;
        await source.tileRequest(mapID, { ...tile }, flush);
      }
      postMessage(flush);
    }
  }

  /**
   * Request temporal source data
   * @param mapID - the id of the map
   * @param tiles - the tile requests with time stamps
   * @param sourceNames - the sources to fetch data for
   */
  async #requestTime(
    mapID: string,
    tiles: TileRequest[],
    sourceNames: string[] = [],
  ): Promise<void> {
    const { sources: mapSources } = this.maps[mapID];
    // build requests
    for (const tile of tiles) {
      const flush: SourceFlushMessage = {
        type: 'flush',
        from: 'source',
        mapID,
        tileID: tile.id,
        layersToBeLoaded: new Set<number>(),
      };
      for (const source of Object.values(mapSources)) {
        if (source.isTimeFormat !== true || !sourceNames.includes(source.name)) continue;
        await source.tileRequest(mapID, { ...tile }, flush);
      }
      postMessage(flush);
    }
  }

  /**
   * Request glyph data
   * @param mapID - the id of the map that needs the glyphs
   * @param workerID - the Tile ID making the request
   * @param reqID - the request id, an encoded string tracking metadata about the request
   * @param sourceGlyphs - the glyphs to request, their sources, etc.
   */
  #glyphRequest(
    mapID: string,
    workerID: number,
    reqID: string,
    sourceGlyphs: Record<string, string[]>,
  ): void {
    // prep
    const { maps, workers } = this;
    const { glyphs } = maps[mapID];
    // iterate the glyph sources for the unicodes
    for (const [name, codes] of Object.entries(sourceGlyphs)) {
      void glyphs[name].glyphRequest(codes, mapID, reqID, workers[workerID]);
    }
  }

  /**
   * Add marker(s) to the map
   * @param mapID - the id of the map to add marker(s) to
   * @param markers - the marker(s) to add
   * @param sourceName - the name of the source to add the marker(s) to
   */
  #addMarkers(mapID: string, markers: MarkerDefinition[], sourceName: string): void {
    const markerSource = this.#getMarkerSource(mapID, sourceName);
    markerSource?.addMarkers(markers);
  }

  /**
   * Delete marker(s) from the map
   * @param mapID - the id of the map to delete marker(s) from
   * @param ids - the id(s) of the marker(s) to delete
   * @param sourceName - the name of the source to delete the marker(s) from
   */
  #deleteMarkers(mapID: string, ids: number[], sourceName: string): void {
    const markerSource = this.#getMarkerSource(mapID, sourceName);
    markerSource?.deleteMarkers(ids);
  }

  /**
   * Get the marker source
   * @param mapID - the id of the map
   * @param sourceName - the name of the source
   * @returns the marker source if found
   */
  #getMarkerSource(mapID: string, sourceName: string): MarkerSource | undefined {
    const { sources, layers, projection } = this.maps[mapID];
    if (sources === undefined) throw new Error(`Map ${mapID} does not exist`);
    if (sources[sourceName] === undefined)
      sources[sourceName] = new MarkerSource(sourceName, this.session, projection, layers);
    return sources[sourceName] as MarkerSource | undefined;
  }

  /**
   * Delete source(s) from the map
   * @param mapID - the id of the map to delete the source from
   * @param sourceNames - the name(s) of the source(s) to delete
   */
  #deleteSource(mapID: string, sourceNames: string[]): void {
    for (const sourceName of sourceNames) {
      // @ts-expect-error - we are deleting the source, this is ok
      this.sources[mapID][sourceName] = undefined;
    }
  }
}

// create the tileworker
const sourceWorker = new SourceWorker();
// bind the onmessage function
onmessage = sourceWorker.onMessage.bind(sourceWorker);

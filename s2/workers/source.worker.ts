import {
  ClusterSource,
  GlyphSource,
  ImageSource,
  JSONSource,
  LocalSource,
  MarkerSource,
  S2TilesSource,
  Session,
  Source,
  SpriteSource,
  TexturePack
} from './source'
import adjustURL from '../util/adjustURL'

import type {
  Analytics,
  ImageFormats,
  LayerDefinition,
  SourceMetadata,
  StylePackage,
  Source as StyleSource
} from 'style/style.spec'
import type { MarkerDefinition } from './source/markerSource'
import type { GlyphMetadataMessage, SourceFlushMessage, SourceWorkerMessages, TileRequest } from './worker.spec'
import type { GlyphMetadata, GlyphMetadataUnparsed } from './source/glyphSource'
import type { ImageMetadata } from './source/imageSource'

/**
  SOURCE WORKER

  The source worker builds the appropriate module defined
  by the style "sources" object. All tile requests are forwarded to the source
  worker, where the worker properly builds the requests. Upon creation of a request,
  the request string is passed to a tile worker to run the fetch and then consequently
  process.

  GEOJSON / S2JSON is a unique case where the source worker just builds the json
  locally to avoid processing the same json multiple times per tile worker.

  The glyph map is processed by the source worker. All data is localized to
  the source worker. When a tile worker requests glyph data, the source will
  scale up the map and send off the x-y position along with the width-height of
  each glyph requested.

  SOURCE TYPES
  * S2Tile - a compact s2tiles file where we request tiles of many file types and compression types
  * GeoJSON - a json file containing geo-spatial data
  * S2JSON - a json file modeled much like geojson
  * Glyph - either a font or icon file stored in a pbf structure
  * LocalSource -> local build tile information
  * default -> assumed the location has a metadata. json at root with a "s2cellid.ext" file structure

  SESSION TOKEN
  This is a pre-approved JWT token for any calls made to api.opens2.com or api.s2maps.io
  when building requests, we take the current time, run a black box digest to hash, and return:
  { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
  (now - timestamp) / 1000 = seconds passed
**/

type SourceMap = Record<string, Record<string, Source | S2TilesSource | JSONSource | ClusterSource | LocalSource | MarkerSource>>

export default class SourceWorker {
  workers: Array<MessageChannel['port2']> = []
  session: Session = new Session()
  layers: Record<string, LayerDefinition[]> = {}
  mapURLS: Record<string, Record<string, string>> = {} // { mapID: { apiURL: string, ... } }
  sources: SourceMap = {}
  glyphs: Record<string, GlyphSource> = {} // path is key again
  sprites: Record<string, SpriteSource> = {}
  texturePack: TexturePack = new TexturePack()
  images: ImageSource = new ImageSource('__images', '', this.texturePack, this.session)

  onMessage ({ data, ports }: MessageEvent<SourceWorkerMessages>): void {
    const { type } = data
    if (type === 'port') this.#loadWorkerPort(ports[0], ports[1], data.id)
    else {
      const { mapID } = data
      if (type === 'requestStyle') this.#requestStyle(mapID, data.style, data.analytics, data.apiKey, data.urlMap)
      else if (type === 'style') this.#loadStyle(mapID, data.style)
      else if (type === 'tilerequest') void this.#requestTile(mapID, data.tiles, data.sources)
      else if (type === 'timerequest') void this.#requestTime(mapID, data.tiles, data.sourceNames)
      else if (type === 'glyphrequest') this.#glyphRequest(mapID, data.workerID, data.reqID, data.glyphList)
      else if (type === 'addMarkers') this.#addMarkers(mapID, data.markers, data.sourceName)
      else if (type === 'removeMarkers') this.#removeMarkers(mapID, data.ids, data.sourceName)
      else if (type === 'deleteSource') this.#deleteSource(mapID, data.sourceNames)
      else if (type === 'addLayer') this.#addLayer(mapID, data.layer, data.index, data.tileRequest)
      else if (type === 'removeLayer') this.#removeLayer(mapID, data.index)
      else if (type === 'reorderLayers') this.#reorderLayers(mapID, data.layerChanges)
    }
  }

  #loadWorkerPort (
    messagePort: MessageChannel['port1'],
    postPort: MessageChannel['port2'],
    id: number
  ): void {
    this.workers[id] = postPort
    messagePort.onmessage = this.onMessage.bind(this)
    this.session.loadWorker(messagePort, postPort, id)
  }

  #requestStyle (
    mapID: string,
    style: string,
    analytics: Analytics,
    apiKey?: string,
    urlMap?: Record<string, string>
  ): void {
    // build maps session
    this.session.loadStyle(mapID, analytics, apiKey)
    // request style
    void this.session.requestStyle(mapID, style, urlMap)
  }

  #loadStyle (mapID: string, style: StylePackage): void {
    // pull style data
    const { layers, analytics, apiKey, urlMap } = style
    // store the apiURL
    this.mapURLS[mapID] = urlMap ?? {}
    // create the source map, if sources already exists, we are dumping the old sources
    this.sources[mapID] = {}
    // create the layer map
    this.layers[mapID] = layers
    // create a session with the style
    this.session.loadStyle(mapID, analytics, apiKey)
    // now build sources
    void this.#buildSources(mapID, style)
  }

  #addLayer (
    mapID: string,
    layer: LayerDefinition,
    index: number,
    tileRequest: TileRequest[]
  ): void {
    // add the layer to the tile
    const layers = this.layers[mapID]
    layers.splice(index, 0, layer)
    for (let i = index + 1, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex++
    }
    // tell the correct source to request the tiles and build the layer of interest
    // const source = this.sources[mapID][layer.source]
    // for (const tile of tiles) source.tileRequest(mapID, { ...tile }, [index])
  }

  #removeLayer (mapID: string, index: number): void {
    const layers = this.layers[mapID]
    layers.splice(index, 1)
    for (let i = index, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex--
    }
  }

  #reorderLayers (mapID: string, layerChanges: Record<string | number, number>): void {
    const layers = this.layers[mapID]
    const newLayers: LayerDefinition[] = []
    // move the layer to its new position
    for (const [from, to] of Object.entries(layerChanges)) {
      const layer = layers[+from]
      layer.layerIndex = to
      newLayers[to] = layer
    }
    // because other classes depend upon the current array, we just update array items
    for (let i = 0; i < layers.length; i++) layers[i] = newLayers[i]
  }

  async #buildSources (
    mapID: string,
    style: StylePackage
  ): Promise<void> {
    const urlMap = this.mapURLS[mapID]
    const { sources, layers, fonts, icons, glyphs, sprites, images } = style
    // sources
    for (const [name, source] of Object.entries(sources)) {
      this.#createSource(mapID, name, source, layers.filter(layer => layer.source === name))
    }
    // fonts & icons
    const glyphAwaits: Array<Promise<undefined | GlyphMetadataUnparsed>> = []
    for (const [name, source] of Object.entries({ ...fonts, ...icons, ...glyphs })) {
      glyphAwaits.push(this.#createGlyphSource(mapID, name, source))
    }
    // sprites
    const imageAwaits: Array<Promise<undefined | ImageMetadata>> = []
    for (const [name, source] of Object.entries(sprites)) {
      if (typeof source === 'object') {
        const path = adjustURL(source.path, urlMap)
        imageAwaits.push(this.#createSpriteSheet(mapID, name, path, source.fileType))
      } else { imageAwaits.push(this.#createSpriteSheet(mapID, name, source)) }
    }
    // images
    for (const [name, href] of Object.entries(images)) {
      const path = adjustURL(href, urlMap)
      imageAwaits.push(this.images.addImage(mapID, name, path))
    }

    // ship the glyph metadata
    const glyphMetadata = await Promise.all(glyphAwaits)
    const filteredMetadata = glyphMetadata.filter(m => m?.metadata !== undefined) as GlyphMetadata[]
    const imageMetadata = await Promise.all(imageAwaits)
    const filteredImageMetadata = imageMetadata.filter(m => m !== undefined) as ImageMetadata[]
    for (const worker of this.workers) {
      const message: GlyphMetadataMessage = {
        mapID,
        type: 'glyphmetadata',
        glyphMetadata: filteredMetadata,
        imageMetadata: filteredImageMetadata
      }
      worker.postMessage(message)
    }
  }

  #createSource (
    mapID: string,
    name: string,
    input: StyleSource,
    layers: LayerDefinition[]
  ): void {
    const { session } = this
    // prepare variables to build appropriate source type
    let metadata: SourceMetadata | undefined
    let fileType: string | undefined
    if (typeof input === 'object') {
      metadata = input
      fileType = input.fileType ?? input.type
      input = input.path ?? ''
    }
    if (fileType === undefined) fileType = (input.split('.').pop() ?? '').toLowerCase()
    const needsToken = session.hasAPIKey(mapID)
    const urlMap = this.mapURLS[mapID]
    const path = adjustURL(input, urlMap)
    // create the proper source type
    let source
    if (fileType === 's2tiles') {
      source = new S2TilesSource(name, layers, path, needsToken, session)
    } else if (fileType === 'json' || fileType === 's2json' || fileType === 'geojson') {
      if (metadata?.cluster ?? false) source = new ClusterSource(name, layers, path, needsToken, session)
      else source = new JSONSource(name, layers, path, needsToken, session)
    } else if (input === '_local') {
      source = new LocalSource(name, session, layers)
    } else if (input === '_markers') {
      source = new MarkerSource(name, session, layers)
    } else source = new Source(name, layers, path, needsToken, session) // default -> folder structure
    // store & build
    this.sources[mapID][name] = source
    void source.build(mapID, metadata)
  }

  async #createGlyphSource (mapID: string, name: string, input: string): Promise<undefined | GlyphMetadataUnparsed> {
    const { texturePack, session } = this
    const urlMap = this.mapURLS[mapID]
    // check if already exists
    if (this.glyphs[name] !== undefined) return
    const source = new GlyphSource(name, adjustURL(input, urlMap), texturePack, session)
    this.glyphs[name] = source
    return await source.build(mapID)
  }

  async #createSpriteSheet (
    mapID: string,
    name: string,
    input: string,
    fileType?: ImageFormats
  ): Promise<undefined | ImageMetadata> {
    const { texturePack, session } = this
    const urlMap = this.mapURLS[mapID]
    // check if already exists
    if (this.sprites[name] !== undefined) return
    const source = new SpriteSource(name, adjustURL(input, urlMap), texturePack, session, fileType)
    // store & build
    this.sprites[name] = source
    return await source.build(mapID)
  }

  async #requestTile (
    mapID: string,
    tiles: TileRequest[],
    sources: Array<[string, string | undefined]> = []
  ): Promise<void> {
    const newHrefs = sources.filter(s => s[1] !== undefined) as Array<[string, string]>
    const sourceNames = sources.map(s => s[0])
    // if new hrefs update sources
    for (const [sourceName, href] of newHrefs) {
      const source = (this.sources[mapID] !== undefined) ? this.sources[mapID][sourceName] : undefined
      if (source !== undefined) {
        // steal the layer data and rebuild
        this.#createSource(mapID, sourceName, href, source.styleLayers)
      }
    }
    // build requests
    for (const tile of tiles) {
      const flush: SourceFlushMessage = { type: 'flush', from: 'source', mapID, tileID: tile.id, layersToBeLoaded: new Set<number>() }
      for (const source of Object.values(this.sources[mapID])) {
        if (sourceNames.length > 0 && !sourceNames.includes(source.name)) continue
        if (source.isTimeFormat) continue
        await source.tileRequest(mapID, { ...tile }, flush)
      }
      postMessage(flush)
    }
  }

  async #requestTime (mapID: string, tiles: TileRequest[], sourceNames: string[]): Promise<void> {
    // build requests
    for (const tile of tiles) {
      const flush: SourceFlushMessage = { type: 'flush', from: 'source', mapID, tileID: tile.id, layersToBeLoaded: new Set<number>() }
      for (const source of Object.values(this.sources[mapID])) {
        if (!source.isTimeFormat || !sourceNames.includes(source.name)) continue
        await source.tileRequest(mapID, { ...tile }, flush)
      }
      postMessage(flush)
    }
  }

  #glyphRequest (
    mapID: string,
    workerID: number,
    reqID: string,
    sourceGlyphs: Record<string, string[]>
  ): void {
    // prep
    const { workers } = this
    // iterate the glyph sources for the unicodes
    for (const [name, codes] of Object.entries(sourceGlyphs)) {
      void this.glyphs[name].glyphRequest(codes, mapID, reqID, workers[workerID])
    }
  }

  #addMarkers (mapID: string, markers: MarkerDefinition[], sourceName: string): void {
    const markerSource = this.#getMarkerSource(mapID, sourceName)
    markerSource.addMarkers(markers)
  }

  #removeMarkers (mapID: string, ids: number[], sourceName: string): void {
    const markerSource = this.#getMarkerSource(mapID, sourceName)
    markerSource.removeMarkers(ids)
  }

  #getMarkerSource (mapID: string, sourceName: string): MarkerSource {
    const sources = this.sources[mapID]
    const layers = this.layers[mapID]
    if (sources === undefined) throw new Error(`Map ${mapID} does not exist`)
    if (sources[sourceName] === undefined) sources[sourceName] = new MarkerSource(sourceName, this.session, layers)
    return sources[sourceName] as MarkerSource
  }

  #deleteSource (mapID: string, sourceNames: string[]): void {
    for (const sourceName of sourceNames) {
      // @ts-expect-error - we are deleting the source
      this.sources[mapID][sourceName] = undefined
    }
  }
}

// create the tileworker
const sourceWorker = new SourceWorker()
// bind the onmessage function
onmessage = sourceWorker.onMessage.bind(sourceWorker)

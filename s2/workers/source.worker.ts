/* eslint-env worker */
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
import s2mapsURL from '../util/s2mapsURL'

import type {
  Analytics,
  Fonts,
  Glyphs,
  Icons,
  LayerDefinition,
  SourceMetadata,
  Sources,
  SpriteFileType,
  Sprites,
  StylePackage,
  Source as StyleSource
} from 'style/style.spec'
import type { MarkerDefinition } from './source/markerSource'
import type { SourceWorkerMessages, TileRequest } from './worker.spec'

/**
  SOURCE WORKER

  The source worker builds the appropriate module defined
  by the style "sources" object. All tile requests are forwarded to the source
  worker, where the worker properly builds the requests. Upon creation of a request,
  the request string is passed to a tile worker to run the fetch and then consequently
  process.

  S2JSON is a unique case where the source worker just builds the json
  locally to avoid processing the same json multiple times per tile worker.

  The glyph map is processed by the source worker. All data is localized to
  the source worker. When a tile worker requests glyph data, the source will
  scale up the map and send off the x-y position along with the width-height of
  each glyph requested.

  SOURCE TYPES
  * S2Tile - a compact s2tiles file where we request tiles of many file types and compression types
  * S2JSON - a json file modeled much like geojson
  * Glyph - either a font or icon file stored in a pbf structure
  * Tile -> local build tile
  * default -> assumed the location has a metadata. json at root with a "s2cellid.ext" file structure

  SESSION TOKEN
  This is a pre-approved JWT token for any calls made to api.s2maps.io
  when building requests, we take the current time, run a black box digest to hash, and return:
  { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
  (now - timestamp) / 1000 = seconds passed
**/

type SourceMap = Record<string, Record<string, Source | S2TilesSource | JSONSource | ClusterSource | LocalSource | MarkerSource>>

export default class SourceWorker {
  workers: Array<MessageChannel['port2']> = []
  session: Session = new Session()
  layers: Record<string, LayerDefinition[]> = {}
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
      if (type === 'requestStyle') this.#requestStyle(mapID, data.style, data.analytics, data.apiKey)
      else if (type === 'style') this.#loadStyle(mapID, data.style)
      else if (type === 'tilerequest') void this.#requestTile(mapID, data.tiles, data.sources)
      else if (type === 'timerequest') void this.#requestTime(mapID, data.tiles, data.sourceNames)
      else if (type === 'glyphrequest') this.#glyphRequest(mapID, data.workerID, data.reqID, data.glyphList, data.iconList)
      else if (type === 'getInfo') this.#getInfo(mapID, data.featureID)
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

  #requestStyle (mapID: string, style: string, analytics: Analytics, apiKey?: string): void {
    // build maps session
    this.session.loadStyle(mapID, analytics, apiKey)
    // request style
    void this.session.requestStyle(mapID, style)
  }

  #loadStyle (mapID: string, style: StylePackage): void {
    // create the source map, if sources already exists, we are dumping the old sources
    this.sources[mapID] = {}
    // pull style data
    const { sources, layers, fonts, icons, glyphs, sprites, images, analytics, apiKey } = style
    this.layers[mapID] = layers
    // create a session with the style
    this.session.loadStyle(mapID, analytics, apiKey)
    // now build sources
    void this.#buildSources(mapID, sources, layers, fonts, icons, glyphs, sprites, images)
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
    const newLayers = []
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
    sources: Sources = {},
    layers: LayerDefinition[],
    fonts: Fonts = {},
    icons: Icons = {},
    glyphs: Glyphs = {},
    sprites: Sprites = {},
    images: Record<string, string> = {}
  ): Promise<void> {
    // sources
    for (const [name, source] of Object.entries(sources)) {
      this.#createSource(mapID, name, source, layers.filter(layer => layer.source === name))
    }
    // fonts & icons
    for (const [name, source] of Object.entries({ ...fonts, ...icons, ...glyphs })) {
      if (typeof source === 'object') {
        this.#createGlyphSource(mapID, name, source.path, source.fallback)
      } else { this.#createGlyphSource(mapID, name, source) }
    }
    // sprites
    for (const [name, source] of Object.entries(sprites)) {
      if (typeof source === 'object') {
        this.#createSpriteSheet(mapID, name, source.path, source.fallback, source.fileType)
      } else { this.#createSpriteSheet(mapID, name, source) }
    }
    // images
    for (const [name, href] of Object.entries(images)) {
      void this.images.addImage(mapID, name, href)
    }

    // add in glyph and sprite fallbacks
    for (const input of [this.glyphs, this.sprites]) {
      for (const [, inputSource] of Object.entries(input)) {
        const { fallbackName } = inputSource
        if (fallbackName !== undefined) inputSource.fallback = input[fallbackName]
      }
    }
  }

  #createSource (mapID: string, name: string, input: StyleSource, layers: LayerDefinition[]): void {
    const { session } = this
    // prepare variables to build appropriate source type
    let metadata: SourceMetadata | undefined
    if (typeof input === 'object') {
      metadata = input
      input = input.path
    }
    const fileType = (input.split('.').pop() ?? '').toLowerCase()
    const needsToken = session.hasAPIKey(mapID)
    const path = s2mapsURL(input)
    // create the proper source type
    let source
    if (fileType === 's2tiles') {
      source = new S2TilesSource(name, layers, path, needsToken, session)
    } else if (fileType === 'json' || fileType === 's2json' || fileType === 'geojson') {
      if (metadata?.cluster ?? false) source = new ClusterSource(name, layers, path, needsToken, session)
      else source = new JSONSource(name, layers, path, needsToken, session)
    } else if (input === 'tile') {
      source = new LocalSource()
    } else source = new Source(name, layers, path, needsToken, session) // default -> folder structure
    // store & build
    this.sources[mapID][name] = source
    void source.build(mapID, metadata)
  }

  #createGlyphSource (mapID: string, name: string, input: string, fallback?: string): void {
    const { texturePack, session } = this
    // check if already exists
    if (this.glyphs[name] !== undefined) return
    const source = new GlyphSource(name, s2mapsURL(input), texturePack, session, fallback)
    this.glyphs[name] = source
    void source.build(mapID)
  }

  #createSpriteSheet (
    mapID: string,
    name: string,
    input: string,
    fallback?: string,
    fileType?: SpriteFileType
  ): void {
    const { texturePack, session } = this
    // check if already exists
    if (this.sprites[name] !== undefined) return
    const source = new SpriteSource(name, s2mapsURL(input), texturePack, session, fallback, fileType)
    // store & build
    this.sprites[name] = source
    void source.build(mapID)
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
        this.#createSource(mapID, sourceName, href, source.styleLayers ?? [])
      }
    }
    // build requests
    for (const tile of tiles) {
      for (const source of Object.values(this.sources[mapID])) {
        if (sourceNames.length > 0 && !sourceNames.includes(source.name)) continue
        if (source.isTimeFormat) continue
        source.tileRequest(mapID, { ...tile })
      }
    }
  }

  async #requestTime (mapID: string, tiles: TileRequest[], sourceNames: string[]): Promise<void> {
    // build requests
    for (const tile of tiles) {
      for (const source of Object.values(this.sources[mapID])) {
        if (!source.isTimeFormat || !sourceNames.includes(source.name)) continue
        source.tileRequest(mapID, { ...tile })
      }
    }
  }

  #glyphRequest (
    mapID: string,
    workerID: number,
    reqID: string,
    sourceGlyphs: Record<string, ArrayBuffer>,
    iconList: Record<string, Set<string>>
  ): void {
    // prep
    const { workers } = this
    // iterate the glyph sources for the unicodes
    for (const [name, unicodes] of Object.entries(sourceGlyphs)) {
      void this.glyphs[name].glyphRequest([...new Uint16Array(unicodes)], mapID, reqID, workers[workerID])
    }
    // iterate all icon requests
    for (const [name, icons] of Object.entries(iconList)) {
      if (name === '__images') void this.images.iconRequest(icons, mapID, reqID, workers[workerID])
      else void (this.sprites[name] ?? this.glyphs[name])?.iconRequest(icons, mapID, reqID, workers[workerID])
    }
  }

  #getInfo (mapID: string, featureID: number): void {
    // 1) build the S2JSON should it exist
    this.#createSource(mapID, '_info', `s2maps://info/${featureID}.s2json`, [])
    // 2) request the JSON
    void this.session.getInfo(mapID, featureID)
  }

  #addMarkers (mapID: string, markers: MarkerDefinition[], sourceName: string): void {
    if (this.sources[mapID] === undefined) return
    if (this.sources[mapID][sourceName] === undefined) {
      this.sources[mapID][sourceName] = new MarkerSource(sourceName, this.session)
    }
    (this.sources[mapID][sourceName] as MarkerSource).addMarkers(markers)
  }

  #removeMarkers (mapID: string, ids: number[], sourceName: string): void {
    if (this.sources[mapID] === undefined) return
    let markerSource = this.sources[mapID][sourceName] as MarkerSource
    if (markerSource === undefined) {
      markerSource = this.sources[mapID][sourceName] = new MarkerSource(sourceName, this.session)
    }
    markerSource.removeMarkers(ids)
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

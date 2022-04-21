// @flow
/* eslint-env worker */
import { GlyphSource, LocalSource, MarkerSource, S2TilesSource, S2JSONSource, Source, TexturePack, Session } from './source'
import s2mapsURL from '../util/s2mapsURL'

import type { Analytics } from '../style'
import type { StylePackage, Layer } from '../style/styleSpec'
import type { Marker } from './source/markerSource'
import type { GlyphRequest } from './source/glyphSource'
import type { TileRequest } from './workerPool'

type Sources = { [string]: Source }

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
  * glyph - either a font or icon file stored in a pbf structure
  * tile -> local build tile
  * default -> assumed the location has a metadata. json at root with a "s2cellid.ext" file structure

  SESSION TOKEN
  This is a pre-approved JWT token for any calls made to api.s2maps.io
  when building requests, we take the current time, run a black box digest to hash, and return:
  { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
  (now - timestamp) / 1000 = seconds passed
**/

export default class SourceWorker {
  workers: Array<MessageChannel.port2> = []
  session: Session = new Session()
  layers: { [string]: Array<Layer> } = {}
  sources: { [string]: Sources } = {} // [mapID]: { [sourceName]: Source }
  glyphs: { [string]: GlyphSource } = {} // path is key again
  texturePack: TexturePack = new TexturePack()

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'port') this._loadWorkerPort(data.messagePort, data.postPort, data.id)
    else if (type === 'requestStyle') this._requestStyle(mapID, data.style, data.apiKey, data.analytics)
    else if (type === 'style') this._loadStyle(mapID, data.style)
    else if (type === 'tilerequest') this._request(mapID, data.tiles, data.sources)
    else if (type === 'timerequest') this._requestTime(mapID, data.tiles, data.sourceNames)
    else if (type === 'glyphrequest') this._glyphRequest(mapID, data.id, data.reqID, data.glyphList, data.iconList)
    else if (type === 'getInfo') this._getInfo(mapID, data.featureID)
    else if (type === 'addMarkers') this._addMarkers(mapID, data.markers, data.sourceName)
    else if (type === 'removeMarkers') this._removeMarkers(mapID, data.ids, data.sourceName)
    else if (type === 'deleteSource') this._deleteSource(mapID, data.sourceNames)
    else if (type === 'addLayer') this._addLayer(mapID, data.layer, data.index)
    else if (type === 'removeLayer') this._removeLayer(mapID, data.index)
    else if (type === 'reorderLayers') this._reorderLayers(mapID, data.layerChanges)
  }

  _loadWorkerPort (messagePort: MessageChannel.port1, postPort: MessageChannel.port2, id: number) {
    this.workers[id] = postPort
    messagePort.onmessage = this.onMessage.bind(this)
    this.session.loadWorker(messagePort, postPort, id)
  }

  _requestStyle (mapID: string, style: string, apiKey: string, analytics: Analytics) {
    // build maps session
    this.session.loadStyle(analytics, mapID, apiKey)
    // request style
    this.session.requestStyle(mapID, style)
  }

  _loadStyle (mapID: string, style: StylePackage = {}) {
    // create the source map, if sources already exists, we are dumping the old sources
    this.sources[mapID] = {}
    // pull style data
    const { sources, layers, fonts, icons, glyphs, analytics, apiKey } = style
    this.layers[mapID] = layers
    // create a session with the style
    this.session.loadStyle(analytics, mapID, apiKey)
    // now build sources
    this._buildSources(mapID, sources, layers, fonts, icons, glyphs)
  }

  _addLayer (mapID: string, layer: Layer, index: number) {
    // add the layer to the tile
    const layers = this.layers[mapID]
    layers.splice(index, 0, layer)
    for (let i = index + 1, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex++
      layer.depthPos++
    }
    // tell the correct source to request the tiles and build the layer of interest
    // const source = this.sources[mapID][layer.source]
    // for (const tile of tiles) source.tileRequest(mapID, tile, [index])
  }

  _removeLayer (mapID: string, index: number) {
    const layers = this.layers[mapID]
    layers.splice(index, 1)
    for (let i = index, ll = layers.length; i < ll; i++) {
      const layer = layers[i]
      layer.layerIndex--
      layer.depthPos--
    }
  }

  _reorderLayers (mapID: string, layerChanges: { [string | number]: number }) {
    const layers = this.layers[mapID]
    const newLayers = []
    // move the layer to its new position
    for (const [from, to] of Object.entries(layerChanges)) {
      const layer = layers[+from]
      layer.layerIndex = to
      layer.depthPos = to + 1
      newLayers[to] = layer
    }
    // because other classes depend upon the current array, we just update array items
    for (let i = 0; i < layers.length; i++) layers[i] = newLayers[i]
  }

  async _buildSources (mapID: string, sources = {}, layers: Array<Layer>, fonts = {}, icons = {}, glyphs = {}) {
    // sources
    for (const [name, source] of Object.entries(sources)) {
      this._createSource(mapID, name, source, layers.filter(layer => layer.source === name))
    }
    // fonts & icons
    for (const [name, source] of Object.entries({ ...fonts, ...icons, ...glyphs })) {
      if (typeof source === 'object') {
        this._createGlyphSource(mapID, name, source.path, source.fallback)
      } else { this._createGlyphSource(mapID, name, source) }
    }

    // add in glyph fallbacks
    for (const [, glyphSource] of Object.entries(this.glyphs)) {
      const { fallback } = glyphSource
      if (fallback) glyphSource.fallback = this.glyphs[fallback]
    }
  }

  _createSource (mapID: string, name: string, input: string, layers: Array<Layer>) {
    const { session } = this
    // prepare variables to build appropriate source type
    let metadata
    if (typeof input === 'object') {
      metadata = input
      input = input.path
    }
    const fileType = input.split('.').pop().toLowerCase()
    const apiSource = input.includes('s2maps://')
    const path = (apiSource) ? s2mapsURL(input) : input
    // create the proper source type
    let source
    if (fileType === 's2tiles') source = new S2TilesSource(name, layers, path, apiSource, session)
    else if (fileType === 's2json') source = new S2JSONSource(name, layers, path, apiSource, session)
    else if (input === 'tile') source = new LocalSource(name, layers)
    else source = new Source(name, layers, path, apiSource, session) // default -> folder structure
    // store
    this.sources[mapID][name] = source
    // build
    source.build(mapID, metadata)
  }

  _createGlyphSource (mapID: string, name: string, input: string, fallback?: string) {
    const { texturePack, session } = this
    // prepare
    const apiSource = input.includes('s2maps://')
    const path = (apiSource) ? s2mapsURL(input) : input
    // check if already exists
    if (this.glyphs[name]) return
    const source = new GlyphSource(name, path, fallback, texturePack, apiSource, session)
    this.glyphs[name] = source
    source.build(mapID)
  }

  async _request (mapID: string, tiles: Array<TileRequest>, sources?: Array<[string, string]> = []) {
    const newHrefs = sources.filter(s => s[1])
    const sourceNames = sources.map(s => s[0])
    // if new hrefs update sources
    for (const [sourceName, href] of newHrefs) {
      const source = this.sources[mapID] && this.sources[mapID][sourceName]
      if (source) {
        // steal the layer data and rebuild
        const { styleLayers } = source
        this._createSource(mapID, sourceName, href, styleLayers)
      }
    }
    // build requests
    for (const tile of tiles) {
      for (const source of Object.values(this.sources[mapID])) {
        if (sourceNames.length && !sourceNames.includes(source.name)) continue
        if (source.isTimeFormat) continue
        source.tileRequest(mapID, tile)
      }
    }
  }

  async _requestTime (mapID: string, tiles: Array<TileRequest>, sourceNames: Array<string>) {
    // build requests
    for (const tile of tiles) {
      for (const source of Object.values(this.sources[mapID])) {
        if (!source.isTimeFormat || !sourceNames.includes(source.name)) continue
        source.tileRequest(mapID, tile)
      }
    }
  }

  _glyphRequest (mapID: string, workerID: number, reqID: string,
    sourceGlyphs: { [string]: GlyphRequest }, iconList: { [string]: Array<string> }) {
    // prep
    const { workers } = this
    // iterate the glyph sources for the unicodes
    for (const [name, unicodes] of Object.entries(sourceGlyphs)) {
      this.glyphs[name].glyphRequest(new Uint16Array(unicodes), mapID, reqID, workers[workerID])
    }
    // iterate all icon requests
    for (const [name, icons] of Object.entries(iconList)) {
      this.glyphs[name].iconRequest(icons, mapID, reqID, workers[workerID])
    }
  }

  _getInfo (mapID: string, featureID: number) {
    // 1) build the S2JSON should it exist
    this._createSource(mapID, '_info', `s2maps://info/${featureID}.s2json`)
    // 2) request the JSON
    this.session.getInfo(mapID, featureID)
  }

  _addMarkers (mapID: string, markers: Array<Marker>, sourceName: string) {
    if (!this.sources[mapID][sourceName]) this.sources[mapID][sourceName] = new MarkerSource(sourceName, this.session)
    this.sources[mapID][sourceName].addMarkers(markers)
  }

  _removeMarkers (mapID: string, ids: Array<number>, sourceName: string) {
    if (!this.sources[mapID][sourceName]) this.sources[mapID][sourceName] = new MarkerSource(sourceName, this.session)
    this.sources[mapID][sourceName].removeMarkers(ids)
  }

  _deleteSource (mapID: string, sourceNames: Array<number>) {
    for (const sourceName of sourceNames) delete this.sources[mapID][sourceName]
  }
}

// create the tileworker
const sourceWorker = new SourceWorker()
// bind the onmessage function
onmessage = sourceWorker.onMessage.bind(sourceWorker)

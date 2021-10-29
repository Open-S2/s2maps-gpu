// @flow
/* eslint-env worker */
import { GlyphSource, LocalSource, MarkerSource, S2JSONSource, S2TilesSource, Source, TexturePack, Session } from './source'

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
  * glyph - either a font or icon file stored in a pbf structure (long term the data will be split up as needed)
  * tile -> local build tile
  * default -> assumed the location has a metadata.json at root with a "face/zoom/x/y.ext" folder structure

  SESSION TOKEN
  This is a pre-approved JWT token for any calls made to data.s2maps.io
  when building requests, we take the current time, run a black box digest to hash, and return:
  { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
  (now - timestamp) / 1000 = seconds passed
**/

export default class SourceWorker {
  workers: Array<MessageChannel.port2> = []
  session: Session = new Session()
  sources: { [string]: Sources } = {} // [mapID]: { [sourceName]: Source }
  glyphs: { [string]: GlyphSource } = {} // path is key again
  texturePack: TexturePack = new TexturePack()

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'port') this._loadWorkerPort(data.messagePort, data.postPort, data.id)
    else if (type === 'style') this._loadStyle(mapID, data.style)
    else if (type === 'tilerequest') this._request(mapID, data.tiles, data.sourceNames)
    else if (type === 'glyphrequest') this._glyphRequest(mapID, data.id, data.reqID, data.glyphList, data.iconList)
    else if (type === 'getInfo') this._getInfo(mapID, data.featureID)
    else if (type === 'addMarkers') this._addMarkers(mapID, data.markers, data.sourceName)
    else if (type === 'removeMarkers') this._removeMarkers(mapID, data.ids, data.sourceName)
    else if (type === 'deleteSource') this._deleteSource(mapID, data.sourceNames)
  }

  _loadWorkerPort (messagePort: MessageChannel.port1, postPort: MessageChannel.port2, id: number) {
    this.workers[id] = postPort
    messagePort.onmessage = this.onMessage.bind(this)
    this.session.loadWorker(messagePort, postPort, id)
  }

  _loadStyle (mapID: string, style: StylePackage = {}) {
    // create the source map, if sources already exists, we are dumping the old sources
    this.sources[mapID] = {}
    // pull style data
    const { sources, layers, fonts, icons, analytics, apiKey } = style
    // create a session with the style
    this.session.loadStyle(analytics, mapID, apiKey)
    // now build sources
    this._buildSources(mapID, sources, layers, fonts, icons)
  }

  async _buildSources (mapID: string, sources = {}, layers: Array<Layer>, fonts = {}, icons = {}) {
    // sources
    for (const [name, source] of Object.entries(sources)) {
      this._createSource(mapID, name, source, layers.filter(layer => layer.source === name))
    }
    // fonts & icons
    for (const [name, source] of Object.entries({ ...fonts, ...icons })) {
      if (typeof source === 'object') {
        this._createGlyphSource(mapID, name, source.path, source.fallback)
      } else { this._createGlyphSource(mapID, name, source) }
    }

    // add in glyph fallbacks
    const { glyphs } = this
    for (const [, glyphSource] of Object.entries(glyphs)) {
      const { fallback } = glyphSource
      if (fallback) glyphSource.fallback = glyphs[fallback]
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
    const apiSource = input.includes('s2maps://data')
    // const path = (apiSource) ? input.replace('s2maps://', `${process.env.NEXT_PUBLIC_API_URL}/`) : input
    const path = (apiSource) ? input.replace('s2maps://', 'https://data.s2maps.io/') : input
    // create the proper source type
    let source
    if (fileType === 's2tiles') source = new S2TilesSource(name, layers, path, apiSource, session)
    else if (fileType === 's2json') source = new S2JSONSource(name, layers, path, apiSource, session)
    else if (input === 'tile') source = new LocalSource(name, layers)
    else source = new Source(name, layers, path, apiSource, session) // default -> folder structure
    // store
    this.sources[mapID][name] = source
    // build
    source.build(mapID).finally(() => {
      // incase the input was originally an object, insert the metadata
      if (metadata) source._buildMetadata(metadata)
    })
  }

  _createGlyphSource (mapID: string, name: string, input: string, fallback?: string) {
    const { texturePack } = this
    // prepare
    const apiSource = input.includes('s2maps://data')
    // const path = (apiSource) ? input.replace('s2maps://', `${process.env.NEXT_PUBLIC_API_URL}/`) : input
    const path = (apiSource) ? input.replace('s2maps://', 'https://data.s2maps.io/') : input
    // check if already exists
    if (this.glyphs[name]) return
    const source = new GlyphSource(name, path, fallback, texturePack, apiSource)
    this.glyphs[name] = source
    source.build()
  }

  async _request (mapID: string, tiles: Array<TileRequest>, sourceNames?: Array<string>) {
    // build requests
    for (const tile of tiles) {
      for (const source of Object.values(this.sources[mapID])) {
        if (sourceNames && !sourceNames.includes(source.name)) continue
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
    this._createSource(mapID, '_info', `s2maps://data/info/${featureID}.s2json`)
    // 2) request the JSON
    this.session.getInfo(mapID, featureID)
  }

  _addMarkers (mapID: string, markers: Array<Marker>, sourceName: string) {
    if (!this.sources[mapID][sourceName]) this.sources[mapID][sourceName] = new MarkerSource(sourceName, this.session)
    this.sources[mapID][sourceName].addMarkers(markers)
  }

  _removeMarkers (mapID: string, ids: Array<number>, sourceName: string) {
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

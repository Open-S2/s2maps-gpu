// @flow
import { GlyphSource, LocalSource, S2JSONSource, S2TilesSource, Source, TexturePack } from './source'

import type { StylePackage } from '../style/styleSpec'
import type { TileRequest } from './workerPool'

export type IconSet = { glyphID: number, colorID: number }

export type IconMap = { [string]: Array<IconSet> }

export type IconPacks = { [string]: IconMap }

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
  This is a pre-approved JWT token for any calls made to the api.s2maps.io
  when building requests, we take the current time, run a black box digest to hash, and return:
  { h: 'first-five-chars', t: '1620276149967' } // h -> hash ; t -> timestamp ('' + Date.now())
  (now - timestamp) / 1000 = seconds passed
**/

export default class SourceWorker {
  currWorker: number = 0
  totalWorkers: number = 0
  status: 'building' | 'ready' = 'building'
  workers: Array<MessageChannel.port2> = []
  cache: Array<[string, Array<TileRequest>]> = [] // each element in array -> [mapID, Array<TileRequest>]
  sessionKeys: { [string]: { token: string, key: string, exp: number } } = {} // [mapID]: token
  sources: { [string]: Sources } = {} // [mapID]: { [sourceName]: Source }
  glyphs: { [string]: GlyphSource } = {} // path is key again
  analytics: Analytics
  texturePack: TexturePack = new TexturePack()

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'port') this._loadWorkerPort(data.messagePort, data.postPort, data.id)
    else if (type === 'style') this._loadStyle(mapID, data.style)
    else if (type === 'tilerequest') this._request(mapID, data.tiles)
    else if (type === 'glyphrequest') this._glyphRequest(mapID, data.id, data.reqID, data.glyphList)
  }

  _loadWorkerPort (messagePort: MessageChannel.port1, postPort: MessageChannel.port2, id: number) {
    this.totalWorkers++
    messagePort.onmessage = this.onMessage.bind(this)
    this.workers[id] = postPort
  }

  _loadStyle (mapID: string, style: StylePackage = {}) {
    // create the source map, if sources already exists, we are dumping the old sources
    this.sources[mapID] = {}
    // pull style data
    const { sources, layers, fonts, icons, analytics, apiKey } = style

    this.status = 'building'
    // store analytics
    this.analytics = analytics || {}
    // store apiKey if it exists
    if (apiKey) this.sessionKeys[mapID] = { apiKey }
    // now build sources
    this._buildSources(mapID, sources, layers, fonts, icons)
  }

  async _buildSources (mapID: string, sources = {}, layers: Array<Layer>, fonts = {}, icons = {}) {
    const promises = []
    // sources
    for (const [name, source] of Object.entries(sources)) {
      promises.push(this._createSource(mapID, name, source, layers.filter(layer => layer.source === name)))
    }
    // fonts & icons
    for (let [name, source] of Object.entries({ ...fonts, ...icons })) {
      if (typeof source === 'object') {
        promises.push(this._createGlyphSource(mapID, name, source.path, source.fallback))
      } else { promises.push(this._createGlyphSource(mapID, name, source)) }
    }

    // run the style config
    await Promise.allSettled(promises)

    // grab all the attributions and send them off
    const attributions = {}
    for (const source of Object.values(this.sources[mapID])) {
      for (const [name, link] of Object.entries(source.attributions)) attributions[name] = link
    }
    if (Object.keys(attributions).length) postMessage({ mapID, type: 'attributions', attributions })

    // add in fallbacks
    this._finalizeGlyphs()
    this.status = 'ready'
    this._checkCache()
  }

  // inject fallbacks & let workers know about icon data
  _finalizeGlyphs () {
    const { glyphs, workers } = this
    const iconPacks: IconPacks = {}
    for (const [name, glyphSource] of Object.entries(glyphs)) {
      const { fallback, iconMap, colors } = glyphSource
      if (fallback) glyphSource.fallback = glyphs[fallback]
      if (iconMap) iconPacks[name] = { iconMap, colors }
    }
    if (Object.keys(iconPacks).length) {
      for (const worker of workers) worker.postMessage({ type: 'iconpacks', iconPacks })
    }
  }

  _checkCache () {
    if (this.cache.length) {
      const [mapID, tiles] = this.cache.pop()
      this._request(mapID, tiles)
    }
  }

  async _createSource (mapID: string, name: string, input: string, layers: Array<Layer>) {
    // prepare variables to build appropriate source type
    let metadata
    if (typeof input === 'object') {
      metadata = input
      input = input.path
    }
    const fileType = input.split('.').pop().toLowerCase()
    const apiSource = input.includes('s2maps://data')
    // const path = (apiSource) ? input.replace('s2maps://', `${process.env.REACT_APP_API_URL}/`) : input
    const path = (apiSource) ? input.replace('s2maps://', `https://data.s2maps.io/`) : input
    // create the proper source type
    let source
    if (fileType === 's2tiles') source = new S2TilesSource(name, layers, path, apiSource)
    else if (fileType === 's2json') source = new S2JSONSource(name, layers, path, apiSource)
    else if (input === 'tile') source = new LocalSource(name, layers)
    else source = new Source(name, layers, path, apiSource) // default -> folder structure
    // build
    await source.build(apiSource ? await this._requestSessionToken(mapID) : null)
    // incase the input was originally an object, insert the metadata
    if (metadata) source._buildMetadata(metadata)
    this.sources[mapID][name] = source
  }

  async _createGlyphSource (mapID: string, name: string, input: string, fallback?: string) {
    const { texturePack } = this
    // prepare
    const apiSource = input.includes('s2maps://data')
    // const path = (apiSource) ? input.replace('s2maps://', `${process.env.REACT_APP_API_URL}/`) : input
    const path = (apiSource) ? input.replace('s2maps://', `https://data.s2maps.io/`) : input
    // check if already exists
    if (this.glyphs[name]) return
    const source = new GlyphSource(name, path, fallback, texturePack, apiSource)
    await source.build(apiSource ? await this._requestSessionToken(mapID) : null)
    // build
    this.glyphs[name] = source
  }

  async _request (mapID: string, tiles: Array<TileRequest>) {
    // cache the request if not ready
    if (this.status === 'building') { this.cache.push([mapID, tiles]); return }
    // build requests
    const token = await this._requestSessionToken(mapID)
    for (const tile of tiles) {
      for (const source of Object.values(this.sources[mapID])) {
        const worker = this.workers[this.currWorker]
        source.tileRequest(mapID, token, tile, worker)
        this.currWorker++
        if (this.currWorker >= this.totalWorkers) this.currWorker = 0
      }
    }
    this._checkCache()
  }

  _glyphRequest (mapID: string, workerID: number, reqID: string,
    sourceGlyphs: { [string]: GlyphRequest }) {
    // prep
    const { workers } = this
    // iterate the glyph sources for the unicodes
    for (const [name, unicodes] of Object.entries(sourceGlyphs)) {
      this.glyphs[name].glyphRequest(new Uint16Array(unicodes), mapID, reqID, workers[workerID])
    }
  }

  async _requestSessionToken (mapID: string) {
    const { sessionKeys, analytics } = this
    const mapSessionKey = sessionKeys[mapID]
    if (!mapSessionKey || !mapSessionKey.apiKey) return null
    const { apiKey, token, exp } = mapSessionKey
    if (exp && token && exp - (new Date()).getTime() > 0) return token
    const { gpu, context, language, width, height } = analytics
    // grab a new token
    // const sessionKey = await fetch(`${process.env.REACT_APP_API_URL}/session`, {
    const sessionKey = await fetch(`https://api.s2maps.io/session`, {
        method: 'POST',
        body: JSON.stringify({ apiKey, gpu, context, language, width, height }),
        headers: { 'Content-Type': 'application/json' }
      }).then(res => {
        if (res.status !== 200 && res.status !== 206) return null
        return res.json()
      }).then(t => {
        const expDate = new Date()
        expDate.setSeconds(expDate.getSeconds() + t.maxAge)
        if (t.token) return { token: t.token, exp: expDate.getTime()  }
        return null
      })
    // store the new key, exp, and return the key to use
    if (!sessionKey) return null
    mapSessionKey.token = sessionKey.token
    mapSessionKey.exp = sessionKey.exp
    return mapSessionKey.token
  }
}

// create the tileworker
const sourceWorker = new SourceWorker()
// bind the onmessage function
onmessage = sourceWorker.onMessage.bind(sourceWorker) // eslint-disable-line

// fetch('URL_GOES_HERE', {
//    method: 'post',
//    headers: new Headers({
//      'Authorization': 'Basic '+btoa('username:password'),
//      'Content-Type': 'application/x-www-form-urlencoded'
//    }),
//    body: 'A=1&B=2'
//  })

// https://jameshfisher.com/2017/10/30/web-cryptography-api-hello-world/
// async function hash (str: string): string {
//   // Get the string as arraybuffer.
//   const buf = await crypto.subtle.digest('SHA-256', new TextEncoder('utf-8').encode(str));
//   return Array.prototype.map.call(new Uint8Array(buf), x => '' + x.toString(16)).join('')
// }

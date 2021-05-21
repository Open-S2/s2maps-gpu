// @flow
import { GlyphSource, LocalSource, S2JSONSource, S2TilesSource, Source, TexturePack } from './source'

import type { StylePackage } from '../style/styleSpec'
import type { TileRequest } from './workerPool'

type SessionToken = {
  token: string,
  age: number
}

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
  sessionToken: SessionToken = { age: 0 }
  sources: { [string]: Source } = {} // path is the key, so ["https://api.s2maps.io/data/oconnorct1/test.s2tiles"] = Source
  glyphs: { [string]: GlyphSource } = {} // path is key again
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
    this.status = 'building'
    // now build sources
    this._buildSources(style.sources, style.layers, style.fonts, style.icons)
  }

  _buildSources (sources = {}, layers: Array<Layer>, fonts = {}, icons = {}) {
    const promises = []
    // sources
    for (const [name, source] of Object.entries(sources)) {
      promises.push(this._createSource(name, source, layers.filter(layer => layer.source === name)))
    }
    // fonts & icons
    for (let [name, source] of Object.entries({ ...fonts, ...icons })) {
      if (typeof source === 'object') {
        promises.push(this._createGlyphSource(name, source.path, source.fallback))
      } else { promises.push(this._createGlyphSource(name, source)) }
    }

    // run the style config
    Promise.all(promises)
      .then(() => {
        // add in fallbacks
        this._injectFallbacks()
        this.status = 'ready'
        this._checkCache()
      })
  }

  _injectFallbacks () {
    const { glyphs } = this
    for (const glyphSource of Object.values(glyphs)) {
      if (glyphSource.fallback) glyphSource.fallback = glyphs[glyphSource.fallback]
    }
  }

  _checkCache () {
    if (this.cache.length) {
      const [mapID, tiles] = this.cache.pop()
      this._request(mapID, tiles)
    }
  }

  async _createSource (name: string, input: string, layers: Array<Layer>) {
    // prepare variables to build appropriate source type
    let metadata
    if (typeof input === 'object') {
      metadata = input
      input = input.path
    }
    const fileType = input.split('.').pop().toLowerCase()
    const apiSource = input.includes('s2maps://')
    const path = (apiSource) ? input.replace('s2maps://', 'https://api.s2maps.io/data/') : input
    // if another map already created the source, return
    if (this.sources[path]) return
    // create the proper source type
    let source
    if (fileType === 's2tiles') source = new S2TilesSource(name, layers, path, apiSource)
    else if (fileType === 's2json') source = new S2JSONSource(name, layers, path, apiSource)
    else if (input === 'tile') source = new LocalSource(name, layers)
    else source = new Source(name, layers, path, apiSource) // default -> folder structure
    // build
    await source._build()
    // incase the input was originally an object, insert the metadata
    if (metadata) source._buildMetadata(metadata)
    this.sources[path] = source
  }

  async _createGlyphSource (name: string, input: string, fallback?: string) {
    const { texturePack } = this
    // prepare
    const apiSource = input.includes('s2maps://')
    const path = (apiSource) ? input.replace('s2maps://', 'https://api.s2maps.io/data/') : input
    // check if already exists
    if (this.glyphs[name]) return
    const source = new GlyphSource(name, path, fallback, texturePack)
    await source._build()
    // build
    this.glyphs[name] = source
  }

  _request (mapID: string, tiles: Array<TileRequest>) {
    // cache the request if not ready
    if (this.status === 'building') { this.cache.push([mapID, tiles]); return }
    // build requests
    const self = this
    self._requestToken(mapID)
      .then(token => { // ensure we have an up to date request token
        for (const tile of tiles) {
          for (const source of Object.values(self.sources)) {
            const worker = self.workers[self.currWorker]
            source.tileRequest(mapID, tile, worker, token)
            self.currWorker++
            if (self.currWorker >= self.totalWorkers) self.currWorker = 0
          }
        }
        self._checkCache()
      })
  }

  async _glyphRequest (mapID: string, workerID: number, reqID: string,
    sourceGlyphs: { [string]: GlyphRequest }) {
    // prep
    const { workers } = this
    const promises = []
    const glyphSources = {}
    const images = []
    // iterate the glyph sources for the unicodes
    for (const [name, unicodes] of Object.entries(sourceGlyphs)) {
      if (this.glyphs[name]) promises.push(this.glyphs[name].glyphRequest(glyphSources, images, new Uint16Array(unicodes)))
    }
    await Promise.all(promises)

    // if glyphResponse has data, send it back to the worker
    if (Object.keys(glyphSources).length) {
      for (const glyphSource in glyphSources) {
        glyphSources[glyphSource] = (new Float32Array(glyphSources[glyphSource])).buffer
      }
      workers[workerID].postMessage({ mapID, type: 'glyphresponse', reqID, glyphSources }, Object.values(glyphSources))
    }

    // send any images to the main thread
    const maxHeight = images.reduce((acc, cur) => Math.max(acc, cur.posY + cur.height), 0)
    if (images.length) postMessage({ mapID, type: 'glyphimages', images, maxHeight }, images.map(i => i.data))
  }

  _requestToken (mapID) {
    // use mapID to keep track of the api used
    return new Promise(resolve => {
      resolve(null)
    })
  }
}

// function requestHash (sessionToken?: string) {
//   if (!sessionToken) return
// }

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

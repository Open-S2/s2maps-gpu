// @flow
import { VectorTile } from 's2-vector-tile'
import { parseLayers } from '../style/conditionals'
import { processFill, processLine } from './process'
import requestData from '../util/xmlHttpRequest'

import type { Face } from 'S2Projection'
import type { StylePackage } from '../style'

type Point = [number, number]

export type CancelTileRequest = Array<number> // hashes of tiles e.g. ['204', '1003', '1245', ...]

export type TileRequest = {
  hash: number,
  face: Face,
  zoom: number,
  x: number,
  y: number,
  bbox: [number, number, number, number],
  division: number,
  extent: number,
  size: number
}

const MAX_FEATURE_BATCH_SIZE = 128

// A TileWorker on spin up will get style "guide". It will have all layers "filter" and "layout" properties
// This is the tileworkers time to prepare the the style data for future requests from said mapID.
// the style features source data long with layer filters shall be prepared early for efficiency.
// Upon requests:
// 1) Check the maps sources and request source tiles.
// 2) When pbf vector tile/image tile is returned for specified source, pre-process according to the rules of maps[mapId].layers
//    a) run through map style layers and if source data exists, run each layer, filter properties accordingly
//    b) create array list of vertices/indices pairs.
// 3) Serialize to arraybuffer and send off to GlobalWorkerPool to send back to the appropriate map.
//    for each vertices/indices pair, encode all in the same buffer. Howevever, we need to track the layer index
//    of each pair for deserializing. For instance, if the layers looks like: [{ source: 1 }, { source: 2 }, { source: 1} ]
//    and the source 1 has finished downloading first, we serialize the first part, and add the index sets:
//    [layerID, count, offset, encoding-size, ..., layerID, count, offset, size, ..., etc.]: [3, 0, 3, 102, 3, 0, 1, 3, 3, 66, 102]. The resultant to send is:
//    In a future update, the size parameter will matter when we add dataRangeFunctions and dataConditionFunctions
//    size does not include layerID, count, or offset. So for instance, if we have no dataFunctions, size is 0
//    postMessage({ mapID, featureGuide, vertexBuffer, indexBuffer }, [vertexBuffer, indexBuffer])

// one thing to note: If all source, font, billboard data has not yet been downloaded, but we are already processing tiles,
// after every update of
export default class TileWorker {
  maps: { [string]: StylePackage } = {} // mapID: StylePackage
  status: 'building' | 'busy' | 'ready' = 'ready'
  cache: { [string]: Array<TileRequest> } = {} // mapID: TileRequests
  cancelCache: Array<number> = []
  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'style') this._styleMessage(mapID, data.style)
    else if (type === 'request') this._requestMessage(mapID, data.tiles)
    else if (type === 'status') postMessage({ type: 'status', status: this.status })
    else if (type === 'cancel') this._cancelTiles(mapID, data.tiles)
  }

  _styleMessage (mapID: string, style: StylePackage) {
    // set status
    this.status = 'building'
    // store the style
    this.maps[mapID] = style
    // prep filter functions
    parseLayers(this.maps[mapID].layers)
    // prep request system
    this.buildSources(mapID)
  }

  _cancelTiles (mapID: string, tiles: Array<CancelTileRequest>) {
    // first check if any of the tiles are in a cache queue
    this.cache[mapID].filter(tile => !tiles.includes(tile.hash))
    // store the cache
    this.cancelCache = tiles
  }

  _requestMessage (mapID: string, tiles: Array<TileRequest>) {
    if (this.status === 'building' || this.status === 'busy') {
      if (this.cache[mapID]) this.cache[mapID].push(...tiles)
      else this.cache[mapID] = tiles
    } else {
      // set status
      this.status = 'busy'
      // make the requests for each source
      const sources = this.maps[mapID].sources
      for (const sourceName in sources) {
        const source = sources[sourceName]
        this.requestTiles(mapID, sourceName, source, tiles)
      }
    }
  }

  // grab the metadata from each source, grab necessary fonts / billboards
  // this may seem wasteful that each worker has to do this, but these assets are cached, so it will be fast.
  async buildSources (mapID: string) {
    const self = this
    const style = self.maps[mapID]
    // check all values are non-null
    if (!style.sources) style.sources = {}
    if (!style.fonts) style.fonts = {}
    if (!style.billboards) style.billboards = {}
    const { sources, fonts, billboards } = style
    // build sources
    const promises = []
    for (const source in sources) {
      if (typeof sources[source] === 'string') {
        promises.push(
          new Promise((resolve, _) => {
            requestData(`${sources[source]}/metadata`, 'json', (metadata) => {
              // build & add proper path to metadata if it does not exist
              if (!metadata.path) metadata.path = sources[source]
              // update source to said metadata
              sources[source] = metadata
              resolve()
            })
          })
        )
      }
    }
    // TODO: get and replace fonts strings with font-gl class objects

    // TODO: get and replace billboard strings with svg-gl class objects
    Promise.all(promises)
      .then(() => {
        this.status = 'ready'
        this._checkCache()
      })
  }

  _checkCache () {
    // if we have a cached tiles, we are now ready to request more data
    const firstCache = Object.keys(this.cache)[0]
    if (firstCache) {
      // pull out the requests and delete the reference
      const tileRequest = this.cache[firstCache]
      delete this.cache[firstCache]
      this._requestMessage(firstCache, tileRequest)
    } else { // otherwise we have no more tiles to process, clear cancelCache should their be any leftover
      this.cancelCache = []
    }
  }

  async requestTiles (mapID: string, sourceName: string, source: Object, tiles: Array<TileRequest>) { // tile: [face, zoom, x, y]
    const self = this
    for (const tile of tiles) {
      const { hash, face, zoom, x, y } = tile
      if (
        source.minzoom <= zoom && source.maxzoom >= zoom && // check zoom bounds
        source.facesbounds[face] && // check face exists
        source.facesbounds[face][zoom] && // check zoom exists
        source.facesbounds[face][zoom][0] <= x && source.facesbounds[face][zoom][2] >= x && // check x is within bounds
        source.facesbounds[face][zoom][1] <= y && source.facesbounds[face][zoom][3] >= y // check y is within bounds
      ) {
        requestData(`${source.path}/${face}/${zoom}/${x}/${y}`, source.extension, (data) => {
          if (data && !self.cancelCache.includes(hash)) self._processTileData(mapID, sourceName, source, tile, data)
        })
      }
    }
    self.status = 'ready'
    self._checkCache()
  }

  _processTileData (mapID: string, sourceName: string, source: Object, tile: TileRequest, data: ArrayBuffer | Blob) {
    // grab tiles basics
    const { extent, division, size } = tile
    let maxLength = extent / division
    if (maxLength === extent) maxLength = null
    const pixelSize = extent / size // defaults extent and size (4096 and 512) equate to 8 units. so 8 units = 1 pixel
    // Check the source metadata. If it's a vector run through all
    // layers and process accordingly. If image, no pre-processing needed.
    // TODO: types may differ between vector or raster
    const { type } = source
    if (type === 'vector') {
      const vertices: Array<number> = []
      const featureIndices: Array<number> = []
      const indices: Array<number> = []
      const featureGuide: Array<number> = []
      const vectorTile = new VectorTile(data)
      const { layers } = this.maps[mapID]
      let indicesOffset: number = 0
      for (let i = 0, sl = layers.length; i < sl; i++) {
        const layer = layers[i]
        if (
          layer.source === sourceName && // the layer source matches
          vectorTile.layers[layer.layer] && // the vectorTile has said layer in it
          layer.minzoom <= tile.zoom && layer.maxzoom >= tile.zoom // zoom attributes fit
        ) {
          // run through the vectorTile's features of said layer and build batches
          // to reduce draw counts, we batch data of the same layer and type.
          // When a feature batch size exceeds the max batch size, finish out the
          // draw batch and start again
          const vectorTileLayer = vectorTile.layers[layer.layer]
          // prep a mapping of layer and paint properties (feature encodings)
          let encodings = []
          let prevEncodings = []
          let encodingIndex = 0
          for (let f = 0; f < vectorTileLayer.length; f++) {
            let featureEncodings = []
            const feature = vectorTileLayer.feature(f)
            const { properties, type } = feature
            // lastly we need to filter according to the layer
            if (layer.filter(properties)) {
              // we can now process according to type
              if (layer.type === 'fill' && (type === 3 || type === 4)) {
                processFill(feature.loadGeometry(), type, tile, vertices, indices, featureIndices, encodingIndex, maxLength)
              } else if (layer.type === 'fill3D' && (type === 7 || type === 8)) {

              } else if (layer.type === 'line' && type === 2) {
                processLine(feature.loadGeometry(), { cap: layer.layout.cap(), join: layer.layout.join() }, tile, vertices, indices, featureIndices, encodingIndex, maxLength, pixelSize * 1)
              } else if (layer.type === 'line3D' && type === 2) {

              } else if (layer.type === 'text' && type === 1) {

              } else if (layer.type === 'billboard' && type === 1) {

              } else { continue }
            } else { continue }
            // create encodings for the feature, if it is different than the previous feature, we start a new encoding set
            for (const l in layer.layout) layer.layout[l](properties, featureEncodings)
            for (const p in layer.paint) layer.paint[p](properties, featureEncodings)
            // quick test, if the batch size is maxed out, then we close out the draw batch and start another one
            if (encodings.length + featureEncodings.length > MAX_FEATURE_BATCH_SIZE) {
              // store the features index count and offset; update offset; store all feature encodings; reset
              featureGuide.push(i, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings
              indicesOffset = indices.length
              encodings = []
              prevEncodings = []
              encodingIndex = 0
            }
            // if we have nothing to encode, move on, otherwise, check if we already have that encoding stored
            if (featureEncodings.length && JSON.stringify(featureEncodings) !== JSON.stringify(prevEncodings)) {
              // store the encodings; set the new previous; update encodingIndex for future vertices
              encodings.push(...featureEncodings)
              prevEncodings = featureEncodings
              encodingIndex += encodings.length
            }
          }
          // store the features index count and offset; update offset; store all feature encodings
          featureGuide.push(i, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings
          indicesOffset = indices.length
        }
      }
      // Upon processing the data, encode vertices, indices, and feature data.
      const vertexBuffer = new Float32Array(vertices).buffer
      const indexBuffer = new Uint32Array(indices).buffer
      const featureIndexBuffer = new Uint8Array(featureIndices).buffer
      const featureGuideBuffer = new Uint32Array(featureGuide).buffer
      // Upon encoding, send back to GlobalWorkerPool.
      postMessage({ mapID, type: 'vectordata', source: sourceName, tileID: tile.hash, vertexBuffer, indexBuffer, featureIndexBuffer, featureGuideBuffer }, [vertexBuffer, indexBuffer, featureIndexBuffer, featureGuideBuffer])
    }
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

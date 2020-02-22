// @flow
import S2JsonVT from 's2json-vt'
import { VectorTile } from 's2-vector-tile'
import { parseLayers } from '../style/conditionals'
import { processFill, processLine } from './process'
import requestData from '../util/xmlHttpRequest'

import type { Face } from 'S2Projection'
import type { StylePackage } from '../style'

type Point = [number, number]

export type CancelTileRequest = Array<number> // hashe IDs of tiles e.g. ['204', '1003', '1245', ...]

export type TileRequest = {
  hash: number,
  face: Face,
  zoom: number,
  x: number,
  y: number,
  division: number,
  size: number
}

type Feature = {
  vertices: Array<number>,
  indices: Array<number>,
  code: Array<number>,
  size: number,
  divisor: number,
  layerID: number
}

const MAX_FEATURE_BATCH_SIZE = 128
const MAX_INDEX_BUFFER_SIZE = 4294967295 // 16bit: 65535

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
        // if there is a filetype at the end, we parse it differently.
        const [fileName, fileType] = sources[source].split('.')

        promises.push(new Promise((resolve, _) => {
          if (fileType === 's2json' || fileType === 'geojson' || fileType === 'json') { // s2json request
            requestData(fileName, fileType, (json) => {
              // create an S2JsonVT object
              if (json) {
                sources[source] = {
                  type: 'json',
                  s2json: new S2JsonVT(json)
                }
              }
              resolve()
            })
          } else { // standard metadata request
            requestData(`${fileName}/metadata`, 'json', (metadata) => {
              // build & add proper path to metadata if it does not exist
              if (!metadata.path) metadata.path = sources[source]
              // update source to said metadata
              sources[source] = metadata
              resolve()
            })
          }
        }))
      }
    }
    // TODO: get and replace fonts strings with font-gl class objects

    // TODO: get and replace billboard strings with svg-gl class objects

    // run the style config
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
      if (source.type === 'vector') {
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
      } else if (source.type === 'json') {
        if (source.s2json.faces.has(face)) {
          const data = source.s2json.getTile(face, zoom, x, y)
          if (data && !self.cancelCache.includes(hash)) self._processTileData(mapID, sourceName, source, tile, data)
        }
      }
    }
    // worker is ready for future tiles
    self.status = 'ready'
    self._checkCache()
  }

  _processTileData (mapID: string, sourceName: string, source: Object,
    tile: TileRequest, data: Object | ArrayBuffer | Blob) {
    // grab tiles basics
    const { zoom, division } = tile
    // Check the source metadata. If it's a vector run through all
    // layers and process accordingly. If image, no pre-processing needed.
    const { type } = source
    if (type === 'vector' || type === 'json') {
      const features: Array<Feature> = []
      const vectorTile = (type === 'vector') ? new VectorTile(data) : data
      const { layers } = this.maps[mapID]
      for (let layerID = 0, ll = layers.length; layerID < ll; layerID++) {
        const layer = layers[layerID]
        if (
          layer.source === sourceName && // the layer source matches
          vectorTile.layers[layer.layer] && // the vectorTile has said layer in it
          layer.minzoom <= zoom && layer.maxzoom >= zoom // zoom attributes fit
        ) {
          // run through the vectorTile's features of said layer and build batches
          // to reduce draw counts, we batch data of the same layer and type.
          // When a feature batch size exceeds the max batch size, finish out the
          // draw batch and start again
          const vectorTileLayer = vectorTile.layers[layer.layer]
          const { extent } = vectorTileLayer
          // prep a mapping of layer and paint properties (feature encodings)
          for (let f = 0; f < vectorTileLayer.length; f++) {
            let featureCode = []
            const feature = vectorTileLayer.feature(f)
            // if (layer.layer === 'boundary') console.log(layer.filter.toString())
            const { properties, type } = feature
            // lastly we need to filter according to the layer
            if (layer.filter(properties)) {
              // create encodings for the feature, if it is different than the previous feature, we start a new encoding set
              for (const l in layer.layout) layer.layout[l](properties, featureCode)
              for (const p in layer.paint) layer.paint[p](properties, featureCode)
              // we can now process according to type
              let vertices = []
              let indices = []
              let vertexSize
              let vertexDivisor
              if (layer.type === 'fill' && (type === 3 || type === 4)) {
                processFill(feature.loadGeometry(), type, vertices, indices, division, extent)
                vertexSize = vertices.length / 2
                vertexDivisor = 2
              } else if (layer.type === 'fill3D' && (type === 7 || type === 8)) {

              } else if (layer.type === 'line' && (type === 2 || type === 3 || type === 4)) {
                const attributes = { cap: layer.layout.cap(), join: layer.layout.join(), maxDistance: extent / division, dashed: true }
                processLine(feature.loadGeometry(), type, attributes, vertices, indices, extent)
                vertexSize = vertices.length / 4
                vertexDivisor = 4
              } else if (layer.type === 'line3D' && type === 2) {

              } else if (layer.type === 'text' && type === 1) {

              } else if (layer.type === 'billboard' && type === 1) {

              } else { continue }
              features.push({ vertices, indices, code: featureCode, size: vertexSize, divisor: vertexDivisor, layerID })
            } else { continue }
          }
        }
      }
      // now post process triangles
      this._processVectorFeatures(mapID, sourceName, tile.hash, features)
    } else if (type === 'raster') {
      // TODO
    }
  }

  _processVectorFeatures (mapID: string, sourceName: string, tileID: string, features: Array<Feature>) {
    // now that we have created all triangles, let's merge into bundled buffer sets
    // for the main thread to build VAOs.
    // Step 1: Sort by layerID, than sort by feature code.
    features = features.sort((a, b) => {
      // layerID
      let diff = a.layerID - b.layerID
      let index = 0
      let maxSize = Math.min(a.code.length, b.code.length)
      while (diff === 0 && index < maxSize) {
        diff = a.code[index] - b.code[index]
        index++
      }
      return diff
    })

    // step 2: Run through all features and bundle into the fewest VAOs and fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (if webgl1 we can only store 16 bits, otherwise 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    let vertices: Array<number> = []
    let indices: Array<number> = []
    let codeOffset: Array<number> = []
    let featureGuide: Array<number> = []
    let encodings: Array<number> = []
    let indicesOffset: number = 0
    let vertexOffset: number = 0
    let encodingIndexes = { '': 0 }
    let encodingIndex
    let prevLayerID
    for (const feature of features) {
      // setup encodings data
      const feKey = feature.code.toString()
      encodingIndex = encodingIndexes[feKey]
      if (!encodingIndex) {
        encodingIndex = encodingIndexes[feKey] = encodings.length
        encodings.push(...feature.code)
      }
      // TODO: If vertex size + current vertexLength > MAX_INDEX_BUFFER_SIZE we start a new VAO set

      // on layer changes we have to setup a new featureGuide
      if ((prevLayerID !== undefined && prevLayerID !== feature.layerID) || (encodings.length + feature.code.length > MAX_FEATURE_BATCH_SIZE)) {
        featureGuide.push(prevLayerID, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings
        indicesOffset = indices.length
        encodings = []
      }
      // each draw type has it's own alignment type, we must pad accordigly
      let vertexalignment = vertices.length % feature.divisor
      while (vertexalignment--) vertices.push(0)
      // store
      vertexOffset = vertices.length / feature.divisor
      // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
      for (let f = 0, fl = feature.vertices.length; f < fl; f++) vertices.push(feature.vertices[f])
      for (let f = 0, fl = feature.indices.length; f < fl; f++) indices.push(feature.indices[f] + vertexOffset)
      for (let s = 0; s < feature.size; s++) codeOffset.push(encodingIndex)
      // update previous layerID
      prevLayerID = feature.layerID
    }
    // store the very last featureGuide batch
    if (indices.length - indicesOffset) featureGuide.push(prevLayerID, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Float32Array(vertices).buffer
    const indexBuffer = new Uint32Array(indices).buffer
    const codeOffsetBuffer = new Uint8Array(codeOffset).buffer
    const featureGuideBuffer = new Uint32Array(featureGuide).buffer
    // Upon encoding, send back to GlobalWorkerPool.
    postMessage({ mapID, type: 'vectordata', source: sourceName, tileID, vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer }, [vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer])
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

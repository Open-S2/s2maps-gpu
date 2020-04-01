// @flow
import S2JsonVT from 's2json-vt'
import S2RTIN from 's2rtin'
import { VectorTile } from 's2-vector-tile'
import { parseLayers } from '../style/conditionals'
import { processFill, processLine, processText, PNGReader, TextureBuilder } from './process'
import requestData from '../util/xmlHttpRequest'
import { tileHash } from 's2projection'

import type { Face } from 's2projection'
import type { StylePackage } from '../styleSpec'

type Point = [number, number]

export type CancelTileRequest = Array<number> // hashe IDs of tiles e.g. ['204', '1003', '1245', ...]

// https://stackoverflow.com/questions/53996916/unable-to-turn-off-eslint-no-unused-expressions

export type TileRequest = {
  hash: number,
  face: Face,
  zoom: number,
  x: number,
  y: number,
  division: number,
  size: number
}

export type ParentLayers = {
  [string | number]: { // tileHash:
    face: Face,
    zoom: number,
    x: number,
    y: number,
    layers: Array<number>
  }
}

export type Feature = {
  vertices: Array<number>,
  indices: Array<number>,
  code: Array<number>,
  size: number,
  divisor: number,
  layerID: number
}

export type Text = {
  // organization parameters
  id: number,
  layerID: number,
  code: Array<number>,
  // layout
  family: string,
  field: string | Array<string>,
  anchor: number, // 0 => auto ; 1 => center ; 2 => top; 3 => topRight ; 4 => right ; 5 => bottomRight ; 6 => bottom ; 7 => bottomLeft ; 8 => left ; 9 => topLeft
  offset: [number, number],
  padding: [number, number],
  // paint
  size: number,
  fillStyle: string,
  strokeStyle: string,
  strokeWidth: number,
  // tile's position
  s: number,
  t: number,
  // canvas properties
  x?: number,
  y?: number,
  width?: number,
  height?: number,
}

const S2Rtin = S2RTIN.default
const terrainToGrid = S2RTIN.terrainToGrid

// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 16bit: 65,535 --- 7bit: 128
const MAX_INDEX_BUFFER_SIZE = 1 << 32
const ID_MAX_SIZE = 1 << 24
const MAX_FEATURE_BATCH_SIZE = 1 << 7

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
  id: number
  chrome: boolean = navigator.userAgent.indexOf('Chrome') !== -1
  offscreenSupport: boolean = global.OffscreenCanvas && global.FontFace
  textureBuilder: TextureBuilder
  maps: { [string]: StylePackage } = {} // mapID: StylePackage
  status: 'building' | 'busy' | 'ready' = 'ready'
  cache: { [string]: Array<TileRequest> } = {} // mapID: TileRequests
  cancelCache: Array<number> = []
  idGen: number = 1
  constructor () {
    if (this.offscreenSupport) this.textureBuilder = new TextureBuilder(true)
  }

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'style') this._styleMessage(mapID, data.style, data.index)
    else if (type === 'request') this._requestMessage(mapID, data.tiles)
    else if (type === 'status') postMessage({ type: 'status', status: this.status })
    else if (type === 'texture') this._processTexture(mapID, data.source, data.tileID, data.texts, data.texture)
    else if (type === 'cancel') this._cancelTiles(mapID, data.tiles)
  }

  _styleMessage (mapID: string, style: StylePackage, id: number) {
    // set id
    this.id = id
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
    const style = this.maps[mapID]
    // check all values are non-null
    if (!style.sources) style.sources = {}
    if (!style.fonts) style.fonts = {}
    if (!style.billboards) style.billboards = {}
    const { sources, fonts, billboards } = style
    // build sources
    const promises = []
    for (const sourceName in sources) {
      let source = sources[sourceName]
      if (typeof source === 'string') {
        // if there is a filetype at the end, we parse it differently.
        const [fileName, fileType] = source.split('.')

        promises.push(new Promise((resolve, _) => {
          if (fileType === 's2json' || fileType === 'geojson' || fileType === 'json') { // s2json request
            requestData(fileName, fileType, (json) => {
              // create an S2JsonVT object
              if (json) {
                sources[sourceName] = source = {
                  type: 'json',
                  s2json: new S2JsonVT(json)
                }
              }
              resolve()
            })
          } else { // standard metadata request
            requestData(`${fileName}/metadata`, 'json', (metadata) => {
              // build & add proper path to metadata if it does not exist
              if (!metadata.path) metadata.path = source
              // update source to said metadata
              sources[sourceName] = source = metadata
              // if mask type, we create an S2Rtin in prep
              if (source.type === 'mask') source.s2rtin = new S2Rtin(source.tileSize)
              resolve()
            })
          }
        }))
      } else if (source.type === 'mask') {
        source.s2rtin = new S2Rtin(source.tileSize)
      }
    }
    // build fonts if we can utilize them
    if (this.offscreenSupport) {
      for (const fontName in fonts) {
        promises.push(new Promise((resolve, _) => {
          const font = new FontFace(fontName, `url(${fonts[fontName]})`)
          font.load()
            .then(loadedFontFace => {
              global.fonts.add(loadedFontFace)
              resolve()
            })
            .catch(err => {
              console.log(`Could not load font "${fontName}"`, err)
              resolve()
            })
        }))
      }
    }
    // TODO: get billboard data

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
    const { type, path, fileType, extension, minzoom, maxzoom, facesbounds, s2json } = source
    for (const tile of tiles) {
      const { hash, face, zoom, x, y } = tile
      if (type === 'vector') {
        if (
          minzoom <= zoom && maxzoom >= zoom && // check zoom bounds
          facesbounds[face] && // check face exists
          facesbounds[face][zoom] && // check zoom exists
          facesbounds[face][zoom][0] <= x && facesbounds[face][zoom][2] >= x && // check x is within bounds
          facesbounds[face][zoom][1] <= y && facesbounds[face][zoom][3] >= y // check y is within bounds
        ) {
          requestData(`${path}/${face}/${zoom}/${x}/${y}`, extension, (data) => {
            if (data && !self.cancelCache.includes(hash)) self._processTileData(mapID, sourceName, source, tile, data)
          })
        }
      } else if (type === 'raster') {
        const tilezoom = zoom + 1
        if (minzoom <= tilezoom && maxzoom >= tilezoom) { // check zoom bounds
          const pieces = [
            { x: x * 2, y: y * 2, leftShift: 0, bottomShift: 0 },
            { x: x * 2 + 1, y: y * 2, leftShift: 1, bottomShift: 0 },
            { x: x * 2, y: y * 2 + 1, leftShift: 0, bottomShift: 1 },
            { x: x * 2 + 1, y: y * 2 + 1, leftShift: 1, bottomShift: 1 }
          ]

          for (const piece of pieces) {
            const { x, y, leftShift, bottomShift } = piece
            requestData(`${path}/${face}/${tilezoom}/${x}/${y}`, fileType, (data) => {
              if (data && !self.cancelCache.includes(hash)) self._processTileData(mapID, sourceName, source, tile, data, { leftShift, bottomShift })
            })
          }
        }
      } else if (type === 'json') {
        if (s2json.faces.has(face)) {
          const data = s2json.getTile(face, zoom, x, y)
          if (data && !self.cancelCache.includes(hash)) self._processTileData(mapID, sourceName, source, tile, data)
        }
      } else if (type === 'mask') {
        if (minzoom <= zoom && maxzoom >= zoom) { // check zoom bounds
          requestData(`${path}/${face}/${zoom}/${x}/${y}`, fileType, (data) => {
            if (data && !self.cancelCache.includes(hash)) self._processTileData(mapID, sourceName, source, tile, data)
          })
        }
      }
    }
    // worker is ready for future tiles
    self.status = 'ready'
    self._checkCache()
  }

  _processTileData (mapID: string, sourceName: string, source: Object,
    tile: TileRequest, data: Object | ArrayBuffer | Blob, params?: Object) {
    // grab tiles basics
    const { face, zoom, x, y, division, size, hash } = tile
    // Check the source metadata. If it's a vector run through all
    // layers and process accordingly. If image, no pre-processing needed.
    const { type } = source
    if (type === 'vector' || type === 'json') {
      const features: Array<Feature> = []
      const texts: Array<Text> = []
      const parentLayers: ParentLayers = {}
      const vectorTile = (type === 'vector') ? new VectorTile(data) : data
      const { layers } = this.maps[mapID]
      for (let layerID = 0, ll = layers.length; layerID < ll; layerID++) {
        const layer = layers[layerID]
        if (layer.source === sourceName) { // ensure we are in the right source
          if (
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
              // every feature MUST have an id associated with it for lookups
              feature._id = this.idGen
              // this.idGen++
              this.idGen += 20000
              if (this.idGen >= ID_MAX_SIZE) this.idGen = 1
              // get prelude properties
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
                  texts.push(...processText(feature, zoom, layer, layerID, extent))
                } else if (layer.type === 'billboard' && type === 1) {

                } else { continue }
                features.push({ type: layer.type, vertices, indices, code: featureCode, codeStr: featureCode.toString(), size: vertexSize, divisor: vertexDivisor, layerID })
              } else { continue }
            } // for (let f = 0; f < vectorTileLayer.length; f++)
          } else if (source.layers && source.layers[layer.layer] && source.layers[layer.layer].maxzoom < zoom) {
            // we have passed the limit at which this data is stored. Rather than
            // processing the data more than once, we reference where to look for the layer
            const layerMaxZoom = source.layers[layer.layer].maxzoom
            let pZoom = zoom
            let pX = x
            let pY = y
            while (pZoom > layerMaxZoom) {
              pZoom--
              pX = Math.floor(pX / 2)
              pY = Math.floor(pY / 2)
            }
            const hash = tileHash(face, pZoom, pX, pY)
            // store parent reference
            if (!parentLayers[hash]) parentLayers[hash] = { face, zoom: pZoom, x: pX, y: pY, layers: [] }
            parentLayers[hash].layers.push(layerID)
          }
        }
      }
      // now post process triangles
      this._processVectorFeatures(mapID, sourceName, hash, features, parentLayers)
      // process text
      if (texts.length) {
        if (this.offscreenSupport) {
          // create the texture
          const imageBitmap = this.textureBuilder.createTexture(texts)
          // build vertex data and send off
          this._processTexture(mapID, sourceName, hash, texts, imageBitmap)
        } else { this._requestTexture(mapID, sourceName, hash, texts) }
      }
    } else if (type === 'raster') {
      const { leftShift, bottomShift } = params
      const getImage = (this.chrome) ? createImageBitmap(data, { imageOrientation: 'flipY', premultiplyAlpha: 'premultiply' }) : createImageBitmap(data)
      getImage
        .then(image => {
          postMessage({ mapID, type: 'rasterdata', source: sourceName, tileID: hash, image, leftShift, bottomShift }, [image])
        })
        .catch(err => {})
    } else if (type === 'mask') {
      // grab the RTIN object
      const { s2rtin } = source
      // create the terrain grid
      data.arrayBuffer()
        .then(ab => {
          const reader = new PNGReader(ab)
          reader.parse((err, png) => {
          	if (!err) {
              const dem = { width: size, data: png.pixels }
              const terrain = terrainToGrid(dem)
              // create a tile object
              const tile = s2rtin.createTile(terrain)
              // find the appropriate margin of error
              const approxBestError = s2rtin.approximateBestError(zoom)
              // build the mesh
              const mesh = tile.getMesh(approxBestError)
              const vertexBuffer = mesh.vertices.buffer
              const indexBuffer = mesh.triangles.buffer
              const radiiBuffer = mesh.radii.buffer
              // ship it
              postMessage({ mapID, type: 'maskdata', tileID: hash, vertexBuffer, indexBuffer, radiiBuffer }, [vertexBuffer, indexBuffer, radiiBuffer])
            } else { console.log('parse error', err)}
          })
        })
      // createImageBitmap(data)
      //   .then(image => {})
    }
  }

  _processVectorFeatures (mapID: string, sourceName: string, tileID: string,
    features: Array<Feature>, parentLayers: ParentLayers) {
    // now that we have created all triangles, let's merge into bundled buffer sets
    // for the main thread to build VAOs.
    // Step 1: Sort by layerID, than sort by feature code.
    features.sort(featureSort)

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
    let codePosition: number = 0
    let encodingIndexes = { '': 0 }
    let encodingIndex
    let prevLayerID
    let prevCodeStr
    // console.log('features', features)
    for (const feature of features) {
      // TODO: If vertex size + current vertexLength > MAX_INDEX_BUFFER_SIZE we start a new VAO set

      // on layer change or max encoding size, we have to setup a new featureGuide, encodings, and encodingIndexes
      if (
        (prevLayerID !== undefined && prevLayerID !== feature.layerID) ||
        (feature.type === 'fill' && prevCodeStr !== feature.codeStr) ||
        (encodings.length + feature.code.length > MAX_FEATURE_BATCH_SIZE)
      ) {
        prevCodeStr = feature.codeStr
        featureGuide.push(prevLayerID, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings
        indicesOffset = indices.length
        encodings = []
        encodingIndexes = { '': 0 }
      }
      // setup encodings data. If we didn't have current feature's encodings already, create and set index
      const feKey = feature.code.toString()
      encodingIndex = encodingIndexes[feKey]
      if (encodingIndex === undefined) {
        encodingIndex = encodingIndexes[feKey] = encodings.length
        encodings.push(...feature.code)
      }
      // each draw type has it's own vertex alignment, we must pad accordingly
      let vertexalignment = vertices.length % feature.divisor
      while (vertexalignment--) vertices.push(0)
      // store
      vertexOffset = vertices.length / feature.divisor
      codePosition = (feature.divisor === 2) ? 0 : 1
      // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
      // so we just do a for loop
      for (let f = 0, fl = feature.vertices.length; f < fl; f++) vertices.push(feature.vertices[f])
      for (let f = 0, fl = feature.indices.length; f < fl; f++) {
        const index = feature.indices[f] + vertexOffset
        indices.push(index)
        codeOffset[(index * 2) + codePosition] = encodingIndex
      }
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
    // ship the vector data.
    postMessage({
      mapID,
      type: 'vectordata',
      source: sourceName,
      tileID,
      parentLayers,
      vertexBuffer,
      indexBuffer,
      codeOffsetBuffer,
      featureGuideBuffer
    }, [vertexBuffer, indexBuffer, codeOffsetBuffer, featureGuideBuffer])
  }

  _processTexture (mapID: string, source: string, tileID: string,
    texts: Array<Text>, imageBitmap: ImageBitmap) {
    // sort by layer than feature code
    texts.sort(featureSort)
    // in the case of textures, we want to draw top down
    // texts.reverse()
    // now that the texture pack is built, we can specify all the attribute sets
    const vertices = []
    const texPositions = []
    for (const text of texts) {
      // store the vertex set
      vertices.push(text.s, text.t, text.id)
      // vertices.push(text.s, text.t, Math.floor(Math.random() * (16777215 - 1 + 1) + 1))
      // prep texture position variables
      texPositions.push(
        // uv positions
        text.x, text.y,
        // scale
        text.width, text.height,
        // descriptor
        text.anchor
      )
    }
    // get the buffer
    const vertexBuffer = new Float32Array(vertices).buffer
    const texPositionBuffer = new Int16Array(texPositions).buffer
    // post
    postMessage({
      mapID,
      type: 'textdata',
      source,
      tileID,
      vertexBuffer,
      texPositionBuffer,
      imageBitmap
    }, [vertexBuffer, texPositionBuffer, imageBitmap])
  }

  _requestTexture (mapID: string, source: string, tileID: string, texts: Array<Text>) {
    console.log('REQUEST')
    // postMessage({ mapID, type: 'processText', source, tileID, texts })
  }
}

function featureSort (a: Text | Feature, b: Text | Feature): number {
  // layerID
  let diff = a.layerID - b.layerID
  let index = 0
  let maxSize = Math.min(a.code.length, b.code.length)
  while (diff === 0 && index < maxSize) {
    diff = a.code[index] - b.code[index]
    index++
  }
  return diff
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

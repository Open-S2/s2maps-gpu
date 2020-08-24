// @flow
import S2JsonVT from 's2json-vt'
import { S2Rtin, terrainToGrid } from 's2rtin'
import { VectorTile } from 's2-vector-tile'
import { parseLayers } from '../style/conditionals'
import {
  preprocessFill, postprocessFill,
  preprocessLine, postprocessLine,
  preprocessText, postprocessGlyph, GlyphBuilder,
  PNGReader
} from './process'
import requestData from '../util/fetch'
import { tileHash } from 's2projection'

import type { Face } from 's2projection'
import type { StylePackage } from '../styleSpec'
import type { Text } from './process'

const IS_CHROME = navigator.userAgent.indexOf('Chrome') !== -1

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
  geometry?: Array<Array<number>>,
  code: Array<number>,
  size: number,
  divisor: number,
  layerID: number
}

export type IDGen = { num: number, incrSize: number, maxNum: number, startNum: number }

// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 22bit: 4,194,304 --- 16bit: 65,535 --- 7bit: 128
export const ID_MAX_SIZE = 1 << 22
export const MAX_FEATURE_BATCH_SIZE = 1 << 7

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

export default class TileWorker {
  id: number
  maps: { [string]: StylePackage } = {} // mapID: StylePackage
  status: 'building' | 'ready' = 'ready'
  cache: { [string]: Array<TileRequest> } = {} // mapID: TileRequests
  cancelCache: Array<number> = []
  idGen: IDGen

  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'style') this._styleMessage(mapID, data.style, data.id, data.totalWorkers)
    else if (type === 'request') this._requestMessage(mapID, data.tiles)
    else if (type === 'status') postMessage({ type: 'status', status: this.status })
    else if (type === 'cancel') this._cancelTiles(mapID, data.tiles)
  }

  _styleMessage (mapID: string, style: StylePackage, id: number, totalWorkers: number) {
    // set id
    this.id = id
    // setup idGenerator
    if (!this.idGen) this.idGen = { num: id + 1, startNum: id + 1, incrSize: totalWorkers, maxNum: ID_MAX_SIZE }
    // set status
    this.status = 'building'
    // create a glyphBuilder for said map
    style.glyphBuilder = new GlyphBuilder()
    // store the style
    this.maps[mapID] = style
    // prep filter functions
    parseLayers(this.maps[mapID].layers, style.glType)
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
    if (this.status === 'building') {
      if (this.cache[mapID]) this.cache[mapID].push(...tiles)
      else this.cache[mapID] = tiles
    } else {
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
    const style = this.maps[mapID]
    // check all values are non-null
    if (!style.sources) style.sources = {}
    if (!style.fonts) style.fonts = {} // eventually have a default that always links to some cdn { default: '' }
    if (!style.billboards) style.billboards = {}
    // const { sources, fonts, billboards } = style
    const { sources, fonts } = style
    // build sources
    const promises = []
    for (const sourceName in sources) {
      let source = sources[sourceName]
      if (typeof source === 'string') {
        // if there is a filetype at the end, we parse it differently.
        const fileName = source
        const fileType = source.split('.').pop()

        promises.push(new Promise((resolve, reject) => {
          if (fileType === 's2json' || fileType === 'geojson' || fileType === 'json') { // s2json request
            requestData(fileName, fileType, (json) => {
              if (!json) reject(new Error(`Request failed: "${fileName}.${fileType}"`))
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
              if (!metadata) reject(new Error(`Request failed: "${fileName}/metadata"`))
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
    // build fonts
    for (const fontName in fonts) {
      promises.push(new Promise((resolve, _) => {
        requestData(fonts[fontName], 'pbf', font => {
          // build the font
          if (font) style.glyphBuilder.addFont(fontName, font)
          resolve()
        })
      }))
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
    // if we have cached tiles, we are now ready to build more
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
            if (data && !self.cancelCache.includes(hash)) self._processVectorData(mapID, sourceName, source, tile, new VectorTile(data))
            else self._getParentData(mapID, sourceName, source, tile) // incase we need to inject parent data
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
              if (data && !self.cancelCache.includes(hash)) self._processRasterData(mapID, sourceName, source, tile.hash, data, { leftShift, bottomShift })
            }, (typeof createImageBitmap !== 'function'))
          }
        }
      } else if (type === 'json') {
        if (s2json.faces.has(face)) {
          const data = s2json.getTile(face, zoom, x, y)
          if (data && !self.cancelCache.includes(hash)) self._processVectorData(mapID, sourceName, source, tile, data)
        }
      } else if (type === 'mask') {
        if (minzoom <= zoom && maxzoom >= zoom) { // check zoom bounds
          requestData(`${path}/${face}/${zoom}/${x}/${y}`, fileType, (data) => {
            if (data && !self.cancelCache.includes(hash)) self._processMaskData(mapID, sourceName, source, tile, fileType, data)
          }, (typeof OffscreenCanvas === "undefined"))
        }
      }
    }
    self._checkCache()
  }

  _processRasterData (mapID: string, sourceName: string, source: Object,
    tileID: number, data: ArrayBuffer | Blob, params?: Object) {
      const { leftShift, bottomShift } = params
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594
      let built = true
      const getImage = (IS_CHROME)
        ? createImageBitmap(data, { imageOrientation: 'flipY', premultiplyAlpha: 'premultiply' })
        : (typeof createImageBitmap === 'function')
          ? createImageBitmap(data)
          : new Promise((resolve) => { built = false; resolve(data) })
      getImage
        .then(image => postMessage({ mapID, type: 'rasterdata', built, source: sourceName, tileID, image, leftShift, bottomShift }, [image]))
        .catch(err => { console.log('ERROR', err )})
  }

  _processMaskData (mapID: string, sourceName: string, source: Object,
    tile: TileRequest, fileType: string, data: Object | ArrayBuffer | Blob) {
    const { hash, zoom, size } = tile
    // grab the RTIN object
    const { s2rtin } = source
    let buildMesh = function (dem) {
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
    }
    // create the terrain grid
    if (typeof OffscreenCanvas === "undefined") { // CPU solution
      const reader = new PNGReader(data)
      reader.parse((err, png) => {
        if (!err) {
          const imageData = { width: size, data: png.pixels }
          buildMesh(imageData)
        } else { console.log('parse error', err) }
      })
    } else { // GPU solution
      createImageBitmap(data)
        .then(image => {
          // build the canvas and draw the image
          const canvas = new OffscreenCanvas(size, size)
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0)
          // grab the data and send to mesh builder
          const imageData = context.getImageData(0, 0, size, size)
          buildMesh(imageData)
        })
        .catch(err => {})
    }
  }

  _processVectorData (mapID: string, sourceName: string, source: Object,
    tile: TileRequest, vectorTile: Object | ArrayBuffer | Blob) {
    // grab tiles basics
    const { face, zoom, x, y, division, hash } = tile

    // prep features
    let featureSet, code, featureCode
    const fillFeatures: Array<Feature> = []
    const lineFeatures: Array<Feature> = []
    const texts: Array<Text> = []
    const parentLayers: ParentLayers = {}
    const { layers, glType, glyphBuilder } = this.maps[mapID]
    const webgl1 = glType === 1
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
            code = []
            featureCode = null
            const feature = vectorTileLayer.feature(f)
            // get prelude properties
            const { properties, type } = feature
            // lastly we need to filter according to the layer
            if (layer.filter(properties)) {
              // create encodings for the feature, if it is different than the previous feature, we start a new encoding set
              for (const p in layer.paint) layer.paint[p](code, properties, zoom)
              for (const l in layer.layout) layer.layout[l](code, properties, zoom)
              // we can now process according to type
              let vertices = []
              let indices = []
              if (layer.type === 'fill' && (type === 3 || type === 4)) {
                preprocessFill(feature.loadGeometry(), type, vertices, indices, division, extent, (webgl1) ? layer.paint.color(null, properties, zoom) : null)
                if (webgl1) featureCode = (layer.paint.color(null, properties, zoom)).getRGB()
                if (!indices.length) continue
                featureSet = fillFeatures
              } else if (layer.type === 'fill3D' && (type === 7 || type === 8)) {
                continue
              } else if (layer.type === 'line' && (type === 2 || type === 3 || type === 4)) {
                // check that we are not exluding fills
                if (layer.onlyLines && type !== 2) continue
                preprocessLine(feature.loadGeometry(), type, false, vertices, division, extent)
                if (webgl1) featureCode = [
                  ...(layer.paint.color(null, properties, zoom)).getRGB(),
                  layer.paint.width(null, properties, zoom)
                ]
                featureSet = lineFeatures
              } else if (layer.type === 'line3D' && type === 9) {
                continue
              } else if (layer.type === 'text' && type === 1) {
                preprocessText(feature, code, zoom, layer, layerID, extent, texts, webgl1, this.idGen)
                continue
              } else if (layer.type === 'billboard' && type === 1) {
                continue
              } else { continue }
              if (vertices.length) featureSet.push({ type: layer.type, vertices, indices, code, layerID, featureCode })
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
      } // if (layer.source === sourceName)
    } // for (let layerID = 0, ll = layers.length; layerID < ll; layerID++) {
    // now post process data, this groups data for fewer draw calls
    // we seperate by type to make it seem like data is loading quicker, and to handle different vertex sizes
    if (fillFeatures.length) postprocessFill(mapID, `${sourceName}:fill`, hash, fillFeatures, postMessage)
    if (lineFeatures.length) postprocessLine(mapID, `${sourceName}:line`, hash, lineFeatures, postMessage)
    if (texts.length) postprocessGlyph(mapID, `${sourceName}:glyph`, hash, texts, glyphBuilder, this.id, postMessage)
    if (Object.keys(parentLayers).length) postMessage({ mapID, type: 'parentlayers', tileID: hash, parentLayers })
  }

  _getParentData (mapID: string, sourceName: string, source: Object,
    tile: TileRequest) {
    // pull out data
    const { layers } = this.maps[mapID]
    const { face, zoom, x, y, hash } = tile
    // setup parentLayers
    const parentLayers: ParentLayers = {}
    // iterate over layers and found any data doesn't exist at current zoom but the style asks for
    for (let layerID = 0, ll = layers.length; layerID < ll; layerID++) {
      const layer = layers[layerID].layer
      if (source.layers && source.layers[layer] && source.layers[layer].maxzoom < zoom) {
        // we have passed the limit at which this data is stored. Rather than
        // processing the data more than once, we reference where to look for the layer
        const layerMaxZoom = source.layers[layer].maxzoom
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
    // if we stored any parent layers, ship it out
    if (Object.keys(parentLayers).length) postMessage({ mapID, type: 'parentlayers', tileID: hash, parentLayers })
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

// @flow
import { VectorTile } from 's2-vector-tile'
import { S2Point } from 's2projection'
import { parseFilter, parseConditionEncode } from '../style/conditionals'
import { processFill } from './process'
import requestData from '../util/xmlHttpRequest'

import type { Face } from 'S2Projection'
import type { StylePackage } from '../style'

type Point = [number, number]

export type TileRequest = {
  hash: string,
  face: Face,
  zoom: number,
  x: number,
  y: number,
  center: [number, number, number],
  bbox: [number, number, number, number],
  division: number,
  extent: number
}

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
//    [layerID, count, offset, size, ..., layerID, count, offset, size, ..., etc.]: [3, 0, 3, 102, 3, 0, 1, 3, 3, 66, 102]. The resultant to send is:
//    In a future update, the size parameter will matter when we add dataRangeFunctions and dataConditionFunctions
//    size does not include layerID, count, or offset. So for instance, if we have no dataFunctions, size is 0
//    postMessage({ mapID, layerGuide, vertexBuffer, indexBuffer }, [vertexBuffer, indexBuffer])

// one thing to note: If all source, font, billboard data has not yet been downloaded, but we are already processing tiles,
// after every update of
export default class TileWorker {
  maps: { [string]: StylePackage } = {} // mapID: StylePackage
  status: 'building' | 'busy' | 'ready' = 'ready'
  cache: { [string]: Array<TileRequest> } = {} // mapID: TileRequests
  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'style') this._styleMessage(mapID, data.style)
    else if (type === 'request') this._requestMessage(mapID, data.tiles)
    else if (type === 'status') postMessage({ type: 'status', status: this.status })
  }

  _styleMessage (mapID: string, style: StylePackage) {
    // set status
    this.status = 'building'
    // store the style
    this.maps[mapID] = style
    // prep filter functions
    this.parseLayers(mapID)
    // prep request system
    this.buildSources(mapID)
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

  // prep functions that take feature.properties as an input
  parseLayers (mapID: string) {
    const { layers } = this.maps[mapID]
    for (const layer of layers) {
      layer.filter = parseFilter(layer.filter)
      for (const l in layer.layout) {
        layer.layout[l] = parseConditionEncode(layer.layout[l])
      }
      for (const p in layer.paint) {
        layer.paint[p] = parseConditionEncode(layer.paint[p])
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
    if (!self._isDoneBuilding(style)) {
      for (const source in sources) {
        if (typeof sources[source] === 'string') {
          requestData(`${sources[source]}/metadata`, 'json', (metadata) => {
            // build & add proper path to metadata if it does not exist
            if (!metadata.path) metadata.path = sources[source]
            // update source to said metadata
            sources[source] = metadata
            // check if all metadata is downloaded, if so, update status and improve
            self.buildSources(mapID)
          })
        }
      }
      // TODO: get and replace fonts strings with font-gl class objects

      // TODO: get and replace billboard strings with svg-gl class objects
    } else {
      this.status = 'ready'
      // if we have a cache, we are now ready to find data
      const firstCache = Object.keys(this.cache)[0]
      if (firstCache) {
        // pull out the requests and delete the reference
        const tileRequest = this.cache[firstCache]
        delete this.cache[firstCache]
        this._requestMessage(firstCache, tileRequest)
      }
    }
  }

  _isDoneBuilding (style: mapStyles) {
    const { sources, fonts, billboards } = style
    return !Object.values(sources).some(s => typeof s === 'string') &&
    !Object.values(fonts).some(s => typeof s === 'string') &&
    !Object.values(billboards).some(s => typeof s === 'string')
  }

  async requestTiles (mapID: string, sourceName: string, source: Object, tiles: Array<TileRequest>) { // tile: [face, zoom, x, y]
    const self = this
    for (const tile of tiles) {
      const { face, zoom, x, y } = tile
      if (
        source.minzoom <= zoom && source.maxzoom >= zoom && // check zoom bounds
        source.facesbounds[face] && // check face exists
        source.facesbounds[face][zoom] && // check zoom exists
        source.facesbounds[face][zoom][0] <= x && source.facesbounds[face][zoom][2] >= x && // check x is within bounds
        source.facesbounds[face][zoom][1] <= y && source.facesbounds[face][zoom][3] >= y // check y is within bounds
      ) {
        requestData(`${source.path}/${face}/${zoom}/${x}/${y}`, source.extension, (data) => {
          if (data) self._processTileData(mapID, sourceName, source, tile, data)
        })
      }
    }
    this.status = 'ready'
  }

  _processTileData (mapID: string, sourceName: string, source: Object, tile: TileRequest, data: ArrayBuffer | Blob) {
    // Check the source metadata. If it's a vector run through all
    // layers and process accordingly. If image, no pre-processing needed.
    // TODO: types may differ between vector or raster
    const { type } = source
    if (type === 'vector') {
      const vertices: Array<number> = []
      const indices: Array<number> = []
      const layerGuide: Array<number> = []
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
          // run through the vectorTile's features of said layers layer
          const vectorTileLayer = vectorTile.layers[layer.layer]
          for (let f = 0; f < vectorTileLayer.length; f++) {
            const feature = vectorTileLayer.feature(f)
            const { properties, type } = feature
            // lastly we need to filter according to the layer
            if (layer.filter(properties)) {
              // now we definitively are creating triangles, so store layerGuide's layer ID, and current indices length
              layerGuide.push(i)
              // we can now process according to type
              if (layer.type === 'fill' && (type === 3 || type === 4)) {
                processFill(feature.loadGeometry(), type, tile, vertices, indices)
              }
              // store layerGuides index count and offset
              layerGuide.push(indices.length - indicesOffset, indicesOffset) // layerID, count, offset
              // update offset
              indicesOffset = indices.length
              // create a mapping of layer and paint properties and than store
              const encodings = []
              for (const l in layer.layout) layer.layout[l](properties, encodings)
              for (const p in layer.paint) layer.paint[p](properties, encodings)
              layerGuide.push(encodings.length, ...encodings)
            }
          }
        }
      }
      // Upon processing the data, encode vertices, indices, and .
      const vertexBuffer = new Float32Array(vertices).buffer
      const indexBuffer = new Uint32Array(indices).buffer
      const layerGuideBuffer = new Uint32Array(layerGuide).buffer
      // Upon encoding, send back to GlobalWorkerPool.
      postMessage({ mapID, type: 'data', source: sourceName, tileID: tile.hash, vertexBuffer, indexBuffer, layerGuideBuffer }, [vertexBuffer, indexBuffer, layerGuideBuffer])
    }
  }
}

// create the tileworker
const tileWorker = new TileWorker()
// bind the onmessage function
onmessage = tileWorker.onMessage.bind(tileWorker)

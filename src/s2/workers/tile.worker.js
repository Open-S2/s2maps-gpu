// @flow
import { VectorTile } from 's2-vector-tile'
import filterFunction from '../style/conditionals/filterFunction'
import requestData from '../util/xmlHttpRequest'

import type { Face } from 'S2Projection'
import type { StylePackage } from '../style'

type mapStyles = {
  [string]: StylePackage // mapID: StylePackage
}

export type TileRequest = {
  face: Face,
  zoom: number,
  x: number,
  y: number,
  center: [number, number, number, number],
  bbox: [number, number, number, number]
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
//    of each pair for deserializing. For instance, if the layers looks like: [{ source: 1 }, { source: 2}, { source: 1} ]
//    and the source 1 has finished downloading first, we serialize the first part, and add the index sets:
//    [layerID, count, offset, layerID, count, offset]: [0, 102, 0, 1, 66, 102]. The resultant to send is:
//    sendMessage({ mapID, layerGuide, vertexBuffer, indexBuffer }, [vertexBuffer, indexBuffer])

// one thing to note: If all source, font, billboard data has not yet been downloaded, but we are already processing tiles,
// after every update of
export default class TileWorker {
  maps: mapStyles = {}
  status: 'building' | 'busy' | 'ready' = 'ready'
  tileQueue: Array<[number, number, number, number]> = [] // [face, zoom, x, y]
  onMessage (e: Event) {
    const { mapID, type } = e.data
    if (type === 'style') this._styleMessage(e.data.style)
    else if (type === 'request') this._requestMessage(e.data.tiles)
    else if (type === 'status') sendMessage({ type: 'status', status: this.status })
  }

  _styleMessage (style) {
    // set status
    this.status = 'building'
    // grab style
    let { style } = e.data
    // store the style
    this.maps[mapID] = style
    // prep filter functions
    this.parseFilters(mapID)
    // prep request system
    this.buildSources(mapID)
  }

  _requestMessage (tiles: TileRequest) {
    // set status
    this.status = 'busy'
    // grab tiles info and center
    const { tiles } = e.data
    // make the requests for each source
    const sources = this.maps[mapID].sources
    for (const sourceName in sources) {
      const source = sources[sourceName]
      this.requestTiles(mapID, sourceName, source, tiles)
    }
  }

  // prep functions that take feature.properties as an input
  parseFilters (mapID: string) {
    const style = this.maps[mapID]
    for (const layer of style.layers) {
      layer.filter = filterFunction(layer.filter)
    }
  }

  // grab the metadata from each source, grab necessary fonts / billboards
  // this may seem wasteful that each worker has to do this, but these assets are cached, so it will be fast.
  async buildSources (mapID: string) {
    const self = this
    const style = self.maps[mapID]
    const { sources, fonts, billboards } = style
    if (!self._isDoneBuilding) {
      for (const source in sources) {
        if (typeof sources[source] === 'string') {
          requestData(sources[source], (metadata) => {
            // build & add proper path to metadata if it does not exist
            if (!metadata.path) metadata.path = source
            // update source to said metadata
            sources[source] = metadata
            // check if all metadata is downloaded, if so, update status and improve
            self._isDoneBuilding()
          })
        }
      }
      // TODO: get and replace fonts strings with font-gl class objects

      // TODO: get and replace billboard strings with svg-gl class objects
    }
  }

  _isDoneBuilding () {
    const { sources, fonts, billboards } = style
    if (
      !Object.values(sources).some(s => typeof s === 'string') &&
      !Object.values(fonts).some(s => typeof s === 'string') &&
      !Object.values(billboards).some(s => typeof s === 'string')
    ) {
      self.status = 'ready'
      sendMessage({ type: 'status', status: self.status })
    }
  }

  async requestTiles (mapID: string, sourceName: string, source: Object, tiles: Array<TileRequest>) { // tile: [face, zoom, x, y]
    const self = this
    for (tile of tiles) {
      const { face, zoom, x, y } = tile
      if (
        source.minzoom <= zoom && source.maxzoom >= zoom && // check zoom bounds
        source.faces.includes(face) // check face exists in source tiles
        source.facesbounds[face].minX <= x && source.facesbounds[face].maxX >= x && // check x bounds
        source.facesbounds[face].minY <= y && source.facesbounds[face].maxY >= y // check y bounds
      ) {
        requestData(`${source.path}/${face}/${zoom}/${x}/${y}.${source.extension}`, (data) => {
          self._processTileData(mapID, sourceName, source, tile, data)
        })
      }
    }
  }

  _processTileData (mapID: string, sourceName: string, source: Object, tile: TileRequest, data: ArrayBuffer | Blob) {
    // Check the source metadata. If it's a vector run through all
    // layers and process accordingly. If image, no pre-processing needed.
    // TODO: types may differ between vector or raster
    const { type } = source
    if (type === 'vector') {
      const vertices = []
      const indices = []
      const layerGuide = []
      const vectorTile = new VectorTile(data)
      for (const layer of source.layers) {
        if (
          layer.source === sourceName && // the layer source matches
          vectorTile.layers[layer.layer] && // the vectorTile has said layer in it
          layer.minzoom <= tile.zoom && layer.maxzoom >= tile.zoom // zoom attributes fit
        ) {
          processVectorFeatures(vectorTile, layer, tile, vertices, indices, layerGuide)
        }
      }
    }
    // Upon processing the data, encode vertices, indices, and .
    const vertexBuffer = new Float32Array(vertices).buffer
    const indexBuffer = new Uint32Array(indices).buffer
    const layerGuideBuffer = new Uint32Array(layerGuide).buffer
    // Upon encoding, send back to GlobalWorkerPool.
    sendMessage({ mapID, vertexBuffer, indexBuffer, layerGuideBuffer }, [vertexBuffer, indexBuffer, layerGuideBuffer])
  }
}

const tileWorker = new TileWorker()

onmessage = tileWorker.onMessage.bind(tileWorker)

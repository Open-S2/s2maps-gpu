// @flow

import type { TileRequest } from '../workerPool'
import type { Face } from 's2projection'

type LayerMetaData = {
  [string]: { // layer
    minzoom: number,
    maxzoom: number,
    fields?: { [string]: Array<string | number | boolean> } // max fields size of 50
  }
}

type FaceBounds = {
  [number | string]: { // face
    [number | string]: [number, number, number, number] // zoom: [minX, minY, maxX, maxY]
  }
}

type Metadata = {
  minzoom: number,
  maxzoom: number,
  faces: Set<Face>,
  facesbounds: FaceBounds,
  layers: LayerMetaData
}

export default class Source {
  name: string
  path: string
  type: 'vector' | 'raster' | 'rasterDEM' // how to process the result
  extension: string
  encoding: 'none' | 'br' | 'gzip'
  styleLayers: Array<Layer>
  layers: LayerMetaData
  active: boolean = true
  minzoom: number = 0
  maxzoom: number = 20
  faces: Set<Face>
  facesbounds: FaceBounds
  constructor (name: string, layers: Array<Layer>, path?: string) {
    this.name = name
    this.styleLayers = layers
    this.path = path
  }

  // if this function runs, we assume default tile source
  async _build () {
    const self = this
    const metadata = await this._fetch(`${this.path}/metadata.json`, 'json')
    if (!metadata) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} metadata`)
    } else { self._buildMetadata(metadata) }
  }

  _buildMetadata (metadata: Metadata) {
    this.active = true // incase we use a "broken" aproach for metadata and insert later
    if (metadata.minzoom) this.minzoom = metadata.minzoom
    if (metadata.maxzoom) this.maxzoom = Math.min(metadata.maxzoom, this.maxzoom)
    if (metadata.faces) this.faces = new Set(metadata.faces)
    if (metadata.facesbounds) this.facesbounds = metadata.facesbounds
    if (metadata.extension) this.extension = metadata.extension
    else this.active = false // we cannot process if we do not know the extension
    if (metadata.encoding) this.encoding = metadata.encoding
    if (metadata.layers) { // cleanup the fields property
      const { layers } = metadata
      for (const layer of Object.values(layers)) delete layer.fields
      this.layers = layers
    }
  }

  // all tile requests undergo a basic check on whether that data exists within the metadata boundaries
  async tileRequest (mapID: string, tile: TileRequest, worker: Worker, token: string) {
    const { active, minzoom, maxzoom, faces, facesbounds, sessionToken, type } = this
    const { hash, face, zoom, x, y } = tile
    if ( // massive quality check to not over burden servers / lambdas with duds
      active && // we have the correct properties to make proper requests
      minzoom <= zoom && maxzoom >= zoom && // check zoom bounds
      (!faces || faces.has(face)) && // check the face exists
      ( // check facesbounds usins the face, zoom, and x-y boundaries for validation
        !facesbounds ||
        (
          facesbounds[face] && // check face exists
          facesbounds[face][zoom] && // check zoom exists
          facesbounds[face][zoom][0] <= x && facesbounds[face][zoom][2] >= x && // check x is within bounds
          facesbounds[face][zoom][1] <= y && facesbounds[face][zoom][3] >= y // check y is within bounds
        )
      )
    ) {
      return this._tileRequest(mapID, tile, worker, false, token)
    }
  }

  // if this function runs, we assume default tile source.
  // in the default case, we want the worker to process the data
  async _tileRequest (mapID: string, tile: TileRequest, worker: Worker,
    parent: boolean, token: string) {
    const { name, path } = this
    const { face, zoom, x, y } = tile

    const data = await this._fetch(`${path}/${face}/${zoom}/${x}/${y}.${this.extension}`, this.extension)
    const type = (this.extension.includes('pbf')) ? 'pbfdata' : 'rasterdata'
    if (data) worker.postMessage({ mapID, type, tile, sourceName: name, parent, data }, [data])
  }

  async _fetch (path: string, ext: string) {
    const res = await fetch(path)
    if (res.status !== 200 && res.status !== 206) return null
    if (ext.includes('pbf')) return res.arrayBuffer()
    else if (ext === 'json') return res.json()
    else return res.blob()
  }
}

// _getParentData (mapID: string, sourceName: string, source: Object,
//   tile: TileRequest, layers) {
//   // pull out data
//   const { face, zoom, x, y } = tile
//   // setup parentLayers
//   const parentLayers: ParentLayers = {}
//   // iterate over layers and found any data doesn't exist at current zoom but the style asks for
//   for (let layerIndex = 0, ll = layers.length; layerIndex < ll; layerIndex++) {
//     const layer = layers[layerIndex]
//     const layerSource = layer.layer
//     if (layer.maxzoom > zoom && source.layers && source.layers[layerSource] && source.layers[layerSource].maxzoom < zoom) {
//       // we have passed the limit at which this data is stored. Rather than
//       // processing the data more than once, we reference where to look for the layer
//       const layerMaxZoom = source.layers[layerSource].maxzoom
//       let pZoom = zoom
//       let pX = x
//       let pY = y
//       while (pZoom > layerMaxZoom) {
//         pZoom--
//         pX = pX >> 1
//         pY = pY >> 1
//       }
//       const hash = tileHash(face, pZoom, pX, pY)
//       // store parent reference
//       if (!parentLayers[hash]) parentLayers[hash] = { face, zoom: pZoom, x: pX, y: pY, layers: [] }
//       parentLayers[hash].layers.push(layerIndex)
//     }
//   }
//   // if we stored any parent layers, ship it out
//   if (Object.keys(parentLayers).length) this._requestParentData(mapID, sourceName, source, tile, parentLayers)
// }
//
// // now that we know what the tile was missing, let's make the requests with the layer filters
// _requestParentData (mapID: string, sourceName: string, source: Object,
//   tile: TileRequest, parentLayers: ParentLayers) {
//   const self = this
//   const { path, extension } = source
//   let count = 0
//   for (const hash in parentLayers) {
//     const parent = parentLayers[hash]
//     const { face, zoom, x, y, layers } = parent
//     if (layers.length) {
//       // eslint-disable-next-line
//       fetch(`${path}/${face}/${zoom}/${x}/${y}`, extension, data => {
//         if (data) self._processVectorData(mapID, `${sourceName}:parent:${++count}`, source, tile, new VectorTile(data), parent)
//       })
//     }
//   }
// }

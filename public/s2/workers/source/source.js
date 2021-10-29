// @flow
/* eslint-env worker */
import { tileHash } from 's2projection'

import type { Session } from './'
import type { TileRequest } from '../workerPool'
import type { Face, Layer } from '../../style/styleSpec'

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

export type ParentLayer = {
  face: Face,
  zoom: number,
  x: number,
  y: number,
  layers: Array<number>
}

export type ParentLayers = {
  [string | number]: ParentLayer
}

export default class Source {
  ready: boolean = false
  active: boolean = true
  name: string
  path: string
  type: 'vector' | 'raster' | 'rasterDEM' | 'rasterData' = 'vector' // how to process the result
  extension: string
  encoding: 'none' | 'br' | 'gz'
  attributions: { [string]: string } = {}
  styleLayers: Array<Layer>
  layers: LayerMetaData
  minzoom: number = 0
  maxzoom: number = 20
  faces: Set<Face>
  facesbounds: FaceBounds
  needsToken: boolean = false
  session: Session
  requestCache: Array<[string, TileRequest]> = [] // each element in array -> [mapID, TileRequest]
  constructor (name: string, layers: Array<Layer>, path?: string, needsToken: boolean, session: Session) {
    this.name = name
    this.styleLayers = layers
    this.path = path
    this.needsToken = needsToken
    this.session = session
  }

  // if this function runs, we assume default tile source
  async build (mapID) {
    const self = this
    const metadata = await this._fetch(`${this.path}/metadata.json`, mapID, true)
    if (!metadata) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} metadata`)
    } else { self._buildMetadata(metadata, mapID) }
  }

  _buildMetadata (metadata: Metadata, mapID: string) {
    this.active = true // incase we use a "broken" aproach for metadata and insert later
    if (metadata.minzoom) this.minzoom = metadata.minzoom
    if (metadata.maxzoom) this.maxzoom = Math.min(metadata.maxzoom, this.maxzoom)
    if (metadata.faces) this.faces = new Set(metadata.faces)
    if (metadata.facesbounds) this.facesbounds = metadata.facesbounds
    if (metadata.extension) this.extension = metadata.extension
    if (metadata.attributions) this.attributions = metadata.attributions
    if (metadata.type) this.type = metadata.type
    else this.active = false // we cannot process if we do not know the extension
    if (metadata.encoding) this.encoding = metadata.encoding
    if (metadata.layers) { // cleanup the fields property
      const { layers } = metadata
      for (const layer of Object.values(layers)) delete layer.fields
      this.layers = layers
    }
    // once the metadata is complete, we should check if any tiles were queued
    this.ready = true
    this._checkCache()
    // if attributions, we send them off
    const attributions = {}
    for (const [name, link] of Object.entries(this.attributions)) attributions[name] = link
    if (Object.keys(attributions).length) postMessage({ mapID, type: 'attributions', attributions })
  }

  _checkCache () {
    while (this.requestCache.length) {
      const [mapID, tile] = this.requestCache.pop()
      this.tileRequest(mapID, tile)
    }
  }

  // all tile requests undergo a basic check on whether that data exists within the metadata boundaries
  tileRequest (mapID: string, tile: TileRequest) {
    // if the source isn't ready yet, we store in cache
    if (!this.ready) {
      this.requestCache.push([mapID, tile])
      return
    }
    // pull out data, check if data exists in bounds, then request
    const { active, minzoom, maxzoom, faces, facesbounds, name } = this
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
      this._tileRequest(mapID, tile, name, false)
    } else { this._flush(mapID, hash, name) }
    // now make requests for parent data as necessary
    this._getParentData(mapID, tile)
  }

  _getParentData (mapID: string, tile: TileRequest) {
    const { layers, styleLayers, name } = this
    // pull out data
    const { face, zoom, x, y } = tile
    // setup parentLayers
    const parentLayers: ParentLayers = {}
    // iterate over layers and found any data doesn't exist at current zoom but the style asks for
    for (let i = 0, ll = styleLayers.length; i < ll; i++) {
      const layer = styleLayers[i]
      if (!layers) continue
      const sourceLayer = layers[layer.layer]
      if (layer.maxzoom > zoom && sourceLayer && sourceLayer.maxzoom < zoom) {
        // we have passed the limit at which this data is stored. Rather than
        // processing the data more than once, we reference where to look for the layer
        const sourceLayerMaxZoom = sourceLayer.maxzoom
        let pZoom = zoom
        let pX = x
        let pY = y
        while (pZoom > sourceLayerMaxZoom) {
          pZoom--
          pX = pX >> 1
          pY = pY >> 1
        }
        const hash = tileHash(face, pZoom, pX, pY)
        // store parent reference
        if (!parentLayers[hash]) parentLayers[hash] = { face, hash, zoom: pZoom, x: pX, y: pY, layers: [] }
        parentLayers[hash].layers.push(layer.layerIndex)
      }
    }
    // if we stored any parent layers, make the necessary requests
    if (Object.keys(parentLayers).length) {
      for (const [hash, parent] of Object.entries(parentLayers)) {
        this._tileRequest(mapID, tile, `${name}:${hash}`, parent)
      }
    }
  }

  // if this function runs, we assume default tile source.
  // in the default case, we want the worker to process the data
  async _tileRequest (mapID: string, tile: TileRequest,
    sourceName: string, parent: boolean | ParentLayer) {
    const { path, session } = this
    const { face, zoom, x, y, hash } = parent || tile

    const data = await this._fetch(`${path}/${face}/${zoom}/${x}/${y}.${this.extension}`, mapID, false)
    const type = (this.extension.includes('pbf')) ? 'pbfdata' : 'rasterdata'
    if (data) {
      const worker = session.requestWorker()
      worker.postMessage({ mapID, type, tile, sourceName, parent, data }, [data])
    } else { this._flush(mapID, hash, sourceName) }
  }

  _flush (mapID, tileID, source) {
    postMessage({
      mapID,
      tileID,
      source,
      type: 'flush',
      fill: false,
      line: false,
      point: false,
      heatmap: false,
      glyph: false
    })
  }

  async _fetch (path: string, mapID: string, json?: boolean = false) {
    const headers = {}
    const Authorization = await this.session.requestSessionToken(mapID)
    if (this.needsToken && Authorization) headers.Authorization = Authorization
    const res = await fetch(path, { headers })
    if (res.status !== 200 && res.status !== 206) return null
    if (!json) return res.arrayBuffer()
    else return res.json()
  }
}

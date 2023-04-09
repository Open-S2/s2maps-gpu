/* eslint-env worker */
import { parent as parentID, toIJ } from 's2/projections/s2/s2CellID'

import type { Session } from '.'
import type { ParentLayers, TileRequest } from '../worker.spec'
import type { Format, Attributions, LayerDefinition } from 's2/style/style.spec'

export interface LayerMetaData {
  [key: string]: { // layer
    minzoom: number
    maxzoom: number
    fields?: { [key: string]: Array<string | number | boolean> } // max fields size of 50
  }
}

export interface FaceBounds {
  [key: number]: { // face
    [key: number]: [number, number, number, number] // zoom: [minX, minY, maxX, maxY]
  }
}

export interface Metadata {
  type: 'vector' | 'json' | 'raster' | 'raster-dem' | 'sensor'
  extension: string
  fileType?: 'json' | 's2json' | 'pbf' | 'png' | 'jpg' | 'webp'
  encoding?: 'gz' | 'br' | 'none'
  size?: number
  format?: Format
  attributions?: Attributions
  interval?: number
  minzoom?: number
  maxzoom?: number
  faces?: number[]
  layers?: LayerMetaData
}

export default class Source {
  ready = false
  active = true
  name: string
  path: string
  type: 'vector' | 'json' | 'raster' | 'raster-dem' | 'sensor' = 'vector' // how to process the result
  extension = 'pbf'
  encoding: 'none' | 'br' | 'gz' = 'none'
  isTimeFormat = false
  attributions: Attributions = {}
  styleLayers: LayerDefinition[]
  layers?: LayerMetaData
  minzoom = 0
  maxzoom = 20
  size = 512 // used for raster type sources
  faces: Set<number> = new Set()
  needsToken: boolean
  time?: number
  session: Session
  requestCache: Array<[string, TileRequest]> = [] // each element in array -> [mapID, TileRequest]
  textEncoder: TextEncoder = new TextEncoder()
  constructor (
    name: string,
    layers: LayerDefinition[],
    path: string,
    needsToken = false,
    session: Session
  ) {
    this.name = name
    this.styleLayers = layers
    this.path = path
    this.needsToken = needsToken
    this.session = session
  }

  // if this function runs, we assume default tile source
  async build (mapID: string, metadata?: Metadata): Promise<void> {
    if (metadata === undefined) metadata = await this._fetch(`${this.path}/metadata.json`, mapID, true) as Metadata
    if (metadata === undefined) {
      this.active = false
      console.log(`FAILED TO extrapolate ${this.path} metadata`)
    } else { this._buildMetadata(metadata, mapID) }
  }

  _buildMetadata (metadata: Metadata, mapID: string): void {
    this.active = true // incase we use a "broken" aproach for metadata and insert later
    this.minzoom = metadata.minzoom ?? 0
    this.maxzoom = Math.min(metadata.maxzoom ?? 20, this.maxzoom)
    if (Array.isArray(metadata.faces)) this.faces = new Set(metadata.faces ?? [0, 1, 2, 3, 4, 5])
    if (typeof metadata.extension === 'string') this.extension = metadata.extension
    this.attributions = metadata.attributions ?? {}
    if (metadata.type === undefined) { this.active = false; console.log('Failed to acquire "type" from metadata') } // we cannot process if we do not know the extension
    this.type = metadata.type
    if (typeof metadata.size === 'number') this.size = metadata.size
    this.encoding = metadata.encoding ?? 'none'
    if (typeof metadata.layers === 'object') { // cleanup the fields property
      for (const value of Object.values(metadata.layers)) delete value.fields
      this.layers = metadata.layers
    }
    // time series data check
    if (metadata.format !== undefined) this.isTimeFormat = metadata.format === 'tfzxy'
    if (this.isTimeFormat) {
      postMessage({
        mapID,
        type: 'timesource',
        sourceName: this.name,
        interval: metadata.interval
      })
    }
    // once the metadata is complete, we should check if any tiles were queued
    this.ready = true
    this.#checkCache()
    // if attributions, we send them off
    const attributions = { ...this.attributions }
    if (Object.keys(attributions).length > 0) postMessage({ mapID, type: 'attributions', attributions })
  }

  #checkCache (): void {
    while (this.requestCache.length > 0) {
      const request = this.requestCache.pop()
      if (request !== undefined) this.tileRequest(...request)
    }
  }

  // all tile requests undergo a basic check on whether that data exists
  // within the metadata boundaries. layerIndexes exists to set a boundary
  // of what layers the map is interested in (caused by style change add/edit layer)
  tileRequest (mapID: string, tile: TileRequest): void {
    // if the source isn't ready yet, we store in cache
    if (!this.ready) {
      this.requestCache.push([mapID, tile])
      return
    }
    // inject layerIndexes
    this.#getLayerIndexes(tile)
    // now make requests for parent data as necessary
    this.#getParentData(mapID, tile)
    // pull out data, check if data exists in bounds, then request
    const { active, minzoom, maxzoom, faces, name } = this
    const { face, zoom } = tile
    if ( // massive quality check to not over burden servers / lambdas with duds
      active && // we have the correct properties to make proper requests
      minzoom <= zoom && maxzoom >= zoom && // check zoom bounds
      (faces.has(face)) // check the face exists
    ) {
      // request
      void this._tileRequest(mapID, tile, name)
    } else {
      // flush to let tile know what layers should be cleaned
      this._flush(mapID, tile, name)
    }
  }

  #getLayerIndexes (tile: TileRequest): void {
    const { layers, styleLayers } = this
    const { zoom } = tile
    if (layers === undefined) return
    const layerIndexes = []

    for (let l = 0, ll = styleLayers.length; l < ll; l++) {
      const layer = styleLayers[l]
      if (layer === undefined || layers[layer.layer] === undefined) continue
      const { minzoom, maxzoom } = layers[layer.layer]
      if (minzoom <= zoom && maxzoom >= zoom) layerIndexes.push(layer.layerIndex)
    }

    tile.layerIndexes = layerIndexes
  }

  #getParentData (mapID: string, tile: TileRequest): void {
    const { layers, styleLayers, name } = this
    if (layers === undefined) return
    // pull out data
    const { time, face, zoom, id } = tile
    // setup parentLayers
    const parentLayers: ParentLayers = {}
    // iterate over layers and found any data doesn't exist at current zoom but the style asks for
    for (let l = 0, ll = styleLayers.length; l < ll; l++) {
      const { layer, layerIndex, maxzoom } = styleLayers[l]
      const sourceLayer = layers[layer]
      const sourceLayerMaxZoom = sourceLayer?.maxzoom
      if (
        maxzoom > zoom &&
        sourceLayer !== undefined &&
        sourceLayerMaxZoom < zoom
      ) {
        // we have passed the limit at which this data is stored. Rather than
        // processing the data more than once, we reference where to look for the layer
        let pZoom = zoom
        let newID = id
        while (pZoom > sourceLayerMaxZoom) {
          pZoom--
          newID = parentID(newID)
        }
        const newIDString = newID.toString()
        // pull out i & j
        const [, i, j] = toIJ(newID, pZoom)
        // store parent reference
        if (parentLayers[newIDString] === undefined) {
          parentLayers[newIDString] = { time, face, id: newID, zoom: pZoom, i, j, layerIndexes: [] }
        }
        parentLayers[newIDString].layerIndexes.push(layerIndex)
        // filter out the index from the tile
        tile.layerIndexes?.filter(index => index !== layerIndex)
      }
    }
    // if we stored any parent layers, make the necessary requests
    for (const parent of Object.values(parentLayers)) {
      void this._tileRequest(mapID, { ...tile, parent }, name)
    }
  }

  // if this function runs, we assume default tile source.
  // in the default case, we want the worker to process the data
  async _tileRequest (mapID: string, tile: TileRequest, sourceName: string): Promise<void> {
    const { path, session, type, extension, size } = this
    const { parent } = tile
    const { time, face, zoom, i, j } = parent ?? tile
    const location = `${(time !== undefined) ? String(time) + '/' : ''}` +
      `${face as number}/${zoom}/${i}/${j}.${extension}`

    const data = await this._fetch(`${path}/${location}`, mapID) as ArrayBuffer
    if (data !== undefined) {
      const worker = session.requestWorker()
      worker.postMessage({ mapID, type, tile, sourceName, data, size }, [data])
    } else { this._flush(mapID, tile, sourceName) }
  }

  // If no data, we still have to let the tile worker know so it can prepare a proper flush
  // as well as manage cases like "invert" type data.
  _flush (mapID: string, tile: TileRequest, sourceName: string): void {
    const { textEncoder, session } = this
    // compress
    const data = textEncoder.encode('{"layers":{}}').buffer
    // send off
    const worker = session.requestWorker()
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName, data }, [data])
  }

  async _fetch (path: string, mapID: string, json = false): Promise<ArrayBuffer | Metadata | undefined> {
    const headers: { Authorization?: string } = {}
    if (this.needsToken) {
      const Authorization = await this.session.requestSessionToken(mapID)
      if (Authorization === 'failed') return
      if (Authorization !== undefined) headers.Authorization = Authorization
    }
    const res = await fetch(path, { headers })
    if (res.status !== 200 && res.status !== 206) return
    if (json || (res.headers.get('content-type') ?? '').includes('application/json')) return await res.json() as Metadata
    return await res.arrayBuffer()
  }
}

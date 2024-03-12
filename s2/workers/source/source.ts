import { parent as parentID, toIJ } from 'geometry/id'

import type { Session } from '.'
import type { ParentLayers, TileRequest } from '../worker.spec'
import type { Attributions, Format, LayerDefinition, Projection, SourceMetadata, SourceType, VectorLayer } from 'style/style.spec'

export interface LayerMeta { // layer
  minzoom: number
  maxzoom: number
  fields?: Record<string, Array<string | number | boolean>> // max fields size of 50
}
export type LayerMetaData = Record<string, LayerMeta>

// export type FaceBounds = Record<number, Record<number, [number, number, number, number]>>

export interface Metadata extends Omit<SourceMetadata, 'path'> {}

export default class Source {
  active = true
  resolve: (value: void | PromiseLike<void>) => void = () => {}
  ready = new Promise<void>(resolve => { this.resolve = resolve })
  name: string
  path: string
  type: SourceType = 'vector' // how to process the result
  extension = 'pbf'
  encoding: 'none' | 'br' | 'gz' = 'none'
  format: Format = 'zxy'
  isTimeFormat = false
  attributions: Attributions = {}
  styleLayers: LayerDefinition[]
  layers?: LayerMetaData
  minzoom = 0
  maxzoom = 20
  size = 512 // used for raster type sources
  faces = new Set<number>()
  needsToken: boolean
  time?: number
  session: Session
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
  async build (mapID: string, metadata?: SourceMetadata): Promise<void> {
    if (metadata === undefined) metadata = await this._fetch(`${this.path}/metadata.json`, mapID, true) as SourceMetadata
    if (metadata === undefined) {
      this.active = false
      console.error(`FAILED TO extrapolate ${this.path} metadata`)
    } else { this._buildMetadata(metadata, mapID) }
  }

  _buildMetadata (metadata: Metadata, mapID: string): void {
    this.active = true // incase we use a "broken" aproach for metadata and insert later
    this.minzoom = Number(metadata.minzoom) ?? 0
    this.maxzoom = Math.min(Number(metadata.maxzoom) ?? 20, this.maxzoom)
    if (Array.isArray(metadata.faces)) this.faces = new Set(metadata.faces ?? [0, 1, 2, 3, 4, 5])
    if (typeof metadata.extension === 'string') this.extension = metadata.extension
    this.attributions = metadata.attributions ?? {}
    this.type = parseMetaType(metadata.type)
    if (typeof metadata.size === 'number') this.size = metadata.size
    this.encoding = metadata.encoding ?? 'none'
    if (typeof metadata.layers === 'object') { // cleanup the fields property
      for (const value of Object.values(metadata.layers)) delete value.fields
      this.layers = metadata.layers
    }
    // other engines that have built data store layer data differently  :
    const vectorLayers = Array.isArray(metadata.vector_layers)
      ? metadata.vector_layers
      : typeof metadata.json === 'string'
        ? JSON.parse(metadata.json).vector_layers as VectorLayer[]
        : undefined
    if (vectorLayers !== undefined) {
      this.layers = {}
      for (const layer of vectorLayers) {
        if (layer.id === undefined) continue
        const { minzoom, maxzoom } = layer
        this.layers[layer.id] = { minzoom: minzoom ?? 0, maxzoom: maxzoom ?? this.maxzoom }
      }
    }
    // time series data check
    if (metadata.scheme !== undefined) this.format = 'zxy'
    else if (metadata.format !== undefined && metadata.format !== 'pbf') {
      this.format = metadata.format
      this.isTimeFormat = metadata.format === 'tfzxy'
    }
    if (this.format === 'zxy') this.faces.add(0)
    if (this.isTimeFormat) {
      postMessage({
        mapID,
        type: 'timesource',
        sourceName: this.name,
        interval: metadata.interval
      })
    }
    // once the metadata is complete, we should check if any tiles were queued
    this.resolve()
    // if attributions, we send them off
    const attributions = { ...this.attributions }
    if (Object.keys(attributions).length > 0) postMessage({ mapID, type: 'attributions', attributions })
  }

  // all tile requests undergo a basic check on whether that data exists
  // within the metadata boundaries. layerIndexes exists to set a boundary
  // of what layers the map is interested in (caused by style change add/edit layer)
  async tileRequest (mapID: string, tile: TileRequest): Promise<void> {
    // if the source isn't ready yet, we wait for the metadata to be built
    await this.ready
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
      faces.has(face) // check the face exists
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
    const layerIndexes: number[] = []

    for (let l = 0, ll = styleLayers.length; l < ll; l++) {
      const layer = styleLayers[l]
      if (layer === undefined || layers[layer.layer] === undefined) continue
      const { minzoom, maxzoom } = layers[layer.layer]
      if (minzoom <= zoom && maxzoom >= zoom) layerIndexes.push(layer.layerIndex)
    }

    tile.layerIndexes = layerIndexes
  }

  #getParentData (mapID: string, tile: TileRequest): void {
    const { format, layers, styleLayers, name } = this
    const projection: Projection = format === 'zxy' ? 'WM' : 'S2'
    if (layers === undefined) return
    // pull out data
    const { time, face, zoom, id } = tile
    // setup parentLayers
    const parentLayers: ParentLayers = {}
    // iterate over layers and found any data doesn't exist at current zoom but the style asks for
    for (const { layer, layerIndex, maxzoom } of styleLayers) {
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
          newID = parentID(projection, newID)
        }
        const newIDString = newID.toString()
        // pull out i & j
        const [, i, j] = toIJ(projection, newID, pZoom)
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
      ((this.format === 'zxy')
        ? `${zoom}/${i}/${j}.${extension}`
        : `${face}/${zoom}/${i}/${j}.${extension}`)

    const data = await this._fetch(`${path}/${location}`, mapID) as ArrayBuffer | undefined
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
    const data = textEncoder.encode('{"layers":{}}').buffer as ArrayBuffer
    // send off
    const worker = session.requestWorker()
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName, data }, [data])
  }

  async _fetch (path: string, mapID: string, json = false): Promise<ArrayBuffer | SourceMetadata | undefined> {
    const headers: { Authorization?: string } = {}
    if (this.needsToken) {
      const Authorization = await this.session.requestSessionToken(mapID)
      if (Authorization === 'failed') return
      if (Authorization !== undefined) headers.Authorization = Authorization
    }
    const res = await fetch(path, { headers })
    if (res.status !== 200 && res.status !== 206) return
    if (
      json ||
      (res.headers.get('content-type') ?? '').includes('application/json')
    ) return await res.json()
    return await res.arrayBuffer()
  }
}

function parseMetaType (type: string): SourceType {
  if (['vector', 'json', 'raster', 'raster-dem', 'sensor', 'overlay'].includes(type)) return type as SourceType
  return 'vector'
}

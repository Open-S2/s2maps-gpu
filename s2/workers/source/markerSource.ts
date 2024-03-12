import { fromLonLat, toST } from 'geometry/s2/s2Point'

import type { Session } from '.'
import type { TileRequest } from '../worker.spec'
import type { Point } from 'geometry'

export interface MarkerDefinition {
  id?: number
  lon: number
  lat: number
  html?: string // HTMLElement
  properties?: Record<string, unknown>
  geometry?: Point
}

interface MarkerProperties {
  [key: string]: unknown
  __markerID: number
}

export interface Marker {
  id?: number
  html?: string // HTMLElement
  properties: MarkerProperties
  geometry: Point
}

export default class MarkerSource {
  name: string
  isTimeFormat = false
  styleLayers: undefined
  idGen = 0
  0 = new Map<number, Marker>()
  1 = new Map<number, Marker>()
  2 = new Map<number, Marker>()
  3 = new Map<number, Marker>()
  4 = new Map<number, Marker>()
  5 = new Map<number, Marker>()
  session: Session
  textEncoder: TextEncoder = new TextEncoder()
  constructor (name: string, session: Session) {
    this.name = name
    this.session = session
  }

  addMarkers (markers: MarkerDefinition[]): void {
    for (const marker of markers) {
      let { id, properties, lon, lat } = marker
      if (properties === undefined) properties = {}
      // build face, s, t
      const [face, s, t] = toST(fromLonLat(lon, lat))
      // if no id, let's create one
      if (id === undefined) {
        id = this.idGen++
        if (this.idGen >= Number.MAX_SAFE_INTEGER) this.idGen = 0
      }
      // store
      properties.__markerID = id
      this[face].set(id, { properties: properties as MarkerProperties, geometry: [s, t] })
    }
  }

  removeMarkers (ids: number[]): void {
    for (const id of ids) {
      if (this[0].has(id)) this[0].delete(id)
      else if (this[1].has(id)) this[1].delete(id)
      else if (this[2].has(id)) this[2].delete(id)
      else if (this[3].has(id)) this[3].delete(id)
      else if (this[4].has(id)) this[4].delete(id)
      else if (this[5].has(id)) this[5].delete(id)
    }
  }

  tileRequest (mapID: string, tile: TileRequest): void {
    const { face, zoom, bbox, i, j } = tile
    const tileZoom = 1 << zoom
    const features = []
    // get bounds of tile
    const [minS, minT, maxS, maxT] = bbox
    // find all markers in st bounds
    for (const [, marker] of this[face]) {
      const { properties, geometry } = marker
      const [s, t] = geometry
      if (s >= minS && s < maxS && t >= minT && t < maxT) {
        features.push({ type: 1, properties, extent: 8_192, geometry: [transformPoint(s, t, 8_192, tileZoom, i, j)] })
      }
    }
    // if markers fit within bounds, create a tile
    const length = features.length
    // TODO: Flush instead of return
    if (length === 0) return
    // build data object
    const data = { extent: 8_192, face, zoom, i, j, layers: { default: { extent: 8_192, features, length: features.length } } }
    // encode for transfer
    const uint8data = (this.textEncoder.encode(JSON.stringify(data))).buffer as ArrayBuffer
    // request a worker and post
    const worker = this.session.requestWorker()
    worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: '_markers', data: uint8data }, [uint8data])
  }
}

function transformPoint (i: number, j: number, extent: number, zoom: number,
  ti: number, tj: number): [number, number] {
  const { round } = Math
  return [
    round(extent * (i * zoom - ti)),
    round(extent * (j * zoom - tj))
  ]
}

// @flow
/* eslint-env worker */
import { S2Point, bboxST } from 's2projection'

import type { Session, Point } from './'
import type { TileRequest } from '../workerPool'

export type Marker = {
  id?: number,
  lon?: number,
  lat?: number,
  html?: string, // HTMLElement
  properties: Object,
  geometry: Point
}

export default class MarkerSource {
  name: string
  idGen: number = 0
  0: Map<number, Marker> = new Map()
  1: Map<number, Marker> = new Map()
  2: Map<number, Marker> = new Map()
  3: Map<number, Marker> = new Map()
  4: Map<number, Marker> = new Map()
  5: Map<number, Marker> = new Map()
  session: Session
  constructor (name: string, session: Session) {
    this.name = name
    this.session = session
  }

  addMarkers (markers: Array<Marker>) {
    for (const marker of markers) {
      let { id, properties, lon, lat } = marker
      if (!properties) properties = {}
      // corner case: no lon, lat
      if (!lon || !lat) continue
      // build face, s, t
      const [face, s, t] = S2Point.fromLonLat(lon, lat).toST()
      // if no id, let's create one
      if (!id) {
        while (this[face].has(this.idGen)) this.idGen++
        id = this.idGen
      }
      // store
      properties._markerID = id
      this[face].set(id, { properties, geometry: [s, t] })
    }
  }

  removeMarkers (ids: Array<number>) {
    for (const id of ids) {
      if (this[0].has(id)) this[0].delete(id)
      else if (this[1].has(id)) this[1].delete(id)
      else if (this[2].has(id)) this[2].delete(id)
      else if (this[3].has(id)) this[3].delete(id)
      else if (this[4].has(id)) this[4].delete(id)
      else if (this[5].has(id)) this[5].delete(id)
    }
  }

  tileRequest (mapID: string, tile: TileRequest) {
    const { face, zoom, x, y, hash } = tile
    const tileZoom = 1 << zoom
    const features = []
    // get bounds of tile
    const [minS, minT, maxS, maxT] = bboxST(x, y, zoom)
    // find all markers in st bounds
    for (const [, marker] of this[face]) {
      const { properties, geometry } = marker
      const [s, t] = geometry
      if (s >= minS && s < maxS && t >= minT && t < maxT) {
        features.push({ type: 1, properties, geometry: [transformPoint(s, t, 8192, tileZoom, x, y)] })
      }
    }
    // if markers fit within bounds, create a tile
    if (features.length) {
      // build data object
      let data = { extent: 8192, face, zoom, x, y, layers: { default: { extent: 8192, features, length: features.length } } }
      // encode for transfer
      data = (new TextEncoder('utf-8').encode(JSON.stringify(data))).buffer
      // request a worker and post
      const worker = this.session.requestWorker()
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: '_markers', data }, [data])
    } else { // if no data, flush
      postMessage({
        mapID,
        tileID: hash,
        source: '_markers',
        type: 'flush',
        fill: false,
        line: false,
        point: false,
        heatmap: false,
        glyph: false
      })
    }
  }
}

function transformPoint (x: number, y: number, extent: number, zoom: number,
  tx: number, ty: number): [number, number] {
  return [
    Math.round(extent * (x * zoom - tx)),
    Math.round(extent * (y * zoom - ty))
  ]
}

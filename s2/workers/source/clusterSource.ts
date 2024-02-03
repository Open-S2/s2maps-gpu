/* eslint-env worker */
import { WMPointCluster } from './pointCluster'
import Source from './source'

import type { SourceMetadata } from 'style/style.spec'
import type { TileRequest } from '../worker.spec'
import type {
  Feature,
  JSONFeatureCollection
} from 'geometry'

export default class ClusterSource extends Source {
  wmCluster!: WMPointCluster
  textEncoder: TextEncoder = new TextEncoder()
  async build (mapID: string, metadata?: SourceMetadata): Promise<void> {
    let json = metadata?.data ?? await this._fetch(`${this.path}`, mapID, true) as unknown as JSONFeatureCollection
    if (json === undefined) {
      this.active = false
      console.error(`FAILED TO extrapolate ${this.path} json data`)
    } else {
      if (json.type === 'Feature') {
        json = { type: 'FeatureCollection', features: [json] }
      } else if (json.type === 'S2Feature') {
        json = { type: 'S2FeatureCollection', features: [json], faces: [json.face] }
      }
      this.wmCluster = new WMPointCluster(metadata)
      this.wmCluster.addManyPoints(json.features as Feature[])
      this.wmCluster.cluster()
      const { minzoom, maxzoom, faces } = this.wmCluster
      this._buildMetadata({
        type: 'vector',
        minzoom,
        maxzoom,
        faces: [...faces],
        layers: { default: { minzoom: 0, maxzoom: 30 } },
        extension: ''
      }, mapID)
    }
  }

  async _tileRequest (mapID: string, tile: TileRequest): Promise<void> {
    const { name, wmCluster, session, textEncoder } = this
    const { id, face } = tile

    if (wmCluster.faces.has(face)) {
      // grab the data
      const vectorTile = wmCluster.getTile(id)
      // prep worker
      const worker = session.requestWorker()
      if (Object.values(vectorTile.layers).length === 0) { this._flush(mapID, tile, name); return }
      // compress
      const data = (textEncoder.encode(JSON.stringify(vectorTile))).buffer
      // send off
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data])
    } else {
      this._flush(mapID, tile, name)
    }
  }
}

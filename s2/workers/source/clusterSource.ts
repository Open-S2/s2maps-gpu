/* eslint-env worker */
import { WMPointCluster } from './pointCluster'
import Source from './source'

import type { ClusterOptions } from './pointCluster'
import type { TileRequest } from '../worker.spec'
import type {
  Feature,
  FeatureCollection,
  S2FeatureCollection
} from 'geometry'

type JSON = FeatureCollection | S2FeatureCollection

export default class ClusterSource extends Source {
  wmCluster!: WMPointCluster
  textEncoder: TextEncoder = new TextEncoder()
  async build (mapID: string, options?: ClusterOptions): Promise<void> {
    const json = await this._fetch(`${this.path}`, mapID, true) as unknown as JSON
    if (json === undefined) {
      this.active = false
      console.error(`FAILED TO extrapolate ${this.path} json data`)
    } else {
      this.wmCluster = new WMPointCluster(options)
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
    }
  }
}

/* eslint-env worker */
import S2JsonVT from './s2json-vt'
import Source from './source'

import type { TileRequest } from '../worker.spec'
import type { S2FeatureCollection } from 's2/geometry'

export default class S2JSONSource extends Source {
  s2json!: S2JsonVT
  textEncoder: TextEncoder = new TextEncoder()
  async build (mapID: string): Promise<void> {
    const json = await this._fetch(`${this.path}`, mapID, true) as unknown as S2FeatureCollection
    if (json === undefined) {
      this.active = false
      console.log(`FAILED TO extrapolate ${this.path} json data`)
    } else {
      this.s2json = new S2JsonVT(json)
      const { minzoom, maxzoom, faces } = this.s2json
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
    const { name, s2json, session, textEncoder } = this
    const { id, face } = tile

    if (s2json.faces.has(face)) {
      // grab the data
      const vectorTile = s2json.getTile(id)
      // prep worker
      const worker = session.requestWorker()
      if (vectorTile?.layers?.default === undefined) return this._flush(mapID, tile, name)
      // compress
      const data = (textEncoder.encode(JSON.stringify(vectorTile))).buffer
      // send off
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data])
    }
  }
}

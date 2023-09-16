/* eslint-env worker */
import JsonVT from './json-vt'
import Source from './source'

import type { TileRequest } from '../worker.spec'
import type {
  Feature,
  FeatureCollection,
  S2Feature,
  S2FeatureCollection
} from 'geometry'

type JSON = Feature | FeatureCollection | S2Feature | S2FeatureCollection

export default class JSONSource extends Source {
  json!: JsonVT
  textEncoder: TextEncoder = new TextEncoder()
  async build (mapID: string): Promise<void> {
    const json = await this._fetch(`${this.path}`, mapID, true) as unknown as JSON
    if (json === undefined) {
      this.active = false
      console.log(`FAILED TO extrapolate ${this.path} json data`)
    } else {
      this.json = new JsonVT(json)
      const { minzoom, maxzoom, faces } = this.json
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
    const { name, json, session, textEncoder } = this
    const { id, face } = tile

    if (json.faces.has(face)) {
      // grab the data
      const vectorTile = json.getTile(id)
      // prep worker
      const worker = session.requestWorker()
      if (vectorTile?.layers?.default === undefined) { this._flush(mapID, tile, name); return }
      // compress
      const data = (textEncoder.encode(JSON.stringify(vectorTile))).buffer
      // send off
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data])
    }
  }
}

// @flow
/* eslint-env worker */
import S2JsonVT from './s2json-vt'
import Source from './source'

import type { TileRequest } from '../workerPool'

export default class S2JSONSource extends Source {
  s2json: S2JsonVT
  async build (mapID: string) {
    const self = this
    const json = await this._fetch(`${this.path}`, mapID, true)
    if (!json) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} json data`)
    } else {
      self.s2json = new S2JsonVT(json)
      this._buildMetadata({ type: 'vector' }, mapID)
    }
  }

  _tileRequest (mapID: string, tile: TileRequest) {
    const { name, s2json, session } = this
    const { id, face } = tile

    if (s2json.faces.has(face)) {
      // grab the data
      let data = s2json.getTile(id)
      if (!data || !data.layers || !data.layers.default) return this._flush(mapID, id, name)
      // compress
      data = (new TextEncoder('utf-8').encode(JSON.stringify(data))).buffer
      // send off
      const worker = session.requestWorker()
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data])
    }
  }

  _getParentData () {}
}

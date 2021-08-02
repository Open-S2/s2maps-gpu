// @flow
import S2JsonVT from './s2json-vt'
import Source from './source'

export default class S2JSONSource extends Source {
  s2json: S2JsonVt
  async build (token: string) {
    const self = this
    const json = await this._fetch(`${this.path}`, true, token)
    if (!json) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} json data`)
    } else { self.s2json = new S2JsonVT(json) }
  }

  // ask for the
  async _tileRequest (mapID: string, token: string, tile: TileRequest, worker: Worker) {
    const { name, s2json } = this
    const { face, zoom, x, y, hash } = tile

    if (s2json.faces.has(face)) {
      // grab the data
      let data = s2json.getTile(face, zoom, x, y)
      if (!data || !data.layers || !data.layers.default) return this._flush(mapID, hash, name)
      // compress
      data = (new TextEncoder('utf-8').encode(JSON.stringify(data))).buffer
      // send off
      worker.postMessage({ mapID, type: 'jsondata', tile, sourceName: name, data }, [data])
      // postMessage({ mapID, type: 'addsource', hash, sourceName: name })
    }
  }
}

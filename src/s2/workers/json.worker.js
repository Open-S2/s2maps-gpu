// @flow
import { VectorTile } from 's2-vector-tile'
import x from ''
import requestData from '../util/xmlHttpRequest'

export type CancelTileRequest = Array<number> // hashe IDs of tiles e.g. ['204', '1003', '1245', ...]

export type TileRequest = {
  hash: number,
  face: Face,
  zoom: number,
  x: number,
  y: number,
  division: number,
  size: number
}

// A JSON Worker takes a list of tiles and creates

// one thing to note: If all source, font, billboard data has not yet been downloaded, but we are already processing tiles,
// after every update of
export default class JsonWorker {
  maps: { [string]: StylePackage } = {} // mapID: StylePackage
  status: 'building' | 'busy' | 'ready' = 'ready'

  cancelCache: Array<number> = []
  onMessage ({ data }) {
    const { mapID, type } = data
    if (type === 'style') this._styleMessage(mapID, data.style)
    else if (type === 'request') this._requestMessage(mapID, data.tiles)
    else if (type === 'status') postMessage({ type: 'status', status: this.status })
  }
}

// create the tileworker
const jsonWorker = new JsonWorker()
// bind the onmessage function
onmessage = jsonWorker.onMessage.bind(jsonWorker)

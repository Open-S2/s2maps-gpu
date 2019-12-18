// @flow
// https://github.com/GoogleChromeLabs/worker-plugin
import Map from '../ui/map'

import type { MapOptions } from '../ui/map'

class MapWorker {
  map: Map
  onMessage ({ data }) {
    const { type } = data
    if (type === 'canvas') this._prepCanvas(data.options, data.canvas, data.id)
    if (type === 'resize') { this.map.resize(data.width, data.height) }
    if (type === 'data') this.map.injectSourceData(data.source, data.tileID, data.vertexBuffer, data.indexBuffer, data.featureGuideBuffer)
  }

  _prepCanvas (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    options.webworker = true
    this.map = new Map(options, canvas, id)
  }
}

const mapWorker = new MapWorker()

onmessage = mapWorker.onMessage.bind(mapWorker)

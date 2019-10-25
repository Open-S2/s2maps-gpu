// @flow
// https://github.com/GoogleChromeLabs/worker-plugin
import Map from '../ui/map'

import type { MapOptions } from '../ui/map'

class MapWorker {
  map: Map
  onMessage (e: Event) {
    const { type } = e.data
    if (type === 'canvas') this._prepCanvas(e.data.options, e.data.canvas)
    if (type === 'resize') { this.map.resize(e.data.width, e.data.height) }
  }

  _prepCanvas (options: MapOptions, canvas: HTMLCanvasElement) {
    this.map = new Map(options, canvas)
  }
}

const mapWorker = new MapWorker()

onmessage = mapWorker.onMessage.bind(mapWorker)

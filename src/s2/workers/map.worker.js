// @flow
// https://github.com/GoogleChromeLabs/worker-plugin
import Map from '../ui/map'

import type { MapOptions } from '../ui/map'

class MapWorker {
  map: Map
  onMessage ({ data }) {
    const { type } = data

    if (type === 'canvas') this._prepCanvas(data.options, data.canvas, data.id)
    else if (type === 'resize') this.map.resize(data.width, data.height)
    else if (type === 'scroll') this.map._onScroll(data.rect, data.clientX, data.clientY, data.deltaY)
    else if (type === 'mousedown') this.map.dragPan.onMouseDown()
    else if (type === 'mouseup') this.map.dragPan.onMouseUp()
    else if (type === 'mousemove') this.map.dragPan.onMouseMove(data.movementX, data.movementY)
    else this.map.injectData(data)
  }

  _prepCanvas (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    options.webworker = true
    this.map = new Map(options, canvas, id)
  }
}

const mapWorker = new MapWorker()

onmessage = mapWorker.onMessage.bind(mapWorker)

// @flow
/* eslint-env worker */
/* global HTMLCanvasElement onmessage */
// https://github.com/GoogleChromeLabs/worker-plugin
import Map from '../ui/map'

import type { MapOptions } from '../ui/map'

class MapWorker {
  map: Map
  onMessage ({ data }) {
    const { type } = data

    if (type === 'canvas') this._prepCanvas(data.options, data.canvas, data.id)
    else if (type === 'resize') this.map.resize(data.width, data.height, data.canvasMultiplier)
    else if (type === 'scroll') this.map._onZoom(data.deltaY, data.clientX - data.rect.left, data.clientY - data.rect.top)
    else if (type === 'mousedown') this.map.dragPan.onMouseDown()
    else if (type === 'mouseup') this.map.dragPan.onMouseUp()
    else if (type === 'mousemove') this.map.dragPan.onMouseMove(data.movementX, data.movementY)
    else if (type === 'touchstart') this.map.dragPan.onTouchStart(data.touchEvent)
    else if (type === 'touchend') this.map.dragPan.onTouchEnd(data.touchEvent)
    else if (type === 'touchmove') this.map.dragPan.onTouchMove(data.touchEvent)
    else this.map.injectData(data)
  }

  _prepCanvas (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    options.webworker = true
    this.map = new Map(options, canvas, id)
  }
}

// create the map worker
const mapWorker = new MapWorker()
// bind the onmessage function
onmessage = mapWorker.onMessage.bind(mapWorker) // eslint-disable-line

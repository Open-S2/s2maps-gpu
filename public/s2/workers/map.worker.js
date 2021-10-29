// @flow
/* eslint-env worker */
/* global HTMLCanvasElement */
import Map from '../ui/map'

import type { MapOptions } from '../ui/map'

export default class MapWorker implements Worker {
  map: Map
  onMessage ({ data }) {
    const { type } = data

    if (type === 'canvas') this._prepCanvas(data.options, data.canvas, data.id)
    else if (type === 'resize') this.map.resize(data.width, data.height)
    else if (type === 'scroll') this.map._onZoom(data.deltaY, data.clientX - data.rect.left, data.clientY - data.rect.top)
    else if (type === 'mousedown') this.map.dragPan.onMouseDown()
    else if (type === 'mouseup') this.map.dragPan.onMouseUp(data.clientX - data.rect.left - (data.rect.width / 2), (data.rect.height / 2) - data.clientY - data.rect.top)
    else if (type === 'mousemove') this.map.dragPan.onMouseMove(data.movementX, data.movementY)
    else if (type === 'canvasmousemove') this.map.onCanvasMouseMove(data.x, data.y)
    else if (type === 'touchstart') this.map.onTouchStart(data.touchEvent)
    else if (type === 'touchend') this.map.dragPan.onTouchEnd(data.touchEvent)
    else if (type === 'touchmove') this.map.dragPan.onTouchMove(data.touchEvent)
    else if (type === 'nav') this.map.navEvent(data.ctrl)
    else if (type === 'setStyle') this.map.setStyle(data.style, data.ignorePosition)
    else if (type === 'jumpTo') this.map.jumpTo(data.lon, data.lat, data.zoom)
    else if (type === 'moveState') this.map.canMove = !!data.state
    else if (type === 'zoomState') this.map.canZoom = !!data.state
    else if (type === 'screenshot') this.map.screenshot()
    else if (type === 'resetSource') this.map.resetSource(data.sourceNames, data.keepCache, data.awaitReplace)
    else if (type === 'clearSource') this.map.clearSource(data.sourceNames)
    else if (type === 'delete') this.map.delete()
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
onmessage = mapWorker.onMessage.bind(mapWorker)

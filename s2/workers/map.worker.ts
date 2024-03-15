import S2MapUI from 'ui/s2mapUI'

import type { MapOptions } from 'ui/s2mapUI'
import type { S2MapMessage } from './worker.spec'

export default class MapWorker {
  s2mapUI!: S2MapUI
  onmessage ({ data }: { data: S2MapMessage }): void {
    const { type } = data

    if (type === 'canvas') this._prepCanvas(data.options, data.canvas, data.id)
    else if (type === 'resize') this.s2mapUI.resize(data.width, data.height)
    else if (type === 'scroll') this.s2mapUI.onZoom(data.deltaY, data.clientX - data.rect.left, data.clientY - data.rect.top)
    else if (type === 'mousedown') this.s2mapUI.dragPan.onMouseDown()
    else if (type === 'mouseup') this.s2mapUI.dragPan.onMouseUp(data.clientX - data.rect.left - (data.rect.width / 2), (data.rect.height / 2) - data.clientY - data.rect.top)
    else if (type === 'mousemove') this.s2mapUI.dragPan.onMouseMove(data.movementX, data.movementY)
    else if (type === 'canvasmousemove') this.s2mapUI.onCanvasMouseMove(data.x, data.y)
    else if (type === 'touchstart') this.s2mapUI.onTouchStart(data.touchEvent)
    else if (type === 'touchend') this.s2mapUI.dragPan.onTouchEnd(data.touchEvent)
    else if (type === 'touchmove') this.s2mapUI.dragPan.onTouchMove(data.touchEvent)
    else if (type === 'nav') this.s2mapUI.navEvent(data.ctrl, data.lon, data.lat)
    else if (type === 'updateCompass') this.s2mapUI.updateCompass(data.bearing)
    else if (type === 'mouseupCompass') this.s2mapUI.mouseupCompass()
    else if (type === 'resetCompass') this.s2mapUI.resetCompass()
    else if (type === 'colorMode') this.s2mapUI.colorMode(data.mode)
    else if (type === 'setStyle') void this.s2mapUI.setStyle(data.style, data.ignorePosition)
    else if (type === 'updateStyle') this.s2mapUI.updateStyle(data.style)
    else if (type === 'jumpTo') this.s2mapUI.jumpTo(data.lon, data.lat, data.zoom)
    else if (type === 'easeTo' || type === 'flyTo') this.s2mapUI.animateTo(type, data.directions)
    else if (type === 'moveState') this.s2mapUI.canMove = data.state
    else if (type === 'zoomState') this.s2mapUI.canZoom = data.state
    else if (type === 'screenshot') this.s2mapUI.screenshot()
    else if (type === 'awaitRendered') this.s2mapUI.awaitFullyRendered()
    else if (type === 'resetSource') this.s2mapUI.resetSource(data.sourceNames, data.keepCache, data.awaitReplace)
    else if (type === 'clearSource') this.s2mapUI.clearSource(data.sourceNames)
    else if (type === 'addLayer') this.s2mapUI.addLayer(data.layer, data.nameIndex)
    else if (type === 'updateLayer') this.s2mapUI.updateLayer(data.layer, data.nameIndex, data.fullUpdate)
    else if (type === 'removeLayer') this.s2mapUI.removeLayer(data.nameIndex)
    else if (type === 'reorderLayers') this.s2mapUI.reorderLayers(data.layerChanges)
    else if (type === 'delete') this.s2mapUI.delete()
    else this.s2mapUI.injectData(data)
  }

  _prepCanvas (options: MapOptions, canvas: HTMLCanvasElement, id: string): void {
    options.webworker = true
    this.s2mapUI = new S2MapUI(options, canvas, id)
  }
}

// create the map worker
const mapWorker = new MapWorker()
// bind the onmessage function
onmessage = mapWorker.onmessage.bind(mapWorker)

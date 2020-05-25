// @flow
// https://github.com/GoogleChromeLabs/worker-plugin
import Map from '../ui/map'

import type { MapOptions } from '../ui/map'

class MapWorker {
  map: Map
  onMessage ({ data }) {
    const { type } = data

    if (type === 'canvas') this._prepCanvas(data.options, data.canvas, data.id)
    if (type === 'resize') this.map.resize(data.width, data.height)
    if (type === 'filldata') this.map.injectFillSourceData(data.source, data.tileID, data.vertexBuffer, data.indexBuffer, data.codeTypeBuffer, data.featureGuideBuffer)
    if (type === 'rasterdata') this.map.injectRasterData(data.source, data.tileID, data.image, data.leftShift, data.bottomShift)
    if (type === 'glyphdata') this.map.injectGlyphSourceData(data.source, data.tileID, data.glyphFilterBuffer, data.glyphVertexBuffer, data.glyphIndexBuffer, data.glyphQuadBuffer, data.colorBuffer, data.layerGuideBuffer)
    if (type === 'maskdata') this.map.injectMaskGeometry(data.tileID, data.vertexBuffer, data.indexBuffer, data.radiiBuffer)
    if (type === 'scroll') this.map._onScroll(data.rect, data.clientX, data.clientY, data.deltaY)
    if (type === 'mousedown') this.map.dragPan.onMouseDown()
    if (type === 'mouseup') this.map.dragPan.onMouseUp()
    if (type === 'mousemove') this.map.dragPan.onMouseMove(data.movementX, data.movementY)
  }

  _prepCanvas (options: MapOptions, canvas: HTMLCanvasElement, id: string) {
    options.webworker = true
    this.map = new Map(options, canvas, id)
  }
}

const mapWorker = new MapWorker()

onmessage = mapWorker.onMessage.bind(mapWorker)

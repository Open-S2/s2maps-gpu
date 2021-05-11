// @flow
import { VectorTile } from 's2-vector-tile'
import processFill from './fill'
import GlyphManager from './glyph'
import processLine from './line'
import processPoint from './point'

import type { TileRequest } from '../../workerPool'
import type { Layer } from '../../../style/styleSpec'

export type Feature = {
  geometry: Array<any>,
  properties: Object,
  indices?: Array<number>
}

export default class VectorManager {
  webgl1: boolean = false
  mainThread: Function
  glyphManager: GlyphManager
  constructor (mainThread: Function, sourceThread: Function) {
    this.mainThread = mainThread
    this.glyphManager = new GlyphManager(mainThread, sourceThread)
  }

  processVector (mapID: string, tile: TileRequest, sourceName: string,
    vectorTile: VectorTile, layers: Array<Layer>, parent?: boolean = false) {
    const { webgl1, glyphManager, mainThread } = this
    const { zoom } = tile
    // sometimes the sourcename includes "${sourceName}:PARENT" so we need to remove parent for comparison
    const subSourceName = sourceName.split(':')[0]
    // filter layers to source
    const sourceLayers = layers.filter(layer => layer.source === subSourceName)

    const featureStore = {
      fill: [],
      line: [],
      point: [],
      heatmap: [],
      glyph: []
    }

    for (const sourceLayer of sourceLayers) {
      // grab layer name
      const sourceLayerName = sourceLayer.layer
      // pull out the layer properties we need
      const { minzoom, maxzoom, type, filter, layerIndex, onlyLines, paint, layout } = sourceLayer
      if (minzoom > zoom || maxzoom < zoom) continue
      // use the appropriate feature array
      if (!featureStore[type]) continue
      const features = featureStore[type]
      // grab the layer of interest from the vectorTile and it's extent
      const vectorLayer = vectorTile.layers[sourceLayerName]
      if (!vectorLayer) continue
      const { extent } = vectorLayer
      // iterate over the vector features, filter as necessary
      for (let f = 0; f < vectorLayer.length; f++) {
        const feature = vectorLayer.feature(f)
        const { properties } = feature
        // filter out features that are not applicable
        if (validType(type, feature.type, onlyLines) && filter(properties)) {
          // build code
          const code = []
          for (const p in paint) paint[p](code, properties, zoom)
          for (const l in layout) layout[l](code, properties, zoom)
          // store
          const geometry = feature.loadGeometry()
          // if (parent) geometry = scaleShiftClip(geometry, type, extent, tile, parent)
          // scale and filter as necessary
          if (!geometry.length) continue
          features.push({
            layerIndex, geometry, code, featureCode: webgl1 && buildFeactureCode(type, paint, layout, properties, zoom),
            extent, type: feature.type, properties, vertices: [],
            indices: (feature.indices) ? feature.indices : [], sourceLayer
          })
        }
      }
    }
    // build for any feature type that we have features in
    if (featureStore.fill.length) processFill(mapID, tile, sourceName, featureStore.fill, mainThread)
    if (featureStore.line.length) processLine(mapID, tile, sourceName, featureStore.line, mainThread)
    if (featureStore.point.length) processPoint(mapID, tile, sourceName, featureStore.point, mainThread)
    if (featureStore.heatmap.length) processPoint(mapID, tile, sourceName, featureStore.heatmap, mainThread)
    if (featureStore.glyph.length) glyphManager.processGlyphs(mapID, tile, sourceName, featureStore.glyph)
  }
}

function buildFeactureCode (type, paint, layout, properties, zoom) {
  const featureCode = []

  if (type === 'fill') {
    featureCode.push(...(paint.color(null, properties, zoom)).getRGB())
  } else if (type === 'line') {
    featureCode.push(
      ...(paint.color(null, properties, zoom)).getRGB(),
      paint.width(null, properties, zoom)
    )
  } else if (type === 'point') {
    featureCode.push(
      ...(paint.color(null, properties, zoom)).getRGB(),
      paint.radius(null, properties, zoom),
      ...(paint.stroke(null, properties, zoom)).getRGB(),
      paint.strokeWidth(null, properties, zoom),
      paint.opacity(null, properties, zoom)
    )
  } else if (type === 'heatmap') {
    featureCode.push(
      layout.intensity(null, properties, zoom),
      paint.radius(null, properties, zoom),
      paint.opacity(null, properties, zoom)
    )
  } else if (type === 'glyph') {
    featureCode.push(
      ...(paint[`text-fill`](null, properties, zoom)).getRGB(),
      ...(paint[`text-stroke`](null, properties, zoom)).getRGB(),
      paint[`text-strokeWidth`](null, properties, zoom)
    )
  }

  return featureCode
}

function validType (layerType: string, type: number, onlyLines: boolean = false) {
  if (layerType === 'fill' && (type === 3 || type === 4)) return true
  else if (layerType === 'line' && (type === 2 || (!onlyLines && (type === 3 || type === 4)))) return true
  else if ((layerType === 'point' || layerType === 'heatmap' || layerType === 'glyph') && type === 1) return true
  return false
}

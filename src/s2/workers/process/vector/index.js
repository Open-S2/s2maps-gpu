// @flow
import { VectorTile } from 's2-vector-tile'
import processFill from './fill'
import GlyphManager from './glyph'
import processLine from './line'
import processPoint from './point'
import postInteractiveData from './postInteractive'
import scaleShiftClip from './scaleShiftClip'

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
  idGen: IDGen
  constructor (mainThread: Function, sourceThread: MessageChannel.port2, id: number, idGen: IDGen) {
    this.mainThread = mainThread
    this.glyphManager = new GlyphManager(mainThread, sourceThread, id, idGen)
    this.idGen = idGen
  }

  processVector (mapID: string, tile: TileRequest, sourceName: string,
    vectorTile: VectorTile, layers: Array<Layer>, parent?: boolean | ParentLayer = false) {
    const { webgl1, glyphManager, mainThread, idGen } = this
    const { hash, zoom } = tile
    // sometimes the sourcename includes "${sourceName}:PARENT_HASH" so we need to remove parent for comparison
    const subSourceName = sourceName.split(':')[0]
    // filter layers to source
    const sourceLayers = layers.filter(layer => layer.source === subSourceName)
    // prep an interactive map
    const interactiveMap = new Map()

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
      const {
        name, cursor, source, minzoom, maxzoom, type, interactive,
        filter, layerIndex, onlyLines, paint, layout
      } = sourceLayer
      if (minzoom > zoom || maxzoom < zoom) continue
      if (parent && !parent.layers.includes(layerIndex)) continue
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
          let geometry = feature.loadGeometry()
          if (parent) geometry = scaleShiftClip(geometry, feature.type, extent, tile, parent)
          // scale and filter as necessary
          if (!geometry || !geometry.length) continue
          const id = idGen.getNum()
          features.push({
            id, layerIndex, geometry, code, featureCode: webgl1 && buildFeactureCode(type, paint, layout, properties, zoom),
            extent, type: feature.type, properties, vertices: [],
            indices: (!parent && feature.indices) ? feature.indices : [], sourceLayer
          })
          // if the layer is interactive, store the id's property data
          if (interactive) interactiveMap.set(id, { __id: id, __cursor: cursor, __name: name, __source: source, __layer: sourceLayerName,  ...properties })
        }
      }
    }
    // build for any feature type that we have features in
    mainThread({
      mapID, tileID: hash, source: sourceName, type: 'flush', fill: featureStore.fill.length !== 0,
      line: featureStore.line.length !== 0, point: featureStore.point.length !== 0,
      heatmap: featureStore.heatmap.length !== 0, glyph: featureStore.glyph.length !== 0
    })
    if (featureStore.fill.length) processFill(mapID, tile, sourceName, featureStore.fill, mainThread)
    if (featureStore.line.length) processLine(mapID, tile, sourceName, featureStore.line, mainThread)
    if (featureStore.point.length) processPoint(mapID, tile, sourceName, featureStore.point, mainThread)
    if (featureStore.heatmap.length) processPoint(mapID, tile, sourceName, featureStore.heatmap, mainThread)
    if (featureStore.glyph.length) glyphManager.processGlyphs(mapID, tile, sourceName, featureStore.glyph)
    if (interactiveMap.size) postInteractiveData(mapID, sourceName, hash, interactiveMap, mainThread)
  }
}

function buildFeactureCode (type, paint, layout, properties, zoom) {
  const featureCode = []

  if (type === 'fill') {
    featureCode.push(
      ...(paint.color(null, properties, zoom)).getRGB(),
      paint.opacity(null, properties, zoom)
    )
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
  }

  return featureCode
}

function validType (layerType: string, type: number, onlyLines: boolean = false) {
  if (layerType === 'fill' && (type === 3 || type === 4)) return true
  else if (layerType === 'line' && (type === 2 || (!onlyLines && (type === 3 || type === 4)))) return true
  else if ((layerType === 'point' || layerType === 'heatmap' || layerType === 'glyph') && type === 1) return true
  return false
}

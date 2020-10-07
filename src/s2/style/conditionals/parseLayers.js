// @flow
import { parseFilter, parseFeatureFunction, orderLayer } from './'
import type { Layer, GLType } from '../styleSpec'
// prep functions that take feature.properties as an input.
// we need to ensure the layer contains the proper inputs along with the order of parsing
export default function parseLayers (layers: Array<Layer>, glType: GLType) {
  for (const layer of layers) {
    layer.filter = parseFilter(layer.filter)
    // order
    orderLayer(layer)
    // parse
    if (layer.type === 'text') {
      for (const l in layer.layoutLocal) layer.layoutLocal[l] = parseFeatureFunction(layer.layoutLocal[l], l)
      for (const p in layer.paintLocal) layer.paintLocal[p] = parseFeatureFunction(layer.paintLocal[p], p)
    }
    for (const l in layer.layout) layer.layout[l] = parseFeatureFunction(layer.layout[l], l)
    for (const p in layer.paint) layer.paint[p] = parseFeatureFunction(layer.paint[p], p)
  }
}

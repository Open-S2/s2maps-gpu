// @flow
import { parseFilter, parseFeatureFunction, encodeFeatureFunction, orderLayer } from './'
// prep functions that take feature.properties as an input.
// we need to ensure the layer contains the proper inputs along with the order of parsing
export default function parseLayers (layers: Array<Layer>) {
  for (const layer of layers) {
    layer.filter = parseFilter(layer.filter)
    // order
    orderLayer(layer)
    // parse
    if (layer.type === 'text') {
      for (const l in layer.layoutLocal) layer.layoutLocal[l] = parseFeatureFunction(layer.layoutLocal[l], l)
      for (const p in layer.paintLocal) layer.paintLocal[p] = parseFeatureFunction(layer.paintLocal[p], p)
    }
    for (const l in layer.layout) layer.layout[l] = encodeFeatureFunction(layer.layout[l])
    for (const p in layer.paint) layer.paint[p] = encodeFeatureFunction(layer.paint[p])
  }
}

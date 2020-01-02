// @flow
import { parseFilter, encodeFeatureFunction, orderLayer } from './'
// prep functions that take feature.properties as an input.
// we need to ensure the layer contains the proper inputs along with the order of parsing
export default function parseLayers (layers: Array<Layer>) {
  for (const layer of layers) {
    layer.filter = parseFilter(layer.filter)
    // order
    orderLayer(layer)
    // parse
    for (const l in layer.layout) layer.layout[l] = encodeFeatureFunction(layer.layout[l])
    for (const p in layer.paint) layer.paint[p] = encodeFeatureFunction(layer.paint[p])
  }
}

// @flow
import { VectorFeature } from 's2-vector-tile'
import { coalesceAnchor, coalesceField } from './'

import type { Text } from './'
import type { Layer } from '../../style/styleSpec'
type Point = [number, number]

export default function processText (feature: VectorFeature, zoom: number, layer: Layer,
  layerID: number, extent: number): Array<Text> {
  const geometry: Array<Point> = feature.loadGeometry()
  const { _id, properties } = feature

  // build all layout and paint parameters
  const code = []
  const family = layer.layout.family(properties, zoom, code)
  const field = coalesceField(layer.layout.field(properties, zoom, code), properties)
  const anchor = coalesceAnchor(layer.layout.anchor(properties, zoom, code))
  const offset = layer.layout.offset(properties, zoom, code)
  const padding = layer.layout.padding(properties, zoom, code)
  const size = layer.paint.size(properties, zoom, code)
  const fillStyle = layer.paint.fillStyle(properties, zoom, code)
  const strokeStyle = layer.paint.strokeStyle(properties, zoom, code)
  const strokeWidth = layer.paint.strokeWidth(properties, zoom, code)

  // build out all the individual s,t tile positions from the feature geometry
  const texts = []
  for (const point of geometry) {
    const text = {
      // organization parameters
      id: _id, layerID, code,
      // layout
      family, field, anchor, offset, padding,
      // paint
      size, fillStyle, strokeStyle, strokeWidth,
      // tile position
      s: point[0] / extent,
      t: point[1] / extent
    }
    // store
    texts.push(text)
  }

  return texts
}

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
  const { layoutLocal, paintLocal } = layer

  // build all layout and paint parameters
  const family = layoutLocal.family(properties, zoom)
  const field = coalesceField(layoutLocal.field(properties, zoom), properties)
  const anchor = coalesceAnchor(layoutLocal.anchor(properties, zoom))
  const padding = layoutLocal.padding(properties, zoom)
  const size = paintLocal.size(properties, zoom)
  const strokeWidth = paintLocal.strokeWidth(properties, zoom)

  // build out all the individual s,t tile positions from the feature geometry
  const texts = []
  for (const point of geometry) {
    const text = {
      // organization parameters
      id: _id, layerID,
      // layout
      family, field, anchor, padding,
      // paint
      height: size, strokeWidth,
      // tile position
      s: point[0] / extent,
      t: point[1] / extent
    }
    // store
    texts.push(text)
  }

  // get all individual glyph data

  // filter out any points that obviously overlaps

  // build text boxes and exact glyph locations


  return texts
}

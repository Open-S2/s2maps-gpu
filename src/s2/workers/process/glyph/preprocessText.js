// @flow
import { VectorFeature } from 's2-vector-tile'
import { coalesceField, coalesceAnchor } from './'

import type { IDGen } from '../tile.worker'
import type { Layer } from '../../style/styleSpec'

type Point = [number, number]

export type Text = {
  // organization parameters
  id: number,
  layerID: number,
  code: Array<number>,
  // layout
  family: string,
  field: string | Array<string>,
  anchor: number, // 0 => center ; 1 => top; 2 => topRight ; 3 => right ; 4 => bottomRight ; 5 => bottom ; 6 => bottomLeft ; 7 => left ; 8 => topLeft
  offset: [number, number],
  padding: [number, number],
  // paint
  size: number,
  featureCode: undefined | Array<number>, // [fill, stroke, strokeWidth, ...]
  // tile's position
  s: number,
  t: number,
  // texture & box mapping properties
  width?: number,
  height?: number,
  x?: number,
  y?: number
}

export default function processText (feature: VectorFeature, code: Array<number>,
  zoom: number, layer: Layer, layerID: number, extent: number, texts: Array<Text>,
  webgl1: boolean, idGen: IDGen) {
  const geometry: Array<Point> = feature.loadGeometry()
  const { properties } = feature
  const { paint, layoutLocal, paintLocal } = layer

  // build all layout and paint parameters
  // per tile properties
  const field = coalesceField(layoutLocal.field(null, properties, zoom), properties)
  if (!field) return
  const family = layoutLocal.family(null, properties, zoom)
  const anchor = coalesceAnchor(layoutLocal.anchor(null, properties, zoom))
  // NOTE: until we implement offsets, we just set them to 0
  const padding = layoutLocal.padding(null, properties, zoom)
  // const offset = layoutLocal.offset(null, properties, zoom)
  const offset = [0, 0]
  // variable properties
  const size = paintLocal.size(null, properties, zoom)
  // If WEBGL1 - add fill, stroke, and strokeWidth
  let featureCode
  if (webgl1) {
    featureCode = [
      size,
      ...(paint.fill(null, properties, zoom)).getRGB(),
      ...(paint.stroke(null, properties, zoom)).getRGB(),
      paint.strokeWidth(null, properties, zoom)
    ]
  }

  // ensure padding has a minimum of 2 for x and y
  if (padding[0] < 2) padding[0] = 2
  if (padding[1] < 2) padding[1] = 2

  // build out all the individual s,t tile positions from the feature geometry
  for (const point of geometry) {
    const text = {
      // organization parameters
      id: idGen.num, layerID, code,
      // layout
      family, field, padding, offset, anchor,
      // paint
      size, featureCode,
      // tile position
      s: point[0] / extent,
      t: point[1] / extent,
      height: size
    }
    // update and ensure ID wraps
    idGen.num += idGen.incrSize
    if (idGen.number >= idGen.maxNum) idGen.number = idGen.startNum
    // store
    texts.push(text)
  }
}

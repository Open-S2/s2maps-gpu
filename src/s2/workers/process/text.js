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
  fill: string,
  stroke: string,
  strokeWidth: number,
  // tile's position
  s: number,
  t: number,
  // texture & box mapping properties
  width?: number,
  height?: number,
  x?: number,
  y?: number
}

export default function processText (feature: VectorFeature, zoom: number, layer: Layer,
  layerID: number, extent: number, texts: Array<Text>, idGen: IDGen) {
  const geometry: Array<Point> = feature.loadGeometry()
  const { properties } = feature
  const { layoutLocal, paintLocal } = layer

  // build all layout and paint parameters
  const code = []
  const family = layoutLocal.family(properties, zoom, code)
  const field = coalesceField(layoutLocal.field(properties, zoom, code), properties)
  const anchor = coalesceAnchor(layoutLocal.anchor(properties, zoom, code))
  const padding = layoutLocal.padding(properties, zoom, code)
  const offset = layoutLocal.offset(properties, zoom, code)
  const size = paintLocal.size(properties, zoom, code) * 2
  const fill = paintLocal.fill(properties, zoom, code).getValue(false)
  const stroke = paintLocal.stroke(properties, zoom, code).getValue(false)
  const strokeWidth = paintLocal.strokeWidth(properties, zoom, code)

  if (!field) return

  // ensure padding has a minimum of 2 for x and y
  if (padding[0] < 2) padding[0] = 2
  if (padding[1] < 2) padding[1] = 2

  // find box height
  const height = size + (strokeWidth * 2) + (padding[1] * 2)

  // build out all the individual s,t tile positions from the feature geometry
  for (const point of geometry) {
    const text = {
      // organization parameters
      id: idGen.num, layerID, code,
      // layout
      family, field, padding, offset, anchor,
      // paint
      size, strokeWidth, stroke, fill,
      // tile position
      s: point[0] / extent,
      t: point[1] / extent,
      height
    }
    // update and ensure ID wraps
    idGen.num += idGen.incrSize
    if (idGen.number >= idGen.maxNum) idGen.number = idGen.startNum
    // store
    texts.push(text)
  }
}

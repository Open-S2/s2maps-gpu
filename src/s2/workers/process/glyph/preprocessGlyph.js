// @flow
import { VectorFeature } from 's2-vector-tile'
import { coalesceField, coalesceAnchor } from './'

import type { GlyphObject } from './glyph'
import type { IDGen } from '../../tile.worker'
import type { Layer } from '../../../style/styleSpec'
import type { Anchor } from './glyphBuilder/anchorOffset'

type Point = [number, number]

export type Glyph = {
  // organization parameters
  id: number,
  type: 'text' | 'icon',
  layerIndex: number,
  code: Array<number>,
  // layout
  family: string,
  field: string,
  padding: [number, number],
  offset: [number, number],
  anchor: Anchor,
  // paint
  size: number,
  featureCode: Array<number>,
  // tile position
  s: number,
  t: number,
  height: number,
  // precreate children array for rtree
  children: Array<Glyph>
}

export default function preprocessGlyph (feature: VectorFeature, code: Array<number>,
  zoom: number, layer: Layer, layerIndex: number, extent: number, glyphs: Array<GlyphObject>,
  webgl1: boolean, idGen: IDGen, interactiveMap: Map<number, Object>) {
  // grab geometry, property, and layer data
  const geometry: Array<Point> = feature.loadGeometry()
  const { properties } = feature
  const { name, cursor, source, paint, layoutLocal, paintLocal, interactive, overdraw } = layer

  for (const type of ['text', 'icon']) {
    if (!paintLocal[`${type}-size`]) continue

    // build all layout and paint parameters
    // per tile properties
    const field = coalesceField(layoutLocal[`${type}-field`](null, properties, zoom), properties)
    if (!field) return
    const family = layoutLocal[`${type}-family`](null, properties, zoom)
    const anchor = layoutLocal[`${type}-anchor`](null, properties, zoom)
    // NOTE: until we implement offsets, we just set them to 0
    const padding = layoutLocal[`${type}-padding`](null, properties, zoom)
    const offset = layoutLocal[`${type}-offset`](null, properties, zoom)
    // variable properties
    const size = paintLocal[`${type}-size`](null, properties, zoom)
    // If WEBGL1 - add fill, stroke, and strokeWidth
    let featureCode
    if (webgl1) {
      featureCode = [size]
      if (type === 'text') {
        size.push(
          ...(paint[`text-fill`](null, properties, zoom)).getRGB(),
          ...(paint[`text-stroke`](null, properties, zoom)).getRGB(),
          paint[`text-strokeWidth`](null, properties, zoom)
        )
      }
    }

    // ensure padding has a minimum of 2 for x and y
    if (padding[0] < 2) padding[0] = 2
    if (padding[1] < 2) padding[1] = 2

    // build out all the individual s,t tile positions from the feature geometry
    for (const point of geometry) {
      const glyph = {
        // organization parameters
        id: idGen.num,
        type,
        overdraw,
        layerIndex,
        code,
        // layout
        family,
        field,
        padding,
        offset,
        anchor,
        // paint
        size,
        featureCode,
        // tile position
        s: point[0] / extent,
        t: point[1] / extent,
        height: size,
        // precreate children array for rtree
        children: []
      }
      // store the properties data if interactive feature
      if (interactive) interactiveMap.set(idGen.num, { __id: idGen.num, __cursor: cursor, __name: name, __source: source, __layer: layer.layer,  ...properties })
      // update and ensure ID wraps
      idGen.num += idGen.incrSize
      if (idGen.num >= idGen.maxNum) idGen.num = idGen.startNum
      // store
      glyphs.push(glyph)
    }
  }
}

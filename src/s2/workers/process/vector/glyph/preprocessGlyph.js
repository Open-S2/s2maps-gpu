// @flow
import { coalesceField } from '../../../../style/conditionals'

import type { GlyphObject } from './glyph'

export default function preprocessGlyphs (features: Feature, zoom: number,
  glyphMap: Map<string, Glyph>, glyphList: { _total: number, [string]: Array<Unicode> }) {
  // prep variables
  const glyphFeatures = []

  // iterate features, creating both a text and icon version as applicable
  for (const feature of features) {
    const { id, layerIndex, extent, code, sourceLayer, featureCode, properties, geometry } = feature
    const { overdraw, layoutLocal, paintLocal } = sourceLayer

    for (const type of ['icon', 'text']) { // icon FIRST incase text draws over the icon
      if (!paintLocal[`${type}-size`]) continue

      // build all layout and paint parameters
      // per tile properties
      const field = coalesceField(layoutLocal[`${type}-field`](null, properties, zoom), properties)
      if (!field) continue
      const family = layoutLocal[`${type}-family`](null, properties, zoom)
      const anchor = layoutLocal[`${type}-anchor`](null, properties, zoom)
      addMissingChars(field, family, glyphMap, glyphList)
      // positional properties
      const offset = layoutLocal[`${type}-offset`](null, properties, zoom)
      const padding = layoutLocal[`${type}-padding`](null, properties, zoom)
      const wordWrap = (type === 'text') && layoutLocal['text-word-wrap'](null, properties, zoom)
      const align = (type === 'text') && layoutLocal['text-align'](null, properties, zoom)
      // for rtree tests
      const size = paintLocal[`${type}-size`](null, properties, zoom)

      // build out all the individual s,t tile positions from the feature geometry
      for (const point of geometry) {
        const glyph = {
          // organization parameters
          id,
          type: (type === 'text') ? 0 : 1,
          overdraw,
          layerIndex,
          code,
          // layout
          family,
          field,
          offset,
          padding,
          anchor,
          wordWrap,
          align,
          // paint
          featureCode: buildFeatureCode(featureCode, type, paintLocal, properties, zoom),
          // tile position
          s: point[0] / extent,
          t: point[1] / extent,
          // precreate children array for rtree
          size,
          children: []
        }
        // store
        glyphFeatures.push(glyph)
      }
    }
  }

  return glyphFeatures
}

function addMissingChars (field: string, family: string, glyphMap: Map<Unicode, Glyph>,
  glyphList: { _total: number, [string]: Array<Unicode> }) {
  if (!glyphMap[family]) glyphMap[family] = new Map()
  if (!glyphList[family]) glyphList[family] = new Set()
  const familyList = glyphList[family]
  const familyMap = glyphMap[family]
  for (let index = 0, fl = field.length; index < fl; index++) {
    const unicode = field.charCodeAt(index)
    if (!familyMap.has(unicode)) {
      glyphList._total++
      familyList.add(unicode)
    }
  }
}

function buildFeatureCode (featureCode, type, paint, properties, zoom) {
  if (!featureCode) return featureCode
  if (type === 1) { // icon
    featureCode.push(paintLocal[`icon-size`](null, properties, zoom))
  } else { // text
    featureCode.push(
      paintLocal[`text-size`](null, properties, zoom),
      ...(paint[`text-fill`](null, properties, zoom)).getRGB(),
      ...(paint[`text-stroke`](null, properties, zoom)).getRGB(),
      paint[`text-strokeWidth`](null, properties, zoom)
    )
  }

  return featureCode
}

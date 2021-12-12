// @flow
import { coalesceField } from '../../../../style/conditionals'

import type { Unicode, GlyphMap, IconMap, GlyphList, IconList } from './'
import type { Feature } from '../../../tile.worker'

export default function preprocessGlyphs (features: Feature, zoom: number,
  glyphMap: GlyphMap, iconMap: IconMap, glyphList: GlyphList, iconList: IconList) {
  // prep variables
  const glyphFeatures = []

  // iterate features, creating both a text and icon version as applicable
  for (const feature of features) {
    const { id, layerIndex, extent, code, sourceLayer, featureCode, properties, geometry } = feature
    const { overdraw, layoutLocal, paintLocal, paint } = sourceLayer

    for (const type of ['icon', 'text']) { // icon FIRST incase text draws over the icon
      if (!paintLocal[`${type}-size`]) continue

      // build all layout and paint parameters
      // per tile properties
      let field = coalesceField(layoutLocal[`${type}-field`](null, properties, zoom), properties)
      if (!field) continue
      const family = layoutLocal[`${type}-family`](null, properties, zoom)
      const anchor = layoutLocal[`${type}-anchor`](null, properties, zoom)
      // if icon, convert field to list of codes, otherwise create a unicode array
      if (type === 'icon') {
        addMissingIcons(field, family, glyphMap, iconMap, iconList)
      } else {
        field = field.split('').map(char => char.charCodeAt(0))
        addMissingChars(field, family, glyphMap, glyphList)
      }
      // positional properties
      const offset = layoutLocal[`${type}-offset`](null, properties, zoom)
      const padding = layoutLocal[`${type}-padding`](null, properties, zoom)
      const wordWrap = (type === 'text') && layoutLocal['text-word-wrap'](null, properties, zoom)
      const align = (type === 'text') && layoutLocal['text-align'](null, properties, zoom)
      const kerning = (type === 'text') ? layoutLocal['text-kerning'](null, properties, zoom) : 0
      const lineHeight = (type === 'text') && layoutLocal['text-line-height'](null, properties, zoom)
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
          kerning,
          lineHeight,
          // paint
          featureCode: buildFeatureCode(featureCode, type, paint, properties, zoom),
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

function addMissingChars (field: Array<Unicode>, family: string, glyphMap: GlyphMap, glyphList: GlyphList) {
  if (!glyphMap[family]) glyphMap[family] = new Map()
  if (!glyphList[family]) glyphList[family] = new Set()
  const familyList = glyphList[family]
  const familyMap = glyphMap[family]
  for (const unicode of field) {
    if (!familyMap.has(unicode)) {
      glyphList._total++
      familyList.add(unicode)
    }
  }
}

function addMissingIcons (field: string, family: string, glyphMap: GlyphMap,
  iconMap: IconMap, iconList: IconList) {
  if (!glyphMap[family]) glyphMap[family] = new Map()
  if (!iconMap[family]) iconMap[family] = new Map()
  if (!iconList[family]) iconList[family] = new Set()
  const familyList = iconList[family]
  const familyMap = iconMap[family]
  if (!familyMap.has(field)) {
    iconList._total++
    familyList.add(field)
  }
}

function buildFeatureCode (featureCode, type, paint, properties, zoom) {
  if (!featureCode) return null
  const res = []
  if (type === 'icon') { // icon
    res.push(paint['icon-size'](null, properties, zoom))
  } else { // text
    res.push(
      paint['text-size'](null, properties, zoom),
      ...(paint['text-fill'](null, properties, zoom)).getRGB(),
      ...(paint['text-stroke'](null, properties, zoom)).getRGB(),
      paint['text-stroke-width'](null, properties, zoom) || 0
    )
  }

  return res
}

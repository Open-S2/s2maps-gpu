// @flow
import type { Feature } from '../tile.worker.js'
import type { GlyphObject } from './glyph/glyph'

export default function featureSort (a: Feature | GlyphObject, b: Feature | GlyphObject): number {
  // layerIndex
  let diff = a.layerIndex - b.layerIndex
  let index = 0
  let maxSize = Math.min(a.code.length, b.code.length)
  while (diff === 0 && index < maxSize) {
    diff = a.code[index] - b.code[index]
    index++
  }
  return diff
}

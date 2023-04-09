import type { Feature } from '../process.spec'
import type { GlyphObject } from 's2/glyph/glyph.spec'

export default function featureSort (a: Feature | GlyphObject, b: Feature | GlyphObject): number {
  // layerIndex
  let diff = a.layerIndex - b.layerIndex
  // glyph -> sort text and icon
  if (diff === 0 && 'family' in a && 'family' in b) diff = a.type - b.type
  // if diff is still 0, sort by code
  let index = 0
  const maxSize = Math.min(a.gl2Code.length, b.gl2Code.length)
  while (diff === 0 && index < maxSize) {
    diff = a.gl2Code[index] - b.gl2Code[index]
    index++
  }

  return diff
}

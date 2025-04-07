import type { Feature } from '../process.spec';
import type { GlyphObject } from '../glyph/glyph.spec';

/**
 * @param a
 * @param b
 */
export default function featureSort(a: Feature | GlyphObject, b: Feature | GlyphObject): number {
  // layerIndex
  let diff = a.layerIndex - b.layerIndex;
  // glyph -> sort by glyphType (`point` or `path`) then by type (`text` or `icon`)
  if (diff === 0 && 'family' in a && 'family' in b) {
    diff = parseGlyphType(a.glyphType) - parseGlyphType(b.glyphType);
    if (diff === 0) diff = parseType(a.type) - parseType(b.type);
  }
  // if diff is still 0, sort by code
  let index = 0;
  const maxSize = Math.min(a.gl2Code.length, b.gl2Code.length);
  while (diff === 0 && index < maxSize) {
    diff = a.gl2Code[index] - b.gl2Code[index];
    index++;
  }

  return diff;
}

/**
 * @param type
 */
function parseGlyphType(type: 'point' | 'path'): number {
  if (type === 'point') return 0;
  return 1;
}

/**
 * @param type
 */
function parseType(type: 'text' | 'icon'): number {
  if (type === 'icon') return 1;
  return 0;
}

import type { Feature } from '../process.spec.js';
import type { GlyphObject } from '../glyph/glyph.spec.js';

/**
 * Sort features or glyph features
 * @param a - first feature
 * @param b - comparison feature
 * @returns a negative value if a < b, 0 if a === b, and a positive value if a > b
 */
export default function featureSort(a: Feature | GlyphObject, b: Feature | GlyphObject): number {
  // layerIndex
  let diff = a.layerIndex - b.layerIndex;
  // glyph -> sort by glyphType (`point` or `path`) then by type (`text` or `icon`)
  if (diff === 0 && 'family' in a && 'family' in b) {
    diff = parseGlyphType(a.glyphType) - parseGlyphType(b.glyphType);
    if (diff === 0) diff = parseRenderType(a.type) - parseRenderType(b.type);
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
 * Parse a glyph type into a sorting number
 * @param type - glyph type (point or path)
 * @returns 0 for point, 1 for path
 */
function parseGlyphType(type: 'point' | 'path'): number {
  if (type === 'point') return 0;
  return 1;
}

/**
 * Parse a render type into a sorting number
 * @param type - render type (text or icon)
 * @returns 0 for text, 1 for icon
 */
function parseRenderType(type: 'text' | 'icon'): number {
  if (type === 'icon') return 1;
  return 0;
}

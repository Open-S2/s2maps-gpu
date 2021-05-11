// @flow
import type { Node } from './rtree'

export type GlyphData = [string, string] // [family, char]

export type GlyphObject = {
  // organization parameters
  id: number,
  layerIndex: number,
  code: Array<number>,
  featureCode: typeof undefined | Array<number>, // [fill, stroke, strokeWidth, ...]
  // layout
  family: string,
  field: string | Array<string>,
  anchor: number, // 0 => center ; 1 => top; 2 => topRight ; 3 => right ; 4 => bottomRight ; 5 => bottom ; 6 => bottomLeft ; 7 => left ; 8 => topLeft
  wordWrap: number, // 0 means no word wrap
  offset: [number, number],
  padding: [number, number],
  // paint
  size: number
  // tile's position
  s: number,
  t: number,
  // rtree values to track early overlap drops
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  children: Array<Node | GlyphObject>,
  treeHeight: number,
  leaf: boolean
}

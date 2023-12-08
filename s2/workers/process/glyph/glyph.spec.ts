import type { Alignment, Anchor } from 'style/style.spec'

export type Unicode = number

export interface Node {
  children: Node[]
  treeHeight: number
  leaf: boolean
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type GlyphData = [string, string] // [family, char]

export interface GlyphObject extends Node {
  // organization parameters
  id: number
  idRGB: [r: number, g: number, b: number, a: number]
  layerIndex: number
  gl2Code: number[]
  code: number[]
  // layout
  overdraw: boolean
  family: string
  field: string
  fieldCodes: Unicode[]
  anchor: Anchor // 0 => center ; 1 => top; 2 => topRight ; 3 => right ; 4 => bottomRight ; 5 => bottom ; 6 => bottomLeft ; 7 => left ; 8 => topLeft
  wordWrap: number // 0 means no word wrap
  offset: [x: number, y: number]
  padding: [x: number, y: number]
  align: Alignment
  kerning: number
  lineHeight: number
  type: 'text' | 'icon'
  // paint
  size: number
  // tile's position
  s: number
  t: number
  // if icon (type === 1) add to color
  // grouped sets of: [r, g, b, a]
  color: number[]
  // grouped sets of: [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
  quads: number[]
  // [s, t, anchorOffsetX, anchorOffsetY, paddingX, paddingY, maxWidth, maxHeight, index]
  filter: [s: number, t: number, anchorOffsetX: number, anchorOffsetY: number, paddingX: number, paddingY: number, maxWidth: number, maxHeight: number]
  // missing chars or icons so it neeeds to wait for data
  missing: boolean
}

export interface Glyph {
  texX: number // x position on glyph texture sheet
  texY: number // y position on glyph texture sheet
  texW: number // width of the glyph in the texture
  texH: number // height of the glyph in the texture
  xOffset: number // x offset for glyph
  yOffset: number // y offset for glyph
  width: number // width of glyph relative to 0->1
  height: number // height of glyph relative to 0->1
  advanceWidth: number // how far to move the cursor
}

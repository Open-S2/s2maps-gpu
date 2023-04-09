import type { Alignment, Anchor } from 's2/style/style.spec'
import type { TileRequest } from 's2/workers/worker.spec'

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
  idRGB: [number, number, number] // [red, green, blue]
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
  offset: [number, number]
  padding: [number, number]
  align: Alignment
  kerning: number
  lineHeight: number
  type: 0 | 1 // (0: text, 1: icon)
  // paint
  size: number
  // tile's position
  s: number
  t: number
  // if icon (type === 1) add to color
  color: number[]
  // building quads and filter
  quads: number[] // [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
  filter: number[] // [s, t, anchorOffsetX, anchorOffsetY, paddingX, paddingY, maxWidth, maxHeight, index]
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

export type Unicode = number

export type Color = [number, number, number, number]

export type Colors = Color[]

export interface ColorMap {
  [family: string]: {
    [colorID: number]: Color
  }
}

export interface FamilyMap {
  [code: Unicode]: Glyph
}

export interface GlyphMap {
  [family: string]: FamilyMap
}

export interface IconMap {
  [family: string]: {
    [icon: string]: Array<{ glyphID: Unicode, colorID: number }>
  }
}

export interface GlyphStore {
  features: GlyphObject[]
  tile: TileRequest
  glyphFamilyCount: number
  processed: number
}

export interface IconList {
  [family: string]: Set<string>
}

export interface GlyphList {
  [family: string]: Set<Unicode>
}

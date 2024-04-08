import type { Alignment, Anchor } from 'style/style.spec'
import type { ColorArray } from 'style/color'
import type { Point } from 'geometry'
import type { PathData } from '../util'

export interface SquareNode {
  id: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface RoundNode {
  x: number
  y: number
  r: number
}

export interface RoundNodes {
  id: number
  nodes: RoundNode[]
}

export type Node = SquareNode | RoundNodes

export type GlyphData = [string, string] // [family, char]

export interface GlyphBase {
  // organization parameters
  id: number
  idRGB: ColorArray
  layerIndex: number
  gl2Code: number[]
  code: number[]
  // layout
  overdraw: boolean
  family: string[]
  field: string
  fieldCodes: string[]
  spacing: number
  offset: Point
  padding: Point
  kerning: number
  lineHeight: number
  type: 'text' | 'icon'
  wordWrap: number // 0 means no word wrap
  align: Alignment
  anchor: Anchor // 0 => center ; 1 => top; 2 => topRight ; 3 => right ; 4 => bottomRight ; 5 => bottom ; 6 => bottomLeft ; 7 => left ; 8 => topLeft
  // paint
  size: number
  // grouped sets of: [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
  quads: number[]
  // if icon add to color
  // grouped sets of: [r, g, b, a]
  color: number[]
  // missing chars or icons so it neeeds to wait for data
  missing: boolean
}

export interface GlyphPoint extends GlyphBase, SquareNode {
  glyphType: 'point'
  // tile's position
  s: number
  t: number
  // NOTE: offsetX and offsetY are the pixel based offset
  // while xPos and yPos are the 0->1 ratio placement that will be multiplied by size
  // [s, t, xPos, yPos, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
  // NOTE: index and id will be added later
  filter: [
    s: number, t: number,
    xPos: number, yPos: number,
    offsetX: number, offsetY: number,
    paddingX: number, paddingY: number,
    maxWidth: number, maxHeight: number
  ]
}

export type PathFilter = [
  s: number, t: number,
  offsetX: number, offsetY: number,
  xPos: number, yPos: number,
  path1X: number, path1Y: number,
  path2X: number, path2Y: number,
  path3X: number, path3Y: number,
  padding: number
]

export interface GlyphPath extends GlyphBase, RoundNodes {
  glyphType: 'path'
  // store geometry data and type to properly build later
  extent: number
  pathData: PathData
  // [s, t, offsetX, offsetY, posX, posY, path1X, path1Y, path2X, path2Y, path3X, path3Y, padding, index, id]
  filters: PathFilter[]
}

export type GlyphObject = GlyphPoint | GlyphPath

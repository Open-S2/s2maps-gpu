import type { Alignment, Anchor } from 'style/style.spec'
import type { S2VectorGeometry, S2VectorTileFeatureType } from 's2-vector-tile'
import type { ColorArray } from 'style/color'
import type { Point } from 'geometry'

export interface SquareNode {
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
  // [s, t, anchorOffsetX, anchorOffsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
  filter: [s: number, t: number, anchorOffsetX: number, anchorOffsetY: number, paddingX: number, paddingY: number, maxWidth: number, maxHeight: number]
}

export interface GlyphPath extends GlyphBase, RoundNodes {
  glyphType: 'path'
  // store geometry data and type to properly build later
  extent: number
  geometry: S2VectorGeometry
  geometryType: S2VectorTileFeatureType
  // [s, t, anchorOffsetX, anchorOffsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
  filters: Array<[s: number, t: number, anchorOffsetX: number, anchorOffsetY: number, padding: number, radius: number]>
}

export type GlyphObject = GlyphPoint | GlyphPath

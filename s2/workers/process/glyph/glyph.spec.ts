import type { ColorArray } from 'style/color';
import type { PathData } from '../util';
import type { Point } from 'gis-tools';
import type { Alignment, Anchor } from 'style/style.spec';

/** a bounding box like structure */
export interface SquareNode {
  id: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** a bounding circle like structure */
export interface RoundNode {
  x: number;
  y: number;
  r: number;
}

/** collection of round nodes */
export interface RoundNodes {
  id: number;
  nodes: RoundNode[];
}

/** a node is a collection of square or round nodes */
export type Node = SquareNode | RoundNodes;

/** a glyph descriptor. */
export type GlyphData = [family: string, char: string];

/**
 * Glyph Base properties found in all glyph types
 */
export interface GlyphBase {
  // organization parameters
  id: number;
  idRGB: ColorArray;
  layerIndex: number;
  gl2Code: number[];
  code: number[];
  // layout
  overdraw: boolean;
  family: string[];
  field: string;
  fieldCodes: string[];
  spacing: number;
  offset: Point;
  padding: Point;
  kerning: number;
  lineHeight: number;
  type: 'text' | 'icon';
  wordWrap: number; // 0 means no word wrap
  align: Alignment;
  anchor: Anchor; // 0 => center ; 1 => top; 2 => topRight ; 3 => right ; 4 => bottomRight ; 5 => bottom ; 6 => bottomLeft ; 7 => left ; 8 => topLeft
  // paint
  size: number;
  // grouped sets of: [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
  quads: number[];
  // if icon add to color
  // grouped sets of: [r, g, b, a]
  color: number[];
  // missing chars or icons so it neeeds to wait for data
  missing: boolean;
}

/**
 * Glyph Point is a glyph rendering that has a singular anchor point to render from
 */
export interface GlyphPoint extends GlyphBase, SquareNode {
  glyphType: 'point';
  // tile's position
  s: number;
  t: number;
  // NOTE: offsetX and offsetY are the pixel based offset
  // while xPos and yPos are the 0->1 ratio placement that will be multiplied by size
  // [s, t, xPos, yPos, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
  // NOTE: index and id will be added later
  filter: [
    s: number,
    t: number,
    xPos: number,
    yPos: number,
    offsetX: number,
    offsetY: number,
    paddingX: number,
    paddingY: number,
    maxWidth: number,
    maxHeight: number,
  ];
}

/** Glyph's renderered along a path have their own filter data */
export type PathFilter = [
  s: number,
  t: number,
  offsetX: number,
  offsetY: number,
  xPos: number,
  yPos: number,
  path1X: number,
  path1Y: number,
  path2X: number,
  path2Y: number,
  path3X: number,
  path3Y: number,
  padding: number,
];

/** Glyph Path data is a collection of glyphs that follow along a vector line */
export interface GlyphPath extends GlyphBase, RoundNodes {
  glyphType: 'path';
  // store geometry data and type to properly build later
  extent: number;
  pathData: PathData;
  // [s, t, offsetX, offsetY, posX, posY, path1X, path1Y, path2X, path2Y, path3X, path3Y, padding, index, id]
  filters: PathFilter[];
}

/** A Glpyh object is either a GlyphPoint or GlyphPath */
export type GlyphObject = GlyphPoint | GlyphPath;

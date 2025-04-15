import { getPathPos } from '../util';

import type { Glyph } from './familySource';
import type { MapGlyphSource } from '../imageStore';
import type { Point } from 'gis-tools';
import type { Alignment, Anchor } from 'style/style.spec';
import type { GlyphPath, GlyphPoint, PathFilter } from './glyph.spec';
import type { Path, QuadPos } from '../util';

/**
 * Quads
 * - BOX: [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
 * - CIRCLE: [s, t, xOffset, yOffset, path1X, path1Y, path2X, path2Y, path3X, path3Y, path4X, path4Y, distance, texX, texY, texWidth, texHeight]
 *
 * the xPos and yPos are for the 0->1 ratio placement. This is computed internally with size
 * meanwhile xOffset and yOffset are where to start from the s, t position (the pixel based offset)
 */
export type Quad = number[];

/**
 * BOX: [s, t, anchorOffsetX, anchorOffsetY, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
 * CIRCLE: [s, t, anchorOffsetX, anchorOffsetY, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
 */
export type Filter = number[];

/** Row: [rowCount, rowWidth, rowHeight] */
export type Row = [rowCount: number, rowWidth: number, rowHeight: number];

export const QUAD_SIZE_TEXT = 12;
export const QUAD_SIZE_PATH = 20;

export const NULL_GLYPH = {
  code: '0',
  texX: 0,
  texY: 0,
  texW: 0,
  texH: 0,
  xOffset: 0,
  yOffset: 0,
  width: 0,
  height: 0,
  advanceWidth: 0,
};

/**
 * This step exclusively creates quad data, E.G. How to draw each glyph on the screen,
 * given the anchor point as a basis for drawing. This step is seperate to preprocessing
 * as we are avoiding doing too much work prior to potentially filtering the object (rtree).
 * NOTE: EVERY GLYPH is currently "normalized", with a 0->1 scale so it can later be
 * multiplied by "size"
 * NOTE: Just put the glyph offsets + word-wrap-y offset provided at first,
 * add in the excess anchor offset AFTER we know the bbox size
 * TODO: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
 * @param feature - input glyph point feature
 * @param glyphSource - glyph source to pull glyph metadata from
 * @param tileSize - tile size/extent
 */
export function buildGlyphPointQuads(
  feature: GlyphPoint,
  glyphSource: MapGlyphSource,
  tileSize: number,
): void {
  const { max } = Math;
  const {
    s,
    t,
    size,
    offset,
    padding,
    family,
    anchor,
    fieldCodes,
    wordWrap,
    align,
    kerning,
    lineHeight,
    type,
    quads,
  } = feature;
  const [offsetX, offsetY] = offset;
  const [paddingX, paddingY] = padding;
  // setup variable
  const rows: Row[] = []; // a row: [glyph count, rowMaxWidth, rowMaxHeight]
  let rowCount = 0;
  let rowWidth = 0;
  let rowHeight = 0;
  let cursorX = 0;
  // run through string using the glyphSet as a guide to build the quads
  for (const unicode of fieldCodes) {
    // word-wrap if line break or length exceeds max allowed.
    if (
      type === 'text' && // is text
      (unicode === '10' ||
        unicode === '13' ||
        (unicode === '32' && wordWrap !== 0 && cursorX >= wordWrap))
    ) {
      cursorX = 0;
      const heightAdjust = rowCount > 0 ? rowHeight + lineHeight : 0;
      updateGlyphPos(quads, 0, heightAdjust); // we move all previous content up a row
      rows.push([rowCount, rowWidth, heightAdjust]);
      rowCount = 0;
      rowWidth = 0;
      rowHeight = 0;
      continue;
    }
    // grab the unicode information
    const unicodeData = getGlyph(glyphSource, family, unicode);
    if (unicodeData === undefined) continue;
    const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData;
    // prep x-y positions
    const xPos = cursorX + xOffset;
    const yPos = yOffset;
    if (texW > 0 && texH > 0) {
      // store quad
      quads.push(
        // NOTE: offsetX and offsetY are the pixel based offset
        // while xPos and yPos are the 0->1 glyph ratio placement
        // position data
        s,
        t,
        offsetX,
        offsetY,
        xPos,
        yPos,
        width,
        height,
        // texture data
        texX,
        texY,
        texW,
        texH,
      );
      // update number of glyphs and draw box height
      rowCount++;
      rowHeight = max(rowHeight, height);
    }
    // always update rowWidth by advanceWidth
    rowWidth = max(rowWidth, xPos + width, xPos + advanceWidth);
    // advance cursor position
    cursorX += advanceWidth + kerning;
  }
  // store the last row
  rows.push([rowCount, rowWidth, rowCount > 0 ? rowHeight + lineHeight : 0]);
  // grab max width from said
  const maxWidth = rows.reduce((acc, curr) => max(acc, curr[1]), 0);
  const maxHeight = rows.reduce((acc, curr) => acc + curr[2], 0);
  // adjust text based upon center-align or right-align
  alignText(align, quads, rows, maxWidth);
  // now adjust all glyphs and max-values by the anchor and alignment
  const [anchorOffsetX, anchorOffsetY] = anchorOffset(anchor, maxWidth, maxHeight);
  updateGlyphPos(quads, anchorOffsetX, anchorOffsetY);

  // set minX, maxX, minY, maxY in the feature
  feature.minX = s * tileSize + offsetX + anchorOffsetX * size - paddingX;
  feature.minY = t * tileSize + offsetY + anchorOffsetY * size - paddingY;
  feature.maxX = feature.minX + maxWidth * size + paddingX * 2;
  feature.maxY = feature.minY + maxHeight * size + paddingY * 2;
  // store the filter
  feature.filter = [
    s,
    t,
    anchorOffsetX,
    anchorOffsetY,
    offsetX,
    offsetY,
    paddingX,
    paddingY,
    maxWidth,
    maxHeight,
  ];
}

/**
 * Build glyph path quads
 * IDEATION: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
 * @param feature - glyph lines feature
 * @param glyphSource - glyph source to pull glyph metadata from
 * @param tileSize - tile size/extent
 */
export function buildGlyphPathQuads(
  feature: GlyphPath,
  glyphSource: MapGlyphSource,
  tileSize: number,
): void {
  const { max } = Math;
  // NOTE: missing "size" and "padding"
  const { size, offset, family, anchor, pathData, align, kerning } = feature;
  let { fieldCodes } = feature;
  const [offsetX, offsetY] = offset;
  const padding = max(...feature.padding);
  const {
    point: { x: s, y: t },
    pathLeft,
    pathRight,
  } = pathData;
  // first replace all newlines with spaces
  fieldCodes = fieldCodes.map((unicode) => {
    if (unicode === '10' || unicode === '13') return '32';
    else return unicode;
  });
  // setup variable
  let maxWidth = 0;
  let maxHeight = 0;
  let cursorX = 0;
  // run through string using the glyphSet as a guide to build the quads
  const quads: number[] = [];
  for (const unicode of fieldCodes) {
    // grab the unicode information
    const unicodeData = getGlyph(glyphSource, family, unicode);
    if (unicodeData === undefined) continue;
    const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData;
    maxHeight = max(maxHeight, height);
    // prep x-y positions & distance
    const xPos = cursorX + xOffset + width / 2;
    const yPos = yOffset + height / 2;
    // skip no texture data like spaces
    if (texW > 0 && texH > 0) {
      // NOTE: texX, texY, texW, texH, offsetX, and offsetY are the pixel based values
      // while xPos, yPos, width, and height are the 0->1 ratio placement to user defined size
      // st is 0->1 ratio relative to tile size
      quads.push(
        // position data
        s,
        t,
        offsetX,
        offsetY,
        xPos,
        yPos,
        width,
        height,
        // texture data
        texX,
        texY,
        texW,
        texH,
        // tmp path data
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      );
    }
    maxWidth = max(maxWidth, xPos + width, xPos + advanceWidth);
    // advance cursor position
    cursorX += advanceWidth + kerning;
  }
  // adjust text based upon center-align or right-align
  alignText(align, quads, [[0, maxWidth, 0]], maxWidth, 'path');
  // now adjust all glyphs and max-values by the anchor and alignment
  const [anchorOffsetX, anchorOffsetY] = anchorOffsetPath(anchor, maxWidth, maxHeight);
  updateGlyphPos(quads, anchorOffsetX, anchorOffsetY, 'path');
  // set the correct path data relative to whether the glyph is traveling
  // left or right from the anchor point
  updatePathData(quads, pathLeft, pathRight);
  // add nodes to the feature for each quad
  buildFeatureNodes(feature, quads, pathLeft, pathRight, size, padding, tileSize);
  // last step is to build the filter container paths. For each quad just
  // copy paste a slice from st to end of path, add padding, and store to filters
  storePathFeatureFilters(feature, quads, padding);
  // store quads in feature
  feature.quads.push(...quads);
}

/**
 * Get a glyph's metadata from the glyph source
 * @param glyphSource - glyph source
 * @param family - glyph family
 * @param code - glyph code
 * @returns the glyph metadata
 */
function getGlyph(glyphSource: MapGlyphSource, family: string[], code: string): Glyph {
  for (const familyName of family) {
    const glyphFamily = glyphSource.get(familyName);
    if (glyphFamily === undefined) continue;
    const glyph = glyphFamily.glyphCache.get(code);
    if (glyph !== undefined) return glyph;
  }
  return NULL_GLYPH;
}

/**
 * Update the position of the glyphs
 * @param quads - glyph quads
 * @param offsetX - x offset
 * @param offsetY - y offset
 * @param glyphType - glyph type
 */
function updateGlyphPos(
  quads: Quad,
  offsetX: number,
  offsetY: number,
  glyphType: 'text' | 'path' = 'text',
): void {
  const quadSize = glyphType === 'text' ? QUAD_SIZE_TEXT : QUAD_SIZE_PATH;
  for (let i = 0, ql = quads.length; i < ql; i += quadSize) {
    quads[i + 4] += offsetX;
    quads[i + 5] += offsetY;
  }
}

/**
 * Set an user defined anchor offset. boxes start at the bottom left as UV [0,0] to [1, 1]
 * @param anchor - anchor type
 * @param width - full width of all glyphs in the line or paragrpah
 * @param height - full height of all glyphs in the line or paragrpah
 * @returns the anchor offset
 */
function anchorOffset(anchor: Anchor, width: number, height: number): Point {
  if (anchor === 'center') return [-width / 2, -height / 2];
  else if (anchor === 'top') return [-width / 2, -height];
  else if (anchor === 'top-right') return [-width, -height];
  else if (anchor === 'right') return [-width, -height / 2];
  else if (anchor === 'bottom-right') return [-width, 0];
  else if (anchor === 'bottom') return [-width / 2, 0];
  else if (anchor === 'bottom-left') return [0, 0];
  else if (anchor === 'left') return [0, -height / 2];
  else if (anchor === 'top-left') return [0, -height];
  else return [-width / 2, -height / 2]; // default to center
}

/**
 * Set a user defined anchor offset for path glyphs
 * the path drawing takes [-0.5, -0.5] to [0.5, 0.5] quads
 * @param anchor - anchor type
 * @param width - full width of all glyphs in the line or paragrpah
 * @param height - full height of all glyphs in the line or paragrpah
 * @returns the anchor offset
 */
function anchorOffsetPath(anchor: Anchor, width: number, height: number): Point {
  if (anchor === 'center') return [-width / 2, 0];
  else if (anchor === 'top') return [-width / 2, -height / 2];
  else if (anchor === 'top-right') return [-width, -height / 2];
  else if (anchor === 'right') return [-width, 0];
  else if (anchor === 'bottom-right') return [-width, height / 2];
  else if (anchor === 'bottom') return [-width / 2, height / 2];
  else if (anchor === 'bottom-left') return [0, height / 2];
  else if (anchor === 'left') return [0, 0];
  else if (anchor === 'top-left') return [0, -height / 2];
  else return [-width / 2, 0]; // default to center
}

/**
 * Align text given a user defined alignment
 * @param align - alignment
 * @param quads - glyph quads
 * @param rows - rows and their size,width,& height
 * @param maxWidth - max width found from all rows
 * @param glyphType - glyph type (text or path)
 */
function alignText(
  align: Alignment,
  quads: Quad,
  rows: Row[],
  maxWidth: number,
  glyphType: 'text' | 'path' = 'text',
): void {
  const quadSize = glyphType === 'text' ? QUAD_SIZE_TEXT : QUAD_SIZE_PATH;
  if (align !== 'center' && align !== 'right') return;
  const alignFunc =
    align === 'center'
      ? (mW: number, rW: number): number => (mW - rW) / 2 // center align
      : (mW: number, rW: number): number => mW - rW; // right align

  let currPos = 0;
  let idx = 0;
  // iterate rows, grab their count and width, adjust as necessary
  for (const [rowCount, rowWidth] of rows) {
    // if row is same size as the width of the display box, move on
    if (rowWidth === maxWidth) {
      currPos += rowCount;
      continue;
    }
    // find the alignment based upon the rows width and the total draw box width
    const adjust = alignFunc(maxWidth, rowWidth);
    // iterate the rows, adding the x-y adjustment as appropriate
    for (let i = 0; i < rowCount; i++) {
      idx = currPos * quadSize;
      quads[idx + 4] += adjust;
      currPos++;
    }
  }
}

/**
 * Update path data's x and y
 * @param quads - glyph quads
 * @param pathLeft - left path
 * @param pathRight - right path
 */
function updatePathData(quads: Quad, pathLeft: Path, pathRight: Path): void {
  for (let i = 0, ql = quads.length; i < ql; i += QUAD_SIZE_PATH) {
    const path = quads[i + 4] >= 0 ? pathRight : pathLeft;
    for (let j = 0; j < 4; j++) {
      quads[i + 12 + j * 2] = path[j].x;
      quads[i + 13 + j * 2] = path[j].y;
    }
  }
}

/**
 * Build feature nodes
 * @param feature - glyph feature
 * @param quads - glyph quads
 * @param pathLeft - left path
 * @param pathRight - right path
 * @param size - glyph size
 * @param padding - glyph padding
 * @param tileSize - tile size
 */
function buildFeatureNodes(
  feature: GlyphPath,
  quads: Quad,
  pathLeft: Path,
  pathRight: Path,
  size: number,
  padding: number,
  tileSize: number,
): void {
  for (let i = 0, ql = quads.length; i < ql; i += QUAD_SIZE_PATH) {
    const quadPos = quads.slice(i, i + 6) as QuadPos;
    const { x, y } = getPathPos(quadPos, pathLeft, pathRight, tileSize, size);
    feature.nodes.push({ x, y, r: size / 2 + padding });
  }
}

/**
 * Store path feature's filters for the GPU to filter overalapping glyphs
 * @param feature - glyph feature
 * @param quads - glyph quads
 * @param padding - glyph padding
 */
function storePathFeatureFilters(feature: GlyphPath, quads: Quad, padding: number): void {
  for (let i = 0, ql = quads.length; i < ql; i += QUAD_SIZE_PATH) {
    feature.filters.push([
      // st, offsetXY, xy
      ...quads.slice(i, i + 6),
      // paths
      ...quads.slice(i + 12, i + 20),
      // padding
      padding,
    ] as PathFilter);
  }
}

// import { getPathPos } from '../util/index.js';

// import type { Glyph } from './familySource.js';
// import type { MapGlyphSource } from '../imageStore.js';
// import type { Point } from 'gis-tools/index.js';
// import type { Alignment, Anchor } from 'style/style.spec.js';
// import type { GlyphPath, GlyphPoint, PathFilter } from './glyph.spec.js';
// import type { Path, QuadPos } from '../util/index.js';

use crate::{
    style::Anchor,
    workers::{GlyphPath, Path, RoundNode, RoundNodes, get_path_pos},
};
use s2json::{GetXY, VectorPoint};

/**
 * Quads
 * - BOX: [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
 * - CIRCLE: [s, t, xOffset, yOffset, path1X, path1Y, path2X, path2Y, path3X, path3Y, path4X, path4Y, distance, texX, texY, texWidth, texHeight]
 *
 * the xPos and yPos are for the 0->1 ratio placement. This is computed internally with size
 * meanwhile xOffset and yOffset are where to start from the s, t position (the pixel based offset)
 */
pub type Quad = Vec<f32>;
// export type Quad = number[];

// /**
//  * BOX: [s, t, anchorOffsetX, anchorOffsetY, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
//  * CIRCLE: [s, t, anchorOffsetX, anchorOffsetY, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
//  */
// export type Filter = number[];

// /** Row: [rowCount, rowWidth, rowHeight] */
// export type Row = [rowCount: number, rowWidth: number, rowHeight: number];

/// Size of each quad for text type
pub const QUAD_SIZE_TEXT: usize = 12;
/// Size of each quad for path type
pub const QUAD_SIZE_PATH: usize = 20;

// export const NULL_GLYPH = {
//   code: '0',
//   texX: 0,
//   texY: 0,
//   texW: 0,
//   texH: 0,
//   xOffset: 0,
//   yOffset: 0,
//   width: 0,
//   height: 0,
//   advanceWidth: 0,
// };

// /**
//  * This step exclusively creates quad data, E.G. How to draw each glyph on the screen,
//  * given the anchor point as a basis for drawing. This step is seperate to preprocessing
//  * as we are avoiding doing too much work prior to potentially filtering the object (rtree).
//  * NOTE: EVERY GLYPH is currently "normalized", with a 0->1 scale so it can later be
//  * multiplied by "size"
//  * NOTE: Just put the glyph offsets + word-wrap-y offset provided at first,
//  * add in the excess anchor offset AFTER we know the bbox size
//  * TODO: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
//  * @param feature - input glyph point feature
//  * @param glyphSource - glyph source to pull glyph metadata from
//  * @param tile_size - tile size/extent
//  */
// export function buildGlyphPointQuads(
//   feature: GlyphPoint,
//   glyphSource: MapGlyphSource,
//   tile_size: number,
// ): void {
//   const { max } = Math;
//   const {
//     s,
//     t,
//     size,
//     offset,
//     padding,
//     family,
//     anchor,
//     fieldCodes,
//     wordWrap,
//     align,
//     kerning,
//     lineHeight,
//     type,
//     quads,
//   } = feature;
//   const [offsetX, offsetY] = offset;
//   const [paddingX, paddingY] = padding;
//   // setup variable
//   const rows: Row[] = []; // a row: [glyph count, rowMaxWidth, rowMaxHeight]
//   let rowCount = 0;
//   let rowWidth = 0;
//   let rowHeight = 0;
//   let cursorX = 0;
//   // run through string using the glyphSet as a guide to build the quads
//   for (const unicode of fieldCodes) {
//     // word-wrap if line break or length exceeds max allowed.
//     if (
//       type === 'text' && // is text
//       (unicode === '10' ||
//         unicode === '13' ||
//         (unicode === '32' && wordWrap !== 0 && cursorX >= wordWrap))
//     ) {
//       cursorX = 0;
//       const heightAdjust = rowCount > 0 ? rowHeight + lineHeight : 0;
//       updateGlyphPos(quads, 0, heightAdjust); // we move all previous content up a row
//       rows.push([rowCount, rowWidth, heightAdjust]);
//       rowCount = 0;
//       rowWidth = 0;
//       rowHeight = 0;
//       continue;
//     }
//     // grab the unicode information
//     const unicodeData = getGlyph(glyphSource, family, unicode);
//     if (unicodeData === undefined) continue;
//     const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData;
//     // prep x-y positions
//     const xPos = cursorX + xOffset;
//     const yPos = yOffset;
//     if (texW > 0 && texH > 0) {
//       // store quad
//       quads.push(
//         // NOTE: offsetX and offsetY are the pixel based offset
//         // while xPos and yPos are the 0->1 glyph ratio placement
//         // position data
//         s,
//         t,
//         offsetX,
//         offsetY,
//         xPos,
//         yPos,
//         width,
//         height,
//         // texture data
//         texX,
//         texY,
//         texW,
//         texH,
//       );
//       // update number of glyphs and draw box height
//       rowCount++;
//       rowHeight = max(rowHeight, height);
//     }
//     // always update rowWidth by advanceWidth
//     rowWidth = max(rowWidth, xPos + width, xPos + advanceWidth);
//     // advance cursor position
//     cursorX += advanceWidth + kerning;
//   }
//   // store the last row
//   rows.push([rowCount, rowWidth, rowCount > 0 ? rowHeight + lineHeight : 0]);
//   // grab max width from said
//   const maxWidth = rows.reduce((acc, curr) => max(acc, curr[1]), 0);
//   const maxHeight = rows.reduce((acc, curr) => acc + curr[2], 0);
//   // adjust text based upon center-align or right-align
//   align_text(align, quads, rows, maxWidth);
//   // now adjust all glyphs and max-values by the anchor and alignment
//   const [anchorOffsetX, anchorOffsetY] = anchorOffset(anchor, maxWidth, maxHeight);
//   updateGlyphPos(quads, anchorOffsetX, anchorOffsetY);

//   // set minX, maxX, minY, maxY in the feature
//   feature.minX = s * tile_size + offsetX + anchorOffsetX * size - paddingX;
//   feature.minY = t * tile_size + offsetY + anchorOffsetY * size - paddingY;
//   feature.maxX = feature.minX + maxWidth * size + paddingX * 2;
//   feature.maxY = feature.minY + maxHeight * size + paddingY * 2;
//   // store the filter
//   feature.filter = [
//     s,
//     t,
//     anchorOffsetX,
//     anchorOffsetY,
//     offsetX,
//     offsetY,
//     paddingX,
//     paddingY,
//     maxWidth,
//     maxHeight,
//   ];
// }

// /**
//  * Build glyph path quads
//  * IDEATION: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
//  * @param feature - glyph lines feature
//  * @param glyphSource - glyph source to pull glyph metadata from
//  * @param tile_size - tile size/extent
//  */
// export function buildGlyphPathQuads(
//   feature: GlyphPath,
//   glyphSource: MapGlyphSource,
//   tile_size: number,
// ): void {
//   const { max } = Math;
//   // NOTE: missing "size" and "padding"
//   const { size, offset, family, anchor, pathData, align, kerning } = feature;
//   let { fieldCodes } = feature;
//   const [offsetX, offsetY] = offset;
//   const padding = max(...feature.padding);
//   const {
//     point: { x: s, y: t },
//     path_left,
//     path_right,
//   } = pathData;
//   // first replace all newlines with spaces
//   fieldCodes = fieldCodes.map((unicode) => {
//     if (unicode === '10' || unicode === '13') return '32';
//     else return unicode;
//   });
//   // setup variable
//   let maxWidth = 0;
//   let maxHeight = 0;
//   let cursorX = 0;
//   // run through string using the glyphSet as a guide to build the quads
//   const quads: number[] = [];
//   for (const unicode of fieldCodes) {
//     // grab the unicode information
//     const unicodeData = getGlyph(glyphSource, family, unicode);
//     if (unicodeData === undefined) continue;
//     const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData;
//     maxHeight = max(maxHeight, height);
//     // prep x-y positions & distance
//     const xPos = cursorX + xOffset + width / 2;
//     const yPos = yOffset + height / 2;
//     // skip no texture data like spaces
//     if (texW > 0 && texH > 0) {
//       // NOTE: texX, texY, texW, texH, offsetX, and offsetY are the pixel based values
//       // while xPos, yPos, width, and height are the 0->1 ratio placement to user defined size
//       // st is 0->1 ratio relative to tile size
//       quads.push(
//         // position data
//         s,
//         t,
//         offsetX,
//         offsetY,
//         xPos,
//         yPos,
//         width,
//         height,
//         // texture data
//         texX,
//         texY,
//         texW,
//         texH,
//         // tmp path data
//         0,
//         0,
//         0,
//         0,
//         0,
//         0,
//         0,
//         0,
//       );
//     }
//     maxWidth = max(maxWidth, xPos + width, xPos + advanceWidth);
//     // advance cursor position
//     cursorX += advanceWidth + kerning;
//   }
//   // adjust text based upon center-align or right-align
//   align_text(align, quads, [[0, maxWidth, 0]], maxWidth, 'path');
//   // now adjust all glyphs and max-values by the anchor and alignment
//   const [anchorOffsetX, anchorOffsetY] = anchorOffsetPath(anchor, maxWidth, maxHeight);
//   updateGlyphPos(quads, anchorOffsetX, anchorOffsetY, 'path');
//   // set the correct path data relative to whether the glyph is traveling
//   // left or right from the anchor point
//   update_path_data(quads, path_left, path_right);
//   // add nodes to the feature for each quad
//   build_feature_nodes(feature, quads, path_left, path_right, size, padding, tile_size);
//   // last step is to build the filter container paths. For each quad just
//   // copy paste a slice from st to end of path, add padding, and store to filters
//   store_path_feature_filters(feature, quads, padding);
//   // store quads in feature
//   feature.quads.push(...quads);
// }

// /**
//  * Get a glyph's metadata from the glyph source
//  * @param glyphSource - glyph source
//  * @param family - glyph family
//  * @param code - glyph code
//  * @returns the glyph metadata
//  */
// function getGlyph(glyphSource: MapGlyphSource, family: string[], code: string): Glyph {
//   for (const familyName of family) {
//     const glyphFamily = glyphSource.get(familyName);
//     if (glyphFamily === undefined) continue;
//     const glyph = glyphFamily.glyphCache.get(code);
//     if (glyph !== undefined) return glyph;
//   }
//   return NULL_GLYPH;
// }

// /**
//  * Update the position of the glyphs
//  * @param quads - glyph quads
//  * @param offsetX - x offset
//  * @param offsetY - y offset
//  * @param glyphType - glyph type
//  */
// function updateGlyphPos(
//   quads: Quad,
//   offsetX: number,
//   offsetY: number,
//   glyphType: 'text' | 'path' = 'text',
// ): void {
//   const quadSize = glyphType === 'text' ? QUAD_SIZE_TEXT : QUAD_SIZE_PATH;
//   for (let i = 0, ql = quads.length; i < ql; i += quadSize) {
//     quads[i + 4] += offsetX;
//     quads[i + 5] += offsetY;
//   }
// }

impl Anchor {
    /**
     * Set an user defined anchor offset. boxes start at the bottom left as UV [0,0] to [1, 1]
     * @param anchor - anchor type
     * @param width - full width of all glyphs in the line or paragrpah
     * @param height - full height of all glyphs in the line or paragrpah
     * @returns the anchor offset
     */
    pub fn offset_point(&self, width: f32, height: f32) -> [f32; 2] {
        match self {
            Anchor::Center => [-width / 2.0, -height / 2.0],
            Anchor::Top => [-width / 2.0, -height],
            Anchor::TopRight => [-width, -height],
            Anchor::Right => [-width, -height / 2.0],
            Anchor::BottomRight => [-width, 0.0],
            Anchor::Bottom => [-width / 2.0, 0.0],
            Anchor::BottomLeft => [0.0, 0.0],
            Anchor::Left => [0.0, -height / 2.0],
            Anchor::TopLeft => [0.0, -height],
        }
    }

    /**
     * Set a user defined anchor offset for path glyphs
     * the path drawing takes [-0.5, -0.5] to [0.5, 0.5] quads
     * @param anchor - anchor type
     * @param width - full width of all glyphs in the line or paragrpah
     * @param height - full height of all glyphs in the line or paragrpah
     * @returns the anchor offset
     */
    pub fn offset_path(&self, width: f32, height: f32) -> [f32; 2] {
        match self {
            Anchor::Center => [-width / 2.0, 0.],
            Anchor::Top => [-width / 2.0, -height / 2.],
            Anchor::TopRight => [-width, -height / 2.],
            Anchor::Right => [-width, 0.],
            Anchor::BottomRight => [-width, height / 2.],
            Anchor::Bottom => [-width / 2.0, height / 2.],
            Anchor::BottomLeft => [0., height / 2.],
            Anchor::Left => [0., 0.],
            Anchor::TopLeft => [0., -height / 2.],
        }
    }
}

// /**
//  * Align text given a user defined alignment
//  * @param align - alignment
//  * @param quads - glyph quads
//  * @param rows - rows and their size,width,& height
//  * @param maxWidth - max width found from all rows
//  * @param glyphType - glyph type (text or path)
//  */
// fn align_text(
//   align: Alignment,
//   quads: Quad,
//   rows: Row[],
//   maxWidth: number,
//   glyphType: 'text' | 'path' = 'text',
// ): void {
//   const quadSize = glyphType === 'text' ? QUAD_SIZE_TEXT : QUAD_SIZE_PATH;
//   if (align !== 'center' && align !== 'right') return;
//   const alignFunc =
//     align === 'center'
//       ? (mW: number, rW: number): number => (mW - rW) / 2 // center align
//       : (mW: number, rW: number): number => mW - rW; // right align

//   let currPos = 0;
//   let idx = 0;
//   // iterate rows, grab their count and width, adjust as necessary
//   for (const [rowCount, rowWidth] of rows) {
//     // if row is same size as the width of the display box, move on
//     if (rowWidth === maxWidth) {
//       currPos += rowCount;
//       continue;
//     }
//     // find the alignment based upon the rows width and the total draw box width
//     const adjust = alignFunc(maxWidth, rowWidth);
//     // iterate the rows, adding the x-y adjustment as appropriate
//     for (let i = 0; i < rowCount; i++) {
//       idx = currPos * quadSize;
//       quads[idx + 4] += adjust;
//       currPos++;
//     }
//   }
// }

/**
 * Update path data's x and y
 * @param quads - glyph quads
 * @param path_left - left path
 * @param path_right - right path
 */
fn update_path_data(quads: &mut Quad, path_left: &Path, path_right: &Path) {
    let mut i = 0;
    while i < quads.len() {
        let path = (if quads[i + 4] >= 0.0 { path_right } else { path_left }).to_vec();
        for j in 0..4 {
            quads[i + 12 + j * 2] = path[j].x() as f32;
            quads[i + 13 + j * 2] = path[j].y() as f32;
        }
        i += QUAD_SIZE_PATH;
    }
}

/**
 * Build feature nodes
 * @param feature - glyph feature
 * @param quads - glyph quads
 * @param path_left - left path
 * @param path_right - right path
 * @param size - glyph size
 * @param padding - glyph padding
 * @param tile_size - tile size
 */
fn build_feature_nodes(
    feature: &mut GlyphPath,
    quads: &Quad,
    path_left: &Path,
    path_right: &Path,
    size: f64,
    padding: f64,
    tile_size: f64,
) {
    let mut i = 0;
    while i < quads.len() {
        let quad_pos = &quads[i..i + 6];
        let VectorPoint { x, y, .. } =
            get_path_pos::<()>(quad_pos.into(), path_left, path_right, tile_size, size);
        feature.nodes.nodes.push(RoundNode { x, y, r: size / 2.0 + padding });
        i += QUAD_SIZE_PATH;
    }
}

/**
 * Store path feature's filters for the GPU to filter overalapping glyphs
 * @param feature - glyph feature
 * @param quads - glyph quads
 * @param padding - glyph padding
 */
fn store_path_feature_filters(feature: &mut GlyphPath, quads: &Quad, padding: f32) {
    let mut i = 0;
    while i < quads.len() {
        // st, offsetXY, xy
        feature.filters.extend(&quads[i..i + 6]);
        // paths
        feature.filters.extend(&quads[i + 12..i + 20]);
        // padding
        feature.filters.push(padding);
        i += QUAD_SIZE_PATH;
    }
}

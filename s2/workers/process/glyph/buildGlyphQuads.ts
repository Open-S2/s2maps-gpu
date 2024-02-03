import { findPointsAlongLine, flattenGeometry } from '../util'
import { clipLines } from '../util/scaleShiftClip'

import type { Alignment, Anchor } from 'style/style.spec'
import type { GlyphPath, GlyphPoint } from './glyph.spec'
// import type { MapGlyphSource } from '../imageStore'
import type { MapGlyphSource } from '../imageStore'
import type { Glyph } from './familySource'

// [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight, id]
export type Quad = number[]
// the xPos and yPos are for the 0->1 ratio placement. This is computed internally with size
// meanwhile xOffset and yOffset are where to start from the s, t position (the pixel based offset)

// [s, t, anchorOffsetX, anchorOffsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
export type Filter = number[]

export const QUAD_SIZE = 12

export const MEDIALS_AND_VOWELS = [
  // MYANMAR MEDIALS
  '4155', '4156', '4157', '4158', '4190', '4191', '4192', '4226',
  // TIBETAN VOWELS
  '3953', '3954', '3955', '3956', '3957', '3958', '3959', '3960', '3961', '3962', '3963', '3964', '3965',
  // TAMIL VOWELS
  '3006', '3007', '3008', '3009', '3010', '3011', '3012', '3013', '3014', '3015', '3016'
  // ORIYA VOWELS
  // '2878' to '2888'
  // TODO: Maybe consider Decompose these? Not sure if something along the way is bugged or I'm missing something else
  // 0 decompose 2888(0B48): 2887(0B47) ->  -> previous char
  // 1 decompose 2891(0B4B): 2887(0B47) -> previous char -> 2878(0B3E)
  // 2 decompose 2892(0B4C): 2887(0B47) -> previous char -> 2903(0B57)
  // '2888', '2891', '2892'
]

export const NULL_GLYPH = { code: '0', texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: 0 }

// This step exclusively creates quad data, E.G. How to draw each glyph on the screen,
// given the anchor point as a basis for drawing. This step is seperate to preprocessing
// as we are avoiding doing too much work prior to potentially filtering the object (rtree).
// NOTE: EVERY GLYPH is currently "normalized", with a 0->1 scale so it can later be
// multiplied by "size"
// NOTE: Just put the glyph offsets + word-wrap-y offset provided at first,
// add in the excess anchor offset AFTER we know the bbox size
// TODO: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
export function buildGlyphPointQuads (
  feature: GlyphPoint,
  glyphSource: MapGlyphSource
): void {
  const { max } = Math
  const {
    s, t, size, offset, padding, family, anchor,
    wordWrap, align, kerning, lineHeight, type, quads
  } = feature
  let { fieldCodes } = feature
  const [adjustX, adjustY] = offset
  // update field codes if it contains joining characters
  if (type === 'text') fieldCodes = adjustMedials(fieldCodes)
  // setup variable
  const rows: Array<[number, number, number]> = [] // a row: [glyph count, rowMaxWidth, rowMaxHeight]
  let rowCount = 0
  let rowWidth = 0
  let rowHeight = 0
  let cursorX = 0
  // run through string using the glyphSet as a guide to build the quads
  for (const unicode of fieldCodes) {
    // word-wrap if line break or length exceeds max allowed.
    if (
      type === 'text' && // is text
      (unicode === '10' || unicode === '13' || (unicode === '32' && wordWrap !== 0 && cursorX >= wordWrap))
    ) {
      cursorX = 0
      const heightAdjust = rowCount > 0 ? rowHeight + lineHeight : 0
      updateoffset(quads, 0, heightAdjust) // we move all previous content up a row
      rows.push([rowCount, rowWidth, heightAdjust])
      rowCount = 0
      rowWidth = 0
      rowHeight = 0
      continue
    }
    // grab the unicode information
    const unicodeData = getGlyph(glyphSource, family, unicode)
    if (unicodeData === undefined) continue
    const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData
    // prep x-y positions
    const xPos = cursorX + xOffset
    const yPos = yOffset
    if (texW > 0 && texH > 0) {
      // store quad
      quads.push(s, t, adjustX, adjustY, xPos, yPos, width, height, texX, texY, texW, texH)
      // update number of glyphs and draw box height
      rowCount++
      rowHeight = max(rowHeight, height)
    }
    // always update rowWidth by advanceWidth
    rowWidth = max(rowWidth, xPos + width, xPos + advanceWidth)
    // advance cursor psoition
    cursorX += advanceWidth + kerning
  }
  // store the last row
  rows.push([rowCount, rowWidth, rowCount > 0 ? rowHeight + lineHeight : 0])
  // grab max width from said
  const maxWidth = rows.reduce((acc, curr) => max(acc, curr[1]), 0)
  const maxHeight = rows.reduce((acc, curr) => acc + curr[2], 0)
  // adjust text based upon center-align or right-align
  alignText(align, quads, rows, maxWidth)
  // now adjust all glyphs and max-values by the anchor and alignment
  const [anchorOffsetX, anchorOffsetY] = anchorOffset(anchor, maxWidth, maxHeight)
  updateoffset(quads, anchorOffsetX, anchorOffsetY)

  // set minX, maxX, minY, maxY in the feature
  feature.minX = (s * 768) + adjustX + (anchorOffsetX * size) - padding[0]
  feature.minY = (t * 768) + adjustY + (anchorOffsetY * size) - padding[1]
  feature.maxX = feature.minX + (maxWidth * size) + (padding[0] * 2)
  feature.maxY = feature.minY + (maxHeight * size) + (padding[1] * 2)
  // store the filter
  feature.filter = [s, t, anchorOffsetX, anchorOffsetY, ...padding, maxWidth, maxHeight]
}

// IDEATION: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
export function buildGlyphPathQuads (
  feature: GlyphPath,
  glyphSource: MapGlyphSource
): void {
  const { max } = Math
  // NOTE: missing "size" and "padding"
  const {
    offset, family, anchor, geometry,
    geometryType, extent, align, kerning, type, quads
  } = feature
  let { fieldCodes } = feature
  const [adjustX, adjustY] = offset
  // update field codes if it contains joining characters
  if (type === 'text') fieldCodes = adjustMedials(fieldCodes)
  // first replace all newlines with spaces
  fieldCodes = fieldCodes.map(unicode => {
    if (unicode === '10' || unicode === '13') return '32'
    else return unicode
  })
  // setup variable
  let maxWidth = 0
  let maxHeight = 0
  let cursorX = 0
  // first run builds maxWidth and maxHeight
  for (const unicode of fieldCodes) {
    const unicodeData = getGlyph(glyphSource, family, unicode)
    if (unicodeData === undefined) continue
    const { texW, texH, xOffset, width, height, advanceWidth } = unicodeData
    maxHeight = max(maxHeight, height)
    const xPos = cursorX + xOffset
    if (texW > 0 && texH > 0) maxHeight = max(maxHeight, height)
    // always update rowWidth by advanceWidth
    maxWidth = max(maxWidth, xPos + width, xPos + advanceWidth)
    // advance cursor position
    cursorX += advanceWidth + kerning
  }
  // reset cursor
  cursorX = 0
  // grab geometry lines and clip
  let lines = flattenGeometry(geometry, geometryType)
  // clip any data outside the 0->extent boundary
  lines = clipLines(lines, extent, geometryType > 2, 0)
  if (lines.length === 0) return
  // build points for each line
  const points = findPointsAlongLine(lines, maxWidth, extent)
  // TODO: given the geometry, check if the line is long enough to fit the glyph
  // TODO: given the geometry, find the anchor points to place the glyph
  // TODO: build the filters + x,y,r for each set of glyphs
  // run through string using the glyphSet as a guide to build the quads
  for (const [s, t] of points) {
    for (const unicode of fieldCodes) {
      // grab the unicode information
      const unicodeData = getGlyph(glyphSource, family, unicode)
      if (unicodeData === undefined) continue
      const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData
      // prep x-y positions
      const xPos = cursorX + xOffset
      const yPos = yOffset
      if (texW > 0 && texH > 0) {
        // store quad
        quads.push(s, t, adjustX, adjustY, xPos, yPos, width, height, texX, texY, texW, texH)
      }
      // advance cursor position
      cursorX += advanceWidth + kerning
    }
    // adjust text based upon center-align or right-align
    alignText(align, quads, [[0, maxWidth, 0]], maxWidth)
    // now adjust all glyphs and max-values by the anchor and alignment
    const [anchorOffsetX, anchorOffsetY] = anchorOffset(anchor, maxWidth, maxHeight)
    updateoffset(quads, anchorOffsetX, anchorOffsetY)
    // last step is to build the filter container for both worker and render filtering
  }
}

function getGlyph (glyphSource: MapGlyphSource, family: string[], code: string): Glyph {
  for (const familyName of family) {
    const glyphFamily = glyphSource.get(familyName)
    if (glyphFamily === undefined) continue
    const glyph = glyphFamily.glyphCache.get(code)
    if (glyph !== undefined) return glyph
  }
  return NULL_GLYPH
}

// NOTE: Tempporary solution; remove whne zig module implements more languages
// MYANMAR MEDIALS go after the characters they are attached to
function adjustMedials (fieldCodes: string[]): string[] {
  for (let i = 1, fl = fieldCodes.length; i < fl; i++) {
    if (MEDIALS_AND_VOWELS.includes(fieldCodes[i])) {
      // swap with previous char
      const prev = fieldCodes[i - 1]
      fieldCodes[i - 1] = fieldCodes[i]
      fieldCodes[i] = prev
    }
  }
  return fieldCodes
}

function updateoffset (quads: Quad, adjustX: number, adjustY: number): void {
  for (let i = 0, ql = quads.length; i < ql; i += QUAD_SIZE) {
    quads[i + 4] += adjustX
    quads[i + 5] += adjustY
  }
}

function anchorOffset (anchor: Anchor, width: number, height: number): [number, number] {
  if (anchor === 'center') return [-width / 2, -height / 2]
  else if (anchor === 'top') return [-width / 2, -height]
  else if (anchor === 'top-right') return [-width, -height]
  else if (anchor === 'right') return [-width, -height / 2]
  else if (anchor === 'bottom-right') return [-width, 0]
  else if (anchor === 'bottom') return [-width / 2, 0]
  else if (anchor === 'bottom-left') return [0, 0]
  else if (anchor === 'left') return [0, -height / 2]
  else if (anchor === 'top-left') return [0, -height]
  else return [-width / 2, -height / 2] // default to center
}

function alignText (
  align: Alignment,
  quads: Quad,
  rows: Array<[number, number, number]>,
  maxWidth: number
): void {
  if (align !== 'center' && align !== 'right') return
  const alignFunc = (align === 'center')
    ? (mW: number, rW: number): number => (mW - rW) / 2 // center align
    : (mW: number, rW: number): number => mW - rW // right align

  let currPos = 0
  let idx = 0
  // iterate rows, grab their count and width, adjust as necessary
  for (const [rowCount, rowWidth] of rows) {
    // if row is same size as the width of the display box, move on
    if (rowWidth === maxWidth) {
      currPos += rowCount
      continue
    }
    // find the alignment based upon the rows width and the total draw box width
    const adjust = alignFunc(maxWidth, rowWidth)
    // iterate the rows, adding the x-y adjustment as appropriate
    for (let i = 0; i < rowCount; i++) {
      idx = currPos * QUAD_SIZE
      quads[idx + 4] += adjust
      currPos++
    }
  }
}

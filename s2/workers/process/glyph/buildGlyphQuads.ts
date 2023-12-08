import type { Alignment, Anchor } from 'style/style.spec'
import type { GlyphObject } from './glyph.spec'
import type { GlyphMap } from '../imageStore'

// [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight, id]
export type Quad = number[]
// the xPos and yPos are for the 0->1 ratio placement. This is computed internally with size
// meanwhile xOffset and yOffset are where to start from the s, t position (the pixel based offset)

// [s, t, anchorOffsetX, anchorOffsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
export type Filter = number[]

export const QUAD_SIZE = 12

export const MYANMAR_MEDIALS = [4155, 4156, 4157, 4158, 4190, 4191, 4192, 4226]

// This step exclusively creates quad data, E.G. How to draw each glyph on the screen,
// given the anchor point as a basis for drawing. This step is seperate to preprocessing
// as we are avoiding doing too much work prior to potentially filtering the object (rtree).
// NOTE: EVERY GLYPH is currently "normalized", with a 0->1 scale so it can later be
// multiplied by "size"
// NOTE: Just put the glyph offsets + word-wrap-y offset provided at first,
// add in the excess anchor offset AFTER we know the bbox size
export default function buildGlyphQuads (
  feature: GlyphObject,
  glyphMap: GlyphMap
): void {
  const { max } = Math
  const {
    s, t, size, offset, padding, family, anchor,
    wordWrap, align, kerning, lineHeight, type, quads
  } = feature
  let { fieldCodes } = feature
  const familyMap = glyphMap[family]
  const adjustX = offset[0]
  const adjustY = offset[1]
  // update field codes if it contains joining characters
  if (type === 'text') fieldCodes = adjustMedials(fieldCodes)
  // setup variable
  const rows: Array<[number, number, number]> = [] // a row: [glyph count, rowMaxWidth]
  let rowCount = 0
  let rowWidth = 0
  let rowHeight = 0
  let cursorX = 0
  // run through string using the glyphSet as a guide to build the quads
  for (const unicode of fieldCodes) {
    // word-wrap if line break or length exceeds max allowed.
    if (
      type === 'text' && // is text
      (unicode === 10 || unicode === 13 || (unicode === 32 && wordWrap !== 0 && cursorX >= wordWrap))
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
    const unicodeData = familyMap[unicode]
    if (unicodeData === undefined) continue
    const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = unicodeData
    // prep x-y positions
    const xPos = cursorX + xOffset
    const yPos = yOffset
    if (texW > 0 && texH > 0) {
      // store quad
      quads.push(s * 8_192, t * 8_192, adjustX, adjustY, xPos, yPos, width, height, texX, texY, texW, texH)
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
  // build bbox given current size
  // const bbox = [anchorOffsetX, anchorOffsetY, maxWidth + anchorOffsetX, maxHeight + anchorOffsetY]
  // set minX, maxX, minY, maxY in the feature
  feature.minX = (s * 1_024) + adjustX + (anchorOffsetX * size) - padding[0]
  feature.minY = (t * 1_024) + adjustY + (anchorOffsetY * size) - padding[1]
  feature.maxX = feature.minX + (maxWidth * size) + (padding[0] * 2)
  feature.maxY = feature.minY + (maxHeight * size) + (padding[1] * 2)
  // store the filter
  feature.filter = [s * 8_192, t * 8_192, anchorOffsetX, anchorOffsetY, ...padding, maxWidth, maxHeight]
}
// var XY = ((container.xy * size) - padding) / uAspect; // setup the xy positional change in pixels
// var WH = ((container.wh * size) + (padding * 2)) / uAspect;

// MYANMAR MEDIALS go after the characters they are attached to
function adjustMedials (fieldCodes: number[]): number[] {
  for (let i = 1, fl = fieldCodes.length; i < fl; i++) {
    if (MYANMAR_MEDIALS.includes(fieldCodes[i])) {
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

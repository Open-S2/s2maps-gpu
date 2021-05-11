// @flow
// [xOffset, yOffset, texU, texV, texWidth, texHeight]
export type Quad = [number, number, number, number, number, number]

export type GlyphQuads = {
  bbox: [number, number, number, number], // [x, y, width, height]
  glyphQuads: Array<Quad>
}

// This step exclusively creates quad data, E.G. How to draw each glyph on the screen,
// given the anchor point as a basis for drawing. This step is seperate to preprocessing
// as we are avoiding doing too much work prior to potentially filtering the object (rtree).
export function buildGlyphQuads (glyph: GlyphObject, glyphSet: GlyphSet) {
  const { field, anchor, wordWrap } = glyph
  // setup variable
  const quads: Array<Quad> = []
  const bbox: [number, number, number, number] = [0, 0, 0, 0]
  let cursorX = 0
  let cursorY = 0
  // run through string using the glyphSet as a guide to build the quads
  for (const char of field) {
    const glyph = glyphSet.get(char)
    if (glyph) {

    } else {

    }
  }
  // build bbox given cursor positions

  // now adjust by the anchor

  // store results
  glyph.bbox = bbox
  glyph.quads = quads
}

// NOTE: EVERY GLYPH is currently "normalized", with a 0->1 scale so it can later be
// multiplied by "size"

// NOTE: Just put the glyph offsets + word-wrap-y offset provided at first,
// add in the excess anchor offset AFTER we know the bbox size

// GlyphSet => { [unicode]: Glyph }

// export type Glyph = {
//   texX: number, // x position on glyph texture sheet
//   texY: number, // y position on glyph texture sheet
//   texW: number,
//   texH: number,
//   xOffset: number, // x offset for glyph
//   yOffset: number, // y offset for glyph
//   advanceWidth: number // how far to move the cursor
// }

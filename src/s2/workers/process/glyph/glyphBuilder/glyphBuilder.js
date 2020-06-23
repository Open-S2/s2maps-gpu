// @flow
import { RTree, TexturePack } from './'

import type { Text } from '../../tile.worker'
import type { Glyph } from './texturePack'
import type { Quad } from './rtree'

export type Path = {
  vertices: Array<number>,
  indices: Array<number>,
  quads: Array<number>,
  strokes: Array<Array<number>>
}

export type FontOptions = {
  fontSize: number
}

export default class GlyphBuilder {
  texturePack: TexturePack = new TexturePack()
  glyphFilterVertices: Array<number> = []
  glyphQuads: Array<number> = []
  layerGuide: Array<number> = []
  filterOffset: number = 0
  quadOffset: number = 0
  rtree: RTree = new RTree()
  dneGlyph: Glyph

  clear () {
    this.rtree.clear()
    this.texturePack.clear()
    this.glyphFilterVertices = []
    this.layerGuide = []
    this.glyphQuads = []
    this.filterOffset = 0
    this.quadOffset = 0
  }

  finishLayer (layerID: number, code: Array<number> = []) {
    // get offsets
    const filterOffset = this.glyphFilterVertices.length / 8
    const quadOffset = this.glyphQuads.length / 10
    // get counts
    const filterCount = filterOffset - this.filterOffset
    const quadCount = quadOffset - this.quadOffset
    // if any non-zero, draw
    if (filterCount > 0 || quadCount > 0) {
      // layerID, filterOffset, filterCount, quadOffset, quadCount, codeLength, code
      this.layerGuide.push(layerID, this.filterOffset, filterCount, this.quadOffset, quadCount, code.length, ...code)
      this.filterOffset = filterOffset
      this.quadOffset = quadOffset
    }
  }

  addFont (familyName: string, pbf: ArrayBuffer, opts: FontOptions = {}) {
    this.texturePack.addFont(familyName, pbf, opts)
    // if default font, try to setup the "char doesn't exist" glyph
    if (familyName === 'default') this.dneGlyph = this.texturePack.getGlyph('default', String.fromCharCode(9633))
  }

  testQuad (quad: Quad): boolean {
    // build the bbox
    let s = Math.round(quad.s * 512)
    let t = Math.round(quad.t * 512)
    quad.minX = s + quad.x
    quad.minY = t + quad.y
    quad.maxX = s + quad.x + (quad.width * quad.size)
    quad.maxY = t + quad.y + quad.height
    return !this.rtree.collides(quad)
  }

  getWidthAndGlyphData (family: string, field: string) {
    const families = [family, 'default']
    const glyphData = []
    let width = 0
    let found
    // run through each character in the field param and build out glyph data & width
    for (const char of field) {
      found = false
      // we check glyphsets first
      for (const fam of families) {
        const glyph = this.texturePack.getGlyph(fam, char)
        if (glyph) {
          width += glyph.advanceWidth
          glyphData.push([fam, char])
          found = true
          break
        }
      }
      // if we couldn't find the character, we check if our default font has a DNE,
      // otherwise we store a null
      if (!found) {
        if (this.dneGlyph) {
          width += this.dneGlyph.advanceWidth
          glyphData.push(['default', 9633])
        } else { glyphData.push(null) }
      }
    }

    return [width, glyphData]
  }

  // by far the most complex component of the glyph builder.
  // all text is build via 0 to 1 glyph scale. That way everything can be multiplied by the font size
  // for the texture and eventual quad draw, width needs to be a multiplier of height
  // 1) add to our glyphFilterVertices the text dimesions
  // 2) add any missing glyphs to our texturePack
  // 3) reference the texture when building quad glyph data (always put strokes in the front, fills in the back)
  buildText (text: Text) {
    const { s, t, x, y, family, width, id, padding, offset, strokeWidth, glyphData } = text
    // 1) add to our glyphFilterVertices the text dimesions
    this.glyphFilterVertices.push(s, t, x, y, ...padding, width, id)
    // 2 & 3) build our texture and glyph vertices
    let glyph: Glyph
    let xOffset = 0
    // for each glyph in
    for (const gData of glyphData) {
      if (gData) {
        const [family, char] = gData
        // grab the glyph
        glyph = this.texturePack.getGlyph(family, char)
        if (!glyph) glyph = this.dneGlyph
        if (glyph) {
          this.glyphQuads.push(s, t, x, y, xOffset, ...glyph.bbox, id)
          // update offset (remove the glyph excess padding)
          xOffset += glyph.advanceWidth
        }
      }
    }
  }
}

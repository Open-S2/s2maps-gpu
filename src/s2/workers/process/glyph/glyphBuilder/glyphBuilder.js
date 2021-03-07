// @flow
import { RTree, TexturePack } from './'

import type { Glyph } from './texturePack'

export type Path = {
  vertices: Array<number>,
  indices: Array<number>,
  quads: Array<number>,
  strokes: Array<number>
}

export type FontOptions = {
  fontSize: number
}

export default class GlyphBuilder {
  texturePack: TexturePack = new TexturePack()
  glyphFilterVertices: Array<number> = []
  glyphQuads: Array<number> = [] // Float32Array
  glyphColors: Array<number> = [] // Uint8ClampedArray [r, g, b, a, ...]
  layerGuide: Array<number> = []
  filterOffset: number = 0
  filterIndex: number = 0
  quadOffset: number = 0
  charIgnoreList: Set<number> = new Set([8206, 3640, 3633, 2509, 2492, 2497, 146, 55300, 56960, 129, 9, 145])
  rtree: RTree = new RTree()
  dneGlyph: Glyph

  clear () {
    this.rtree.clear()
    this.texturePack.clear()
    this.glyphFilterVertices = []
    this.layerGuide = []
    this.glyphQuads = []
    this.glyphColors = []
    this.filterOffset = 0
    this.quadOffset = 0
  }

  finishLayer (layerIndex: number, type: 'text' | 'icon', code: Array<number> = [], subCode?: Array<number>) {
    // get offsets
    const filterOffset = this.glyphFilterVertices.length / 9
    const quadOffset = this.glyphQuads.length / 11
    // get counts
    const filterCount = filterOffset - this.filterOffset
    const quadCount = quadOffset - this.quadOffset
    // if any non-zero, draw
    if (filterCount > 0 || quadCount > 0) {
      // layerIndex, filterOffset, filterCount, quadOffset, quadCount, codeLength, code
      this.layerGuide.push(layerIndex, (type === 'text') ? 0 : 1, this.filterOffset, filterCount, this.quadOffset, quadCount, code.length, ...code)
      // if webgl1, subCode will exist
      if (subCode) this.layerGuide.push(...subCode)
      // update offsets
      this.filterOffset = filterOffset
      this.quadOffset = quadOffset
      // reset filterIndex
      this.filterIndex = 0
    }
  }

  addGlyphStore (familyName: string, pbf: ArrayBuffer, opts: FontOptions = {}) {
    this.texturePack.addGlyphStore(familyName, pbf, opts)
    // if default font, try to setup the "char doesn't exist" glyph
    if (familyName === 'default') this.dneGlyph = this.texturePack.getGlyph('default', String.fromCharCode(9633))
  }

  testQuad (text: Text): boolean {
    const { round } = Math
    // build the bbox
    let s = round(text.s * 512) // 768 is between 512 and 1080 and is a
    let t = round(text.t * 512) // compromise of zooming and reducing too much content
    text.minX = t + text.x
    text.minY = s + text.y
    text.maxX = text.minX + (text.width * text.size)
    text.maxY = text.minY + text.height
    return !this.rtree.collides(text)
  }

  getIconData (family: string, field: string) {
    const glyphData = []
    // first grab the list of features (glyph & color pairs)
    const [width, features] = this.texturePack.getFeatures(family, field)
    if (features.length) {
      for (const [glyphID, color] of features) glyphData.push([family, glyphID, color])
    }

    return [width, glyphData]
  }

  getTextData (family: string, field: string) {
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
          glyphData.push([fam, char, [255, 255, 255, 255]])
          found = true
          break
        }
      }
      // if we couldn't find the character, we check if our default font has a DNE,
      // otherwise we store a null
      if (!found) {
        const unicode = char.charCodeAt(0)
        if (this.charIgnoreList.has(unicode)) { // special cases - weird character that should not be there
          glyphData.push(null)
        } else if (this.dneGlyph) {
          width += this.dneGlyph.advanceWidth
          glyphData.push(['default', String.fromCharCode(9633), [255, 255, 255, 255]])
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
    let { s, t, x, y, width, id, padding, glyphData, offset, overdraw, type } = text
    // adjust s & t
    s *= 8192
    t *= 8192
    // 1) add to our glyphFilterVertices the text dimesions
    if (!overdraw) this.glyphFilterVertices.push(s, t, x, y, ...padding, width, this.filterIndex++, id)
    // 2 & 3) build our texture and glyph vertices
    let glyph: Glyph
    let xOffset = 0
    // for each glyph, grab it's information and store
    for (const gData of glyphData) {
      if (gData) {
        const [family, gID, color] = gData
        // grab the glyph
        glyph = this.texturePack.getGlyph(family, gID)
        if (glyph) {
          // store the quad
          this.glyphQuads.push(s, t, x + offset[0] / width, y + offset[1], xOffset, glyph.yOffset, ...glyph.bbox, id)
          // store color (temp storing procedure)
          this.glyphColors.push(...color)
          // update offset (remove the glyph excess padding)
          if (type === 'text') xOffset += glyph.advanceWidth
        }
      }
    }
  }
}

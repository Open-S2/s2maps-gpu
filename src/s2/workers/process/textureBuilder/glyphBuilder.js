// @flow
import { GlyphSet } from 'glyph-pbf'
import { RTree, TexturePack } from './'
import MapCache from '../../../util/mapCache'

import type { Text } from '../workers/tile.worker'
import type { Box } from './texturePack'
import type { Quad } from './rtree'

export type Path = { vertices: Array<number>, indices: Array<number>, quads: Array<number> }

type GlyphStore = {
  cache: MapCache,
  glyphSet: GlyphSet
}

export default class GlyphBuilder {
  texturePack: TexturePack = new TexturePack()
  glyphFilterVertices: Array<number> = []
  glyphQuads: Array<number> = []
  color: Array<number> = []
  layerGuide: Array<number> = []
  layerOffset: number = 0
  font: { [string]: GlyphStore } = new Map()
  rtree: RTree = new RTree()
  dneGlyph: undefined | Path

  clear () {
    this.rtree.clear()
    this.glyphFilterVertices = []
    this.layerGuide = []
    this.glyphQuads = []
    this.color = []
    this.layerOffset = 0
    this.texturePack = new TexturePack()
  }

  finishLayer (layerID: number) {
    const offset = this.color.length / 4
    const count = offset - this.layerOffset
    if (count > 0) {
      this.layerGuide.push(layerID, this.layerOffset, count) // layerID, offset, count
      this.layerOffset = offset
    }
  }

  testQuad (quad: Quad): boolean {
    // build the bbox
    let s = Math.round(quad.s * 512)
    let t = Math.round(quad.t * 512)
    quad.minX = s + quad.x
    quad.minY = t + quad.y
    quad.maxX = s + quad.x + quad.width
    quad.maxY = t + quad.y + quad.height
    const passFail = !this.rtree.collides(quad)
    // check if it passes
    return passFail
  }

  addFont (name: string, pbf: ArrayBuffer) {
    const glyphSet = new GlyphSet(pbf)
    this.font[name] = {
      cache: new MapCache(400),
      glyphSet
    }
    // if default font, try to setup the "char doesn't exist" glyph
    if (name === 'default') this.dneGlyph = this.getGlyph('default', 9633)
  }

  getWidthAndGlyphData (family: string, field: string, size: number) {
    const families = [family, 'default']
    const glyphData = []
    let width = 0
    let found
    // run through each character in the field param and build out glyph data & width
    for (let i = 0, sl = field.length; i < sl; i++) {
      const code = field.charCodeAt(i)
      found = false
      // we check glyphsets first
      for (const fam of families) {
        let glyphSet = this.font[fam] && this.font[fam].glyphSet
        if (glyphSet && glyphSet.has(code)) {
          const glyph = glyphSet.get(code)
          width += glyph.advanceWidth * size
          glyphData.push([fam, code])
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
    // ensure a whole number for width
    width = Math.ceil(width)

    return [width, glyphData]
  }

  // by far the most complex component of the glyph builder.
  // 1) add to our glyphFilterVertices the text dimesions
  // 2) add any missing glyphs to our texturePack
  // 3) reference the texture when building quad glyph data
  buildText (text: Text) {
    const { s, t, x, y, size, width, height, id, padding, strokeWidth, stroke, fill, glyphData } = text
    const strokeSize = size + (strokeWidth * 2)
    // 1) add to our glyphFilterVertices the text dimesions
    this.glyphFilterVertices.push(s, t, x, y, width, height, id)
    // 2 & 3) build our texture and glyph vertices
    let glyph: Box
    let xOffset = 0
    // for each glyph in
    for (const char of glyphData) {
      if (char) {
        const [family, code] = char
        // first do stroke
        // if (strokeWidth && stroke[3] !== 0) {
        //   glyph = this.texturePack.getTexture(family, size + strokeSize, padding[1] + strokeWidth, code, this.getGlyph.bind(this))
        //   this.glyphQuads.push(s, t, x + xOffset + padding[0], y + padding[1], ...glyph, id)
        //   this.color.push(...stroke)
        // }
        // now the fill
        if (fill[3] !== 0) {
          glyph = this.texturePack.getTexture(family, size, padding[1] + strokeWidth, code, this.getGlyph.bind(this))
          this.glyphQuads.push(s, t, x + xOffset + strokeWidth + padding[0], y + strokeWidth + padding[1], ...glyph, id)
          this.color.push(...fill)
        }
        // update offset (remove the glyph AA padding)
        xOffset += glyph[2] - 4
      }
    }
  }

  getGlyph (family: string, code: number): Path {
    let glyphStore = this.font[family]
    const { cache, glyphSet } = glyphStore
    if (cache.has(code)) {
      return cache.get(code)
    } else {
      const glyph = glyphSet.get(code)
      const path = glyph.getPath()
      const res = { advanceWidth: glyph.advanceWidth, path }
      cache.set(code, res)
      return res
    }
  }
}

// @flow
import { GlyphSet } from 'glyph-pbf'
import { texturePack, mapOverlap } from './'
import MapCache from '../../../util/mapCache'

import type { Text } from '../workers/tile.worker'

type Path = { vertices: Array<number>, indices: Array<number>, quads: Array<number> }

type GlyphCache = {
  cache: MapCache,
  glyphSet: GlyphSet
}

export default class GlyphStore {
  font: Map<string, GlyphCache> = new Map()
  billboard: Map<string, GlyphCache> = new Map()

  addFont (name: string, pbf: ArrayBuffer) {
    this.font.set(name, {
      cache: new MapCache(500),
      glyphSet: new GlyphSet(pbf)
    })
  }

  addBillboard (name: string, pbf: ArrayBuffer) {
    this.billboard.set(name, {
      cache: new MapCache(200),
      glyphSet: new GlyphSet(pbf)
    })
  }

  buildText (text: Text) {
    text.glyphs = []
    const { field, family } = text
    let width = 0
    for (let i = 0, sl = field.length; i < sl; i++) {
      const code = field.charCodeAt(i)
      const glyph = this.getGlyph('font', family, code)
      width += glyph.advanceWidth
      text.glyphs.push(glyph)
    }
    text.width = width
  }

  getGlyph (type: 'font' | 'billboard', name: string, char: number): null | Path {
    const names = [name, 'default']
    for (const name of names) {
      // first check it exists
      let glyphStore = this[type][name]
      if (glyphStore) {
        const glyph = glyphStore._getGlyph(glyphStore, char)
        if (glyph) return glyph
      }
    }
    // if we made it here, no glyphset had the unicode, so add an advanceWidth and move on
    return { advanceWidth: 0.5, path: { indices: [], vertices: [], quads: [] } }
  }

  _getGlyph (store: GlyphCache, char: number): null | Path {
    const { cache, glyphSet } = store
    if (cache.has(char)) return cache.get(char)
    else if (glyphSet.has(char)) {
      const glyph = glyphSet.get(char)
      const path = glyph.getPath()
      const res = { advanceWidth: glyph.advanceWidth, path }
      cache.set(char, res)
      return res
    }
    else return null
  }

  createText (texts: Array<Text>): any {
    // define the width & height parameters
    for (const text of texts) {
      // get the font object

    }
    // filter obvious overlaps
    texts = mapOverlap(texts, 512).filter(t => !t.overlap) // 768 is the average between 512 and 1024, balance of performance and population of information
  }
}

// @flow
import { GlyphSet } from 'glyph-pbf'

import type { Path } from './glyphBuilder'

export type BBox = [number, number, number, number] // u, v, width, height

export type GlyphStore = {
  glyphSet: GlyphSet,
  size: number
}

export type Glyph = {
  bbox: BBox,
  advanceWidth: number,
  yOffset: number
}

type Space = {
  widthOffset: number,
  heightOffset: number
}

// Texture pack stores fonts and builds out SDF characters onto a texture sheet
// each time we encounter a new character, we need to build the fills and strokes
// and let the main painting thread know about the update
// each font will have its own vertical row, and if a row is filled, we start a new one
// the horizontal space is 2048 and we start a new row
export default class TexturePack {
  width: number = 0
  height: number = 0
  maxWidth: number = 2048
  fillVertices: Array<number> = []
  lineVertices: Array<number> = []
  fillIndices: Array<number> = []
  spaces: { [number | string]: Space } = {}
  font: Map<string, GlyphStore> // familyName -> GlyphStore
  glyphs: Map<string, Glyph> // 'family:char' -> Glyph
  constructor () {
    this.font = new Map()
    this.glyphs = new Map()
  }

  // upon creating a new tile, we can clear out vertices and indices as we don't need
  // to build those glyphs again
  clear () {
    this.fillVertices = []
    this.lineVertices = []
    this.fillIndices = []
  }

  addFont (familyName: string, pbf: ArrayBuffer, opts) {
    this.font.set(familyName, {
      glyphSet: new GlyphSet(pbf),
      size: (opts.size) ? opts.size : 34,
      sdfMaxSize: (opts.sdfMaxSize) ? opts.sdfMaxSize : 4
    })
  }

  getGlyph (family: string, char: string): undefined | Glyph {
    const key = `${family}:${char}`
    // check if we've already built the glyph, otherwise build and replace
    if (this.glyphs.has(key)) {
      return this.glyphs.get(key)
    } else if (this.font.has(family)) {
      const { glyphSet, size, sdfMaxSize } = this.font.get(family)
      // look for the char, build
      if (glyphSet.has(char)) {
        const g = glyphSet.get(char)
        let { yOffset, advanceWidth } = g
        // store the glyph to the texture
        const glyph = this._addGlyphToTexture(key, advanceWidth, yOffset, size, sdfMaxSize)
        // adjust yOffset by size
        yOffset *= size
        // now build the path using offset as a guide
        const offset = [glyph.bbox[0], glyph.bbox[1] + yOffset]
        const path = g.getPath(true, offset, size, sdfMaxSize)
        // Build the actual glyph using the path data with the box as a positional adivsor
        this._buildGlyph(glyph, path, offset, size, sdfMaxSize)

        return glyph
      }
    }
  }

  _buildGlyph (glyph: Glyph, path: Path, glyphOffset: [number, number],
    size: number, sdfMaxSize: number) {
    const self = this
    // grab the box
    const glyphXOffset = glyphOffset[0]
    const glyphYOffset = glyphOffset[1]
    // fill data
    const offset = self.fillVertices.length / 3
    for (let v = 0, vl = path.vertices.length; v < vl; v += 3) {
      self.fillVertices.push(
        path.vertices[v] * size + glyphXOffset + sdfMaxSize, // (4 for the offset for SDF max distance)
        path.vertices[v + 1] * size + glyphYOffset + sdfMaxSize,
        path.vertices[v + 2] // type
      )
    }
    self.fillIndices.push(...path.indices.map(i => i + offset))
    self.fillIndices.push(...path.quads.map(i => i + offset))
    // line data
    path.strokes.forEach(stroke => {
      for (const vertex of stroke) {
        const { pos, par, limits, scale } = vertex
        self.lineVertices.push(
          ...pos,
          ...par,
          ...limits,
          scale
        )
      }
    })
  }

  _addGlyphToTexture (key: string, advanceWidth: number, yOffset: number,
    size: number, sdfMaxSize: number): Glyph {
    // round up the width and height and add the texture padding for AA
    const width = Math.ceil(advanceWidth * size) + (sdfMaxSize * 2)
    const glyphHeight = Math.ceil(size)
    const height = glyphHeight + (sdfMaxSize * 2)
    const ratio = glyphHeight / height

    // create a box object
    const bbox: BBox = [0, 0, width, height]

    // if spaces doesn't have the height OR the width of the space is maxed out, create new
    if (!this.spaces[height] || this.spaces[height].widthOffset + width > this.maxWidth) {
      this.spaces[height] = { heightOffset: this.height, widthOffset: 0 }
      // update height offset of texture
      this.height += height
    }

    // add to the space
    const { widthOffset, heightOffset } = this.spaces[height]
    bbox[0] = widthOffset
    bbox[1] = heightOffset
    // update width offset of row and texture
    this.width = Math.max(this.width, widthOffset + width)
    this.spaces[height].widthOffset += width

    // adjust the width by the height
    bbox[2] /= bbox[3]

    const glyph = { advanceWidth: advanceWidth * ratio, yOffset: yOffset * ratio, bbox } // update offsets by glyph ratios
    this.glyphs.set(key, glyph)
    return glyph
  }
}

// @flow
import { GlyphSet } from 'glyph-pbf'

import type { Path } from './glyphBuilder'

export type GlyphSetOptions = {
  size: number,
  sdfMaxSize: number
}

export type BBox = [number, number, number, number] // u, v, width, height

export type GlyphStore = {
  glyphSet: GlyphSet,
  size: number,
  sdfMaxSize: number
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
  glyphStores: Map<string, GlyphStore> = new Map() // familyName -> GlyphStore
  glyphs: Map<string, Glyph> = new Map() // 'family:char' -> Glyph

  // upon creating a new tile, we can clear out vertices and indices as we don't need
  // to build those glyphs again
  clear () {
    this.fillVertices = []
    this.lineVertices = []
    this.fillIndices = []
  }

  addGlyphStore (familyName: string, pbf: ArrayBuffer, opts: GlyphSetOptions) {
    const glyphSet = new GlyphSet(pbf)
    this.glyphStores.set(familyName, {
      glyphSet,
      size: glyphSet.glyphSize,
      sdfMaxSize: glyphSet.sdfMaxSize
    })
  }

  // get list of glyph-color pairs, build glyphs, return the pairs
  getFeatures (family: string, field: string) {
    let width = 1
    const glyphs = []
    if (this.glyphStores.has(family)) {
      const { glyphSet } = this.glyphStores.get(family)
      if (glyphSet.has(field)) {
        const { features } = glyphSet.get(field)
        const { ratio } = glyphSet.get('' + features[0].glyphID)
        width = ratio
        for (const { glyphID, colorID } of features) {
          // create color
          const color = glyphSet.get(colorID)
          // store
          glyphs.push(['' + glyphID, color])
        }
      }
    }

    return [width, glyphs]
  }

  getGlyph (family: string, glyphID: string): typeof undefined | Glyph {
    const key = `${family}:${glyphID}`
    // check if we've already built the glyph, otherwise build and replace
    if (this.glyphs.has(key)) {
      return this.glyphs.get(key)
    } else if (this.glyphStores.has(family)) { // $FlowIgnore - flow just being ignorant
      const { glyphSet, size, sdfMaxSize } = this.glyphStores.get(family)
      // look for the glyphID, build
      if (glyphSet.has(glyphID)) {
        const gData = glyphSet.get(glyphID)
        let { yOffset, advanceWidth, ratio } = gData
        // store the glyph to the texture
        const glyph = this._addGlyphToTexture(key, !isNaN(advanceWidth) ? advanceWidth : ratio, yOffset, size, sdfMaxSize)
        const { bbox } = glyph
        // now build the path using offset as a guide
        const offset = [bbox[0], bbox[1] + (yOffset * size) + 1]
        const path = gData.getPath(true, offset, size, sdfMaxSize)
        // Build the actual glyph using the path data with the box as a positional adivsor
        this._buildPath(path)

        return glyph
      }
    }
  }

  _buildPath (path: Path) {
    const { fillVertices, fillIndices, lineVertices } = this
    const { vertices, indices, quads, strokes } = path
    // fill data
    const offset = fillVertices.length / 3
    fillVertices.push(...vertices)
    fillIndices.push(...indices.map(i => i + offset))
    fillIndices.push(...quads.map(i => i + offset))
    // line data
    lineVertices.push(...strokes)
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

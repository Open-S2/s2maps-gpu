// @flow
import type { Path } from './glyphBuilder'

export type Box = [number, number, number, number] // u, v, width, height

type Space = {
  widthOffset: number,
  heightOffset: number
}

export default class TexturePack {
  width: number = 0
  height: number = 0
  maxWidth: number = 500
  vertices: Array<number> = []
  indices: Array<number> = []
  spaces: { [number | string]: Space } = {}
  // [string]: Box // 'family:size:code'

  getTexture (family: string, size: number, padOffset: number, code: number, getGlyph: Function): Box {
    const key = `${family}:${size}:${code}`
    let glyph = this[key]
    if (glyph) {
      return glyph
    } else {
      let { advanceWidth, path } = getGlyph(family, code)
      advanceWidth *= size
      glyph = this._addTexture(key, advanceWidth, size)
      // Build the actual glyph using the path data with the box as a positional adivsor
      this._buildGlyph(glyph, path, size, padOffset)

      return glyph
    }
  }

  _buildGlyph (box: Box, path: Path, size: number, padOffset: number): Box {
    const offset = this.vertices.length / 3
    for (let v = 0, vl = path.vertices.length; v < vl; v += 3) {
      this.vertices.push(
        path.vertices[v] * size + box[0] + 2, // x (2 for the offset for AA)
        path.vertices[v + 1] * size + box[1] + 2, // y (2 for the offset for AA)
        path.vertices[v + 2] // type
      )
    }
    this.indices.push(...path.indices.map(i => i + offset))
    this.indices.push(...path.quads.map(i => i + offset))
  }

  _addTexture (key: string, width: number, height: number): Box {
    // round up the width and height and add the texture padding for AA
    width = Math.ceil(width) + 4
    height = Math.ceil(height) + 4

    // create a box object
    const box: Box = [0, 0, width, height]

    // if spaces doesn't have the height OR the width of the space is maxed out, create new
    if (!this.spaces[height] || this.spaces[height].widthOffset + width > this.maxWidth) {
      this.spaces[height] = { heightOffset: this.height, widthOffset: 0 }
      // update height offset of texture
      this.height += height
    }

    // add to the space
    const { widthOffset, heightOffset } = this.spaces[height]
    box[0] = widthOffset
    box[1] = heightOffset
    // update width offset of row and texture
    this.width = Math.max(this.width, widthOffset + width)
    this.spaces[height].widthOffset += width

    this[key] = box
    return box
  }
}

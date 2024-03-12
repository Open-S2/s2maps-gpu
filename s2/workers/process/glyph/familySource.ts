import type { ColorArray } from 'style/color'
import type { ImageMetadata, Metadata } from 'workers/source/imageSource'

export interface Glyph {
  /** code represents either the unicode value or substitution value */
  code: string
  /** texX is the x position on the texture sheet */
  texX: number
  /** texY is the y position on the texture sheet */
  texY: number
  /** texW is the width of the glyph on the texture sheet */
  texW: number
  /** texH is the height of the glyph on the texture sheet */
  texH: number
  /** xOffset is the x offset for the glyph */
  xOffset: number
  /** yOffset is the y offset for the glyph */
  yOffset: number
  /** width is the width of the glyph */
  width: number
  /** height is the height of the glyph */
  height: number
  /** advanceWidth is how far to move the cursor */
  advanceWidth: number
}

export interface IconPiece {
  /** glyphID is the glyphID of the icon */
  glyphID: string
  /** colorID is the colorID of the icon */
  color: ColorArray
}
export type Icon = IconPiece[]

export interface LigatureSubstitute {
  type: 4
  substitute: string
  components: string[]
}

export interface LigatureTree extends Record<number, LigatureTree> {
  /** unicode substitute if it ends here */
  substitute?: string
}

export interface IconDefinition { glyphID: string, colorID: number }
export type IconMap = Record<string, IconDefinition[]> // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)
export type GlyphSet = Set<string>
export type ColorMap = Record<number, ColorArray>

export default class FamilySource {
  name: string
  extent: number = 0
  defaultAdvance: number = 0
  glyphSet: GlyphSet = new Set() // existing glyphs
  ligatures: LigatureTree = {}
  // cache system
  glyphCache = new Map<string, Glyph>() // glyphs we have built already
  iconCache = new Map<string, Icon>()
  // track missing glyphs for future requests to the source worker
  glyphRequestList = new Map<bigint, Set<string>>()
  isIcon = false
  constructor (
    name: string,
    metadata?: ArrayBuffer
  ) {
    this.name = name
    if (metadata === undefined) return
    const meta = new DataView(metadata)
    this.extent = meta.getUint16(0, true)
    this.defaultAdvance = meta.getUint16(8, true) / this.extent
    const glyphCount = meta.getUint16(10, true)
    const iconMapSize = meta.getUint32(12, true)
    const colorBufSize = meta.getUint16(16, true) * 4
    const substituteSize = meta.getUint32(18, true)
    this.isIcon = iconMapSize > 0

    // store glyphSet
    const glyphEnd = 30 + (glyphCount * 2)
    const gmdv = new DataView(metadata, 30, glyphCount * 2)
    for (let i = 0; i < glyphCount; i++) {
      this.glyphSet.add(String(gmdv.getUint16(i * 2, true)))
    }
    // build icon metadata
    const iconMap = this.#buildIconMap(iconMapSize, new DataView(metadata, glyphEnd, iconMapSize))
    const colors = this.#buildColorMap(colorBufSize, new DataView(metadata, glyphEnd + iconMapSize, colorBufSize))
    // store the icon
    for (const [name, pieces] of Object.entries(iconMap)) {
      this.iconCache.set(name, pieces.map(piece => {
        return { glyphID: piece.glyphID, color: colors[piece.colorID] }
      }))
    }
    this.#buildSubstituteMap(substituteSize, new DataView(metadata, glyphEnd + iconMapSize + colorBufSize, substituteSize))

    // store space (32)
    if (!this.isIcon) this.glyphCache.set('32', { code: '32', texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: this.defaultAdvance })
  }

  static FromImageMetadata ({ name, metadata }: ImageMetadata): FamilySource {
    const fs = new FamilySource(name)
    fs.addMetadata(metadata)
    return fs
  }

  has (code: string): boolean {
    return this.glyphSet.has(code)
  }

  missingGlyph (code: string): boolean {
    const { isIcon, glyphSet, glyphCache } = this
    if (isIcon) return !glyphCache.has(code)
    return glyphSet.has(code) && !glyphCache.has(code)
  }

  addMetadata (metadata: Metadata): void {
    for (const [code, glyph] of Object.entries(metadata)) {
      this.glyphSet.add(code)
      this.glyphCache.set(code, glyph)
      if (!this.iconCache.has(code)) this.iconCache.set(code, [{ glyphID: code, color: [0, 0, 0, 0] }])
    }
  }

  addGlyphRequest (tileID: bigint, code: string): void {
    if (!this.glyphRequestList.has(tileID)) this.glyphRequestList.set(tileID, new Set())
    const requests = this.glyphRequestList.get(tileID)
    requests?.add(code)
  }

  getRequests (tileID: bigint): string[] {
    const glyphList = this.glyphRequestList.get(tileID) ?? new Set<string>()
    // cleanup requests that we are pulling from the cache
    this.glyphRequestList.delete(tileID)

    return [...glyphList]
  }

  #buildIconMap (iconMapSize: number, dv: DataView): IconMap {
    const iconMap: IconMap = {}
    let pos = 0
    while (pos < iconMapSize) {
      const nameLength = dv.getUint8(pos)
      const mapLength = dv.getUint8(pos + 1)
      pos += 2
      const id: number[] = []
      for (let i = 0; i < nameLength; i++) id.push(dv.getUint8(pos + i))
      const name = id.map(n => String.fromCharCode(n)).join('')
      pos += nameLength
      const map: IconDefinition[] = []
      for (let i = 0; i < mapLength; i++) {
        map.push({
          glyphID: String(dv.getUint16(pos, true)),
          colorID: dv.getUint16(pos + 2, true)
        })
        pos += 4
      }
      iconMap[name] = map
    }

    return iconMap
  }

  #buildColorMap (colorSize: number, dv: DataView): ColorArray[] {
    const colors: ColorArray[] = []
    for (let i = 0; i < colorSize; i += 4) {
      colors.push([dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3)])
    }

    return colors
  }

  #buildSubstituteMap (substituteSize: number, dv: DataView): void {
    let pos = 0
    while (pos < substituteSize) {
      const type = dv.getUint8(pos)
      if (type === 4) {
        // LIGATURE TYPE
        const count = dv.getUint8(pos + 1)
        const components: string[] = []
        for (let j = 0; j < count; j++) {
          components.push(String(dv.getUint16(pos + 2 + j * 2, true)))
        }
        const substitute = components.join('.')
        this.glyphSet.add(substitute)
        let tree = this.ligatures
        for (const component of components) {
          const unicode = Number(component)
          if (tree[unicode] === undefined) tree[unicode] = {}
          tree = tree[unicode]
        }
        tree.substitute = substitute
        pos += 2 + count * 2
      } else {
        throw new Error(`Unknown substitute type: ${type}`)
      }
    }
  }

  /** Zero Width Joiner pass goes first */
  parseLigatures (strCodes: string[], zwjPass = false): void {
    // iterate through the unicodes and follow the tree, if we find a substitute,
    // replace the unicodes with the substitute, but don't stop diving down the tree until we don't find
    // a substitute. This is because we want to find the longest ligature match possible.
    for (let i = 0; i < strCodes.length; i++) {
      let code = Number(strCodes[i])
      let tree = this.ligatures
      let j = i
      let zwj = false
      while (tree[code] !== undefined) {
        if (code === 8205) zwj = true
        tree = tree[code]
        if (tree.substitute !== undefined && (zwjPass ? zwj : true)) {
          strCodes.splice(i, j - i + 1, tree.substitute)
        } else { j++ }
        code = Number(strCodes[j])
      }
    }
  }
}

import type {
  Glyph,
  Unicode
} from './glyph/glyph.spec'
import type {
  ColorMap as ColorMapResponse,
  IconMap as IconMapResponse
} from 'workers/source/glyphSource'
import type { GlyphRequestMessage } from 'workers/worker.spec'
import type { IDGen } from './process.spec'

export type Color = [r: number, g: number, b: number, a: number]

export type Colors = Color[]

export type ColorMap = Record<string, Record<number, Color>>

export type FamilyMap = Record<Unicode, Glyph>

// family name => unicode => glyph
export type GlyphMap = Record<string, FamilyMap>

export type IconMap = Record<string, IconMapResponse>

export interface GlyphStore {
  glyphFamilyCount: number
  processed: number
  resolve: () => void
}

export type IconList = Record<string, Set<string>>

export type GlyphList = Record<string, Set<Unicode>>

export default class ImageStore {
  glyphMap: GlyphMap = {}
  iconMap: IconMap = {}
  colorMap: ColorMap = {}
  iconList: IconList = {}
  glyphList: GlyphList = {}
  // track requests per tile
  glyphStore = new Map<string, GlyphStore>()
  // worker properties
  idGen!: IDGen
  sourceWorker!: MessagePort

  setup (idGen: IDGen, sourceWorker: MessagePort): void {
    this.idGen = idGen
    this.sourceWorker = sourceWorker
  }

  addMissingChars (
    field: Unicode[],
    family: string
  ): boolean {
    const { glyphMap, glyphList } = this
    let missing = false
    if (glyphMap[family] === undefined) glyphMap[family] = {}
    if (glyphList[family] === undefined) glyphList[family] = new Set()
    const familyList = glyphList[family]
    const familyMap = glyphMap[family]
    for (const unicode of field) {
      if (familyMap[unicode] === undefined) {
        familyList.add(unicode)
        missing = true
      }
    }
    return missing
  }

  addMissingIcons (
    field: string,
    family: string
  ): boolean {
    const { glyphMap, iconList, iconMap } = this
    let missing = false
    if (glyphMap[family] === undefined) glyphMap[family] = {}
    if (iconMap[family] === undefined) iconMap[family] = {}
    if (iconList[family] === undefined) iconList[family] = new Set()
    const familyList = iconList[family]
    const familyMap = iconMap[family]
    if (familyMap[field] === undefined) {
      familyList.add(field)
      missing = true
    }
    return missing
  }

  async processMissingData (
    mapID: string,
    sourceName: string
  ): Promise<void> {
    const { idGen, iconList, sourceWorker, glyphStore, glyphList: _glyphList } = this
    const { workerID } = idGen
    // build glyphList and iconList to ship to the source thread
    // prep glyphList for transfer
    const glyphList: Record<string, ArrayBuffer> = {}
    const glyphFamilyCount = this.#getMissingLength()
    if (glyphFamilyCount > 0) {
      for (const family in _glyphList) {
        const list = [..._glyphList[family]].sort((a, b) => a - b)
        glyphList[family] = (new Uint16Array(list)).buffer
      }
      // randome string of numbers and letters 7 characters long
      const reqID = `${mapID}:${sourceName}:${Math.random().toString(36).substring(2, 9)}`
      // send off and prep for response
      const requestMessage: GlyphRequestMessage = {
        type: 'glyphrequest',
        mapID,
        workerID,
        reqID,
        glyphList,
        iconList
      }
      sourceWorker.postMessage(requestMessage, Object.values(glyphList))
      await new Promise<void>(resolve => {
        glyphStore.set(reqID, { glyphFamilyCount, processed: 0, resolve })
      })
    }
    await new Promise<void>(resolve => { resolve() })
    // cleanup for next request set
    this.iconList = {}
    this.glyphList = {}
  }

  #getMissingLength (): number {
    let count = 0
    for (const family of Object.values(this.glyphList)) if (family.size > 0) count++
    for (const family of Object.values(this.iconList)) if (family.size > 0) count++
    return count
  }

  processGlyphResponse (
    reqID: string,
    glyphMetadata: ArrayBuffer,
    familyName: string,
    icons?: IconMapResponse,
    colors?: ColorMapResponse
  ): void {
    // pull in the features and delete the reference
    const store = this.glyphStore.get(reqID)
    if (store === undefined) return
    store.processed++
    // store our response glyphs
    this.importGlyphs(familyName, new Float32Array(glyphMetadata))
    // if icons, store icons
    if (icons !== undefined && colors !== undefined) this.importIconMetadata(familyName, icons, colors)
    // If we have all data, we now process the built glyphs
    if (store.glyphFamilyCount === store.processed) {
      this.glyphStore.delete(reqID)
      store.resolve()
    }
  }

  // a response from the sourceThread for glyph data
  // [unicode, texX, texY, texW, texH, xOffset, yOffset, advanceWidth, ...]
  importGlyphs (familyName: string, glyphs: Float32Array): void {
    const familyMap = this.glyphMap[familyName]
    for (let i = 0, gl = glyphs.length; i < gl; i += 10) {
      const code = glyphs[i]
      const glyph: Glyph = {
        texX: glyphs[i + 1],
        texY: glyphs[i + 2],
        texW: glyphs[i + 3],
        texH: glyphs[i + 4],
        xOffset: glyphs[i + 5],
        yOffset: glyphs[i + 6],
        width: glyphs[i + 7],
        height: glyphs[i + 8],
        advanceWidth: glyphs[i + 9]
      }
      familyMap[code] = glyph
    }
  }

  importIconMetadata (familyName: string, icons: IconMapResponse, colors: ColorMapResponse): void {
    // store icon metadata
    const iconMap = this.iconMap[familyName]
    for (const icon in icons) iconMap[icon] = icons[icon]
    // store colors
    if (this.colorMap[familyName] === undefined) this.colorMap[familyName] = []
    const colorMap = this.colorMap[familyName]
    for (const color in colors) colorMap[parseInt(color)] = colors[color]
  }

  getPattern (familyName: string, name?: string): Glyph {
    const nullGlyph: Glyph = { texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: 0 }
    if (name === undefined) return nullGlyph
    const familyMap = this.glyphMap[familyName]
    const iconMap = this.iconMap[familyName]
    if (iconMap !== undefined) {
      const icon = iconMap[name]
      if (icon !== undefined) {
        const glyph = familyMap[icon[0].glyphID]
        if (glyph !== undefined) return glyph
      }
    }
    return nullGlyph
  }
}

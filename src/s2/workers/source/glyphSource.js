// @flow
import Source from './source'

type Unicode = number

export type GlyphRequest = Uint16Array // Array<Unicode>

// export type GlyphResponse = {
//   [Unicode]: Glyph // [unicode]: Glyph
// }
export type GlyphResponse = { [string]: Float32Array } // [unicode, texX, texY, texW, texH, xOffset, yOffset, advanceWidth, ...]

type GlyphImage = {
  posX: number,
  posY: number,
  width: number,
  height: number,
  data: ImageData
}

type GlyphImages = Array<GlyphImage>

export type Glyph = {
  texX: number, // x position on glyph texture sheet
  texY: number, // y position on glyph texture sheet
  texW: number,
  texH: number,
  xOffset: number, // x offset for glyph
  yOffset: number, // y offset for glyph
  width: number,
  height: number,
  advanceWidth: number // how far to move the cursor
}

type IconMap = { [string]: Unicode } // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)

export default class GlyphSource {
  version: number
  extent: number
  name: string
  size: number
  fallback: GlyphSource
  defaultAdvance: number
  maxHeight: number
  range: number
  pageSize: number = 100
  texturePack: TexturePack
  colors: Array<[number, number, number, number]>
  iconMap: IconMap
  glyphSet: Set<Unicode> // existing glyphs
  glyphsMap: Map<Glyph> = new Map() // glyphs we have built already
  needsToken: boolean = false
  constructor (name: string, path: string, fallback?: string, texturePack: TexturePack, needsToken?: boolean) {
    this.name = name
    this.path = path
    this.fallback = fallback // temporary reference to the source name
    this.texturePack = texturePack
    this.needsToken = needsToken
  }

  async build (token: string) {
    const self = this
    const metadata = await this._fetch(`${this.path}/metadata.json`, true, token)

    if (!metadata) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} metadata`)
    } else { self._buildMetadata(metadata) }
  }

  _buildMetadata (metadata) {
    const { version, pageSize, extent, colors, iconMap, defaultAdvance, size, maxHeight, range, glyphs } = metadata
    this.version = version
    this.extent = extent
    this.defaultAdvance = defaultAdvance
    this.size = size
    this.maxHeight = maxHeight
    this.range = range
    this.colors = colors
    this.iconMap = iconMap
    this.glyphSet = new Set(glyphs)
    if (pageSize) this.pageSize = pageSize
  }

  async glyphRequest (glyphResponse: GlyphResponse, images: GlyphImages,
    glyphList: GlyphRequest, token?: string): GlyphResponse {
    // prep variables
    const { name, glyphSet, glyphsMap, defaultAdvance, fallback } = this

    if (!glyphResponse[name]) glyphResponse[name] = []
    const glyphSourceRes = glyphResponse[name]

    const notbuilt = {} // { [page]: [unicode, unicode, unicode, ...] }
    const notBuiltFallback = {}

    // Step 1: all glyphs we already have the solution to we put in res,
    // otherwise report the glyph in notbuilt assuming the metadata claims it exists
    for (const unicode of glyphList) {
      if (glyphSet.has(unicode)) { // 1: this source has the glyph
        this._findGlyphs(this, unicode, glyphSourceRes, notbuilt)
      } else if (fallback && fallback.glyphSet.has(unicode)) { // 2: the fallback glyph source exists and has the glyph
        this._findGlyphs(fallback, unicode, glyphSourceRes, notBuiltFallback)
      } else { // no glyph source exists that can handle this glyph type
        glyphsMap.set(unicode, { texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: defaultAdvance })
        glyphSourceRes.push(unicode, 0, 0, 0, 0, 0, 0, 0, 0, defaultAdvance)
      }
    }

    // Step 2: build glyphs we don't have yet from their perspective pages
    const pageBuilds = []
    for (const page in notbuilt) pageBuilds.push(this._buildGlyphPage(this, page, notbuilt[page], glyphSourceRes, images, token))
    for (const page in notBuiltFallback) pageBuilds.push(this._buildGlyphPage(fallback, page, notBuiltFallback[page], glyphSourceRes, images, token))
    // send the build promises
    return Promise.all(pageBuilds)
  }

  _findGlyphs (source: GlyphSource, unicode: number, glyphSourceRes: Array<Glyph>, notbuilt: Object) {
    const { pageSize } = this
    const { glyphsMap } = source
    const { floor } = Math
    if (glyphsMap.has(unicode)) { // A: this source has already built this unicode
      const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = glyphsMap.get(unicode)
      glyphSourceRes.push(unicode, texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth)
    } else { // B: this source has the unicode but needs to retrieve and build the unicode
      const page = floor(unicode / pageSize)
      if (!notbuilt[page]) notbuilt[page] = new Set()
      notbuilt[page].add(unicode)
    }
  }

  // PAGES:
  // a page contains max pageSize glyphs per page. The page will always contain a range of
  // pageSize. so for instance, page 0 has utf8 codes: [0, pageSize) and page 1 has [pageSize, 200) and so on
  // the buffer container: [[glyph metadata], [glyph images]]
  async _buildGlyphPage (source: GlyphSource, page: number, pageGlyphList: Set,
    glyphSourceRes: Array<Glyph>, images: GlyphImages, token?: string) {
    const { extent, size, path, maxHeight, texturePack, glyphsMap } = source
    const { ceil } = Math
    // pull in the page
    const pageData = await this._fetch(`${path}/${page}.msdf`, false, token)
    // parse the page glyphs, if the page includes a glyph in pageGlyphList,
    // build and add to res & glyphsMap
    if (pageData) {
      // create dataview and grab the size (number of glyphs stored)
      const dv = new DataView(pageData)
      const glyphLength = dv.getUint16(0, true)
      // iterate glyphs, if we find a glyph we need to build... build
      for (let i = 0; i < glyphLength; i++) {
        const idx = 2 + (i * 18)
        const unicode = dv.getUint16(idx, true)
        if (pageGlyphList.has(unicode)) {
          if (glyphsMap.has(unicode)) { // another request already created the glyph
            const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = glyphsMap.get(unicode)
            glyphSourceRes.push(unicode, texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth)
          } else {
            // pull the glyph width and height; recreate the texture size
            const width = dv.getUint16(idx + 6, true) / extent
            const height = dv.getUint16(idx + 8, true) / extent
            const texW = dv.getUint8(idx + 10)
            const texH = dv.getUint8(idx + 11)
            const xOffset = zagzig(dv.getUint16(idx + 12, true)) / extent
            const yOffset = zagzig(dv.getUint16(idx + 14, true)) / extent
            const advanceWidth = zagzig(dv.getUint16(idx + 16, true)) / extent
            // only ask the texturePack if there is a texture size
            let posX, posY
            if (!texW || !texH) { posX = 0; posY = 0 }
            else {
              const [pX, pY] = texturePack.addGlyph(texW, maxHeight)
              posX = pX
              posY = pY
            }
            // build the meta object
            const glyphMeta = {
              texX: posX,
              texY: posY,
              texW,
              texH,
              xOffset,
              yOffset,
              width,
              height,
              advanceWidth
            }
            // store glyph data
            glyphSourceRes.push(unicode, posX, posY, texW, texH, xOffset, yOffset, width, height, advanceWidth)
            glyphsMap.set(unicode, glyphMeta)
            // create the image
            const offset = dv.getUint32(idx + 2, true)
            const length = texW * texH * 4
            if (length) {
              const data = new Uint8ClampedArray(pageData.slice(offset, offset + length))
              images.push({ posX, posY, width: texW, height: texH, data: data.buffer })
            }
          }
        }
      }
    }
  }

  async _fetch (path: string, json?: boolean = false, Authorization?: string) {
    const headers = {}
    if (this.needsToken && Authorization) headers.Authorization = Authorization
    const res = await fetch(path, { headers })
    if (res.status !== 200 && res.status !== 206) return null
    if (!json) return res.arrayBuffer()
    else return res.json()
  }
}

const zagzig = (num: number): number => {
  return (num >> 1) ^ (-(num & 1))
}

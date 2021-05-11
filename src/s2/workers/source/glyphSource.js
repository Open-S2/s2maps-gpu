// @flow
import Source from './source'

type Unicode = number

export type GlyphRequest = Array<Unicode>

export type GlyphResponse = {
  [Unicode]: Glyph // [unicode]: Glyph
}

type GlyphImages = Array<{
  alpha: boolean,
  posX: number,
  posY: number,
  width: number,
  height: number,
  data: ImageData
}>

export type Glyph = {
  texX: number, // x position on glyph texture sheet
  texY: number, // y position on glyph texture sheet
  texW: number,
  texH: number,
  xOffset: number, // x offset for glyph
  yOffset: number, // y offset for glyph
  advanceWidth: number // how far to move the cursor
}

export default class GlyphSource {
  version: number
  extent: number
  name: string
  size: number
  maxHeight: number
  range: number
  alpha: boolean
  texturePack: TexturePack
  glyphSet: Set<Unicode> // existing glyphs
  glyphsMap: Map<Glyph> = new Map() // glyphs we have built already
  constructor (name: string, path: string, texturePack: TexturePack) {
    this.name = name
    this.path = path
    this.texturePack = texturePack
  }

  async _build () {
    const self = this
    const metadata = await this._fetch(`${this.path}/metadata.json`, true)
    if (!metadata) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} metadata`)
    } else { self._buildMetadata(metadata) }
  }

  _buildMetadata (metadata) {
    const { version, extent, name, size, maxHeight, range, alpha, glyphs } = metadata
    this.version = version
    this.extent = extent
    this.name = name
    this.size = size
    this.maxHeight = maxHeight
    this.range = range
    this.alpha = alpha
    this.glyphSet = new Set(glyphs)
  }

  async _glyphsRequest (glyphList: GlyphRequest, tileWorker: Function,
    mainThread: Function): GlyphResponse {
    // prep variables
    const { range, glyphSet, glyphsMap } = this
    const { floor } = Math
    const res: GlyphResponse = { range }
    const images: GlyphImages = []
    const notbuilt = {} // { [page]: [glyph. glyph, glyph, ...] }

    // Step 1: all glyphs we already have the solution to we put in res,
    // otherwise report the glyph in notbuilt assuming the metadata claims it exists
    for (const glyph of glyphList) {
      if (glyphsMap.has(glyph)) res[glyph] = glyphsMap.get(glyph)
      else if (glyphSet.has(glyph)) {
        const page = floor(glyph / 100)
        if (!notbuilt[page]) notbuilt[page] = new Set()
        notbuilt[page].add(glyph)
      }
    }

    // Step 2: build glyphs we don't have yet from their perspective pages
    const pageBuilds = []
    for (const page in notbuilt) pageBuilds.push(this._buildGlyphPage(page, notbuilt[page], res, images))
    // await the completion of building the glyphs
    await Promise.all(pageBuilds)

    // Step 3: send the glyph structures to the tile worker, send new glyph images to the main thread
    // post glyph data to tileWorker

    // post image data to mainThread
  }

  // PAGES:
  // a page contains max 100 glyphs per page. The page will always contain a range of
  // 100. so for instance, page 0 has utf8 codes: [0, 100) and page 1 has [100, 200) and so on
  // the buffer container: [[glyph metadata], [glyph images]]
  async _buildGlyphPage (page: number, pageGlyphList: Set,
    res: Array<Glyph>, images: GlyphImages) {
    const { extent, path, alpha, maxHeight, texturePack, glyphsMap } = this
    // pull in the page
    const pageData = await this._fetch(`${path}/${page}.gz`)
    // parse the page glyphs, if the page includes a glyph in pageGlyphList,
    // build and add to res & glyphsMap
    if (pageData) {
      // create dataview and grab the size (number of glyphs stored)
      const dv = new DataView(pageData)
      const size = dv.getUint16(0, true)
      // iterate glyphs, if we find a glyph we need to build... build
      for (let i = 0; i < size; i++) {
        const idx = 2 + (i * 14)
        const unicode = dv.getUint16(idx, true)
        if (pageGlyphList.has(unicode, true)) {
          // pull the glyph width and height
          const width = dv.getUint8(idx + 6, true)
          const height = dv.getUint8(idx + 7, true)
          // ask texture packer where the glyph goes
          const [posX, posY] = texturePack.addGlyph(width, maxHeight)
          // build the meta object and pull the rest of the metadata
          const glyphMeta = {
            texX: posX,
            texY: posY,
            texW: width,
            texH: height,
            xOffset: zagzig(dv.getUint16(idx + 8, true)) / extent,
            yOffset: zagzig(dv.getUint16(idx + 10, true)) / extent,
            advanceWidth: zagzig(dv.getUint16(idx + 12, true)) / extent
          }
          // store glyph data
          res[unicode] = glyphMeta
          glyphsMap.set(unicode, glyphMeta)
          // create the image
          const offset = dv.getUint32(idx + 2, true)
          const length = width * height * (alpha ? 4 : 3)
          const data = new Uint8ClampedArray(pageData.slice(offset, offset + length))
          images.push({ alpha, posX, posY, width, height, data })
        }
      }
    }
  }

  async _fetch (path: string, json?: boolean = false) {
    const res = await fetch(path)
    if (res.status !== 200 && res.status !== 206) return null
    if (!json) return res.arrayBuffer()
    else return res.json()
  }
}

const zagzig = (num: number): number => {
  return (num >> 1) ^ (-(num & 1))
}

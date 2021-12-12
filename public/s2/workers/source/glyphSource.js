// @flow
/* eslint-env worker */
import type { TexturePack } from './texturePack'

type Unicode = number

export type IconRequest = Array<string> // [iconName, iconName, iconName, ...]

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

export type GlyphImages = Array<GlyphImage>

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

export type IconMap = { [string]: Array<{ glyphID: Unicode, colorID: number }> } // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)

export type Color = [number, number, number, number]

export type Colors = Array<Color>

export type ColorMap = { [number | string]: Color }

const zagzig = (num: number): number => {
  return (num >> 1) ^ (-(num & 1))
}

const base36 = (num: number): number => {
  return num.toString(36)
}

const genID = (): string => { return Math.random().toString(16).replace('0.', '') }

export default class GlyphSource {
  ready: boolean = false
  version: number
  extent: number
  name: string
  size: number
  fallback: GlyphSource
  defaultAdvance: number
  maxHeight: number
  range: number
  texturePack: TexturePack
  colors: Colors
  iconMap: IconMap
  glyphMap: Map<Unicode, { pos: number, length: number }> = new Map() // existing glyphs
  glyphWaitlist: Map<Unicode, Promise> = new Map()
  glyphCache: Map<Glyph> = new Map() // glyphs we have built already
  requestCache: Array<[string, IconRequest | GlyphRequest, string, string, MessageChannel.port2]> = [] // each element in array -> [glyphList, mapID, reqID, worker]
  constructor (name: string, path: string, fallback?: string, texturePack: TexturePack) {
    this.name = name
    this.path = path
    this.fallback = fallback // temporary reference to the source name
    this.texturePack = texturePack
  }

  async build () {
    const self = this
    const metadata = await this._fetch(`${this.path}?bytes=0-u`)

    if (!metadata) {
      self.active = false
      console.log(`FAILED TO extrapolate ${this.path} metadata`)
    } else { await self._buildMetadata(metadata) }
  }

  async _buildMetadata (metadata: ArrayBuffer) {
    const { glyphMap } = this
    const meta = new DataView(metadata)
    // build the metadata
    this.version = meta.getUint16(2, true)
    this.extent = meta.getUint16(4, true)
    this.size = meta.getUint16(6, true)
    this.maxHeight = meta.getUint16(8, true)
    this.range = meta.getUint16(10, true)
    this.defaultAdvance = meta.getUint16(12, true) / this.extent
    const glyphMetaSize = meta.getUint32(14, true)
    const iconMapSize = meta.getUint32(22, true)
    const colorBufSize = meta.getUint32(26, true)
    const metadataBuf = await this._fetch(`${this.path}?bytes=u-${base36(glyphMetaSize)}`)
    const glyphMapSize = metadataBuf.byteLength - iconMapSize - colorBufSize
    const glyphCount = glyphMapSize / 8

    // store glyphMap
    const gmdv = new DataView(metadataBuf, 0, glyphMapSize)
    for (let i = 0; i < glyphCount; i++) {
      const pos = i * 8
      glyphMap.set(gmdv.getUint16(pos, true), { pos: gmdv.getUint32(pos + 2, true), length: gmdv.getUint16(pos + 6, true) })
    }
    // build icon metadata
    if (iconMapSize) {
      this._buildIconMap(iconMapSize, new DataView(metadataBuf, glyphMapSize, iconMapSize))
      this._buildColorMap(colorBufSize, new DataView(metadataBuf, glyphMapSize + iconMapSize, colorBufSize))
    }
    this.ready = true
    this._checkCache()
  }

  _buildIconMap (iconMapSize, dv: DataView) {
    this.iconMap = {}
    let pos = 0
    while (pos < iconMapSize) {
      const nameLength = dv.getUint8(pos)
      const mapLength = dv.getUint8(pos + 1)
      pos += 2
      let name = []
      for (let i = 0; i < nameLength; i++) name.push(dv.getUint8(pos + i))
      name = name.map(n => String.fromCharCode(n)).join('')
      pos += nameLength
      const map = []
      for (let i = 0; i < mapLength; i++) {
        map.push({ glyphID: dv.getUint16(pos, true), colorID: dv.getUint16(pos + 2, true) })
        pos += 4
      }
      this.iconMap[name] = map
    }
  }

  _buildColorMap (colorSize: number, dv: DataView) {
    this.colors = []
    for (let i = 0; i < colorSize; i += 4) {
      this.colors.push([dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3)])
    }
  }

  _checkCache () {
    while (this.requestCache.length) {
      const [type, list, mapID, reqID, worker] = this.requestCache.pop()
      if (type === 'icon') this.iconRequest(list, mapID, reqID, worker)
      else this.glyphRequest(list, mapID, reqID, worker)
    }
  }

  iconRequest (iconList: IconRequest, mapID: string, reqID: string, worker: MessageChannel.port2) {
    if (!this.ready) {
      this.requestCache.push(['icon', iconList, mapID, reqID, worker])
      return
    }
    const { iconMap, colors } = this
    const icons: IconMap = {}
    const colorMap: ColorMap = {} // [colorID]: Color
    // 1) build a list of glyphs to request
    const glyphList = new Set()
    for (const iconReq of iconList) {
      // pull out the icon and store said icon for the worker to have the
      const icon = iconMap[iconReq]
      if (icon) {
        icons[iconReq] = icon
        // store the glyphIDs and store colors used in a map for the worker to have knowledge
        for (const { glyphID, colorID } of icon) {
          glyphList.add(glyphID)
          colorMap[colorID] = colors[colorID]
        }
      } else {
        icons[iconReq] = []
      }
    }
    // 2) request the glyphs
    this.glyphRequest([...glyphList], mapID, reqID, worker, icons, colorMap)
  }

  glyphRequest (glyphList: GlyphRequest, mapID: string, reqID: string, worker: MessageChannel.port2, icons?: IconMap, colors?: ColorMap) {
    if (!this.ready) {
      this.requestCache.push(['glyph', glyphList, mapID, reqID, worker])
      return
    }
    const self = this
    const { glyphCache, glyphMap, fallback, glyphWaitlist, defaultAdvance, name } = self

    const promiseList = []
    const requestList = []
    const fallbackrequestList = []
    const waitlistPromiseMap = new Map()
    for (const unicode of glyphList) {
      // 1) already cached in glyphCache; do nothing
      if (glyphCache.has(unicode)) continue
      // 2) already exists in the glyphWaitlist (downloading)
      if (glyphWaitlist.has(unicode)) {
        const promise = glyphWaitlist.get(unicode)
        waitlistPromiseMap.set(promise.id, promise)
      } else if (glyphMap.has(unicode)) { // 3) this glyphset has it
        requestList.push(unicode)
      } else if (fallback && fallback.glyphMap.has(unicode)) { // 4) the fallback glyphset has it
        fallbackrequestList.push(unicode)
      } else { // 5) no one has it
        glyphCache.set(unicode, { texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: defaultAdvance })
      }
    }
    // create THIS glyphs missing glyphs request
    if (requestList.length) {
      const promise = self._requestGlyphs(requestList, mapID)
      promise.id = genID()
      promiseList.push(promise)
      for (const unicode of requestList) glyphWaitlist.set(unicode, promise)
    }
    // create FALLBACK glyphs missing glyphs request
    if (fallbackrequestList.length) {
      const promise = fallback._requestGlyphs(fallbackrequestList, mapID)
      promise.id = genID()
      promiseList.push(promise)
      for (const unicode of fallbackrequestList) glyphWaitlist.set(unicode, promise)
    }
    // add all waitlist promises
    promiseList.push(...Array.from(waitlistPromiseMap, ([, promise]) => promise))

    Promise.all(promiseList).then(() => {
      // convert glyphList into a Float32Array of unicode data and ship it out
      const shipment = []
      for (const unicode of glyphList) {
        const glyph = (glyphCache.has(unicode))
          ? glyphCache.get(unicode)
          : (fallback.glyphCache.has(unicode))
              ? fallback.glyphCache.get(unicode)
              : null

        if (glyph) {
          const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = glyph
          shipment.push(unicode, texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth)
        }
      }
      const glyphMetadata = (new Float32Array(shipment)).buffer
      worker.postMessage({ mapID, type: 'glyphresponse', reqID, glyphMetadata, familyName: name, icons, colors }, [glyphMetadata])
    })
  }

  _requestGlyphs (list, mapID) {
    const { extent, glyphCache, glyphWaitlist, maxHeight, texturePack } = this
    // 1) build the ranges, max 35 glyphs per request
    const requests = this.buildRequests(list)
    // 2) return the request promise, THEN: store the glyphs in cache, build the images, and ship the images to the mapID
    const promises = []
    for (const request of requests) {
      promises.push(this._fetch(request).then(glyphsBuf => {
        const images = []
        const dv = new DataView(glyphsBuf)
        const size = dv.byteLength - 1
        let pos = 0
        while (pos < size) {
          // build glyph metadata
          const unicode = dv.getUint16(pos, true)
          const glyph = {
            unicode,
            width: dv.getUint16(pos + 2, true) / extent,
            height: dv.getUint16(pos + 4, true) / extent,
            texW: dv.getUint8(pos + 6),
            texH: dv.getUint8(pos + 7),
            xOffset: zagzig(dv.getUint16(pos + 8, true)) / extent,
            yOffset: zagzig(dv.getUint16(pos + 10, true)) / extent,
            advanceWidth: zagzig(dv.getUint16(pos + 12, true)) / extent
          }
          pos += 14
          // store in texturePack
          const [posX, posY] = texturePack.addGlyph(glyph.texW, maxHeight)
          glyph.texX = posX
          glyph.texY = posY
          // store glyph in cache
          glyphCache.set(unicode, glyph)
          // remove from waitlist cache
          glyphWaitlist.delete(unicode)
          // grab the image
          const imageSize = glyph.texW * glyph.texH * 4
          const data = (new Uint8ClampedArray(glyphsBuf.slice(pos, pos + imageSize))).buffer
          images.push({ posX, posY, width: glyph.texW, height: glyph.texH, data })
          pos += imageSize
        }
        // send off the images
        const imagesMaxHeight = images.reduce((acc, cur) => Math.max(acc, cur.posY + cur.height), 0)
        postMessage({ mapID, type: 'glyphimages', images, maxHeight: imagesMaxHeight }, images.map(i => i.data))
      }))
    }
    return Promise.all(promises)
  }

  buildRequests (list) {
    const { path, glyphMap } = this
    const requests = []
    const chunks = []
    // group into batches of 35
    for (let i = 0; i < list.length; i += 35) chunks.push(list.slice(i, i + 35))
    // group unicode numbers adjacent into the same range
    for (const chunk of chunks) {
      const ranges = []
      for (const unicode of chunk) {
        const { pos, length } = glyphMap.get(unicode)
        ranges.push(`${base36(pos)}-${base36(length)}`)
      }
      requests.push(`${path}?bytes=${ranges.join(',')}`)
    }

    return requests
  }

  async _fetch (path: string) {
    const res = await fetch(path, { headers: { Accept: 'application/protobuf' } })
    if (res.status !== 200 && res.status !== 206) return null
    return res.arrayBuffer()
  }
}

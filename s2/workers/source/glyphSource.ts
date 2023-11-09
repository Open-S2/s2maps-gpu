/* eslint-env worker */
import type Session from './session'

import type TexturePack from './texturePack'
import type { Color, Colors } from '../process/glyph/glyph.spec'
import type { GlyphImageData, GlyphResponseMessage } from 'workers/worker.spec'

type Unicode = number

export type IconRequest = Set<string> // [iconName, iconName, iconName, ...]

export type GlyphRequest = Unicode[] | Uint16Array // Array<Unicode>

interface GlyphPromise<U> extends Promise<U> {
  id: string
}

interface RequestCacheBase {
  mapID: string
  reqID: string
  worker: MessageChannel['port2']
  icons?: IconMap
  colors?: ColorMap
}

interface IconRequestCache extends RequestCacheBase {
  type: 'icon'
  request: IconRequest
}

interface GlyphRequestCache extends RequestCacheBase {
  type: 'glyph'
  request: GlyphRequest
}

type RequestCache = IconRequestCache | GlyphRequestCache

// export type GlyphResponse = {
//   [Unicode]: Glyph // [unicode]: Glyph
// }
export type GlyphResponse = Record<string, Float32Array> // [unicode, texX, texY, texW, texH, xOffset, yOffset, advanceWidth, ...]

export interface GlyphImage {
  posX: number
  posY: number
  width: number
  height: number
  data: ArrayBuffer
}

export type GlyphImages = GlyphImage[]

export interface Glyph {
  texX: number // x position on glyph texture sheet
  texY: number // y position on glyph texture sheet
  texW: number // width of glyph on texture sheet
  texH: number // height of glyph on texture sheet
  xOffset: number // x offset for glyph
  yOffset: number // y offset for glyph
  width: number // width of glyph
  height: number // height of glyph
  advanceWidth: number // how far to move the cursor
}

export type IconMap = Record<string, Array<{ glyphID: Unicode, colorID: number }>> // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)

type GlyphSet = Set<Unicode>

export type ColorMap = Record<number, Color>

const zagzig = (num: number): number => {
  return (num >> 1) ^ (-(num & 1))
}

const base36 = (num: number): string => {
  return num.toString(36)
}

const genID = (): string => { return Math.random().toString(16).replace('0.', '') }

export default class GlyphSource {
  active = true
  ready = false
  extent!: number
  name: string
  path: string
  size!: number
  fallbackName?: string
  fallback?: GlyphSource
  defaultAdvance!: number
  maxHeight!: number
  range!: number
  texturePack: TexturePack
  session: Session
  colors!: Colors
  iconMap!: IconMap
  glyphSet: GlyphSet = new Set() // existing glyphs
  glyphWaitlist = new Map<Unicode, Promise<void>>()
  glyphCache = new Map<number, Glyph>() // glyphs we have built already
  requestCache: RequestCache[] = [] // each element in array -> [glyphList, mapID, reqID, worker]
  constructor (
    name: string,
    path: string,
    texturePack: TexturePack,
    session: Session,
    fallbackName?: string
  ) {
    this.name = name
    this.path = path
    this.texturePack = texturePack
    this.session = session
    this.fallbackName = fallbackName // temporary reference to the source name
  }

  async build (mapID: string): Promise<void> {
    const metadata = await this._fetch(`${this.path}?type=metadata`, mapID)

    if (metadata === undefined) {
      this.active = false
      console.error(`FAILED TO extrapolate ${this.path} metadata`)
    } else { await this._buildMetadata(metadata) }
  }

  async _buildMetadata (metadata: ArrayBuffer): Promise<void> {
    const { glyphSet } = this
    const meta = new DataView(metadata)
    // build the metadata
    this.extent = meta.getUint16(0, true)
    this.size = meta.getUint16(2, true)
    this.maxHeight = meta.getUint16(4, true)
    this.range = meta.getUint16(6, true)
    this.defaultAdvance = meta.getUint16(8, true) / this.extent
    const glyphCount = meta.getUint16(10, true)
    const iconMapSize = meta.getUint32(12, true)
    const colorBufSize = meta.getUint16(16, true) * 4

    // store glyphSet
    const glyphEnd = 30 + (glyphCount * 2)
    const gmdv = new DataView(metadata, 30, glyphCount * 2)
    for (let i = 0; i < glyphCount; i++) {
      glyphSet.add(gmdv.getUint16(i * 2, true))
    }
    // build icon metadata
    if (iconMapSize > 0) {
      this.#buildIconMap(iconMapSize, new DataView(metadata, glyphEnd, iconMapSize))
      this.#buildColorMap(colorBufSize, new DataView(metadata, glyphEnd + iconMapSize, colorBufSize))
    }
    this.ready = true
    this.#checkCache()
  }

  #buildIconMap (iconMapSize: number, dv: DataView): void {
    this.iconMap = {}
    let pos = 0
    while (pos < iconMapSize) {
      const nameLength = dv.getUint8(pos)
      const mapLength = dv.getUint8(pos + 1)
      pos += 2
      const id = []
      for (let i = 0; i < nameLength; i++) id.push(dv.getUint8(pos + i))
      const name = id.map(n => String.fromCharCode(n)).join('')
      pos += nameLength
      const map = []
      for (let i = 0; i < mapLength; i++) {
        map.push({ glyphID: dv.getUint16(pos, true), colorID: dv.getUint16(pos + 2, true) })
        pos += 4
      }
      this.iconMap[name] = map
    }
  }

  #buildColorMap (colorSize: number, dv: DataView): void {
    this.colors = []
    for (let i = 0; i < colorSize; i += 4) {
      this.colors.push([dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3)])
    }
  }

  #checkCache (): void {
    while (this.requestCache.length > 0) {
      const req = this.requestCache.pop()
      if (req === undefined) break
      const { type, request, mapID, reqID, worker, icons, colors } = req
      if (type === 'icon') this.iconRequest(request, mapID, reqID, worker)
      else void this.glyphRequest(request, mapID, reqID, worker, icons, colors)
    }
  }

  iconRequest (
    request: IconRequest,
    mapID: string,
    reqID: string,
    worker: MessageChannel['port2']
  ): void {
    if (!this.ready) {
      this.requestCache.push({ type: 'icon', request, mapID, reqID, worker })
      return
    }
    const { iconMap, colors } = this
    const icons: IconMap = {}
    const colorMap: ColorMap = {} // [colorID]: Color
    // 1) build a list of glyphs to request
    const glyphList = new Set<number>()
    for (const iconReq of request) {
      // pull out the icon and store said icon for the worker to have the
      const icon = iconMap[iconReq]
      if (icon !== undefined) {
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
    void this.glyphRequest([...glyphList], mapID, reqID, worker, icons, colorMap)
  }

  async glyphRequest (
    request: GlyphRequest,
    mapID: string,
    reqID: string,
    worker: MessageChannel['port2'],
    icons?: IconMap,
    colors?: ColorMap
  ): Promise<void> {
    if (!this.ready) {
      this.requestCache.push({ type: 'glyph', request, mapID, reqID, worker, icons, colors })
      return
    }
    const { glyphCache, glyphSet, fallback, glyphWaitlist, defaultAdvance, name } = this
    const hasFallback = fallback !== undefined

    const promiseList: Array<Promise<void>> = []
    const requestList: number[] = []
    const fallbackrequestList: number[] = []
    const waitlistPromiseMap = new Map<string, Promise<void>>()
    for (const unicode of request) {
      // 1) already cached in glyphCache; do nothing
      if (glyphCache.has(unicode)) continue
      // 2) already exists in the glyphWaitlist (downloading)
      if (glyphWaitlist.has(unicode)) {
        const promise = glyphWaitlist.get(unicode) as GlyphPromise<void>
        waitlistPromiseMap.set(promise.id, promise)
      } else if (glyphSet.has(unicode)) { // 3) this glyphset has it
        requestList.push(unicode)
      } else if (hasFallback && fallback.glyphSet.has(unicode)) { // 4) the fallback glyphset has it
        fallbackrequestList.push(unicode)
      } else { // 5) no one has it
        glyphCache.set(unicode, { texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: defaultAdvance })
      }
    }
    // create THIS glyphs missing glyphs request
    if (requestList.length > 0) {
      const promise = this.#requestGlyphs(requestList, mapID) as GlyphPromise<void>
      promise.id = genID()
      promiseList.push(promise)
      for (const unicode of requestList) glyphWaitlist.set(unicode, promise)
    }
    // create FALLBACK glyphs missing glyphs request
    if (hasFallback && fallbackrequestList.length > 0) {
      const promise = fallback.#requestGlyphs(fallbackrequestList, mapID) as GlyphPromise<void>
      promise.id = genID()
      promiseList.push(promise)
      for (const unicode of fallbackrequestList) glyphWaitlist.set(unicode, promise)
    }
    // add all waitlist promises
    for (const [, promise] of waitlistPromiseMap) promiseList.push(promise)

    await Promise.all(promiseList)
    // convert glyphList into a Float32Array of unicode data and ship it out
    const shipment: number[] = []
    for (const unicode of request) {
      const glyph = glyphCache.has(unicode)
        ? glyphCache.get(unicode)
        : (fallback?.glyphCache.has(unicode) ?? false)
            ? fallback?.glyphCache.get(unicode)
            : undefined

      if (glyph !== undefined) {
        const { texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth } = glyph
        shipment.push(unicode, texX, texY, texW, texH, xOffset, yOffset, width, height, advanceWidth)
      }
    }
    const glyphMetadata = (new Float32Array(shipment)).buffer
    const glyphResponseMessage: GlyphResponseMessage = { mapID, type: 'glyphresponse', reqID, glyphMetadata, familyName: name, icons, colors }
    worker.postMessage(glyphResponseMessage, [glyphMetadata])
  }

  async #requestGlyphs (list: number[], mapID: string): Promise<void> {
    const { extent, glyphCache, glyphWaitlist, maxHeight, texturePack } = this
    // 1) build the ranges, max 35 glyphs per request
    const requests = this.#buildRequests(list)
    // 2) return the request promise, THEN: store the glyphs in cache, build the images, and ship the images to the mapID
    const promises: Array<Promise<void>> = []
    for (const request of requests) {
      promises.push(this._fetch(request, mapID).then(glyphsBuf => {
        if (glyphsBuf === undefined) return
        const images = []
        const dv = new DataView(glyphsBuf)
        const size = dv.byteLength - 1
        let pos = 0
        while (pos < size) {
          // build glyph metadata
          const unicode = dv.getUint16(pos, true)
          const glyph: Glyph = {
            width: dv.getUint16(pos + 2, true) / extent,
            height: dv.getUint16(pos + 4, true) / extent,
            texW: dv.getUint8(pos + 6),
            texH: dv.getUint8(pos + 7),
            texX: 0,
            texY: 0,
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
        const glyphImageMessage: GlyphImageData = { mapID, type: 'glyphimages', images, maxHeight: imagesMaxHeight }
        postMessage(glyphImageMessage, images.map(i => i.data))
      }))
    }
    await Promise.allSettled(promises)
  }

  #buildRequests (list: number[]): string[] {
    const { path } = this
    const requests = []
    const chunks = []
    // sort the list by unicode
    list.sort((a, b) => a - b)
    // group into batches of 150
    for (let i = 0; i < list.length; i += 150) chunks.push(list.slice(i, i + 150))
    // group unicode numbers adjacent into the same range
    for (const chunk of chunks) {
      // convert chunk to mergedRanges
      const merged = mergeRanges(chunk)
      // shape the ranges into a base36 string
      const mergedBase36 = merged.map(unicode => {
        if (Array.isArray(unicode)) return `${base36(unicode[0])}-${base36(unicode[1])}`
        else return `${base36(unicode)}`
      })
      // merge the ranges into a single request
      requests.push(`${path}?type=glyph&codes=${mergedBase36.join(',')}`)
    }

    return requests
  }

  async _fetch (path: string, mapID: string): Promise<undefined | ArrayBuffer> {
    const headers: { Authorization?: string } = {}
    if (this.session.hasAPIKey(mapID)) {
      const Authorization = await this.session.requestSessionToken(mapID)
      if (Authorization === 'failed') return
      if (Authorization !== undefined) headers.Authorization = Authorization
    }
    const res = await fetch(path, { headers })
    if (res.status !== 200 && res.status !== 206) return
    return await res.arrayBuffer()
  }
}

function mergeRanges (unicodes: number[]): Array<number | [number, number]> {
  return unicodes.reduce<Array<number | [number, number]>>((acc, cur) => {
    if (acc.length === 0) return [cur]
    const last = acc[acc.length - 1]
    // if last is an array, see if we merge
    if (Array.isArray(last) && cur === last[1] + 1) {
      last[1] = cur
      return acc
    } else if (typeof last === 'number' && cur === last + 1) {
      acc[acc.length - 1] = [last, cur]
      return acc
    }
    acc.push(cur)
    return acc
  }, [])
}

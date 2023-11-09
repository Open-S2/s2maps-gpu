/* eslint-env worker */
import type { GlyphResponseMessage, SpriteImageMessage } from 'workers/worker.spec'
import type Session from './session'
import type { SpriteFileType } from 'style/style.spec'
import type { IconMap, IconRequest } from './glyphSource'
import type TexturePack from './texturePack'

export interface SpriteMetadata {
  id: number
  width: number
  height: number
  x: number
  y: number
  pixelRatio: number
}

export type Metadata = Record<string, SpriteMetadata>

export default class SpriteSource {
  active = true
  ready = false
  name: string
  path: string
  fileType: SpriteFileType = 'png'
  fallbackName?: string
  fallback?: SpriteSource
  metadata = new Map<string, SpriteMetadata>()
  session: Session
  texturePack: TexturePack
  offsets: [offsetX: number, offsetY: number] = [0, 0]
  constructor (
    name: string,
    path: string,
    texturePack: TexturePack,
    session: Session,
    fallbackName?: string,
    fileType?: SpriteFileType
  ) {
    this.name = name
    this.path = path
    this.texturePack = texturePack
    this.session = session
    this.fallbackName = fallbackName
    if (fileType !== undefined) this.fileType = fileType
  }

  async build (mapID: string): Promise<void> {
    const { name, fileType, path, texturePack } = this
    // grab the metadata and sprites
    const [metadata, sprites] = await Promise.all([
      this._fetch(`${path}.json`, mapID),
      this._fetch(`${path}.${fileType}`, mapID)
    ]).catch(err => {
      console.error(err)
      return [undefined, undefined]
    }) as [Metadata | undefined, ArrayBuffer | undefined]
    // if either failed, stop their
    if (metadata === undefined || sprites === undefined) {
      this.active = false
      console.error(`Failed to fetch sprite source ${name}`)
    } else {
      this.ready = true
      // store the metadata
      let id = 0
      let texW = 0
      let texH = 0
      for (const [name, meta] of Object.entries(metadata)) {
        texW = Math.max(texW, meta.width + meta.x)
        texH = Math.max(texH, meta.height + meta.y)
        this.metadata.set(name, { ...meta, id })
        id++
      }
      // update the texture pack
      const [offsetX, offsetY] = this.offsets = texturePack.addGlyph(texW, texH)
      // prebuild the sprite sheet if possible
      let built = false
      let image: ArrayBuffer | ImageBitmap = sprites
      if (typeof createImageBitmap === 'function') {
        image = await createImageBitmap(new Blob([sprites]), { premultiplyAlpha: 'none' })
        built = true
      }

      // ship the sprites to the map
      const spriteImageMessage: SpriteImageMessage = { type: 'spriteimage', mapID, name, built, offsetX, offsetY, width: texW, height: texH, maxHeight: texturePack.height, image }
      postMessage(spriteImageMessage, [image])
    }
  }

  iconRequest (
    request: IconRequest,
    mapID: string,
    reqID: string,
    worker: MessageChannel['port2']
  ): void {
    const { name, metadata, fallback, offsets } = this
    // convert glyphList into a Float32Array of unicode data and ship it out
    const shipment: number[] = []
    const icons: IconMap = {}
    for (const iconReq of request) {
      const glyph = metadata.has(iconReq)
        ? metadata.get(iconReq)
        : (fallback?.metadata.has(iconReq) ?? false)
            ? fallback?.metadata.get(iconReq)
            : undefined

      if (glyph !== undefined) {
        const [offsetX, offsetY] = offsets
        const { id: glyphID, width, height, x, y, pixelRatio } = glyph
        icons[iconReq] = [{ glyphID, colorID: -1 }]
        shipment.push(glyphID, x, y, width, height, offsetX, offsetY, width / pixelRatio, height / pixelRatio, 0)
      }
    }
    const glyphMetadata = (new Float32Array(shipment)).buffer
    const glyphResponseMessage: GlyphResponseMessage = { mapID, type: 'glyphresponse', reqID, glyphMetadata, familyName: name, icons }
    worker.postMessage(glyphResponseMessage, [glyphMetadata])
  }

  async _fetch (path: string, mapID: string): Promise<undefined | Metadata | ArrayBuffer> {
    const { session } = this
    const headers: { Authorization?: string } = {}
    if (session.hasAPIKey(mapID)) {
      const Authorization = await session.requestSessionToken(mapID)
      if (Authorization === 'failed') return
      if (Authorization !== undefined) headers.Authorization = Authorization
    }
    const res = await fetch(path, { headers })
    if (res.status !== 200 && res.status !== 206) return
    if (path.endsWith('json') || res.headers.get('content-type') === 'application/json') {
      return await res.json() as Metadata
    }
    return await res.arrayBuffer()
  }
}

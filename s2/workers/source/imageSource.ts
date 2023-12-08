/* eslint-env worker */
import type { GlyphResponseMessage, SpriteImageMessage } from 'workers/worker.spec'
import type Session from './session'
import type { SpriteFileType } from 'style/style.spec'
import type { ColorMap, IconMap, IconRequest } from './glyphSource'
import type TexturePack from './texturePack'

export interface ImageMetadata {
  id: number
  width: number
  height: number
  x: number
  y: number
  pixelRatio: number
}

export type Metadata = Record<string, ImageMetadata>

export default class ImageSource {
  active = true
  name: string
  path: string
  fileType: SpriteFileType = 'png'
  fallbackName?: string
  fallback?: ImageSource
  metadata = new Map<string, ImageMetadata>()
  // metadata: ImageMetadata = { id: 0, width: 0, height: 0, x: 0, y: 0, pixelRatio: 1 }
  session: Session
  texturePack: TexturePack
  // track source is ready to take data
  resolveFirstFunction!: () => void
  readonly #firstFunctionPromise = new Promise<void>(resolve => {
    this.resolveFirstFunction = resolve
  })

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

  async build (_mapID: string): Promise<void> {}

  async addImage (mapID: string, name: string, path: string): Promise<void> {
    const { metadata, texturePack } = this
    // grab the metadata and sprites
    const data = await this._fetch(path, mapID).catch(err => {
      console.error(err)
      return undefined
    }) as ArrayBuffer
    // if either failed, stop their
    if (data === undefined) {
      this.active = false
      console.error(`Failed to fetch sprite source ${name}`)
    } else {
      const imageMetadata = { id: 0, width: 0, height: 0, x: 0, y: 0, pixelRatio: 1 }
      // prebuild the sprite sheet if possible
      let built = false
      let image: ArrayBuffer | ImageBitmap = data
      if (typeof createImageBitmap === 'function') {
        image = await createImageBitmap(new Blob([image]), { premultiplyAlpha: 'none', imageOrientation: 'flipY' })
        // update metadata width and height
        imageMetadata.width = image.width
        imageMetadata.height = image.height
        built = true
      }
      // get offsets from texturePack
      const [offsetX, offsetY] = texturePack.addGlyph(imageMetadata.width, imageMetadata.height)
      // update imageMetadata x and y
      imageMetadata.x = offsetX
      imageMetadata.y = offsetY
      // store the metadata
      metadata.set(name, imageMetadata)

      // ship the sprites to the map
      const spriteImageMessage: SpriteImageMessage = { type: 'spriteimage', mapID, name: this.name, built, offsetX, offsetY, width: imageMetadata.width, height: imageMetadata.height, maxHeight: texturePack.height, image }
      postMessage(spriteImageMessage, [image])
      this.resolveFirstFunction()
    }
  }

  async iconRequest (
    request: IconRequest,
    mapID: string,
    reqID: string,
    worker: MessageChannel['port2']
  ): Promise<void> {
    await this.#firstFunctionPromise
    const { name, metadata, fallback } = this
    // convert glyph data into a Float32Array of unicode data and ship it out
    const shipment: number[] = []
    const icons: IconMap = {}
    const colors: ColorMap = { 0: [0, 0, 0, 0] }
    for (const iconReq of request) {
      const glyph = metadata.has(iconReq)
        ? metadata.get(iconReq)
        : (fallback?.metadata.has(iconReq) ?? false)
            ? fallback?.metadata.get(iconReq)
            : undefined
      if (glyph !== undefined) {
        const { id: glyphID, width, height, x, y, pixelRatio } = glyph
        icons[iconReq] = [{ glyphID, colorID: 0 }]
        shipment.push(glyphID, x, y, width, height, 0, 0, width / pixelRatio, height / pixelRatio, 0)
      }
    }
    const glyphMetadata = (new Float32Array(shipment)).buffer
    const glyphResponseMessage: GlyphResponseMessage = { mapID, type: 'glyphresponse', reqID, glyphMetadata, familyName: name, icons, colors }
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

import type { SpriteImageMessage } from 'workers/worker.spec'
import type Session from './session'
import type { SpriteFileType } from 'style/style.spec'
import type { Glyph } from 'workers/process/glyph/familySource'
import type TexturePack from './texturePack'

export type Metadata = Record<string, Glyph>
export interface ImageMetadata {
  name: string
  metadata: Metadata
}

export default class ImageSource {
  active = true
  name: string
  path: string
  fileType: SpriteFileType = 'png'
  metadata: Metadata = {}
  session: Session
  texturePack: TexturePack

  constructor (
    name: string,
    path: string,
    texturePack: TexturePack,
    session: Session,
    fileType?: SpriteFileType
  ) {
    this.name = name
    this.path = path
    this.texturePack = texturePack
    this.session = session
    if (fileType !== undefined) this.fileType = fileType
  }

  async build (_mapID: string): Promise<undefined | ImageMetadata> {
    return undefined
  }

  async addImage (mapID: string, name: string, path: string): Promise<undefined | ImageMetadata> {
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
      const imageMetadata: Glyph = {
        code: name,
        texX: 0,
        texY: 0,
        texW: 0,
        texH: 0,
        xOffset: 0,
        yOffset: 0,
        width: 0,
        height: 0,
        advanceWidth: 0
      }
      // prebuild the sprite sheet if possible
      let built = false
      let image: ArrayBuffer | ImageBitmap = data
      if (typeof createImageBitmap === 'function') {
        image = await createImageBitmap(new Blob([image]), { premultiplyAlpha: 'none', imageOrientation: 'flipY' })
        // update metadata width and height
        imageMetadata.width = image.width
        imageMetadata.height = image.height
        imageMetadata.texW = image.width
        imageMetadata.texH = image.height
        built = true
      }
      // get offsets from texturePack
      const [offsetX, offsetY] = texturePack.addGlyph(imageMetadata.width, imageMetadata.height)
      // update imageMetadata x and y
      imageMetadata.texX = offsetX
      imageMetadata.texY = offsetY
      // store the metadata
      metadata[name] = imageMetadata

      // ship the sprites to the map
      const spriteImageMessage: SpriteImageMessage = { type: 'spriteimage', mapID, name: this.name, built, offsetX, offsetY, width: imageMetadata.width, height: imageMetadata.height, maxHeight: texturePack.height, image }
      postMessage(spriteImageMessage, [image])
    }
    return { name: this.name, metadata }
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

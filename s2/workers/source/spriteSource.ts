/* eslint-env worker */
import ImageSource from './imageSource'
import type { SpriteImageMessage } from 'workers/worker.spec'

export interface SpriteMetadata {
  id: number
  width: number
  height: number
  x: number
  y: number
  pixelRatio: number
}

export type Metadata = Record<string, SpriteMetadata>

export default class SpriteSource extends ImageSource {
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
      const [offsetX, offsetY] = texturePack.addGlyph(texW, texH)
      // invert the y axis for each glyph & add offsets
      for (const meta of this.metadata.values()) {
        meta.y = texH - meta.y - meta.height + offsetY
        meta.x += offsetX
      }
      // prebuild the sprite sheet if possible
      let built = false
      let image: ArrayBuffer | ImageBitmap = sprites
      if (typeof createImageBitmap === 'function') {
        image = await createImageBitmap(new Blob([sprites]), { premultiplyAlpha: 'none', imageOrientation: 'flipY' })
        built = true
      }

      // ship the sprites to the map
      const spriteImageMessage: SpriteImageMessage = { type: 'spriteimage', mapID, name, built, offsetX, offsetY, width: texW, height: texH, maxHeight: texturePack.height, image }
      postMessage(spriteImageMessage, [image])
      this.resolveFirstFunction()
    }
  }
}

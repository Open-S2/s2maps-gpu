import ImageSource from './imageSource'

import type { SpriteImageMessage } from 'workers/worker.spec'
import type { ImageMetadata, Metadata } from './imageSource'

export interface SpriteMetadata {
  id: number
  width: number
  height: number
  x: number
  y: number
  pixelRatio: number
}
export type SpritesMetadata = Record<string, SpriteMetadata>

export default class SpriteSource extends ImageSource {
  async build (mapID: string): Promise<undefined | ImageMetadata> {
    const { name, fileType, path, texturePack } = this
    // grab the metadata and sprites
    const [spriteMeta, sprites] = await Promise.all([
      this._fetch(`${path}.json`, mapID),
      this._fetch(`${path}.${fileType}`, mapID)
    ]).catch(err => {
      console.error(err)
      return [undefined, undefined]
    }) as [SpritesMetadata | undefined, ArrayBuffer | undefined]
    // if either failed, stop their
    if (spriteMeta === undefined || sprites === undefined) {
      this.active = false
      console.error(`Failed to fetch sprite source ${name}`)
    } else {
      const metadata: Metadata = {}
      // store the metadata
      let texW = 0
      let texH = 0
      for (const meta of Object.values(spriteMeta)) {
        texW = Math.max(texW, meta.width + meta.x)
        texH = Math.max(texH, meta.height + meta.y)
      }
      // update the texture pack
      const [offsetX, offsetY] = texturePack.addGlyph(texW, texH)
      // invert the y axis for each glyph & add offsets
      for (const [name, meta] of Object.entries(spriteMeta)) {
        // fix the y axis to be inverted
        meta.y = texH - meta.y - meta.height + offsetY
        const { x, y, width, height, pixelRatio } = meta
        metadata[name] = {
          code: name,
          texX: x + offsetX,
          texY: y + offsetY,
          texW: width,
          texH: height,
          xOffset: 0,
          yOffset: 0,
          width: width / pixelRatio,
          height: height / pixelRatio,
          advanceWidth: 0
        }
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
      return { name, metadata }
    }
  }
}

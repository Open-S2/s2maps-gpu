import type { Glyph } from 'workers/process/glyph/familySource.js';
import type { ImageExtensions } from 'style/style.spec.js';
import type Session from './session.js';
import type { SpriteImageMessage } from 'workers/worker.spec.js';
import type TexturePack from './texturePack.js';

/** Metadata for an image source */
export type ImageMetadata = Record<string, Glyph>;
/** Full metadata for an image source including name */
export interface ImageSourceMetadata {
  name: string;
  metadata: ImageMetadata;
}

/**
 * # ImageSource
 *
 * ## Description
 * A collection of images relating to a single source
 */
export default class ImageSource {
  active = true;
  name: string;
  path: string;
  fileType: ImageExtensions = 'png';
  metadata: ImageMetadata = {};
  session: Session;
  texturePack: TexturePack;

  /**
   * @param name - the name of the source
   * @param path - the path to the source
   * @param texturePack - the texture pack to store the glyphs/images into
   * @param session - the session
   * @param fileType - the file type
   */
  constructor(
    name: string,
    path: string,
    texturePack: TexturePack,
    session: Session,
    fileType?: ImageExtensions,
  ) {
    this.name = name;
    this.path = path;
    this.texturePack = texturePack;
    this.session = session;
    if (fileType !== undefined) this.fileType = fileType;
  }

  /**
   * Build the source
   * @param _mapID - the id of the map to build for
   * @returns the image metadata (we don't need to early ship this)
   */
  async build(_mapID: string): Promise<undefined | ImageSourceMetadata> {
    return await undefined;
  }

  /**
   * Add an image to the source collection
   * @param mapID - the id of the map to build for
   * @param name - the name of the image
   * @param path - the path to the image
   * @returns the image metadata if successful
   */
  async addImage(
    mapID: string,
    name: string,
    path: string,
  ): Promise<undefined | ImageSourceMetadata> {
    const { metadata, texturePack } = this;
    // grab the metadata and sprites
    const data = (await this._fetch(path, mapID).catch((err) => {
      console.error(err);
      return undefined;
    })) as ArrayBuffer;
    // if either failed, stop their
    if (data === undefined) {
      this.active = false;
      console.error(`Failed to fetch sprite source ${name}`);
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
        advanceWidth: 0,
      };
      // prebuild the sprite sheet if possible
      const image = await createImageBitmap(new Blob([data]), {
        premultiplyAlpha: 'none',
        imageOrientation: 'flipY',
      });
      // update metadata width and height
      imageMetadata.width = image.width;
      imageMetadata.height = image.height;
      imageMetadata.texW = image.width;
      imageMetadata.texH = image.height;
      // get offsets from texturePack
      const [offsetX, offsetY] = texturePack.addGlyph(imageMetadata.width, imageMetadata.height);
      // update imageMetadata x and y
      imageMetadata.texX = offsetX;
      imageMetadata.texY = offsetY;
      // store the metadata
      metadata[name] = imageMetadata;

      // ship the sprites to the map
      const spriteImageMessage: SpriteImageMessage = {
        type: 'spriteimage',
        mapID,
        name: this.name,
        offsetX,
        offsetY,
        width: imageMetadata.width,
        height: imageMetadata.height,
        maxHeight: texturePack.height,
        image,
      };
      postMessage(spriteImageMessage, [image]);
    }
    return { name: this.name, metadata };
  }

  /**
   * Fetch an image
   * @param path - the path to the image or metadata
   * @param mapID - the id of the map
   * @returns the image or metadata
   */
  async _fetch(path: string, mapID: string): Promise<undefined | ImageMetadata | ArrayBuffer> {
    const { session } = this;
    const headers: { Authorization?: string } = {};
    if (session.hasAPIKey(mapID)) {
      const Authorization = await session.requestSessionToken(mapID);
      if (Authorization === 'failed') return;
      if (Authorization !== undefined) headers.Authorization = Authorization;
    }
    const res = await fetch(path, { headers });
    if (res.status !== 200 && res.status !== 206) return;
    if (path.endsWith('json') || res.headers.get('content-type') === 'application/json') {
      return (await res.json()) as ImageMetadata;
    }
    return await res.arrayBuffer();
  }
}

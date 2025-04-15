import { zagzig } from 'open-vector-tile';

import type Session from './session';

import type { Glyph } from 'workers/process/glyph/familySource';
import type TexturePack from './texturePack';
import type { GlyphImageData, GlyphResponseMessage } from 'workers/worker.spec';

/** Unparsed state of glyph metadata, letting Tile Workers know of what glyphs are available */
export interface GlyphMetadataUnparsed {
  name: string;
  metadata: undefined | ArrayBuffer;
}
/** Actual glyph metadata for the Tile Worker to know how to shape and prepare glyphs for rendering */
export interface GlyphMetadata {
  name: string;
  metadata: ArrayBuffer;
}

/** An incoming lost of icon requests. Each string is the name of an icon */
export type IconRequest = Set<string>; // [iconName, iconName, iconName, ...]
/** Glyph request promise */
interface GlyphPromise<U> extends Promise<U> {
  id: string;
}
/** Glyph Image shape stored for future requests from Tile Workers */
export interface GlyphImage {
  posX: number;
  posY: number;
  width: number;
  height: number;
  data: ArrayBuffer;
}
/** Collection of Glyph Images */
export type GlyphImages = GlyphImage[];

/**
 * # Glyph Source
 *
 * A glyph source manager to request metadata, glyphs, and images
 */
export default class GlyphSource {
  active = true;
  extent: number = 0;
  name: string;
  path: string;
  size: number = 0;
  defaultAdvance: number = 0;
  maxHeight: number = 0;
  range: number = 0;
  texturePack: TexturePack;
  session: Session;
  glyphWaitlist = new Map<string, Promise<void>>();
  glyphCache = new Map<string, Glyph>(); // glyphs we have built already
  isIcon = false;
  /**
   * @param name - the name of the source
   * @param path - the path to the source
   * @param texturePack - the texture pack to help define where the glyphs/images are stored
   * @param session - the session
   */
  constructor(name: string, path: string, texturePack: TexturePack, session: Session) {
    this.name = name;
    this.path = path;
    this.texturePack = texturePack;
    this.session = session;
  }

  /**
   * Build the source data
   * @param mapID - the id of the map
   * @returns the metadata, yet to be parsed
   */
  async build(mapID: string): Promise<GlyphMetadataUnparsed> {
    const metadata = await this._fetch(`${this.path}?type=metadata`, mapID);

    if (metadata === undefined) {
      this.active = false;
      console.error(`FAILED TO extrapolate ${this.path} metadata`);
      return { name: this.name, metadata: undefined };
    } else {
      return await this._buildMetadata(metadata);
    }
  }

  /**
   * Build metadata from a buffer
   * @param metadata - the metadata buffer
   * @returns the metadata
   */
  _buildMetadata(metadata: ArrayBuffer): GlyphMetadataUnparsed {
    const meta = new DataView(metadata);
    // build the metadata
    this.extent = meta.getUint16(0, true);
    this.size = meta.getUint16(2, true);
    this.maxHeight = meta.getUint16(4, true);
    this.range = meta.getUint16(6, true);
    this.defaultAdvance = meta.getUint16(8, true) / this.extent;
    this.isIcon = meta.getUint32(12, true) > 0;
    // return the metadata so it can be shipped to the worker threads
    return { name: this.name, metadata };
  }

  /**
   * Given a collection of unicodes, request the glyphs from the server
   * @param request - array of unicodes
   * @param mapID - the id of the map we are fetching data for
   * @param reqID - the id of the request
   * @param worker - the worker port
   */
  async glyphRequest(
    request: string[], // array of codes
    mapID: string,
    reqID: string,
    worker: MessageChannel['port2'],
  ): Promise<void> {
    const { glyphCache, glyphWaitlist, name } = this;

    const promiseList: Array<Promise<void>> = [];
    const requestList: string[] = [];
    const waitlistPromiseMap = new Map<string, Promise<void>>();
    for (const code of request) {
      // 1) already cached in glyphCache; do nothing
      if (glyphCache.has(code)) continue;
      // 2) already exists in the glyphWaitlist (downloading)
      if (glyphWaitlist.has(code)) {
        const promise = glyphWaitlist.get(code) as GlyphPromise<void>;
        waitlistPromiseMap.set(promise.id, promise);
      } else {
        // 5) no one has it
        requestList.push(code);
      }
    }
    // create THIS glyphs missing glyphs request
    if (requestList.length > 0) {
      const promise = this.#requestGlyphs(requestList, mapID) as GlyphPromise<void>;
      promise.id = genID();
      promiseList.push(promise);
      for (const unicode of requestList) glyphWaitlist.set(unicode, promise);
    }
    // add all waitlist promises
    for (const [, promise] of waitlistPromiseMap) promiseList.push(promise);

    await Promise.all(promiseList);
    // convert glyphList into a Float32Array of unicode data and ship it out
    const glyphMetadata: Glyph[] = [];
    for (const unicode of request) {
      const glyph = glyphCache.get(unicode);
      if (glyph !== undefined) glyphMetadata.push(glyph);
    }
    const glyphResponseMessage: GlyphResponseMessage = {
      mapID,
      type: 'glyphresponse',
      reqID,
      glyphMetadata,
      familyName: name,
    };
    worker.postMessage(glyphResponseMessage);
  }

  /**
   * Request glyphs
   * @param list - array of unicodes to request their data for
   * @param mapID - the id of the map
   */
  async #requestGlyphs(list: string[], mapID: string): Promise<void> {
    const { isIcon, extent, glyphCache, glyphWaitlist, maxHeight, texturePack } = this;
    // 1) build the ranges, max 35 glyphs per request
    const requests = this.#buildRequests(list);
    // 2) return the request promise, THEN: store the glyphs in cache, build the images, and ship the images to the mapID
    const promises: Array<Promise<void>> = [];
    for (const { request, substitutes } of requests) {
      promises.push(
        this._fetch(request, mapID).then((glyphsBuf) => {
          if (glyphsBuf === undefined) return;
          const images: GlyphImages = [];
          const dv = new DataView(glyphsBuf);
          const size = dv.byteLength - 1;
          let pos = 0;
          while (pos < size) {
            // build glyph metadata
            let code = String(dv.getUint16(pos, true));
            if (!isIcon && code === '0') code = substitutes.shift() ?? '';
            const glyph: Glyph = {
              code,
              width: dv.getUint16(pos + 2, true) / extent,
              height: dv.getUint16(pos + 4, true) / extent,
              texW: dv.getUint8(pos + 6),
              texH: dv.getUint8(pos + 7),
              texX: 0,
              texY: 0,
              xOffset: zagzig(dv.getUint16(pos + 8, true)) / extent,
              yOffset: zagzig(dv.getUint16(pos + 10, true)) / extent,
              advanceWidth: zagzig(dv.getUint16(pos + 12, true)) / extent,
            };
            pos += 14;
            // store in texturePack
            const [posX, posY] = texturePack.addGlyph(glyph.texW, maxHeight);
            glyph.texX = posX;
            glyph.texY = posY;
            // store glyph in cache
            glyphCache.set(code, glyph);
            // remove from waitlist cache
            glyphWaitlist.delete(code);
            // grab the image
            const imageSize = glyph.texW * glyph.texH * 4;
            const data = new Uint8ClampedArray(glyphsBuf.slice(pos, pos + imageSize))
              .buffer as ArrayBuffer;
            images.push({ posX, posY, width: glyph.texW, height: glyph.texH, data });
            pos += imageSize;
          }
          // send off the images
          const imagesMaxHeight = images.reduce(
            (acc, cur) => Math.max(acc, cur.posY + cur.height),
            0,
          );
          const glyphImageMessage: GlyphImageData = {
            mapID,
            type: 'glyphimages',
            images,
            maxHeight: imagesMaxHeight,
          };
          postMessage(
            glyphImageMessage,
            images.map((i) => i.data),
          );
        }),
      );
    }
    await Promise.allSettled(promises);
  }

  /**
   * Build requests from the list of requested glyphs
   * @param list - list of requested glyphs
   * @returns an array of requests
   */
  #buildRequests(list: string[]): Array<{ request: string; substitutes: string[] }> {
    const { path } = this;
    const requests: Array<{ request: string; substitutes: string[] }> = [];
    const chunks: Array<Array<number | string>> = [];
    // sort the list by unicode order first substitions second
    const parsedList = list
      .map((code) => {
        if (code.includes('.')) return code;
        else return Number(code);
      })
      .sort((a, b): number => {
        if (typeof a === 'string') return 1;
        if (typeof b === 'string') return -1;
        return a - b;
      });
    // group into batches of 150
    for (let i = 0; i < parsedList.length; i += 150) chunks.push(parsedList.slice(i, i + 150));
    // group unicode numbers adjacent into the same range
    for (const chunk of chunks) {
      // convert chunk to mergedRanges
      const merged = mergeRanges(chunk);
      // shape the ranges into a base36 string
      const mergedBase36 = merged.map((code) => {
        if (Array.isArray(code)) return `${base36(code[0])}-${base36(code[1])}`;
        else if (typeof code === 'number') return `${base36(code)}`;
        else return code;
      });
      // merge the ranges into a single request
      const request = `${path}?type=glyph&codes=${mergedBase36.join(',')}`;
      const substitutes = mergedBase36.filter(
        (code) => typeof code === 'string' && code.includes('.'),
      );
      requests.push({ request, substitutes });
    }

    return requests;
  }

  /**
   * Fetch glyph data and or metadata
   * @param path - the url to fetch the data
   * @param mapID - the id of the map
   * @returns the raw data if found
   */
  async _fetch(path: string, mapID: string): Promise<undefined | ArrayBuffer> {
    const headers: { Authorization?: string } = {};
    if (this.session.hasAPIKey(mapID)) {
      const Authorization = await this.session.requestSessionToken(mapID);
      if (Authorization === 'failed') return;
      if (Authorization !== undefined) headers.Authorization = Authorization;
    }
    const res = await fetch(path, { headers });
    if (res.status !== 200 && res.status !== 206) return;
    return await res.arrayBuffer();
  }
}

/** Result of merging ranges */
type MergeResult = Array<string | number | [from: number, to: number]>;
/**
 * Merge ranges of unicodes into as few ranges as possible.
 * @param unicodes - unicodes to merge
 * @returns merged ranges
 */
function mergeRanges(unicodes: Array<string | number>): MergeResult {
  return unicodes.reduce<MergeResult>((acc, cur): MergeResult => {
    if (acc.length === 0) return [cur];
    const last = acc[acc.length - 1];
    // if last is an array, see if we merge
    if (Array.isArray(last) && cur === last[1] + 1) {
      last[1] = cur;
      return acc;
    } else if (typeof last === 'number' && cur === last + 1) {
      acc[acc.length - 1] = [last, cur];
      return acc;
    }
    acc.push(cur);
    return acc;
  }, []);
}

/**
 * Convert a number to a base36 string
 * @param num - number
 * @returns base36 string
 */
function base36(num: number): string {
  return num.toString(36);
}

/**
 * ID generator. Used to ensure features don't overlap
 * @returns a random string
 */
function genID(): string {
  return Math.random().toString(16).replace('0.', '');
}

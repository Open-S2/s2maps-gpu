import { Cache } from 'gis-tools/index.js';
import Source from './source.js';

import type { Point3D } from 'gis-tools/index.js';
import type { SourceMetadata } from 'style/style.spec.js';
import type { TileRequest } from '../worker.spec.js';

const MAX_SIZE = 2_000_000; // ~2 MB
const NODE_SIZE = 10;
const DIR_SIZE = 1_365 * NODE_SIZE; // (13_650) -> 6 levels, the 6th level has both node and leaf (1+4+16+64+256+1024)*2 = 2_730
const ROOT_DIR_SIZE = DIR_SIZE * 6; // (81_900) -> 6 faces of 6 level directories + their leaves
const DB_METADATA_SIZE = ROOT_DIR_SIZE + 20; // (81_920) -> 6 faces of 6 level directories + their leaves + 20 bytes for the header

/**
 * # S2 Tiles Source
 *
 * A Tile caching mechanic that stores all tile data in a single file. Great for cloud storage.
 *
 * NOTE: This is most likely deprecated and may be removed in the future to be replaced
 * by S2PMTilesSource.
 */
export default class S2TilesSource extends Source {
  version = 1;
  rootDir: Record<number, DataView> = {};
  dirCache = new Cache<number, DataView>(15);
  /** @param mapID - the id of the map we are fetching data for */
  override async build(mapID: string): Promise<void> {
    // fetch the metadata
    const ab = (await this.getRange(`${this.path}?type=dir`, 0, DB_METADATA_SIZE, mapID)) as
      | ArrayBuffer
      | undefined;
    if (ab === undefined || ab.byteLength !== DB_METADATA_SIZE) {
      // if the return is empty, we failed
      this.active = false;
      console.error(`Failed to extrapolate ${this.path} metadata`);
      return;
    }
    // prep a data view, store in header, build metadata
    const dv = new DataView(ab, 0, 20);
    if (dv.getUint16(0, true) !== 12883) {
      // the first two bytes are S and 2, we validate
      this.active = false;
      console.error(`Bad metadata from ${this.path}`);
      return;
    }
    // parse: grab the version
    this.version = dv.getUint16(2, true);
    // parse the JSON metadata length and offset
    const mL = dv.getUint32(4, true);
    const mO = getUint48(dv, 8);
    if (mL === 0 || mO === 0) {
      // if the metadata is empty, we failed
      this.active = false;
      console.error(`Failed to extrapolate ${this.path} metadata`);
      return;
    }
    // create root directories
    for (const face of [0, 1, 2, 3, 4, 5])
      this.rootDir[face] = new DataView(ab, 20 + face * DIR_SIZE, DIR_SIZE);
    const metadata = (await this.getRange(
      `${this.path}?type=metadata`,
      mO,
      mL,
      mapID,
    )) as SourceMetadata;
    this._buildMetadata(metadata, mapID);
  }

  /**
   * Here, we use the memory mapped file directory tree system to find our data
   * @param mapID - the id of the map we are fetching data for
   * @param tile - the tile request
   * @param sourceName - the name of the source
   */
  override async _tileRequest(mapID: string, tile: TileRequest, sourceName: string): Promise<void> {
    const { type, encoding, session, size } = this;
    const { parent } = tile;
    const { face, zoom, i, j } = parent ?? tile;

    // pull in the correct face's directory
    const dir = this.rootDir[face];
    // now we walk to the next directory as necessary
    const node = await this.#walk(mapID, dir, zoom, i, j); // [offset, length]
    if (node === undefined) {
      this._flush(mapID, tile, sourceName);
      return;
    }

    // we found the vector file, let's send the details off to the tile worker
    const data = (await this.getRange(
      `${this.path}?type=tile&enc=${encoding}`,
      node[0],
      node[1],
      mapID,
    )) as ArrayBuffer | undefined;
    if (data !== undefined) {
      const worker = session.requestWorker();
      worker.postMessage({ mapID, type, tile, sourceName, data, size }, [data]);
    } else {
      this._flush(mapID, tile, sourceName);
    }
  }

  /**
   * Walk the directory tree
   * @param mapID - the map id
   * @param dir - the current directory we are walking
   * @param zoom - current zoom
   * @param i - current i-coordinate
   * @param j - current j-coordinate
   * @returns the offset and length of either the next directory or raw data
   */
  async #walk(
    mapID: string,
    dir: DataView,
    zoom: number,
    i: number,
    j: number,
  ): Promise<undefined | [offset: number, length: number]> {
    const { maxzoom } = this;
    const path = getPath(zoom, i, j);
    let offset = 0;
    let length = 0;

    // walk the tree if past zoom 0
    while (path.length > 0) {
      // grab position
      const nodePos = (path.shift() ?? 0) * NODE_SIZE;
      // set
      offset = getUint48(dir, nodePos);
      length = dir.getUint32(nodePos + 6, true);
      if (length === 0) return;
      // if we are still walking, grab the new directory
      if (path.length > 0) {
        // corner case: if maxzoom matches the zoom and is divisible by 5, the leaf is actually a node
        if (maxzoom % 5 === 0 && zoom === maxzoom && path.length === 1 && path[0] === 0) {
          return [offset, length];
        }
        // otherwise fetch the directory
        const nextDir = await this.#getDir(mapID, offset, length);
        if (nextDir === undefined) return;
        dir = nextDir;
      }
    }

    if (length === 0 || length > MAX_SIZE) return;
    return [offset, length];
  }

  /**
   * Get a directory
   * @param mapID - the map id we are are fetching data for
   * @param offset - the start of the directory
   * @param length - the length of the directory
   * @returns the directory
   */
  async #getDir(mapID: string, offset: number, length: number): Promise<undefined | DataView> {
    if (this.dirCache.has(offset)) return this.dirCache.get(offset);
    const ab = (await this.getRange(`${this.path}?type=dir`, offset, length, mapID)) as
      | undefined
      | ArrayBuffer;
    if (ab !== undefined) {
      const dir = new DataView(ab);
      this.dirCache.set(offset, dir);
      return dir;
    }
  }

  /**
   * Get a range request
   * @param url - the base href to build a range request from
   * @param offset - the start of the range
   * @param length - the length of the range
   * @param mapID - the map id we are going to build render data for
   * @returns raw tile data or directory data
   */
  async getRange(
    url: string,
    offset: number,
    length: number,
    mapID: string,
  ): Promise<undefined | ArrayBuffer | object> {
    const { needsToken, type, session } = this;
    const headers: { Authorization?: string } = {};
    const bytes = String(offset) + '-' + String(offset + length);
    if (needsToken) {
      const Authorization = await session.requestSessionToken(mapID);
      if (Authorization === 'failed') return;
      if (Authorization !== undefined) headers.Authorization = Authorization;
    }
    if (length === 0 || length > MAX_SIZE) return;
    const res = await fetch(`${url}&bytes=${bytes}&subtype=${type}`, { headers });
    if (res.status !== 200 && res.status !== 206) return;
    if (res.headers.get('content-type') === 'application/json') return await res.json();
    return await res.arrayBuffer();
  }
}

/**
 * Given a dataview and a position, get a 48-bit integer
 * @param dataview - the dataview
 * @param pos - the position to start reading from
 * @returns a 48-bit integer
 */
function getUint48(dataview: DataView, pos: number): number {
  return dataview.getUint32(pos + 2, true) * (1 << 16) + dataview.getUint16(pos, true);
}

/**
 * Given a starting point, find a list of path offsets to traverse
 * @param zoom - starting zoom-level
 * @param x - starting x-coordinate
 * @param y - starting y-coordinate
 * @returns a list of path offsets
 */
function getPath(zoom: number, x: number, y: number): number[] {
  const { max, pow } = Math;
  const path: Point3D[] = [];

  // grab 6 bits at a time
  while (zoom >= 5) {
    // store at offset
    path.push([5, x & 31, y & 31]);
    // adjust
    x >>= 5;
    y >>= 5;
    zoom = max(0, zoom - 5);
  }
  // store leftovers
  path.push([zoom, x, y]);

  return path.map(([zoom, x, y]): number => {
    let val = 0;
    // adjust by position at current zoom
    val += y * (1 << zoom) + x;
    // adjust by previous zoom tile sizes
    while (zoom-- > 0) val += pow(1 << zoom, 2);

    return val;
  });
}

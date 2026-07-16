import { Compression, compressionToFormat, decompressStream } from '../../util/index.js';
import { Cache as DirCache, FetchReader, toReader } from '../../index.js';

import type { Metadata } from 's2-tilejson';
import type { Face, Reader, ReaderInputs } from '../../index.js';

/**
 * A directory consists of an offset and a length pointing to a node or a leaf.
 * Offset: 6 bytes
 * Length: 4 bytes
 */
type Node = [offset: number, length: number];

const NODE_SIZE = 10; // [offset, length] => [6 bytes, 4 bytes]
const DIR_SIZE = 1_365 * NODE_SIZE; // (13_650) -> 6 levels, the 6th level has both node and leaf (1+4+16+64+256+1024)*2 => (1365)+1365 => 2_730
const METADATA_SIZE = 131_072; // 131,072 bytes is 128kB. It is assumed the map metadata AND the S2Tile format metadata is less than 128kB.
const ROOT_DIR_SIZE = DIR_SIZE * 7; // 27_300 * 7 = 191_100
const ROOT_SIZE = METADATA_SIZE + ROOT_DIR_SIZE;
// assuming all tiles exist for every face from 0->30 the max leafs to reach depth of 30 is 5
// root: 7sides * 27_300bytes/dir = (191_100 bytes)
// all leafs at 6 (only S2): 1024 * 6sides * 27_300bytes/dir (0.167731 GB)
// al leafs at 12 (only S2): 524_288 * 6sides * 27_300bytes/dir (85.8783744 GB) - obviously most of this is water

/**
 * # S2 Tiles Reader
 *
 * ## Description
 *
 * An S2 Tile Reader to store tile and metadata in a cloud optimized format. Similar to PMTiles
 * but simplified to have as few features as possible.
 *
 * Reads either a Web Mercator tile or an S2 tile to the folder location given its (zoom, x, y) or (face, zoom, x, y) coordinates.
 *
 * Reads data via the [S2Tiles specification](https://github.com/Open-S2/s2tiles/blob/master/s2tiles-spec/1.0.0/README.md).
 *
 * ## Usage
 *
 * ```ts
 * import { S2TilesReader } from 'gis-tools-ts';
 * import { FileReader } from 'gis-tools-ts/file';
 * // or use the MMapReader if using Bun / FetchReader for web:
 * // import { MMapReader } from 'gis-tools-ts/mmap';
 * // import { FetchReader } from 'gis-tools-ts';
 *
 * const reader = new S2TilesReader(new FileReader('./data.s2tiles'));
 *
 * // get the metadata
 * const metadata = await reader.getMetadata();
 *
 * // S2 specific functions
 * const hasTile = await reader.hasTileS2(0, 0, 0, 0);
 * const tile = await reader.getTileS2(0, 0, 0, 0);
 *
 * // WM functions
 * const hasTile = await reader.hasTileWM(0, 0, 0);
 * const tile = await reader.getTileWM(0, 0, 0);
 * ```
 *
 * ## Links
 * - https://github.com/Open-S2/s2tiles/blob/master/s2tiles-spec/1.0.0/README.md
 */
export class S2TilesReader {
  #isSetup = false;
  version = 1;
  maxzoom = 0;
  #reader: Reader;
  compression: Compression = Compression.Gzip;
  metadata?: Metadata;
  #rootDir: Record<number, DataView> = {};
  #dirCache: DirCache<number, DataView>;
  decoder = new TextDecoder();
  /**
   * @param path - the location of the S2Tiles data
   * @param rangeRequests - FetchReader specific; enable range requests or use urlParam "bytes"
   * @param maxSize - the max size of the cache before dumping old data. Defaults to 20.
   */
  constructor(
    readonly path: string | ReaderInputs,
    rangeRequests: boolean = false,
    maxSize = 20,
  ) {
    if (typeof path === 'string') {
      this.#reader = new FetchReader(path, rangeRequests);
    } else {
      this.#reader = toReader(path);
    }
    this.#dirCache = new DirCache(maxSize);
  }

  /**
   * Get the metadata of the archive
   * @returns - the metadata of the archive
   */
  async getMetadata(): Promise<Metadata> {
    if (this.metadata !== undefined) return this.metadata;
    await this.setup();
    return this.metadata!;
  }

  /** Setup the reader */
  async setup(): Promise<void> {
    if (this.#isSetup) return;
    this.#isSetup = true;
    // fetch the metadata
    const data = await this.#reader.getRange(0, ROOT_SIZE);
    // prep a data view, store in header, build metadata
    const dv = new DataView(data.buffer, 0, ROOT_SIZE);
    if (dv.getUint16(0, true) !== 12_883) {
      // the first two bytes are S and 2, we validate
      throw new Error(`Bad metadata from ${this.path}`);
    }
    // parse the version, maxzoom, and compression
    this.version = dv.getUint16(2, true);
    this.maxzoom = dv.getUint8(4);
    this.compression = dv.getUint8(5) as Compression;
    // parse the JSON metadata length and offset
    const mL = dv.getUint32(6, true);
    if (mL === 0) {
      // if the metadata is empty, we failed
      throw new Error(`Failed to extrapolate ${this.path} metadata`);
    }
    const meta_data = await decompress(data.slice(10, 10 + mL), this.compression);
    this.metadata = JSON.parse(this.decoder.decode(meta_data)) as Metadata;
    // create root directories
    for (const face of [0, 1, 2, 3, 4, 5, 6])
      this.#rootDir[face] = new DataView(data.buffer, METADATA_SIZE + face * DIR_SIZE, DIR_SIZE);
  }

  /**
   * Check if a tile exists in the archive
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - true if the tile exists in the archive
   */
  async hasTileWM(zoom: number, x: number, y: number): Promise<boolean> {
    return await this.hasTileS2(6 as Face, zoom, x, y);
  }

  /**
   * Check if an S2 tile exists in the archive
   * @param face - the Open S2 projection face
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - true if the tile exists in the archive
   */
  async hasTileS2(face: Face, zoom: number, x: number, y: number): Promise<boolean> {
    await this.setup();
    // pull in the correct face's directory
    const dir = this.#rootDir[face];
    // now we walk to the next directory as necessary
    const node = await this.#walk(dir, zoom, x, y); // [offset, length]
    if (node === undefined) return false;
    const [offset, length] = node;
    return offset !== 0 && length !== 0;
  }

  /**
   * Get the bytes of the tile at the given (zoom, x, y) coordinates
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the bytes of the tile at the given (z, x, y) coordinates, or undefined if the tile
   * does not exist in the archive.
   */
  async getTileWM(zoom: number, x: number, y: number): Promise<Uint8Array | undefined> {
    await this.setup();
    return await this.getTileS2(6 as Face, zoom, x, y);
  }

  /**
   * Get the bytes of the tile at the given (face, zoom, x, y) coordinates
   * @param face - the Open S2 projection face
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the bytes of the tile at the given (face, zoom, x, y) coordinates, or undefined if
   * the tile does not exist in the archive.
   */
  async getTileS2(face: Face, zoom: number, x: number, y: number): Promise<undefined | Uint8Array> {
    await this.setup();
    const { compression } = this;

    // pull in the correct face's directory
    const dir = this.#rootDir[face];
    // now we walk to the next directory as necessary
    const node = await this.#walk(dir, zoom, x, y); // [offset, length]
    if (node === undefined) {
      return;
    }
    const [offset, length] = node;

    // we found the vector file, let's send the details off to the tile worker
    const data = await this.#reader.getRange(offset, length);
    return await decompress(data, compression);
  }

  /**
   * given position and level, find the tile offset and length
   * @param dir - the directory to walk
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the offset and length of the tile if it exists
   */
  async #walk(dir: DataView, zoom: number, x: number, y: number): Promise<undefined | Node> {
    const { maxzoom } = this;
    const path = getTilePath(zoom, x, y);
    let offset = 0;
    let length = 0;

    // walk the tree if past zoom 0
    while (path.length > 0) {
      // grab position
      const nodePos = (path.shift() ?? 0) * NODE_SIZE;
      // set
      offset = _readUInt48LE(dir, nodePos);
      length = dir.getUint32(nodePos + 6, true);
      if (length === 0) return;
      // if we are still walking, grab the new directory
      if (path.length > 0) {
        // corner case: if maxzoom matches the zoom and is divisible by 5, the leaf is actually a node
        if (maxzoom % 5 === 0 && zoom === maxzoom && path.length === 1 && path[0] === 0) {
          return [offset, length];
        }
        // otherwise fetch the directory
        const nextDir = await this.#getDir(offset, length);
        if (nextDir === undefined) return;
        dir = nextDir;
      }
    }

    if (length === 0) return;
    return [offset, length];
  }

  /**
   * get a directory given an offset and length
   * @param offset - the offset
   * @param length - the length
   * @returns - the directory
   */
  async #getDir(offset: number, length: number): Promise<undefined | DataView> {
    if (this.#dirCache.has(offset)) return this.#dirCache.get(offset);
    const data = await this.#reader.getRange(offset, length);
    const dir = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.#dirCache.set(offset, dir);
    return dir;
  }
}

/**
 * read a 48 bit number
 * @param buffer - the buffer
 * @param offset - the offset
 * @returns - the number
 */
function _readUInt48LE(buffer: DataView, offset = 0): number {
  return buffer.getUint32(offset + 2, true) * (1 << 16) + buffer.getUint16(offset, true);
}

/**
 * Get the path to a tile
 * @param zoom - the zoom
 * @param x - the x
 * @param y - the y
 * @returns - The path as a collection of offsets pointing to the tile Node in the directory
 */
export function getTilePath(zoom: number, x: number, y: number): number[] {
  const { max, pow } = Math;
  const path: Array<[number, number, number]> = [];
  while (zoom >= 5) {
    path.push([5, x & 31, y & 31]);
    x >>= 5;
    y >>= 5;
    zoom = max(zoom - 5, 0);
  }
  path.push([zoom, x, y]);
  return path.map(([zoom, x, y]) => {
    let val = 0;
    val += y * (1 << zoom) + x;
    while (zoom-- !== 0) val += pow(1 << zoom, 2);
    return val;
  });
}

/**
 * Decompress the data
 * @param data - the data to decompress
 * @param compression - the compression type
 * @returns - the decompressed data
 */
async function decompress(data: Uint8Array, compression: Compression): Promise<Uint8Array> {
  const format = compressionToFormat(compression);
  if (format === 'none') return data;
  return await decompressStream(data, format);
}

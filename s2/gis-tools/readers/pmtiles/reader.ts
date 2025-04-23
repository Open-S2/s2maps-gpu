import { Cache as DirCache } from '../../dataStructures/cache.js';
import { Compression, compressionToFormat, decompressStream } from '../../util/index.js';
import { FetchReader, toReader } from '../index.js';
import { S2_HEADER_SIZE_BYTES, S2_ROOT_SIZE, s2BytesToHeader } from './s2pmtiles.js';
import { bytesToHeader, deserializeDir, findTile, zxyToTileID } from './pmtiles.js';

import type { Entry, Header } from './pmtiles.js';
import type { Face, Metadata } from 's2-tilejson';
import type { Reader, ReaderInputs } from '../index.js';
import type { S2Entries, S2Header } from './s2pmtiles.js';

/** A description of where a tile can be found in the archive. Both offset and length are in bytes */
export interface S2PMTilesTileEntry {
  offset: number;
  length: number;
}

/**
 * # (S2) PMTiles Reader
 *
 * ## Description
 * A V3.0 PMTiles reader for reading standard WebMercator Tile data and V1.0 S2 Tile data.
 *
 * A Modified implementation of the PMTiles library. It is backwards compatible but
 * offers support for the S2 Projection.
 *
 * You can learn more about the [S2PMTiles Specification here](https://github.com/Open-S2/s2-pmtiles/blob/master/s2-pmtiles-spec/1.0.0/README.md).
 *
 * ## Usage
 * ```ts
 * import { S2PMTilesReader } from 'gis-tools-ts';
 * import { FileReader } from 'gis-tools-ts/file';
 * // or use the MMapReader if using Bun:
 * // import { MMapReader } from 'gis-tools-ts/mmap';
 *
 * const reader = new S2PMTilesReader(new FileReader('./data.pmtiles'));
 *
 * // pull out the header
 * const header = reader.getHeader();
 *
 * // get the metadata
 * const metadata = await reader.getMetadata();
 *
 * // S2 specific functions
 * const hasTile = await reader.hasTileS2(0, 0, 0, 0);
 * const tile = await reader.getTileS2(0, 0, 0, 0);
 *
 * // WM functions
 * const hasTile = await reader.hasTile(0, 0, 0);
 * const tile = await reader.getTile(0, 0, 0);
 * ```
 *
 * ## Links
 * - https://github.com/Open-S2/s2-pmtiles
 * - https://github.com/Open-S2/s2-pmtiles/blob/master/s2-pmtiles-spec/1.0.0/README.md
 * - https://github.com/protomaps/PMTiles
 * - https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 */
export class S2PMTilesReader {
  #header: Header | S2Header | undefined;
  #reader: Reader;
  // root directory will exist if header does
  #rootDir: Entry[] = [];
  #rootDirS2: S2Entries = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };
  #metadata!: Metadata;
  #dirCache: DirCache<number, Entry[]>;
  #decoder = new TextDecoder('utf-8');

  /**
   * Given an input path, read in the header and root directory
   * @param path - the location of the PMTiles data
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
   * Get the metadata for the archive
   * @returns - the header of the archive along with the root directory,
   * including information such as tile type, min/max zoom, bounds, and summary statistics.
   */
  async #getMetadata(): Promise<Header> {
    if (this.#header !== undefined) return this.#header;
    const data = await this.#reader.getRange(0, S2_ROOT_SIZE);
    const headerData = data.slice(0, S2_HEADER_SIZE_BYTES);
    // check if s2
    const isS2 = headerData[0] === 83 && headerData[1] === 50;
    // header
    const headerFunction = isS2 ? s2BytesToHeader : bytesToHeader;
    const header = (this.#header = headerFunction(headerData));

    // json metadata
    const jsonMetadata = data.slice(
      header.jsonMetadataOffset,
      header.jsonMetadataOffset + header.jsonMetadataLength,
    );
    this.#metadata = JSON.parse(
      this.#decoder.decode(await decompress(jsonMetadata, header.internalCompression)),
    );

    // root directory data
    const rootDirData = data.slice(
      header.rootDirectoryOffset,
      header.rootDirectoryOffset + header.rootDirectoryLength,
    );
    this.#rootDir = deserializeDir(await decompress(rootDirData, header.internalCompression));

    if (isS2) await this.#getS2Metadata(data, header as S2Header);

    return header;
  }

  /**
   * If S2 Projection, pull in the rest of the data
   * @param data - the root data
   * @param header - the S2 header with pointers to the rest of the data
   */
  async #getS2Metadata(data: Uint8Array, header: S2Header): Promise<void> {
    // move the root directory to the s2 root
    this.#rootDirS2[0] = this.#rootDir;
    // add the 4 other faces
    for (const face of [1, 2, 3, 4, 5]) {
      const rootOffset = `rootDirectoryOffset${face}` as keyof S2Header;
      const rootLenght = `rootDirectoryLength${face}` as keyof S2Header;
      const faceDirData = data.slice(
        header[rootOffset] as number,
        (header[rootOffset] as number) + (header[rootLenght] as number),
      );
      this.#rootDirS2[face as keyof S2Entries] = deserializeDir(
        await decompress(faceDirData, header.internalCompression),
      );
    }
  }

  /**
   * Get the header of the archive
   * @returns - the header of the archive
   */
  async getHeader(): Promise<Header> {
    return await this.#getMetadata();
  }

  /**
   * Get the metadata of the archive
   * @returns - the metadata of the archive
   */
  async getMetadata(): Promise<Metadata> {
    await this.#getMetadata(); // ensure loaded first
    return this.#metadata;
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
    return (await this.#getTileEntry(face, zoom, x, y)) !== undefined;
  }

  /**
   * Get the bytes of the tile at the given (face, zoom, x, y) coordinates
   * @param face - the Open S2 projection face
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the bytes of the tile at the given (face, zoom, x, y) coordinates, or undefined if the tile does not exist in the archive.
   */
  async getTileS2(face: Face, zoom: number, x: number, y: number): Promise<Uint8Array | undefined> {
    return await this.#getTile(face, zoom, x, y);
  }

  /**
   * Check if a tile exists in the archive
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - true if the tile exists in the archive
   */
  async hasTile(zoom: number, x: number, y: number): Promise<boolean> {
    return (await this.#getTileEntry(-1, zoom, x, y)) !== undefined;
  }

  /**
   * Get the bytes of the tile at the given (zoom, x, y) coordinates
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the bytes of the tile at the given (z, x, y) coordinates, or undefined if the tile does not exist in the archive.
   */
  async getTile(zoom: number, x: number, y: number): Promise<Uint8Array | undefined> {
    return await this.#getTile(-1, zoom, x, y);
  }

  /**
   * Get the bytes of the tile at the given (zoom, x, y) coordinates
   * @param face - the Open S2 projection face
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the bytes of the tile at the given (z, x, y) coordinates, or undefined if the tile does not exist in the archive.
   */
  async #getTile(
    face: number,
    zoom: number,
    x: number,
    y: number,
  ): Promise<Uint8Array | undefined> {
    const { tileCompression } = await this.#getMetadata();
    const entry = await this.#getTileEntry(face, zoom, x, y);
    if (entry === undefined) return undefined;
    const { offset, length } = entry;
    const entryData = await this.#reader.getRange(offset, length);
    return await decompress(entryData, tileCompression);
  }

  /**
   * Find the tile entry relative to the root directory
   * @param face - the Open S2 projection face
   * @param zoom - the zoom level of the tile
   * @param x - the x coordinate of the tile
   * @param y - the y coordinate of the tile
   * @returns - the position and length of bytes for the tile. Undefined if it does not exist
   */
  async #getTileEntry(
    face: number,
    zoom: number,
    x: number,
    y: number,
  ): Promise<S2PMTilesTileEntry | undefined> {
    const header = await this.#getMetadata();
    const tileID = zxyToTileID(zoom, x, y);
    const { minZoom, maxZoom, rootDirectoryOffset, rootDirectoryLength, tileDataOffset } = header;
    if (zoom < minZoom || zoom > maxZoom) return undefined;

    let dO = rootDirectoryOffset;
    let dL = rootDirectoryLength;

    for (let depth = 0; depth <= 3; depth++) {
      const directory = await this.#getDirectory(dO, dL, face);
      if (directory === undefined) return undefined;
      const entry = findTile(directory, tileID);
      if (entry !== null) {
        if (entry.runLength > 0) {
          return { offset: tileDataOffset + entry.offset, length: entry.length };
        }
        dO = header.leafDirectoryOffset + entry.offset;
        dL = entry.length;
      } else return undefined;
    }
    throw Error('Maximum directory depth exceeded');
  }

  /**
   * Get the directory at the given offset
   * @param offset - the offset of the directory
   * @param length - the length of the directory
   * @param face - -1 for WM root, 0-5 for S2
   * @returns - the entries in the directory if it exists
   */
  async #getDirectory(offset: number, length: number, face: number): Promise<Entry[] | undefined> {
    const dir = face === -1 ? this.#rootDir : this.#rootDirS2[face as Face];
    const header = await this.#getMetadata();
    const { internalCompression, rootDirectoryOffset } = header;
    // if rootDirectoryOffset, return roon
    if (offset === rootDirectoryOffset) return dir;
    // check cache
    const cache = this.#dirCache.get(offset);
    if (cache !== undefined) return cache;
    // get from archive
    const resp = await this.#reader.getRange(offset, length);
    const data = await decompress(resp, internalCompression);
    const directory = deserializeDir(data);
    if (directory.length === 0) throw new Error('Empty directory is invalid');
    // save in cache
    this.#dirCache.set(offset, directory);

    return directory;
  }
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

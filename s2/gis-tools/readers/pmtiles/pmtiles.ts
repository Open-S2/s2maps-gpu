import { readVarint } from './varint.js';

import type { Compression } from '../../index.js';
import type { Point } from '../../geometry/index.js';

/** A tile, in the format of ZXY. */
export type FlatTile = [zoom: number, x: number, y: number];

/** PMTiles v3 directory entry. */
export interface Entry {
  tileID: number;
  offset: number;
  length: number;
  runLength: number;
}

/**
 * Describe the type of tiles stored in the archive.
 * 0 is unknown/other, 1 is a vector tile spec.
 */
export const TileType = {
  /** unknown/other. */
  Unknown: 0,
  /** Vector tiles. */
  Pbf: 1,
  /** Image tiles. */
  Png: 2,
  /** Image tiles. */
  Jpeg: 3,
  /** Image tiles. */
  Webp: 4,
  /** Image tiles. */
  Avif: 5,
} as const;

/**
 * Enum representing a tile types stored in the archive.
 * 0 = unknown type
 * 1 = PBF
 * 2 = PNG
 * 3 = JPEG
 * 4 = WEBP
 * 5 = AVIF
 */
export type TileType = (typeof TileType)[keyof typeof TileType];

/**
 * PMTiles v3 header storing basic archive-level information.
 */
export interface Header {
  specVersion: number;
  rootDirectoryOffset: number;
  rootDirectoryLength: number;
  jsonMetadataOffset: number;
  jsonMetadataLength: number;
  leafDirectoryOffset: number;
  leafDirectoryLength?: number;
  tileDataOffset: number;
  tileDataLength?: number;
  numAddressedTiles: number;
  numTileEntries: number;
  numTileContents: number;
  clustered: boolean;
  internalCompression: Compression;
  tileCompression: Compression;
  tileType: TileType;
  minZoom: number;
  maxZoom: number;
  etag?: string;
}

export const HEADER_SIZE_BYTES = 127;

export const ROOT_SIZE = 16_384;

/**
 * Rotate a point by n degrees.
 * @param n - the rotation size
 * @param xy - the point
 * @param rx - the x rotation
 * @param ry - the y rotation
 */
function rotate(n: number, xy: Point, rx: number, ry: number): void {
  if (ry === 0) {
    if (rx === 1) {
      xy[0] = n - 1 - xy[0];
      xy[1] = n - 1 - xy[1];
    }
    const t = xy[0];
    xy[0] = xy[1];
    xy[1] = t;
  }
}

/**
 * Get the tile ID on the given level.
 * @param zoom - the zoom level
 * @param pos - the tile position
 * @returns - the tile
 */
function idOnLevel(zoom: number, pos: number): FlatTile {
  const n = 2 ** zoom;
  let rx = pos;
  let ry = pos;
  let t = pos;
  const xy: Point = [0, 0];
  let s = 1;
  while (s < n) {
    rx = 1 & (t / 2);
    ry = 1 & (t ^ rx);
    rotate(s, xy, rx, ry);
    xy[0] += s * rx;
    xy[1] += s * ry;
    t = t / 4;
    s *= 2;
  }
  return [zoom, xy[0], xy[1]];
}

const tzValues: number[] = [
  0, 1, 5, 21, 85, 341, 1365, 5461, 21845, 87381, 349525, 1398101, 5592405, 22369621, 89478485,
  357913941, 1431655765, 5726623061, 22906492245, 91625968981, 366503875925, 1466015503701,
  5864062014805, 23456248059221, 93824992236885, 375299968947541, 1501199875790165,
];

/**
 * Convert Z,X,Y to a Hilbert TileID.
 * @param zoom - the zoom level
 * @param x - the x coordinate
 * @param y - the y coordinate
 * @returns - the Hilbert encoded TileID
 */
export function zxyToTileID(zoom: number, x: number, y: number): number {
  if (zoom > 26) {
    throw Error('Tile zoom level exceeds max safe number limit (26)');
  }
  if (x > 2 ** zoom - 1 || y > 2 ** zoom - 1) {
    throw Error('tile x/y outside zoom level bounds');
  }

  const acc = tzValues[zoom];
  const n = 2 ** zoom;
  let rx = 0;
  let ry = 0;
  let d = 0;
  const xy: [x: number, y: number] = [x, y];
  let s = n / 2;
  while (true) {
    rx = (xy[0] & s) > 0 ? 1 : 0;
    ry = (xy[1] & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    rotate(s, xy, rx, ry);
    if (s <= 1) break;
    s = s / 2;
  }
  return acc + d;
}

/**
 * Convert a Hilbert TileID to Z,X,Y.
 * @param i - the encoded tile ID
 * @returns - the decoded Z,X,Y
 */
export function tileIDToZxy(i: number): FlatTile {
  let acc = 0;

  for (let z = 0; z < 27; z++) {
    const numTiles = (0x1 << z) * (0x1 << z);
    if (acc + numTiles > i) {
      return idOnLevel(z, i - acc);
    }
    acc += numTiles;
  }

  throw Error('Tile zoom level exceeds max safe number limit (26)');
}

/**
 * Low-level function for looking up a TileID or leaf directory inside a directory.
 * @param entries - the directory entries
 * @param tileID - the tile ID
 * @returns the entry associated with the tile, or null if not found
 */
export function findTile(entries: Entry[], tileID: number): Entry | null {
  let m = 0;
  let n = entries.length - 1;
  while (m <= n) {
    const k = (n + m) >> 1;
    const cmp = tileID - entries[k].tileID;
    if (cmp > 0) {
      m = k + 1;
    } else if (cmp < 0) {
      n = k - 1;
    } else {
      return entries[k];
    }
  }

  // at this point, m > n
  if (n >= 0) {
    if (entries[n].runLength === 0) return entries[n];
    if (tileID - entries[n].tileID < entries[n].runLength) return entries[n];
  }
  return null;
}

/**
 * Parse raw header bytes into a Header object.
 * @param bytes - the raw header bytes
 * @returns the parsed header
 */
export function bytesToHeader(bytes: Uint8Array): Header {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // if (dv.getUint16(0, true) !== 0x4d50) {
  //   throw new Error('Wrong magic number for PMTiles archive');
  // }

  return {
    specVersion: dv.getUint8(7),
    rootDirectoryOffset: getUint64(dv, 8),
    rootDirectoryLength: getUint64(dv, 16),
    jsonMetadataOffset: getUint64(dv, 24),
    jsonMetadataLength: getUint64(dv, 32),
    leafDirectoryOffset: getUint64(dv, 40),
    leafDirectoryLength: getUint64(dv, 48),
    tileDataOffset: getUint64(dv, 56),
    tileDataLength: getUint64(dv, 64),
    numAddressedTiles: getUint64(dv, 72),
    numTileEntries: getUint64(dv, 80),
    numTileContents: getUint64(dv, 88),
    clustered: dv.getUint8(96) === 1,
    internalCompression: dv.getUint8(97) as Compression,
    tileCompression: dv.getUint8(98) as Compression,
    tileType: dv.getUint8(99) as TileType,
    minZoom: dv.getUint8(100),
    maxZoom: dv.getUint8(101),
  };
}

/**
 * Deserialize a directory from a Uint8Array.
 * @param buffer - the buffer to deserialize
 * @returns - the deserialized entries
 */
export function deserializeDir(buffer: Uint8Array): Entry[] {
  const p = { buf: new Uint8Array(buffer), pos: 0 };
  const numEntries = readVarint(p);

  const entries: Entry[] = [];

  let lastID = 0;
  for (let i = 0; i < numEntries; i++) {
    const v = readVarint(p);
    entries.push({ tileID: lastID + v, offset: 0, length: 0, runLength: 1 });
    lastID += v;
  }

  // run lengths, lengths, and offsets
  for (let i = 0; i < numEntries; i++) entries[i].runLength = readVarint(p);
  for (let i = 0; i < numEntries; i++) entries[i].length = readVarint(p);
  for (let i = 0; i < numEntries; i++) {
    const v = readVarint(p);
    if (v === 0 && i > 0) {
      entries[i].offset = entries[i - 1].offset + entries[i - 1].length;
    } else {
      entries[i].offset = v - 1;
    }
  }

  return entries;
}

/**
 * Get a 64-bit number from a DataView
 * @param dv - a DataView
 * @param offset - the offset in the DataView
 * @returns - the decoded 64-bit number
 */
export function getUint64(dv: DataView, offset: number): number {
  const wh = dv.getUint32(offset + 4, true);
  const wl = dv.getUint32(offset, true);
  return wh * 2 ** 32 + wl;
}

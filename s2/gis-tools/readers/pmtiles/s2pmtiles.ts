import { bytesToHeader, getUint64 } from './pmtiles.js';

import type { Entry, Header } from './pmtiles.js';

/** Store entries for each Face */
export interface S2Entries {
  0: Entry[];
  1: Entry[];
  2: Entry[];
  3: Entry[];
  4: Entry[];
  5: Entry[];
}

/** S2PMTiles v3 header storing basic archive-level information. */
export interface S2Header extends Header {
  rootDirectoryOffset1: number;
  rootDirectoryLength1: number;
  rootDirectoryOffset2: number;
  rootDirectoryLength2: number;
  rootDirectoryOffset3: number;
  rootDirectoryLength3: number;
  rootDirectoryOffset4: number;
  rootDirectoryLength4: number;
  rootDirectoryOffset5: number;
  rootDirectoryLength5: number;
  leafDirectoryOffset1: number;
  leafDirectoryLength1: number;
  leafDirectoryOffset2: number;
  leafDirectoryLength2: number;
  leafDirectoryOffset3: number;
  leafDirectoryLength3: number;
  leafDirectoryOffset4: number;
  leafDirectoryLength4: number;
  leafDirectoryOffset5: number;
  leafDirectoryLength5: number;
}

export const S2_HEADER_SIZE_BYTES = 262;

export const S2_ROOT_SIZE = 98_304;

/**
 * Parse raw header bytes into a Header object.
 * @param bytes - the raw header bytes
 * @returns the parsed header
 */
export function s2BytesToHeader(bytes: Uint8Array): S2Header {
  const baseHeader = bytesToHeader(bytes);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    ...baseHeader,
    rootDirectoryOffset1: getUint64(dv, 102),
    rootDirectoryLength1: getUint64(dv, 110),
    rootDirectoryOffset2: getUint64(dv, 118),
    rootDirectoryLength2: getUint64(dv, 126),
    rootDirectoryOffset3: getUint64(dv, 134),
    rootDirectoryLength3: getUint64(dv, 142),
    rootDirectoryOffset4: getUint64(dv, 150),
    rootDirectoryLength4: getUint64(dv, 158),
    rootDirectoryOffset5: getUint64(dv, 166),
    rootDirectoryLength5: getUint64(dv, 174),
    leafDirectoryOffset1: getUint64(dv, 182),
    leafDirectoryLength1: getUint64(dv, 190),
    leafDirectoryOffset2: getUint64(dv, 198),
    leafDirectoryLength2: getUint64(dv, 206),
    leafDirectoryOffset3: getUint64(dv, 214),
    leafDirectoryLength3: getUint64(dv, 222),
    leafDirectoryOffset4: getUint64(dv, 230),
    leafDirectoryLength4: getUint64(dv, 238),
    leafDirectoryOffset5: getUint64(dv, 246),
    leafDirectoryLength5: getUint64(dv, 254),
  };
}

import { decompressSync } from './fflate.js';

import type { Format } from '../index.js';

declare global {
  /** Expose a decompressionPolyfill */
  // eslint-disable-next-line no-var
  var decompressionPolyfill: undefined | ((data: Uint8Array, format?: Format) => Uint8Array);
}

/**
 * Polyfill for DecompressionStream
 * Supports 'gzip', 'inflate', and 'inflate-raw' formats
 * @param data - compressed data
 * @param format - compression format
 * @returns - decompressed data
 */
globalThis.decompressionPolyfill = (data: Uint8Array, format?: Format): Uint8Array => {
  if (format === 'gzip' || format === 'deflate' || format === 'deflate-raw') {
    return decompressSync(data);
  }
  throw new Error(`format ${format} not supported`);
};

export {};

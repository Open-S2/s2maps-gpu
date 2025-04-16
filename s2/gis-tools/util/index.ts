import type { Encoding } from 's2-tilejson';

export * from './compression.js';

/** The formats available to DecompressionStream */
export type Format = 'deflate' | 'deflate-raw' | 'gzip' | 'br' | 'zstd';

/**
 * Enum representing a compression algorithm used.
 * 0 = unknown compression, for if you must use a different or unspecified algorithm.
 * 1 = no compression.
 * 2 = gzip
 * 3 = brotli
 * 4 = zstd
 */
export const Compression = {
  /** Unknown compression, for if you must use a different or unspecified algorithm. */
  Unknown: 0,
  /** No compression. */
  None: 1,
  /** Gzip compression. */
  Gzip: 2,
  /** Brotli compression. */
  Brotli: 3,
  /** Zstd compression. */
  Zstd: 4,
} as const;

/**
 * Enum representing a compression algorithm used.
 * 0 = unknown compression, for if you must use a different or unspecified algorithm.
 * 1 = no compression.
 * 2 = gzip
 * 3 = brotli
 * 4 = zstd
 */
export type Compression = (typeof Compression)[keyof typeof Compression];

/**
 * Converts a string encoding to a compression algorithm enum
 * @param encoding - the encoding as a string
 * @returns the compression algorithm as an Enum
 */
export function encodingToCompression(encoding: Encoding): Compression {
  switch (encoding) {
    case 'gz':
      return Compression.Gzip;
    case 'br':
      return Compression.Brotli;
    case 'zstd':
      return Compression.Zstd;
    default:
      return Compression.None;
  }
}

/**
 * Converts a compression algorithm enum to a string encoding
 * @param compression - the compression algorithm as an Enum
 * @returns the encoding as a string
 */
export function compressionToFormat(compression: Compression): Format | 'none' {
  switch (compression) {
    case Compression.Gzip:
      return 'gzip';
    case Compression.Brotli:
      return 'br';
    case Compression.Zstd:
      return 'zstd';
    default:
      return 'none';
  }
}

/**
 * Provide a decompression implementation that acts on `buf` and returns decompressed data.
 *
 * Should use the native DecompressionStream on browsers, zlib on node.
 * Should throw if the compression algorithm is not supported.
 */
export type DecompressFunc = (buf: Uint8Array, compression: Compression) => Promise<Uint8Array>;

/**
 * pollyfill for string to array buffer
 * @param base64 - base64 encoded string
 * @returns converted ArrayBuffer of the string data
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  return bytes.buffer;
}

/**
 * @param uint8arrays - the Uint8Arrays to concatenate
 * @returns - the concatenated Uint8Array
 */
export async function concatUint8Arrays(uint8arrays: Uint8Array[]): Promise<Uint8Array> {
  const blob = new Blob(uint8arrays);
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

import { concatUint8Arrays } from './index.js';

import type { Format } from './index.js';

/**
 * A Browser compatible Gzip compression function
 * @param bytes - the data to decompress
 * @param format - the format of the data. Defaults to 'gzip'
 * @returns - the decompressed data
 */
export async function compressStream(bytes: Uint8Array, format?: Format): Promise<Uint8Array> {
  // Convert the string to a byte stream.
  const stream = new Blob([bytes]).stream();
  // Create a compressed stream.
  const compressedStream = stream.pipeThrough(new CompressionStream((format ?? 'gzip') as 'gzip'));
  // Read all the bytes from this stream.
  const chunks: Uint8Array[] = [];
  // @ts-expect-error - this works
  for await (const chunk of compressedStream) chunks.push(chunk);

  return await concatUint8Arrays(chunks);
}

/**
 * A Browser compatible Gzip decompression function
 * @param bytes - the data to decompress
 * @param format - the format of the data. Defaults to 'gzip'
 * @returns - the decompressed data
 */
export async function decompressStream(bytes: Uint8Array, format?: Format): Promise<Uint8Array> {
  // first test if polyfill was already added
  if (globalThis.decompressionPolyfill !== undefined) {
    return globalThis.decompressionPolyfill(bytes, format);
  }

  if (format === undefined) format = bytes[0] === 0x1f && bytes[1] === 0x8b ? 'gzip' : 'deflate';
  // Convert the bytes to a stream.
  const stream = new Blob([bytes]).stream();

  // Create a decompressed stream.
  const decompressedStream = stream.pipeThrough(new DecompressionStream(format as 'gzip'));
  // Read all the bytes from this stream.
  const chunks: Uint8Array[] = [];
  // @ts-expect-error - this works
  for await (const chunk of decompressedStream) chunks.push(chunk);

  return await concatUint8Arrays(chunks);
}

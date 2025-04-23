import type { MValue, Properties, VectorFeatures, VectorGeometry } from '../geometry/index.js';

export * from './pmtiles/index.js';
export * from './fetch.js';

/** Reader interface. Implemented to read data from either a buffer or a filesystem */
export interface Reader {
  // Properties
  byteLength: number;
  byteOffset: number;
  // Getters
  getBigInt64: (byteOffset?: number, littleEndian?: boolean) => bigint;
  getBigUint64: (byteOffset?: number, littleEndian?: boolean) => bigint;
  getFloat32: (byteOffset?: number, littleEndian?: boolean) => number;
  getFloat64: (byteOffset?: number, littleEndian?: boolean) => number;
  getInt16: (byteOffset?: number, littleEndian?: boolean) => number;
  getInt32: (byteOffset?: number, littleEndian?: boolean) => number;
  getInt8: (byteOffset?: number) => number;
  getUint16: (byteOffset?: number, littleEndian?: boolean) => number;
  getUint32: (byteOffset?: number, littleEndian?: boolean) => number;
  getUint8: (byteOffset?: number) => number;
  // Methods
  tell(): number;
  seek(pos?: number): void;
  slice: (begin?: number, end?: number) => DataView;
  seekSlice: (size: number) => DataView;
  setStringEncoding: (encoding: string) => void;
  parseString: (byteOffset?: number, byteLength?: number) => string;
  getRange: (offset: number, length: number) => Promise<Uint8Array>;
}

/** Feature iteration interface. Implemented by readers to iterate over features */
export interface FeatureIterator<
  M = Record<string, unknown>,
  D extends MValue = MValue,
  P extends Properties = Properties,
  G extends VectorGeometry<D> = VectorGeometry<D>,
> {
  [Symbol.asyncIterator]: () => AsyncGenerator<VectorFeatures<M, D, P, G>>;
}

/** All input types that can be placed into a reader */
export type ReaderInputs =
  | Reader
  | BufferReader
  | ArrayBufferLike
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array
  | DataView;

/**
 * Convenience function that ensures the input is a usable reader
 * @param input - the input data
 * @returns - a BufferReader
 */
export function toReader(input: ReaderInputs): Reader {
  if (input instanceof BufferReader) return input;
  else if ('buffer' in input) return new BufferReader(input.buffer);
  else if (input instanceof ArrayBuffer || input instanceof SharedArrayBuffer)
    return new BufferReader(input);
  else return input;
}

/** A buffer reader is an extension of a DataView with some extra methods */
export class BufferReader extends DataView<ArrayBufferLike> implements Reader {
  private cursor = 0;
  textDecoder = new TextDecoder('utf-8');

  /**
   * @param buffer - the input buffer
   * @param byteOffset - offset in the buffer
   * @param byteLength - length of the buffer
   */
  constructor(buffer: ArrayBufferLike, byteOffset?: number, byteLength?: number) {
    super(buffer, byteOffset, byteLength);
  }

  /**
   * @returns - the current position of the cursor
   */
  tell(): number {
    return this.cursor;
  }

  /**
   * Set the current position of the cursor
   * @param pos - where to adjust the current cursor
   */
  seek(pos = 0): void {
    this.cursor = pos;
  }

  /**
   * Reads a 64-bit unsigned integer (biguint64) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 64-bit unsigned integer as a bigint
   */
  getBigInt64(byteOffset = this.cursor, littleEndian: boolean = false): bigint {
    this.cursor = byteOffset + 8;
    return super.getBigInt64(byteOffset, littleEndian);
  }

  /**
   * Reads a 64-bit unsigned integer (biguint64) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 64-bit unsigned integer as a bigint
   */
  getBigUint64(byteOffset = this.cursor, littleEndian: boolean = false): bigint {
    this.cursor = byteOffset + 8;
    return super.getBigUint64(byteOffset, littleEndian);
  }

  /**
   * Reads a 32-bit floating-point number (float32) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 32-bit floating-point number as a number
   */
  getFloat32(byteOffset = this.cursor, littleEndian: boolean = false): number {
    this.cursor = byteOffset + 4;
    return super.getFloat32(byteOffset, littleEndian);
  }

  /**
   * Reads a 64-bit floating-point number (float64) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 64-bit floating-point number as a number
   */
  getFloat64(byteOffset = this.cursor, littleEndian: boolean = false): number {
    this.cursor = byteOffset + 8;
    return super.getFloat64(byteOffset, littleEndian);
  }

  /**
   * Reads a signed 16-bit integer (int16) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 16-bit signed integer value as a number
   */
  getInt16(byteOffset = this.cursor, littleEndian: boolean = false): number {
    this.cursor = byteOffset + 2;
    return super.getInt16(byteOffset, littleEndian);
  }

  /**
   * Reads a signed 32-bit integer (int32) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 32-bit signed integer value as a number
   */
  getInt32(byteOffset = this.cursor, littleEndian: boolean = false): number {
    this.cursor = byteOffset + 4;
    return super.getInt32(byteOffset, littleEndian);
  }

  /**
   * Reads a signed byte (int8) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @returns The byte value as a signed number
   */
  getInt8(byteOffset = this.cursor): number {
    this.cursor = byteOffset + 1;
    return super.getInt8(byteOffset);
  }

  /**
   * Reads an unsigned 16-bit integer (uint16) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 16-bit unsigned integer value as a number
   */
  getUint16(byteOffset = this.cursor, littleEndian: boolean = false): number {
    this.cursor = byteOffset + 2;
    return super.getUint16(byteOffset, littleEndian);
  }

  /**
   * Reads an unsigned 32-bit integer (uint32) at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @param littleEndian - Optional, specifies if the value is stored in little-endian format. Defaults to false (big-endian).
   * @returns The 32-bit unsigned integer value as a number
   */
  getUint32(byteOffset = this.cursor, littleEndian: boolean = false): number {
    this.cursor = byteOffset + 4;
    return super.getUint32(byteOffset, littleEndian);
  }

  /**
   * Reads a single byte at the given byteOffset
   * @param byteOffset - The position in the file to read from
   * @returns The byte value as a number
   */
  getUint8(byteOffset = this.cursor): number {
    this.cursor = byteOffset + 1;
    return super.getUint8(byteOffset);
  }

  /**
   * Get a slice of the buffer
   * @param begin - beginning of the slice
   * @param end - end of the slice. If not provided, the end of the data is used
   * @returns - a DataView of the slice
   */
  slice(begin: number = this.cursor, end: number = this.byteLength): DataView {
    this.cursor = end;
    return new DataView(this.buffer.slice(this.byteOffset + begin, this.byteOffset + end));
  }

  /**
   * Fetch a slice at the current cursor position. The cursor is updated
   * @param size - size of the slice
   * @returns - a DataView of the slice
   */
  seekSlice(size: number): DataView {
    const pos = this.byteOffset + this.cursor;
    return this.slice(pos, pos + size);
  }

  /**
   * Set the text decoder's encoding
   * @param encoding - update the text decoder's encoding
   */
  setStringEncoding(encoding: string) {
    this.textDecoder = new TextDecoder(encoding);
  }

  /**
   * Reads a string from the buffer
   * @param byteOffset - Start of the string
   * @param byteLength - Length of the string
   * @returns - The string
   */
  parseString(byteOffset: number = this.cursor, byteLength: number = this.byteLength): string {
    const { textDecoder } = this;
    const data = this.slice(byteOffset, byteOffset + byteLength).buffer;
    this.cursor = byteOffset + byteLength;
    const out = textDecoder.decode(data as ArrayBuffer, { stream: true }) + textDecoder.decode();
    return out.replace(/\0/g, '');
  }

  /**
   * Reads a range from the buffer
   * @param offset - the offset of the range
   * @param length - the length of the range
   * @returns - the ranged buffer
   */
  async getRange(offset: number, length: number): Promise<Uint8Array> {
    return await new Uint8Array(this.buffer).slice(offset, offset + length);
  }
}

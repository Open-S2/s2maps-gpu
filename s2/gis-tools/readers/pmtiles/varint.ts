/** A buffer with the position to read from */
export interface VarintBufPos {
  buf: Uint8Array;
  pos: number;
}

/**
 * Decode a 64 bit number
 * @param low - the low 32 bits of the number
 * @param high - the high 32 bits of the number
 * @returns - the decoded number
 */
function toNum(low: number, high: number): number {
  return (high >>> 0) * 0x100000000 + (low >>> 0);
}

/**
 * Read a varint
 * @param bufPos - the buffer with it's position
 * @returns - the decoded number
 */
export function readVarint(bufPos: VarintBufPos): number {
  const buf = bufPos.buf;
  let b = buf[bufPos.pos++];
  let val = b & 0x7f;
  if (b < 0x80) return val;
  b = buf[bufPos.pos++];
  val |= (b & 0x7f) << 7;
  if (b < 0x80) return val;
  b = buf[bufPos.pos++];
  val |= (b & 0x7f) << 14;
  if (b < 0x80) return val;
  b = buf[bufPos.pos++];
  val |= (b & 0x7f) << 21;
  if (b < 0x80) return val;
  b = buf[bufPos.pos];
  val |= (b & 0x0f) << 28;

  return readVarintRemainder(val, bufPos);
}

/**
 * Read the remainder of a varint
 * @param low - the low 32 bits of the number
 * @param bufPos - the buffer with it's position
 * @returns - the decoded remainder
 */
export function readVarintRemainder(low: number, bufPos: VarintBufPos): number {
  const buf = bufPos.buf;
  let b = buf[bufPos.pos++];
  let h = (b & 0x70) >> 4;
  if (b < 0x80) return toNum(low, h);
  b = buf[bufPos.pos++];
  h |= (b & 0x7f) << 3;
  if (b < 0x80) return toNum(low, h);
  b = buf[bufPos.pos++];
  h |= (b & 0x7f) << 10;
  if (b < 0x80) return toNum(low, h);
  b = buf[bufPos.pos++];
  h |= (b & 0x7f) << 17;
  if (b < 0x80) return toNum(low, h);
  b = buf[bufPos.pos++];
  h |= (b & 0x7f) << 24;
  if (b < 0x80) return toNum(low, h);
  b = buf[bufPos.pos++];
  h |= (b & 0x01) << 31;
  if (b < 0x80) return toNum(low, h);
  throw new Error('Expected varint not more than 10 bytes');
}

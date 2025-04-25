import { readVarint } from '../../../../../s2/gis-tools/readers/pmtiles';
import { describe, expect, test } from 'vitest';

describe('varint', () => {
  const resBuffer = {
    buf: new Uint8Array([
      0, 1, 127, 128, 1, 255, 127, 128, 128, 1, 168, 242, 138, 171, 153, 240, 190, 1, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 1, 136, 148, 221, 227, 248, 255, 255, 255, 255, 1, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]),
    pos: 0,
  };

  test('readVarint', () => {
    expect(readVarint(resBuffer)).toEqual(0);
    expect(readVarint(resBuffer)).toEqual(1);
    expect(readVarint(resBuffer)).toEqual(127);
    expect(readVarint(resBuffer)).toEqual(128);
    expect(readVarint(resBuffer)).toEqual(16383);
    expect(readVarint(resBuffer)).toEqual(16384);
    expect(readVarint(resBuffer)).toEqual(839483929049384);
    // the next two numbers are not supported
    readVarint(resBuffer);
    readVarint(resBuffer);
  });
});

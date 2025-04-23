import { FetchReader } from '../../../../s2/gis-tools';
import { expect, test } from 'bun:test';

test('FetchReader - ensure 0s', () => {
  const reader = new FetchReader('https://example.com/test.pmtiles', true);
  reader.setStringEncoding('utf-8');
  expect(reader.getBigInt64(0, true)).toBe(0n);
  expect(reader.getBigUint64(0, true)).toBe(0n);
  expect(reader.getFloat32(0, true)).toBe(0);
  expect(reader.getFloat64(0, true)).toBe(0);
  expect(reader.getInt16(0, true)).toBe(0);
  expect(reader.getInt32(0, true)).toBe(0);
  expect(reader.getInt8(0)).toBe(0);
  expect(reader.getUint16(0, true)).toBe(0);
  expect(reader.getUint32(0, true)).toBe(0);
  expect(reader.getUint8(0)).toBe(0);
  expect(reader.slice(0, 10)).toEqual(new DataView(new Uint8Array([]).buffer));
  expect(reader.parseString(0, 10)).toEqual('');
});

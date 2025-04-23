import { decompressStream } from '../../../../../s2/gis-tools';
import { decompressSync } from '../../../../../s2/gis-tools/util/polyfills/fflate';
import { expect, test } from 'bun:test';

import zlib from 'zlib';

test('deflateSync - dictionary', async () => {
  const dictionary = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/spdyDict.txt`).arrayBuffer(),
  );
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = zlib.deflateSync(expected, { dictionary });

  const res: Uint8Array = decompressSync(data, dictionary);

  expect(expected).toEqual(res);
});

test('deflateSync - level: 9', async () => {
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = new Uint8Array(zlib.deflateSync(expected, { level: 9 }).buffer);

  const res: Uint8Array = decompressSync(data);

  expect(expected).toEqual(res);
});

test('deflateSync - memLevel: 9', async () => {
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = zlib.deflateSync(expected, { memLevel: 9 });

  const res: Uint8Array = decompressSync(data);

  expect(expected).toEqual(res);
});

test('deflateSync - strategy: 0', async () => {
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = zlib.deflateSync(expected, { strategy: 0 });

  const res: Uint8Array = decompressSync(data);

  expect(expected).toEqual(res);
});

test('deflateRawSync - windowBits: 15', async () => {
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = zlib.deflateRawSync(expected, { windowBits: 15 });

  const res: Uint8Array = decompressSync(data);

  expect(expected).toEqual(res);
});

test('deflateRawSync - level: 0', async () => {
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = zlib.deflateRawSync(expected, { level: 0 });

  const res: Uint8Array = decompressSync(data);

  expect(expected).toEqual(res);
});

test('deflateRawSync - Error', async () => {
  const expected: Uint8Array = new Uint8Array(
    await Bun.file(`${__dirname}/../fixtures/lorem_en_100k.txt`).arrayBuffer(),
  );
  const data = zlib.deflateRawSync(expected, { windowBits: 15 });

  expect(() => decompressSync(data.slice(20))).toThrowError('invalid block type');
});

test('dictionary', () => {
  const dict = new Uint8Array(Buffer.from('abcd').buffer); // [97, 98, 99, 100]

  const deflateResult = new Uint8Array([
    120, 187, 3, 216, 1, 139, 203, 72, 205, 201, 201, 7, 19, 10, 229, 249, 69, 57, 41, 0, 55, 19, 6,
    113,
  ]);

  const uncompressedInternal: Uint8Array = decompressSync(deflateResult, dict);
  const expected: Uint8Array = new Uint8Array(Buffer.from('hellohello world'));

  expect(expected).toEqual(uncompressedInternal);
});

test('gzip - decompressStream (polyfill)', async () => {
  const expected = await Bun.file(`${__dirname}/../fixtures/expected.txt`).text();
  const data = await Bun.file(`${__dirname}/../fixtures/expected.txt.gz`).arrayBuffer();

  const result = await decompressStream(new Uint8Array(data), 'gzip');
  const actual = new TextDecoder().decode(result);
  expect(actual).toEqual(expected);
});

test('deflate - decompressStream (polyfill)', async () => {
  const expected = await Bun.file(`${__dirname}/../fixtures/expected.txt`).text();
  const data = await Bun.file(`${__dirname}/../fixtures/expected.txt.deflate`).arrayBuffer();

  const result = await decompressStream(new Uint8Array(data), 'deflate');
  const actual = new TextDecoder().decode(result);
  expect(actual).toEqual(expected);
});

test('deflate - raw - decompressStream (polyfill)', async () => {
  const expected = await Bun.file(`${__dirname}/../fixtures/expected.txt`).text();
  const data = await Bun.file(`${__dirname}/../fixtures/expected.txt.deflate-raw`).arrayBuffer();

  const result = await decompressStream(new Uint8Array(data), 'deflate-raw');
  const actual = new TextDecoder().decode(result);
  expect(actual).toEqual(expected);
});

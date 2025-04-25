import { expect, test } from 'vitest';

test('parseFeature', (): void => {
  expect(true).toBe(true);
});

// import { decompressStream } from '../../../../s2/gis-tools/util/compression';
// import { expect, test } from 'vitest';

// test('gzip - decompressStream', async () => {
//   const expected = await Bun.file(`${__dirname}/fixtures/expected.txt`).text();
//   const data = await Bun.file(`${__dirname}/fixtures/expected.txt.gz`).arrayBuffer();

//   const result = await decompressStream(new Uint8Array(data), 'gzip');
//   const actual = new TextDecoder().decode(result);
//   expect(actual).toEqual(expected);
// });

// test('deflate - decompressStream', async () => {
//   const expected = await Bun.file(`${__dirname}/fixtures/expected.txt`).text();
//   const data = await Bun.file(`${__dirname}/fixtures/expected.txt.deflate`).arrayBuffer();

//   const result = await decompressStream(new Uint8Array(data), 'deflate');
//   const actual = new TextDecoder().decode(result);
//   expect(actual).toEqual(expected);
// });

// test('deflate - raw - decompressStream', async () => {
//   const expected = await Bun.file(`${__dirname}/fixtures/expected.txt`).text();
//   const data = await Bun.file(`${__dirname}/fixtures/expected.txt.deflate-raw`).arrayBuffer();

//   const result = await decompressStream(new Uint8Array(data), 'deflate-raw');
//   const actual = new TextDecoder().decode(result);
//   expect(actual).toEqual(expected);
// });

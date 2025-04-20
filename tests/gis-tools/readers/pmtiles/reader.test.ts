import { Compression } from '../../../../s2/gis-tools';
import { BufferReader, S2PMTilesReader } from '../../../../s2/gis-tools/readers';
import { expect, test } from 'bun:test';

import type { Metadata } from 's2-tilejson';
import type { S2Header } from '../../../../s2/gis-tools';

/** External old metadata spec */
interface MetaExternal {
  name: string;
  description: string;
  version: string;
  type: string;
  generator: string;
  generator_options: string;
  vector_layers: Array<{
    id: string;
    description?: string;
    minzoom: number;
    maxzoom: number;
    fields: Record<string, string>;
  }>;
  tilestats: {
    layerCount: number;
    layers: Array<{
      layer: string;
      count: number;
      geometry: string;
      attributeCount: number;
      attributes: Array<string>;
    }>;
  };
}

test('pmtiles - test_fixture_1', async () => {
  const bufferReader = new BufferReader(
    await Bun.file(`${__dirname}/fixtures/test_fixture_1.pmtiles`).arrayBuffer(),
  );
  const testFixture1 = new S2PMTilesReader(bufferReader);
  expect(testFixture1).toBeInstanceOf(S2PMTilesReader);
  const header = await testFixture1.getHeader();
  // header
  expect(header).toEqual({
    clustered: false,
    internalCompression: Compression.Gzip,
    jsonMetadataLength: 247,
    jsonMetadataOffset: 152,
    leafDirectoryLength: 0,
    leafDirectoryOffset: 0,
    maxZoom: 0,
    minZoom: 0,
    numAddressedTiles: 1,
    numTileContents: 1,
    numTileEntries: 1,
    rootDirectoryLength: 25,
    rootDirectoryOffset: 127,
    specVersion: 3,
    tileCompression: Compression.Gzip,
    tileDataLength: 69,
    tileDataOffset: 399,
    tileType: 1,
  });
  // metadata
  expect((await testFixture1.getMetadata()) as unknown as MetaExternal).toEqual({
    name: 'test_fixture_1.pmtiles',
    description: 'test_fixture_1.pmtiles',
    version: '2',
    type: 'overlay',
    generator: 'tippecanoe v2.5.0',
    generator_options: './tippecanoe -zg -o test_fixture_1.pmtiles --force',
    vector_layers: [
      {
        id: 'test_fixture_1pmtiles',
        description: '',
        minzoom: 0,
        maxzoom: 0,
        fields: {},
      },
    ],
    tilestats: {
      layerCount: 1,
      layers: [
        {
          layer: 'test_fixture_1pmtiles',
          count: 1,
          geometry: 'Polygon',
          attributeCount: 0,
          attributes: [],
        },
      ],
    },
  });
  // TILE
  const tile = await testFixture1.getTile(0, 0, 0);
  expect(tile).toBeInstanceOf(Uint8Array);
  expect(new Uint8Array(tile as Uint8Array)).toEqual(
    new Uint8Array([
      26, 47, 120, 2, 10, 21, 116, 101, 115, 116, 95, 102, 105, 120, 116, 117, 114, 101, 95, 49,
      112, 109, 116, 105, 108, 101, 115, 40, 128, 32, 18, 17, 24, 3, 34, 13, 9, 150, 32, 232, 31,
      26, 0, 24, 21, 0, 0, 23, 15,
    ]),
  );
});

test('pmtiles - test_fixture_2', async () => {
  const testFixture2 = new S2PMTilesReader(
    await Bun.file(`${__dirname}/fixtures/test_fixture_2.pmtiles`).arrayBuffer(),
  );
  expect(testFixture2).toBeInstanceOf(S2PMTilesReader);
  const header = await testFixture2.getHeader();
  // header
  expect(header).toEqual({
    clustered: false,
    internalCompression: Compression.Gzip,
    jsonMetadataLength: 247,
    jsonMetadataOffset: 152,
    leafDirectoryLength: 0,
    leafDirectoryOffset: 0,
    maxZoom: 0,
    minZoom: 0,
    numAddressedTiles: 1,
    numTileContents: 1,
    numTileEntries: 1,
    rootDirectoryLength: 25,
    rootDirectoryOffset: 127,
    specVersion: 3,
    tileCompression: Compression.Gzip,
    tileDataLength: 67,
    tileDataOffset: 399,
    tileType: 1,
  });
  // metadata
  expect((await testFixture2.getMetadata()) as unknown as MetaExternal).toEqual({
    name: 'test_fixture_2.pmtiles',
    description: 'test_fixture_2.pmtiles',
    version: '2',
    type: 'overlay',
    generator: 'tippecanoe v2.5.0',
    generator_options: './tippecanoe -zg -o test_fixture_2.pmtiles --force',
    vector_layers: [
      {
        id: 'test_fixture_2pmtiles',
        description: '',
        minzoom: 0,
        maxzoom: 0,
        fields: {},
      },
    ],
    tilestats: {
      layerCount: 1,
      layers: [
        {
          layer: 'test_fixture_2pmtiles',
          count: 1,
          geometry: 'Polygon',
          attributeCount: 0,
          attributes: [],
        },
      ],
    },
  });
  // TILE
  const tile = await testFixture2.getTile(0, 0, 0);
  expect(tile).toBeInstanceOf(Uint8Array);
  expect(new Uint8Array(tile as Uint8Array)).toEqual(
    new Uint8Array([
      26, 45, 120, 2, 10, 21, 116, 101, 115, 116, 95, 102, 105, 120, 116, 117, 114, 101, 95, 50,
      112, 109, 116, 105, 108, 101, 115, 40, 128, 32, 18, 15, 24, 3, 34, 11, 9, 128, 32, 232, 31,
      18, 22, 24, 21, 0, 15,
    ]),
  );
});

test('s2pmtiles - s2', async () => {
  const reader = new S2PMTilesReader(
    await Bun.file(`${__dirname}/fixtures/s2.s2pmtiles`).arrayBuffer(),
  );

  // setup data
  const str = 'hello world';
  const buf = Buffer.from(str, 'utf8');
  const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  // const str2 = 'hello world 2';
  // const buf2 = Buffer.from(str2, 'utf8');
  // const uint8_2 = new Uint8Array(buf2.buffer, buf2.byteOffset, buf2.byteLength);

  const metadata = await reader.getMetadata();
  const header = await reader.getHeader();
  expect(header).toEqual({
    clustered: true,
    internalCompression: 1,
    jsonMetadataLength: 17,
    jsonMetadataOffset: 280,
    leafDirectoryLength: 0,
    leafDirectoryLength1: 0,
    leafDirectoryLength2: 0,
    leafDirectoryLength3: 0,
    leafDirectoryLength4: 0,
    leafDirectoryLength5: 0,
    leafDirectoryOffset: 98_339,
    leafDirectoryOffset1: 98_339,
    leafDirectoryOffset2: 98_339,
    leafDirectoryOffset3: 98_339,
    leafDirectoryOffset4: 98_339,
    leafDirectoryOffset5: 98_339,
    maxZoom: 0,
    minZoom: 0,
    numAddressedTiles: 3,
    numTileContents: 1,
    numTileEntries: 1,
    rootDirectoryLength: 5,
    rootDirectoryLength1: 5,
    rootDirectoryLength2: 1,
    rootDirectoryLength3: 5,
    rootDirectoryLength4: 1,
    rootDirectoryLength5: 1,
    rootDirectoryOffset: 262,
    rootDirectoryOffset1: 267,
    rootDirectoryOffset2: 272,
    rootDirectoryOffset3: 273,
    rootDirectoryOffset4: 278,
    rootDirectoryOffset5: 279,
    specVersion: 1,
    tileCompression: 1,
    tileDataLength: 35,
    tileDataOffset: 98_304,
    tileType: 1,
  } as S2Header);
  expect(metadata).toEqual({ metadata: true } as unknown as Metadata);

  const tile = await reader.getTileS2(0, 0, 0, 0);
  expect(tile).toEqual(uint8);

  const tile2 = await reader.getTileS2(1, 0, 0, 0);
  expect(tile2).toEqual(uint8);

  // const tile3 = await reader.getTileS2(3, 2, 1, 1);
  // expect(tile3).toEqual(uint8_2);
});

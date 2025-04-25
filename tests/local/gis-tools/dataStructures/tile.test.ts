import { Tile, TileStore, transformPoint } from '../../../../s2/gis-tools';
import { expect, test } from 'vitest';

// import { deepEqualWithTolerance } from '../../../deepEqual';

import { idChildrenIJ, idFromFace } from '../../../../s2/gis-tools/geometry/id';

import type {
  FeatureCollection,
  VectorFeature,
  VectorLineString,
  VectorPolygon,
} from '../../../../s2/gis-tools/geometry';

const SIMPLIFY_MAXZOOM = 16;

test('tile - from reader', () => {
  const tile = new Tile(0n);
  tile.addFeature({
    type: 'VectorFeature',
    properties: { name: 'Melbourne' },
    geometry: { type: 'Point', is3D: false, coordinates: { x: 144.9584, y: -37.8173 } },
  });
  tile.addFeature({
    type: 'VectorFeature',
    properties: { name: 'Canberra' },
    geometry: { type: 'Point', is3D: false, coordinates: { x: 149.1009, y: -35.3039 } },
  });
  tile.addFeature({
    type: 'VectorFeature',
    properties: { name: 'Sydney' },
    geometry: { type: 'Point', is3D: false, coordinates: { x: 151.2144, y: -33.8766 } },
  });
  expect(tile).toEqual({
    extent: 1,
    face: 0,
    i: 0,
    j: 0,
    layers: {
      default: {
        extent: 1,
        features: [
          {
            geometry: {
              // bbox: [144.9584, -37.8173, 144.9584, -37.8173],
              coordinates: {
                m: undefined,
                x: 144.9584,
                y: -37.8173,
                z: undefined,
              },
              is3D: false,
              type: 'Point',
            },
            properties: {
              name: 'Melbourne',
            },
            type: 'VectorFeature',
          },
          {
            geometry: {
              // bbox: [149.1009, -35.3039, 149.1009, -35.3039],
              coordinates: {
                m: undefined,
                x: 149.1009,
                y: -35.3039,
                z: undefined,
              },
              is3D: false,
              type: 'Point',
            },
            properties: {
              name: 'Canberra',
            },
            type: 'VectorFeature',
          },
          {
            geometry: {
              // bbox: [151.2144, -33.8766, 151.2144, -33.8766],
              coordinates: {
                m: undefined,
                x: 151.2144,
                y: -33.8766,
                z: undefined,
              },
              is3D: false,
              type: 'Point',
            },
            properties: {
              name: 'Sydney',
            },
            type: 'VectorFeature',
          },
        ],
        name: 'default',
      },
    },
    transformed: false,
    zoom: 0,
  } as unknown as Tile);
});

test('transformPoint', () => {
  const p = { x: 0, y: 0 };
  transformPoint(p, 1, 0, 0);
  expect(p).toEqual({ x: 0, y: 0 });
  transformPoint(p, 1, 1, 0);
  expect(p).toEqual({ x: -1, y: 0 });
});

test('Tile', () => {
  const tile = new Tile(idFromFace(0));
  expect(tile).toEqual({
    face: 0,
    zoom: 0,
    i: 0,
    j: 0,
    extent: 1,
    layers: {},
    transformed: false,
  } as Tile);

  expect(tile.isEmpty()).toBe(true);

  tile.addFeature(
    {
      type: 'VectorFeature',
      properties: {},
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0, y: 0 },
      },
    },
    'default',
  );

  expect(tile.isEmpty()).toBe(false);

  tile.transform(3, SIMPLIFY_MAXZOOM);

  expect(tile).toEqual({
    face: 0,
    zoom: 0,
    i: 0,
    j: 0,
    extent: 1,
    transformed: true,
    layers: {
      default: {
        extent: 1,
        name: 'default',
        features: [
          {
            type: 'VectorFeature',
            properties: {},
            geometry: {
              type: 'Point',
              is3D: false,
              coordinates: { x: 0, y: 0 },
            },
          },
        ],
      },
    },
  } as unknown as Tile);
});

test('TileStore - points', () => {
  const featureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { a: 1 },
        geometry: {
          type: 'Point',
          coordinates: [0, 0],
        },
      },
      {
        type: 'Feature',
        properties: { b: 2 },
        geometry: {
          type: 'Point3D',
          coordinates: [45, 45, 1],
        },
      },
      {
        type: 'Feature',
        properties: { c: 3 },
        geometry: {
          type: 'MultiPoint',
          coordinates: [
            [-45, -45],
            [-45, 45],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { d: 4 },
        geometry: {
          type: 'MultiPoint3D',
          coordinates: [
            [45, -45, 1],
            [-180, 20, 2],
          ],
        },
      },
    ],
  };

  const store = new TileStore(featureCollection, { projection: 'WG' });

  const faceID = idFromFace(0);
  const faceTile = store.getTile(faceID);

  expect(faceTile).toEqual({
    face: 0,
    zoom: 0,
    i: 0,
    j: 0,
    extent: 1,
    layers: {
      default: {
        extent: 1,
        features: [
          {
            geometry: {
              coordinates: {
                m: undefined,
                x: 0.5,
                y: 0.5,
                z: undefined,
              },
              type: 'Point',
              is3D: false,
              vecBBox: [0.5, 0.5, 0.5, 0.5],
            },
            properties: {
              a: 1,
            },
            type: 'VectorFeature',
          },
          {
            geometry: {
              coordinates: {
                m: undefined,
                x: 0.625,
                y: 0.35972503691520497,
                z: 1,
              },
              type: 'Point',
              is3D: true,
              vecBBox: [0.625, 0.35972503691520497, 0.625, 0.35972503691520497, 1, 1],
            },
            properties: {
              b: 2,
            },
            type: 'VectorFeature',
          },
          {
            geometry: {
              coordinates: [
                {
                  x: 0.375,
                  y: 0.640274963084795,
                },
                {
                  x: 0.375,
                  y: 0.35972503691520497,
                },
              ],
              type: 'MultiPoint',
              is3D: false,
              vecBBox: [0.375, 0.35972503691520497, 0.375, 0.640274963084795],
            },
            properties: {
              c: 3,
            },
            type: 'VectorFeature',
          },
          {
            geometry: {
              coordinates: [
                {
                  x: 0.625,
                  y: 0.640274963084795,
                  z: 1,
                },
                {
                  x: 0,
                  y: 0.4432805993614054,
                  z: 2,
                },
              ],
              type: 'MultiPoint',
              is3D: true,
              vecBBox: [0, 0.4432805993614054, 0.625, 0.640274963084795, 1, 2],
            },
            properties: {
              d: 4,
            },
            type: 'VectorFeature',
          },
        ],
        name: 'default',
      },
    },
    transformed: true,
  } as unknown as Tile);

  const [, child2] = idChildrenIJ(0, 0, 0, 0);
  const childTile = store.getTile(child2);
  expect(childTile).toEqual({
    extent: 1,
    face: 0,
    i: 1,
    j: 0,
    layers: {
      default: {
        extent: 1,
        features: [
          {
            geometry: {
              coordinates: {
                x: 0.25,
                y: 0.7194500738304099,
                z: 1,
              },
              is3D: true,
              type: 'Point',
              vecBBox: [0.625, 0.35972503691520497, 0.625, 0.35972503691520497, 1, 1],
            },
            properties: {
              b: 2,
            },
            type: 'VectorFeature',
          },
        ],
        name: 'default',
      },
    },
    transformed: true,
    zoom: 1,
  } as unknown as Tile);
});

test('TileStore - lines', () => {
  const featureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'lines',
          id: 1336,
        },
        geometry: {
          coordinates: [
            [-13.292352825505162, 54.34883408204476],
            [36.83102287804303, 59.56941785818924],
            [50.34083898563978, 16.040052775278994],
            [76.38149901912357, 35.155968522292056],
          ],
          type: 'LineString',
        },
      },
    ],
  };

  const store = new TileStore(featureCollection, { projection: 'S2' });

  const faceID = idFromFace(1);
  const faceTile = store.getTile(faceID);

  const feature = faceTile?.layers.default.features[0] as VectorFeature;
  const coords = feature.geometry.coordinates as VectorLineString;
  const expected: VectorLineString = [
    { t: 1, x: 0.16117147860778458, y: 1.0625 },
    { t: 0.09501600025180619, x: 0.06631938819928551, y: 0.7280709792071008 },
    { t: 1, x: 0.3429608328526337, y: 0.8907772605847967 },
  ];
  for (let i = 0; i < coords.length; i++) {
    expect(coords[i].x).toBeCloseTo(expected[i].x);
    expect(coords[i].y).toBeCloseTo(expected[i].y);
  }
  expect(feature.geometry.offset).toBeCloseTo(0.5733427280932565);
  const bboxExpected = [0.06631938819928551, 0.7280709792071008, 0.3429608328526337, 1.0625];
  for (let i = 0; i < bboxExpected.length; i++) {
    expect(feature.geometry.vecBBox?.[i]).toBeCloseTo(bboxExpected[i]);
  }
  expect(feature.properties).toEqual({ id: 1336, name: 'lines' });

  const [, , child3] = idChildrenIJ(1, 0, 0, 0);
  const childTile = store.getTile(child3);

  // expect(
  //   deepEqualWithTolerance(childTile, {
  //     layers: {
  //       default: {
  //         name: 'default',
  //         features: [
  //           {
  //             face: 1,
  //             geometry: {
  //               bbox: undefined,
  //               coordinates: [
  //                 [
  //                   { t: 1, x: 0.32234295721556916, y: 1.125 },
  //                   { t: 0.09501600025180619, x: 0.13263877639857102, y: 0.4561419584142017 },
  //                   { t: 1, x: 0.6859216657052674, y: 0.7815545211695933 },
  //                 ],
  //               ],
  //               is3D: false,
  //               offset: [0.5733427280932565],
  //               type: 'MultiLineString',
  //               vecBBox: [0.06631938819928551, 0.7280709792071008, 0.3429608328526337, 1.0625],
  //             },
  //             id: undefined,
  //             metadata: undefined,
  //             properties: {
  //               id: 1336,
  //               name: 'lines',
  //             },
  //             type: 'S2Feature',
  //           },
  //         ],
  //         extent: 1,
  //       },
  //     },
  //     transformed: true,
  //     extent: 1,
  //     face: 1,
  //     zoom: 1,
  //     i: 0,
  //     j: 1,
  //   } as unknown as Tile),
  // ).toBe(true);
  expect(childTile?.isEmpty()).toBe(false);
});

test('TileStore - polys', () => {
  const featureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'polys',
          id: 100,
        },
        geometry: {
          coordinates: [
            [
              [-82.22210288919695, 43.20251833642999],
              [-101.93729667579208, 19.709540835851655],
              [-29.6482527916086, 6.24385238701565],
              [-82.22210288919695, 43.20251833642999],
            ],
          ],
          type: 'Polygon',
        },
      },
    ],
  };

  const store = new TileStore(featureCollection, { projection: 'S2' });

  const faceID = idFromFace(4);
  const faceTile = store.getTile(faceID);
  const defaultLayer = faceTile?.layers.default;
  expect(defaultLayer).toBeDefined();
  expect(defaultLayer?.length).toBe(1);
  const feature = faceTile?.layers.default.features[0] as VectorFeature;
  const coords = feature.geometry.coordinates as VectorLineString;
  const expected: VectorPolygon = [
    [
      { t: 1, x: 0.019745389202600605, y: 0.5936686625424521 },
      { t: 0.11973158120854696, x: 0.2756944455013487, y: 0.36081320997943556 },
      { t: 0.3840760719449536, x: 0.425051753528058, y: 1.0625 },
      { t: 0.02043724219043263, x: 0.2360772824344321, y: 1.0625 },
      { t: 1, x: 0.019745389202600605, y: 0.5936686625424521 },
    ],
  ];
  for (let i = 0; i < coords.length; i++) {
    // @ts-expect-error - This doesn't matter just a test
    expect(coords[0][i].x).toBeCloseTo(expected[0][i].x);
    // @ts-expect-error - This doesn't matter just a test
    expect(coords[0][i].y).toBeCloseTo(expected[0][i].y);
  }
  // @ts-expect-error - This doesn't matter just a test
  expect(feature.geometry.offset?.[0]).toBeCloseTo(2.6779635944880855);
  const bboxExpected = [0.019745389202600605, 0.36081320997943556, 0.425051753528058, 1.0625];
  for (let i = 0; i < bboxExpected.length; i++) {
    expect(feature.geometry.vecBBox?.[i]).toBeCloseTo(bboxExpected[i]);
  }
  expect(feature.properties).toEqual({ id: 100, name: 'polys' });

  // expect(faceTile).toEqual({
  //   extent: 1,
  //   face: 4,
  //   i: 0,
  //   j: 0,
  //   layers: {
  //     default: {
  //       extent: 1,
  //       features: [
  //         {
  //           face: 4,
  //           geometry: {
  //             coordinates: [
  //               [
  //                 { t: 1, x: 0.019745389202600605, y: 0.5936686625424521 },
  //                 { t: 0.11973158120854696, x: 0.2756944455013487, y: 0.36081320997943556 },
  //                 { t: 0.3840760719449536, x: 0.425051753528058, y: 1.0625 },
  //                 { t: 0.02043724219043263, x: 0.2360772824344321, y: 1.0625 },
  //                 { t: 1, x: 0.019745389202600605, y: 0.5936686625424521 },
  //               ],
  //             ],
  //             is3D: false,
  //             offset: [2.6779635944880855],
  //             type: 'Polygon',
  //             vecBBox: [0.019745389202600605, 0.36081320997943556, 0.425051753528058, 1.0625],
  //           },
  //           id: undefined,
  //           metadata: undefined,
  //           properties: {
  //             id: 100,
  //             name: 'polys',
  //           },
  //           type: 'S2Feature',
  //         },
  //       ],
  //       name: 'default',
  //     },
  //   },
  //   transformed: true,
  //   zoom: 0,
  // } as unknown as Tile);
});

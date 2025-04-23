import { Tile } from '../../../../s2/gis-tools/dataStructures';
import { idFromFace } from '../../../../s2/gis-tools/geometry/id';
import { clipLine, clipPoint, splitTile } from '../../../../s2/gis-tools/geometry/tools/clip';
import { describe, expect, it, test } from 'bun:test';

import type {
  BBox,
  VectorFeature,
  VectorLineString,
  VectorPointGeometry,
} from '../../../../s2/gis-tools/geometry';

test('clipPoint', () => {
  const point: VectorPointGeometry = {
    type: 'Point',
    is3D: false,
    coordinates: { x: 0.5, y: 0.5 },
  };
  const res = clipPoint(point, 0, 0, 1);
  expect(res).toEqual(point);

  const res2 = clipPoint(point, 0, 0, 0.1);
  expect(res2).toBeUndefined();
});

test('clipLine - simple', () => {
  const bbox: BBox = [0, 0, 10.5, 10.5];
  const line: VectorLineString = [
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 5, z: 4, m: { a: 1 } },
    { x: 10, y: 10, z: -2, m: { a: 2 } },
    { x: 15, y: 15, z: 3, m: { a: 3 } },
  ];

  const res = clipLine(line, bbox, false, 0, 0);
  expect(res).toEqual([
    {
      line: [
        { m: undefined, x: 0, y: 0, z: 0 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 2 }, x: 10, y: 10, z: -2 },
        { x: 10.5, y: 10.5, z: -2, m: { a: 3 }, t: 1 },
      ],
      offset: 0,
      vecBBox: [0, 0, 10.5, 10.5, -2, 4],
    },
  ]);

  // polygon case:
  const res2 = clipLine(line, bbox, true, 0, 0);
  expect(res2).toEqual([
    {
      line: [
        { m: undefined, x: 0, y: 0, z: 0 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 2 }, x: 10, y: 10, z: -2 },
        { x: 10.5, y: 10.5, z: -2, m: { a: 3 }, t: 1 },
        { m: undefined, x: 0, y: 0, z: 0 },
      ],
      offset: 0,
      vecBBox: [0, 0, 10.5, 10.5, -2, 4],
    },
  ]);
});

test('clipLine - starts outside left', () => {
  const bbox: BBox = [2.5, 2.5, 10.5, 10.5];
  const line: VectorLineString = [
    { x: 0, y: 0, z: 0, t: 1 },
    { x: 5, y: 5, z: 4, m: { a: 1 } },
    { x: 10, y: 10, z: -2, m: { a: 2 } },
    { x: 15, y: 15, z: 3, m: { a: 3 } },
  ];

  const res = clipLine(line, bbox, false, 0, 0.5);
  expect(res).toEqual([
    {
      line: [
        { m: { a: 1 }, x: 2, y: 2, z: 4, t: 1 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 2 }, x: 10, y: 10, z: -2 },
        { x: 11, y: 11, z: -2, m: { a: 3 }, t: 1 },
      ],
      offset: 2.8284271247461903,
      vecBBox: [2, 2, 11, 11, -2, 4],
    },
  ]);

  // polygon case:
  const res2 = clipLine(line, bbox, true, 0, 0.5);
  expect(res2).toEqual([
    {
      line: [
        { m: { a: 1 }, x: 2, y: 2, z: 4, t: 1 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 2 }, x: 10, y: 10, z: -2 },
        { x: 11, y: 11, z: -2, m: { a: 3 }, t: 1 },
        { m: { a: 1 }, x: 2, y: 2, z: 4, t: 1 },
      ],
      offset: 2.8284271247461903,
      vecBBox: [2, 2, 11, 11, -2, 4],
    },
  ]);
});

test('clipLine - starts outside right', () => {
  const bbox: BBox = [2.5, 2.5, 10.5, 10.5];
  const line: VectorLineString = [
    { x: 15, y: 15, z: 3, m: { a: 3 } },
    { x: 10, y: 10, z: -2, m: { a: 2 } },
    { x: 5, y: 5, z: 4, m: { a: 1 } },
    { x: 0, y: 0, z: 0 },
  ];

  const res = clipLine(line, bbox, false, 0, 0);
  expect(res).toEqual([
    {
      line: [
        { x: 10.5, y: 10.5, z: -2, t: 1, m: { a: 2 } },
        { m: { a: 2 }, x: 10, y: 10, z: -2 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 1 }, x: 2.5, y: 2.5, z: 0, t: 1 },
      ],
      offset: 6.363961030678928,
      vecBBox: [2.5, 2.5, 10.5, 10.5, -2, 4],
    },
  ]);

  // polygon case:
  const res2 = clipLine(line, bbox, true, 0, 0);
  expect(res2).toEqual([
    {
      line: [
        { x: 10.5, y: 10.5, z: -2, m: { a: 2 }, t: 1 },
        { m: { a: 2 }, x: 10, y: 10, z: -2 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 1 }, x: 2.5, y: 2.5, z: 0, t: 1 },
        { x: 10.5, y: 10.5, z: -2, m: { a: 2 }, t: 1 },
      ],
      offset: 6.363961030678928,
      vecBBox: [2.5, 2.5, 10.5, 10.5, -2, 4],
    },
  ]);
});

test('clipLine - starts outside right and moves to outside left', () => {
  const bbox: BBox = [2.5, 2.5, 10.5, 10.5];
  const line: VectorLineString = [
    { x: 15, y: 15, z: 3, m: { a: 3 } },
    { x: 0, y: 0, z: 0 },
  ];

  const res = clipLine(line, bbox, false, 0, 0);
  expect(res).toEqual([
    {
      line: [
        { x: 10.5, y: 10.5, z: 0, t: 1, m: undefined },
        { m: { a: 3 }, x: 2.5, y: 2.5, z: 0, t: 1 },
      ],
      offset: 6.363961030678928,
      vecBBox: [2.5, 2.5, 10.5, 10.5, 0, 0],
    },
  ]);
});

test('clipLine - only vertically', () => {
  const bbox: BBox = [2.5, 2.5, 10.5, 10.5];
  const line: VectorLineString = [
    { x: 4, y: 0, z: 0 },
    { x: 5, y: 5, z: 4, m: { a: 1 } },
    { x: 7, y: 10, z: -2, m: { a: 2 } },
    { x: 9, y: 15, z: 3, m: { a: 3 } },
  ];

  const res = clipLine(line, bbox, false, 0, 0);
  expect(res).toEqual([
    {
      line: [
        { m: { a: 1 }, x: 4.5, y: 2.5, z: 4, t: 1 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 2 }, x: 7, y: 10, z: -2 },
        { m: { a: 3 }, x: 7.2, y: 10.5, z: -2, t: 1 },
      ],
      offset: 2.5495097567963922,
      vecBBox: [4.5, 2.5, 7.2, 10.5, -2, 4],
    },
  ]);

  const res2 = clipLine(line, bbox, true, 0, 0);
  expect(res2).toEqual([
    {
      line: [
        { m: { a: 1 }, x: 4.5, y: 2.5, z: 4, t: 1 },
        { m: { a: 1 }, x: 5, y: 5, z: 4 },
        { m: { a: 2 }, x: 7, y: 10, z: -2 },
        { m: { a: 3 }, x: 7.2, y: 10.5, z: -2, t: 1 },
        { m: undefined, x: 7.5, y: 10.5, z: 0, t: 1 },
        { m: { a: 3 }, x: 4.833333333333333, y: 2.5, z: 0, t: 1 },
        { m: { a: 1 }, x: 4.5, y: 2.5, z: 4, t: 1 },
      ],
      offset: 2.5495097567963922,
      vecBBox: [4.5, 2.5, 7.5, 10.5, -2, 4],
    },
  ]);
});

test('clipLine - passes through the x axis from left to right, then again right to left', () => {
  const bbox: BBox = [0, 0, 10, 10];
  const line: VectorLineString = [
    { x: -2, y: 4 },
    { x: 2, y: 4 },
    { x: 8, y: 4 },
    { x: 12, y: 4 },
    { x: 12, y: 8 },
    { x: 8, y: 8 },
    { x: 2, y: 8 },
    { x: -2, y: 8 },
  ];

  const res = clipLine(line, bbox, false, 0, 0);
  expect(res).toEqual([
    {
      line: [
        { x: 0, y: 4, t: 1 },
        { x: 2, y: 4 },
        { x: 8, y: 4 },
        { x: 10, y: 4, t: 1 },
      ],
      offset: 2,
      vecBBox: [0, 4, 10, 4],
    },
    {
      line: [
        { x: 10, y: 8, t: 1 },
        { x: 8, y: 8 },
        { x: 2, y: 8 },
        { x: 0, y: 8, t: 1 },
      ],
      offset: 20,
      vecBBox: [0, 8, 10, 8],
    },
  ]);
});

describe('splitTile', () => {
  it('Point', () => {
    const faceID = idFromFace(0);
    const features: VectorFeature[] = [
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'Point',
          is3D: false,
          coordinates: { x: 0.25, y: 0.25 },
          vecBBox: [0.25, 0.25, 0.25, 0.25],
        },
      },
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'Point',
          is3D: false,
          coordinates: { x: 0.75, y: 0.75 },
          vecBBox: [0.75, 0.75, 0.75, 0.75],
        },
      },
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'Point',
          is3D: false,
          coordinates: { x: 0.75, y: 0.25 },
          vecBBox: [0.75, 0.25, 0.75, 0.25],
        },
      },
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'Point',
          is3D: false,
          coordinates: { x: 0.25, y: 0.75 },
          vecBBox: [0.25, 0.75, 0.25, 0.75],
        },
      },
    ];

    const tile = new Tile(faceID);
    for (const feature of features) tile.addFeature(feature);

    const res = splitTile(tile);
    expect(res).toEqual([
      {
        id: 288230376151711744n,
        tile: {
          face: 0,
          zoom: 1,
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
                      x: 0.25,
                      y: 0.25,
                    },
                    is3D: false,
                    type: 'Point',
                    vecBBox: [0.25, 0.25, 0.25, 0.25],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
        } as unknown as Tile,
      },
      {
        id: 2017612633061982208n,
        tile: {
          face: 0,
          zoom: 1,
          i: 1,
          j: 0,
          extent: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    coordinates: {
                      x: 0.75,
                      y: 0.25,
                    },
                    is3D: false,
                    type: 'Point',
                    vecBBox: [0.75, 0.25, 0.75, 0.25],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
        } as unknown as Tile,
      },
      {
        id: 864691128455135232n,
        tile: {
          face: 0,
          zoom: 1,
          i: 0,
          j: 1,
          extent: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    coordinates: {
                      x: 0.25,
                      y: 0.75,
                    },
                    is3D: false,
                    type: 'Point',
                    vecBBox: [0.25, 0.75, 0.25, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
        } as unknown as Tile,
      },
      {
        id: 1441151880758558720n,
        tile: {
          face: 0,
          zoom: 1,
          i: 1,
          j: 1,
          extent: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    coordinates: {
                      x: 0.75,
                      y: 0.75,
                    },
                    is3D: false,
                    type: 'Point',
                    vecBBox: [0.75, 0.75, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
        } as unknown as Tile,
      },
    ]);
  });
  it('MultiPoint', () => {
    const faceID = idFromFace(0);
    const features: VectorFeature[] = [
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'MultiPoint',
          is3D: false,
          coordinates: [
            { x: 0.25, y: 0.25 },
            { x: 0.75, y: 0.75 },
            { x: 0.75, y: 0.25 },
            { x: 0.25, y: 0.75 },
          ],
          vecBBox: [0.25, 0.25, 0.75, 0.75],
        },
      },
    ];

    const tile = new Tile(faceID);
    for (const feature of features) tile.addFeature(feature);

    const res = splitTile(tile);
    expect(res).toEqual([
      {
        id: 288230376151711744n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      {
                        x: 0.25,
                        y: 0.25,
                      },
                    ],
                    is3D: false,
                    type: 'MultiPoint',
                    vecBBox: [0.25, 0.25, 0.25, 0.25],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 2017612633061982208n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      {
                        x: 0.75,
                        y: 0.25,
                      },
                    ],
                    is3D: false,
                    type: 'MultiPoint',
                    vecBBox: [0.75, 0.25, 0.75, 0.25],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 864691128455135232n,
        tile: {
          extent: 1,
          face: 0,
          i: 0,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      {
                        x: 0.25,
                        y: 0.75,
                      },
                    ],
                    is3D: false,
                    type: 'MultiPoint',
                    vecBBox: [0.25, 0.75, 0.25, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 1441151880758558720n,
        tile: {
          extent: 1,
          face: 0,
          i: 1,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      {
                        x: 0.75,
                        y: 0.75,
                      },
                    ],
                    is3D: false,
                    type: 'MultiPoint',
                    vecBBox: [0.75, 0.75, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
    ]);

    const splitAgain = splitTile(res[3].tile);

    expect(splitAgain).toEqual([
      {
        id: 1224979098644774912n,
        tile: {
          extent: 1,
          face: 0,
          i: 2,
          j: 2,
          layers: {},
          transformed: false,
          zoom: 2,
        } as unknown as Tile,
      },
      {
        id: 1657324662872342528n,
        tile: {
          extent: 1,
          face: 0,
          i: 3,
          j: 2,
          layers: {},
          transformed: false,
          zoom: 2,
        } as unknown as Tile,
      },
      {
        id: 1369094286720630784n,
        tile: {
          extent: 1,
          face: 0,
          i: 2,
          j: 3,
          layers: {},
          transformed: false,
          zoom: 2,
        } as unknown as Tile,
      },
      {
        id: 1513209474796486656n,
        tile: {
          extent: 1,
          face: 0,
          i: 3,
          j: 3,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      {
                        x: 0.75,
                        y: 0.75,
                      },
                    ],
                    is3D: false,
                    type: 'MultiPoint',
                    vecBBox: [0.75, 0.75, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 2,
        } as unknown as Tile,
      },
    ]);
  });

  it('LineString', () => {
    const faceID = idFromFace(0);
    const features: VectorFeature[] = [
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'LineString',
          is3D: false,
          coordinates: [
            { x: 0.25, y: 0.25 },
            { x: 0.75, y: 0.75 },
            { x: 0.75, y: 0.25 },
            { x: 0.25, y: 0.75 },
          ],
          vecBBox: [0.25, 0.25, 0.75, 0.75],
        },
      },
    ];

    const tile = new Tile(faceID);
    for (const feature of features) tile.addFeature(feature);

    const res = splitTile(tile);
    expect(res).toEqual([
      {
        id: 288230376151711744n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        { x: 0.25, y: 0.25 },
                        { t: 1, x: 0.5625, y: 0.5625 },
                      ],
                      [
                        { t: 1, x: 0.5625, y: 0.4375 },
                        { t: 1, x: 0.4375, y: 0.5625 },
                      ],
                    ],
                    is3D: false,
                    offset: [0, 1.4722718241315027],
                    type: 'MultiLineString',
                    vecBBox: [0.25, 0.25, 0.5625, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 2017612633061982208n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.4375, y: 0.4375 },
                        { t: 1, x: 0.5625, y: 0.5625 },
                      ],
                      [
                        { t: 1, x: 0.75, y: 0.5625 },
                        { x: 0.75, y: 0.25 },
                        { t: 1, x: 0.4375, y: 0.5625 },
                      ],
                    ],
                    is3D: false,
                    offset: [0.2651650429449553, 0.8946067811865475],
                    type: 'MultiLineString',
                    vecBBox: [0.4375, 0.25, 0.75, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 864691128455135232n,
        tile: {
          extent: 1,
          face: 0,
          i: 0,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.4375, y: 0.4375 },
                        { t: 1, x: 0.5625, y: 0.5625 },
                      ],
                      [
                        { t: 1, x: 0.5625, y: 0.4375 },
                        { x: 0.25, y: 0.75 },
                      ],
                    ],
                    is3D: false,
                    offset: [0.2651650429449553, 1.4722718241315027],
                    type: 'MultiLineString',
                    vecBBox: [0.25, 0.4375, 0.5625, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 1441151880758558720n,
        tile: {
          extent: 1,
          face: 0,
          i: 1,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.4375, y: 0.4375 },
                        { x: 0.75, y: 0.75 },
                        { t: 1, x: 0.75, y: 0.4375 },
                      ],
                      [
                        { t: 1, x: 0.5625, y: 0.4375 },
                        { t: 1, x: 0.4375, y: 0.5625 },
                      ],
                    ],
                    is3D: false,
                    offset: [0.2651650429449553, 1.4722718241315027],
                    type: 'MultiLineString',
                    vecBBox: [0.4375, 0.4375, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
    ]);
  });

  it('MultiLineString', () => {
    const faceID = idFromFace(0);
    const features: VectorFeature[] = [
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'MultiLineString',
          is3D: false,
          coordinates: [
            [
              { x: 0.25, y: 0.25 },
              { x: 0.75, y: 0.25 },
              { x: 0.75, y: 0.75 },
              { x: 0.25, y: 0.75 },
            ],
            [
              { x: 0.4, y: 0.4 },
              { x: 0.6, y: 0.4 },
              { x: 0.6, y: 0.6 },
              { x: 0.4, y: 0.6 },
            ],
          ],
          vecBBox: [0.25, 0.25, 0.75, 0.75],
        },
      },
    ];

    const tile = new Tile(faceID);
    for (const feature of features) tile.addFeature(feature);

    const res = splitTile(tile);
    expect(res).toEqual([
      {
        id: 288230376151711744n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        { x: 0.25, y: 0.25 },
                        { t: 1, x: 0.5625, y: 0.25 },
                      ],
                      [
                        { x: 0.4, y: 0.4 },
                        { t: 1, x: 0.5625, y: 0.4 },
                      ],
                    ],
                    is3D: false,
                    offset: [0, 0],
                    type: 'MultiLineString',
                    vecBBox: [0.25, 0.25, 0.5625, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 2017612633061982208n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.4375, y: 0.25 },
                        { x: 0.75, y: 0.25 },
                        { t: 1, x: 0.75, y: 0.5625 },
                      ],
                      [
                        { t: 1, x: 0.4375, y: 0.4 },
                        { x: 0.6, y: 0.4 },
                        { t: 1, x: 0.6, y: 0.5625 },
                      ],
                    ],
                    is3D: false,
                    offset: [0.1875, 0.03749999999999998],
                    type: 'MultiLineString',
                    vecBBox: [0.4375, 0.25, 0.75, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 864691128455135232n,
        tile: {
          extent: 1,
          face: 0,
          i: 0,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.5625, y: 0.75 },
                        { x: 0.25, y: 0.75 },
                      ],
                      [
                        { t: 1, x: 0.5625, y: 0.6 },
                        { x: 0.4, y: 0.6 },
                      ],
                    ],
                    is3D: false,
                    offset: [1.1875, 0.4374999999999999],
                    type: 'MultiLineString',
                    vecBBox: [0.25, 0.4375, 0.5625, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 1441151880758558720n,
        tile: {
          extent: 1,
          face: 0,
          i: 1,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.75, y: 0.4375 },
                        { x: 0.75, y: 0.75 },
                        { t: 1, x: 0.4375, y: 0.75 },
                      ],
                      [
                        { t: 1, x: 0.6, y: 0.4375 },
                        { x: 0.6, y: 0.6 },
                        { t: 1, x: 0.4375, y: 0.6 },
                      ],
                    ],
                    is3D: false,
                    offset: [0.6875, 0.23749999999999993],
                    type: 'MultiLineString',
                    vecBBox: [0.4375, 0.4375, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
    ]);
  });

  it('Polygon', () => {
    const faceID = idFromFace(0);
    const features: VectorFeature[] = [
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'Polygon',
          is3D: false,
          coordinates: [
            [
              { x: 0.25, y: 0.25 },
              { x: 0.75, y: 0.25 },
              { x: 0.75, y: 0.75 },
              { x: 0.25, y: 0.75 },
            ],
            [
              { x: 0.4, y: 0.6 },
              { x: 0.6, y: 0.6 },
              { x: 0.6, y: 0.4 },
              { x: 0.4, y: 0.4 },
            ],
          ],
          vecBBox: [0.25, 0.25, 0.75, 0.75],
        },
      },
    ];

    const tile = new Tile(faceID);
    for (const feature of features) tile.addFeature(feature);

    const res = splitTile(tile);
    expect(res).toEqual([
      {
        id: 288230376151711744n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        { x: 0.25, y: 0.25 },
                        { t: 1, x: 0.5625, y: 0.25 },
                        { t: 1, x: 0.5625, y: 0.5625 },
                        { t: 1, x: 0.25, y: 0.5625 },
                        { x: 0.25, y: 0.25 },
                      ],
                      [
                        { t: 1, x: 0.5625, y: 0.5625 },
                        { t: 1, x: 0.5625, y: 0.4 },
                        { x: 0.4, y: 0.4 },
                        { t: 1, x: 0.4, y: 0.5625 },
                        { t: 1, x: 0.5625, y: 0.5625 },
                      ],
                    ],
                    is3D: false,
                    offset: [2.5, 0.6374999999999998],
                    type: 'Polygon',
                    vecBBox: [0.25, 0.25, 0.5625, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 2017612633061982208n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.4375, y: 0.25 },
                        { x: 0.75, y: 0.25 },
                        { t: 1, x: 0.75, y: 0.5625 },
                        { t: 1, x: 0.4375, y: 0.5625 },
                        { t: 1, x: 0.4375, y: 0.25 },
                      ],
                      [
                        { t: 1, x: 0.6, y: 0.5625 },
                        { x: 0.6, y: 0.4 },
                        { t: 1, x: 0.4375, y: 0.4 },
                        { t: 1, x: 0.4375, y: 0.5625 },
                        { t: 1, x: 0.6, y: 0.5625 },
                      ],
                    ],
                    is3D: false,
                    offset: [1.5, 0.23749999999999993],
                    type: 'Polygon',
                    vecBBox: [0.4375, 0.25, 0.75, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 864691128455135232n,
        tile: {
          extent: 1,
          face: 0,
          i: 0,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.5625, y: 0.4375 },
                        { t: 1, x: 0.5625, y: 0.75 },
                        { x: 0.25, y: 0.75 },
                        { t: 1, x: 0.25, y: 0.4375 },
                        { t: 1, x: 0.5625, y: 0.4375 },
                      ],
                      [
                        { x: 0.4, y: 0.6 },
                        { t: 1, x: 0.5625, y: 0.6 },
                        { t: 1, x: 0.5625, y: 0.4375 },
                        { t: 1, x: 0.4, y: 0.4375 },
                        { x: 0.4, y: 0.6 },
                      ],
                    ],
                    is3D: false,
                    offset: [1.6875, 0.9999999999999998],
                    type: 'Polygon',
                    vecBBox: [0.25, 0.4375, 0.5625, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 1441151880758558720n,
        tile: {
          extent: 1,
          face: 0,
          i: 1,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        { t: 1, x: 0.75, y: 0.4375 },
                        { x: 0.75, y: 0.75 },
                        { t: 1, x: 0.4375, y: 0.75 },
                        { t: 1, x: 0.4375, y: 0.4375 },
                        { t: 1, x: 0.75, y: 0.4375 },
                      ],
                      [
                        { t: 1, x: 0.4375, y: 0.6 },
                        { x: 0.6, y: 0.6 },
                        { t: 1, x: 0.6, y: 0.4375 },
                        { t: 1, x: 0.4375, y: 0.4375 },
                        { t: 1, x: 0.4375, y: 0.6 },
                      ],
                    ],
                    is3D: false,
                    offset: [0.6875, 0.5999999999999999],
                    type: 'Polygon',
                    vecBBox: [0.4375, 0.4375, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
    ]);
  });

  it('MultiPolygon', () => {
    const faceID = idFromFace(0);
    const features: VectorFeature[] = [
      {
        type: 'VectorFeature',
        properties: { a: 2 },
        geometry: {
          type: 'MultiPolygon',
          is3D: false,
          coordinates: [
            [
              [
                { x: 0.25, y: 0.25 },
                { x: 0.75, y: 0.25 },
                { x: 0.75, y: 0.75 },
                { x: 0.25, y: 0.75 },
              ],
              [
                { x: 0.4, y: 0.6 },
                { x: 0.6, y: 0.6 },
                { x: 0.6, y: 0.4 },
                { x: 0.4, y: 0.4 },
              ],
            ],
          ],
          vecBBox: [0.25, 0.25, 0.75, 0.75],
        },
      },
    ];

    const tile = new Tile(faceID);
    for (const feature of features) tile.addFeature(feature);

    const res = splitTile(tile);
    expect(res).toEqual([
      {
        id: 288230376151711744n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        [
                          { x: 0.25, y: 0.25 },
                          { t: 1, x: 0.5625, y: 0.25 },
                          { t: 1, x: 0.5625, y: 0.5625 },
                          { t: 1, x: 0.25, y: 0.5625 },
                          { x: 0.25, y: 0.25 },
                        ],
                        [
                          { t: 1, x: 0.5625, y: 0.5625 },
                          { t: 1, x: 0.5625, y: 0.4 },
                          { x: 0.4, y: 0.4 },
                          { t: 1, x: 0.4, y: 0.5625 },
                          { t: 1, x: 0.5625, y: 0.5625 },
                        ],
                      ],
                    ],
                    is3D: false,
                    offset: [[2.5, 0.6374999999999998]],
                    type: 'MultiPolygon',
                    vecBBox: [0.25, 0.25, 0.5625, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 2017612633061982208n,
        tile: {
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
                    bbox: undefined,
                    coordinates: [
                      [
                        [
                          { t: 1, x: 0.4375, y: 0.25 },
                          { x: 0.75, y: 0.25 },
                          { t: 1, x: 0.75, y: 0.5625 },
                          { t: 1, x: 0.4375, y: 0.5625 },
                          { t: 1, x: 0.4375, y: 0.25 },
                        ],
                        [
                          { t: 1, x: 0.6, y: 0.5625 },
                          { x: 0.6, y: 0.4 },
                          { t: 1, x: 0.4375, y: 0.4 },
                          { t: 1, x: 0.4375, y: 0.5625 },
                          { t: 1, x: 0.6, y: 0.5625 },
                        ],
                      ],
                    ],
                    is3D: false,
                    offset: [[1.5, 0.23749999999999993]],
                    type: 'MultiPolygon',
                    vecBBox: [0.4375, 0.25, 0.75, 0.5625],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 864691128455135232n,
        tile: {
          extent: 1,
          face: 0,
          i: 0,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        [
                          { t: 1, x: 0.5625, y: 0.4375 },
                          { t: 1, x: 0.5625, y: 0.75 },
                          { x: 0.25, y: 0.75 },
                          { t: 1, x: 0.25, y: 0.4375 },
                          { t: 1, x: 0.5625, y: 0.4375 },
                        ],
                        [
                          { x: 0.4, y: 0.6 },
                          { t: 1, x: 0.5625, y: 0.6 },
                          { t: 1, x: 0.5625, y: 0.4375 },
                          { t: 1, x: 0.4, y: 0.4375 },
                          { x: 0.4, y: 0.6 },
                        ],
                      ],
                    ],
                    is3D: false,
                    offset: [[1.6875, 0.9999999999999998]],
                    type: 'MultiPolygon',
                    vecBBox: [0.25, 0.4375, 0.5625, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
      {
        id: 1441151880758558720n,
        tile: {
          extent: 1,
          face: 0,
          i: 1,
          j: 1,
          layers: {
            default: {
              extent: 1,
              features: [
                {
                  geometry: {
                    bbox: undefined,
                    coordinates: [
                      [
                        [
                          { t: 1, x: 0.75, y: 0.4375 },
                          { x: 0.75, y: 0.75 },
                          { t: 1, x: 0.4375, y: 0.75 },
                          { t: 1, x: 0.4375, y: 0.4375 },
                          { t: 1, x: 0.75, y: 0.4375 },
                        ],
                        [
                          { t: 1, x: 0.4375, y: 0.6 },
                          { x: 0.6, y: 0.6 },
                          { t: 1, x: 0.6, y: 0.4375 },
                          { t: 1, x: 0.4375, y: 0.4375 },
                          { t: 1, x: 0.4375, y: 0.6 },
                        ],
                      ],
                    ],
                    is3D: false,
                    offset: [[0.6875, 0.5999999999999999]],
                    type: 'MultiPolygon',
                    vecBBox: [0.4375, 0.4375, 0.75, 0.75],
                  },
                  properties: {
                    a: 2,
                  },
                  type: 'VectorFeature',
                },
              ],
              name: 'default',
            },
          },
          transformed: false,
          zoom: 1,
        } as unknown as Tile,
      },
    ]);
  });
});

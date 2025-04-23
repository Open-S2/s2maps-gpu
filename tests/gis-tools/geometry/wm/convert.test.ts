import { toLL, toS2, toUnitScale, toVector } from '../../../../s2/gis-tools/geometry/wm/convert';

import { expect, test } from 'bun:test';

import type { Feature, VectorFeature } from '../../../../s2/gis-tools/geometry';

// toUnitScale

test('toUnitScale - toLL - Point', () => {
  const point: VectorFeature = {
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Point',
      is3D: true,
      coordinates: { x: 0, y: 0, z: 0, m: { b: 2 } },
    },
  };

  toUnitScale(point);
  expect(point).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Point',
      is3D: true,
      vecBBox: [0.5, 0.5, 0.5, 0.5, 0, 0],
      coordinates: { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
    },
  });

  toLL(point);
  expect(point).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Point',
      is3D: true,
      vecBBox: [0.5, 0.5, 0.5, 0.5, 0, 0],
      coordinates: { x: 0, y: 0, z: 0, m: { b: 2 } },
    },
  });
});

test('toUnitScale - toLL - MultiPoint', () => {
  const point: VectorFeature = {
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      is3D: true,
      coordinates: [
        { x: 0, y: 0, z: 0, m: { b: 2 } },
        { x: -180, y: -90, z: 0, m: { b: 3 } },
        { x: 180, y: 90, z: 0, m: { b: 4 } },
      ],
    },
  };

  toUnitScale(point);
  expect(point).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
        { x: 0, y: 1, z: 0, m: { b: 3 } },
        { x: 1, y: 0, z: 0, m: { b: 4 } },
      ],
    },
  });

  toLL(point);
  expect(point).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        { x: 0, y: 0, z: 0, m: { b: 2 } },
        { x: -180, y: -85.05112877980659, z: 0, m: { b: 3 } },
        { x: 180, y: 85.05112877980659, z: 0, m: { b: 4 } },
      ],
    },
  });
});

test('toUnitScale - toLL - LineString', () => {
  const linestring: VectorFeature = {
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      is3D: true,
      coordinates: [
        { x: 0, y: 0, z: 0, m: { b: 2 } },
        { x: -180, y: -90, z: 0, m: { b: 3 } },
        { x: 180, y: 90, z: 0, m: { b: 4 } },
      ],
    },
  };

  toUnitScale(linestring);
  expect(linestring).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
        { x: 0, y: 1, z: 0, m: { b: 3 } },
        { x: 1, y: 0, z: 0, m: { b: 4 } },
      ],
    },
  });

  toLL(linestring);
  expect(linestring).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        { x: 0, y: 0, z: 0, m: { b: 2 } },
        { x: -180, y: -85.05112877980659, z: 0, m: { b: 3 } },
        { x: 180, y: 85.05112877980659, z: 0, m: { b: 4 } },
      ],
    },
  });
});

test('toUnitScale - toLL - MultiLineString', () => {
  const multilinestring: VectorFeature = {
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString',
      is3D: true,
      coordinates: [
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -180, y: -90, z: 0, m: { b: 3 } },
          { x: 180, y: 90, z: 0, m: { b: 4 } },
        ],
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -90, y: -45, z: 0, m: { b: 3 } },
          { x: 90, y: 45, z: 0, m: { b: 4 } },
        ],
      ],
    },
  };

  toUnitScale(multilinestring);
  expect(multilinestring).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        [
          { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
          { x: 0, y: 1, z: 0, m: { b: 3 } },
          { x: 1, y: 0, z: 0, m: { b: 4 } },
        ],
        [
          { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
          { x: 0.25, y: 0.640274963084795, z: 0, m: { b: 3 } },
          { x: 0.75, y: 0.35972503691520497, z: 0, m: { b: 4 } },
        ],
      ],
    },
  });

  toLL(multilinestring);
  expect(multilinestring).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -180, y: -85.05112877980659, z: 0, m: { b: 3 } },
          { x: 180, y: 85.05112877980659, z: 0, m: { b: 4 } },
        ],
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -90, y: -45, z: 0, m: { b: 3 } },
          { x: 90, y: 45, z: 0, m: { b: 4 } },
        ],
      ],
    },
  });
});

test('toUnitScale - toLL - Polygon', () => {
  const polygon: VectorFeature = {
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon',
      is3D: true,
      coordinates: [
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -180, y: -90, z: 0, m: { b: 3 } },
          { x: 180, y: 90, z: 0, m: { b: 4 } },
        ],
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -90, y: -45, z: 0, m: { b: 3 } },
          { x: 90, y: 45, z: 0, m: { b: 4 } },
        ],
      ],
    },
  };

  toUnitScale(polygon);
  expect(polygon).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        [
          { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
          { x: 0, y: 1, z: 0, m: { b: 3 } },
          { x: 1, y: 0, z: 0, m: { b: 4 } },
        ],
        [
          { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
          { x: 0.25, y: 0.640274963084795, z: 0, m: { b: 3 } },
          { x: 0.75, y: 0.35972503691520497, z: 0, m: { b: 4 } },
        ],
      ],
    },
  });

  toLL(polygon);
  expect(polygon).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -180, y: -85.05112877980659, z: 0, m: { b: 3 } },
          { x: 180, y: 85.05112877980659, z: 0, m: { b: 4 } },
        ],
        [
          { x: 0, y: 0, z: 0, m: { b: 2 } },
          { x: -90, y: -45, z: 0, m: { b: 3 } },
          { x: 90, y: 45, z: 0, m: { b: 4 } },
        ],
      ],
    },
  });
});

test('toUnitScale - toLL - MultiPolygon', () => {
  const multiPolygon: VectorFeature = {
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon',
      is3D: true,
      coordinates: [
        [
          [
            { x: 0, y: 0, z: 0, m: { b: 2 } },
            { x: -180, y: -90, z: 0, m: { b: 3 } },
            { x: 180, y: 90, z: 0, m: { b: 4 } },
          ],
          [
            { x: 0, y: 0, z: 0, m: { b: 2 } },
            { x: -90, y: -45, z: 0, m: { b: 3 } },
            { x: 90, y: 45, z: 0, m: { b: 4 } },
          ],
        ],
      ],
    },
  };

  toUnitScale(multiPolygon);
  expect(multiPolygon).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        [
          [
            { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
            { x: 0, y: 1, z: 0, m: { b: 3 } },
            { x: 1, y: 0, z: 0, m: { b: 4 } },
          ],
          [
            { x: 0.5, y: 0.5, z: 0, m: { b: 2 } },
            { x: 0.25, y: 0.640274963084795, z: 0, m: { b: 3 } },
            { x: 0.75, y: 0.35972503691520497, z: 0, m: { b: 4 } },
          ],
        ],
      ],
    },
  });

  toLL(multiPolygon);
  expect(multiPolygon).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon',
      is3D: true,
      vecBBox: [0, 0, 1, 1, 0, 0],
      coordinates: [
        [
          [
            { x: 0, y: 0, z: 0, m: { b: 2 } },
            { x: -180, y: -85.05112877980659, z: 0, m: { b: 3 } },
            { x: 180, y: 85.05112877980659, z: 0, m: { b: 4 } },
          ],
          [
            { x: 0, y: 0, z: 0, m: { b: 2 } },
            { x: -90, y: -45, z: 0, m: { b: 3 } },
            { x: 90, y: 45, z: 0, m: { b: 4 } },
          ],
        ],
      ],
    },
  });
});

// toVector

test('toVector - Point', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: { type: 'Point', coordinates: [0, 0] },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: { type: 'Point', is3D: false, coordinates: { x: 0, y: 0 } },
  });
});

test('toVector - Point3D', () => {
  const point: Feature = {
    id: 1,
    type: 'Feature',
    properties: { a: 1 },
    geometry: { type: 'Point3D', coordinates: [1, 1, 1] },
  };
  expect(toVector(point, false)).toEqual({
    id: 1,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: { type: 'Point', is3D: true, coordinates: { x: 1, y: 1, z: 1 } },
  });
});

test('toVector - MultiPoint', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      is3D: false,
      coordinates: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
  });
});

test('toVector - MultiPoint3D', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint3D',
      coordinates: [
        [0, 0, 0],
        [1, 1, 1],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      is3D: true,
      coordinates: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
      ],
    },
  });
});

test('toVector - LineString', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      is3D: false,
      coordinates: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
  });
});

test('toVector - LineString3D', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString3D',
      coordinates: [
        [0, 0, 0],
        [1, 1, 1],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      is3D: true,
      coordinates: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
      ],
    },
  });
});

test('toVector - MultiLineString', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString',
      is3D: false,
      coordinates: [
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
      ],
    },
  });
});

test('toVector - MultiLineString3D', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString3D',
      coordinates: [
        [
          [0, 0, 0],
          [1, 1, 1],
        ],
        [
          [2, 2, 2],
          [3, 3, 3],
        ],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiLineString',
      is3D: true,
      coordinates: [
        [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 1, z: 1 },
        ],
        [
          { x: 2, y: 2, z: 2 },
          { x: 3, y: 3, z: 3 },
        ],
      ],
    },
  });
});

test('toVector - Polygon', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon',
      is3D: false,
      coordinates: [
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
      ],
    },
  });
});

test('toVector - Polygon3D', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon3D',
      coordinates: [
        [
          [0, 0, 0],
          [1, 1, 1],
        ],
        [
          [2, 2, 2],
          [3, 3, 3],
        ],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Polygon',
      is3D: true,
      coordinates: [
        [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 1, z: 1 },
        ],
        [
          { x: 2, y: 2, z: 2 },
          { x: 3, y: 3, z: 3 },
        ],
      ],
    },
  });
});

test('toVector - MultiPolygon', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 1],
          ],
          [
            [2, 2],
            [3, 3],
          ],
        ],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon',
      is3D: false,
      coordinates: [
        [
          [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          [
            { x: 2, y: 2 },
            { x: 3, y: 3 },
          ],
        ],
      ],
    },
  });
});

test('toVector - MultiPolygon3D', () => {
  const point: Feature = {
    type: 'Feature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon3D',
      coordinates: [
        [
          [
            [0, 0, 0],
            [1, 1, 1],
          ],
          [
            [2, 2, 2],
            [3, 3, 3],
          ],
        ],
      ],
    },
  };
  expect(toVector(point, false)).toEqual({
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPolygon',
      is3D: true,
      coordinates: [
        [
          [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
          [
            { x: 2, y: 2, z: 2 },
            { x: 3, y: 3, z: 3 },
          ],
        ],
      ],
    },
  });

  expect(() =>
    toVector({
      type: 'Feature',
      properties: { a: 1 },
      geometry: {
        // @ts-expect-error - Invalid GeoJSON type
        type: 'mistake',
        coordinates: [],
        vecBBox: [0, 0, 0, 0],
      },
    }),
  ).toThrowError('Invalid GeoJSON type');
});

// toS2

test('toS2 - Point', () => {
  const point: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'Point',
      is3D: false,
      coordinates: { x: 0, y: 0 },
    },
  };
  expect(toS2(point)).toEqual([
    {
      id: 1337,
      type: 'S2Feature',
      face: 0,
      properties: { a: 1 },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
        vecBBox: [0.5, 0.5, 0.5, 0.5],
      },
    },
  ]);
});

test('toS2 - MultiPoint', () => {
  const multiPoint: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'MultiPoint',
      is3D: false,
      coordinates: [
        { x: 0, y: 0 },
        { x: -180, y: -90 },
        { x: 180, y: 90 },
      ],
    },
  };
  expect(toS2(multiPoint)).toEqual([
    {
      id: 1337,
      type: 'S2Feature',
      face: 0,
      properties: { a: 1 },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
        vecBBox: [0.5, 0.5, 0.5, 0.5],
      },
    },
    {
      id: 1337,
      type: 'S2Feature',
      face: 5,
      properties: { a: 1 },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
        vecBBox: [0.5, 0.5, 0.5, 0.5],
      },
    },
    {
      id: 1337,
      type: 'S2Feature',
      face: 2,
      properties: { a: 1 },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
        vecBBox: [0.5, 0.5, 0.5, 0.5],
      },
    },
  ]);
});

test('toS2 - LineString', () => {
  const linestring: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      type: 'LineString',
      is3D: false,
      coordinates: [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
        { x: 40, y: 40 },
      ],
    },
  };

  expect(toS2(linestring)).toEqual([
    {
      face: 0,
      geometry: {
        is3D: false,
        coordinates: [
          { x: 0.5, y: 0.5 },
          { x: 0.7231719544476624, y: 0.7351848576118168 },
          { x: 0.8264458251405347, y: 0.8660254037844386 },
          { x: 0.6953495465482081, y: 1.0625, t: 1 },
        ],
        offset: 0,
        vecBBox: [0.5, 0.5, 0.8264458251405347, 1.0625],
        type: 'LineString',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
    {
      face: 2,
      geometry: {
        is3D: false,
        coordinates: [
          { t: 1, x: -0.0625, y: 0.17012925937810885 },
          { x: 0.033200039883945376, y: 0.091961822201713 },
        ],
        offset: 1.5284052199258356,
        vecBBox: [-0.0625, 0.091961822201713, 0.033200039883945376, 0.17012925937810885],
        type: 'LineString',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
  ]);
});

test('toS2 - MultiLineString', () => {
  const multiLinestring: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      is3D: false,
      type: 'MultiLineString',
      coordinates: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 20 },
          { x: 30, y: 30 },
          { x: 40, y: 40 },
        ],
        [
          { x: -120, y: -30 },
          { x: -130, y: -40 },
          { x: -140, y: -50 },
          { x: -150, y: -60 },
        ],
      ],
    },
  };

  expect(toS2(multiLinestring)).toEqual([
    {
      face: 0,
      geometry: {
        is3D: false,
        coordinates: [
          { x: 0.5, y: 0.5 },
          { x: 0.7231719544476624, y: 0.7351848576118168 },
          { x: 0.8264458251405347, y: 0.8660254037844386 },
          { x: 0.6953495465482081, y: 1.0625, t: 1 },
        ],
        offset: 0,
        vecBBox: [0.5, 0.5, 0.8264458251405347, 1.0625],
        type: 'LineString',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
    {
      face: 2,
      geometry: {
        is3D: false,
        coordinates: [
          { t: 1, x: -0.0625, y: 0.17012925937810885 },
          { x: 0.033200039883945376, y: 0.091961822201713 },
        ],
        offset: 1.5284052199258356,
        vecBBox: [-0.0625, 0.091961822201713, 0.033200039883945376, 0.17012925937810885],
        type: 'LineString',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
    {
      face: 4,
      geometry: {
        is3D: false,
        coordinates: [
          { x: 0.8660254037844386, y: 0.17355417485946534 },
          { x: 1.0332000398839454, y: 0.0919618222017129 },
          { x: 1.0625, y: 0.1016957300340185, t: 1 },
        ],
        offset: 0,
        vecBBox: [0.8660254037844386, 0.0919618222017129, 1.0625, 0.17355417485946534],
        type: 'LineString',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
    {
      face: 5,
      geometry: {
        is3D: false,
        coordinates: [
          { t: 1, x: -0.0625, y: 0.13866981323286479 },
          { x: 0.033200039883945376, y: 0.0919618222017129 },
          { x: 0.1909745772474294, y: 0.14437700634864636 },
          { x: 0.3169872981077806, y: 0.209430584957905 },
        ],
        offset: 0.07953324204553078,
        vecBBox: [-0.0625, 0.0919618222017129, 0.3169872981077806, 0.209430584957905],
        type: 'LineString',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
  ]);
});

test('toS2 - Polygon', () => {
  const polygon: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      is3D: false,
      type: 'Polygon',
      coordinates: [
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 40, y: 0 },
          { x: 40, y: 20 },
          { x: 40, y: 40 },
          { x: 20, y: 40 },
          { x: 0, y: 40 },
          { x: 0, y: 20 },
          { x: 0, y: 0 },
        ],
        [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 30, y: 10 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
          { x: 20, y: 30 },
          { x: 10, y: 30 },
          { x: 10, y: 20 },
          { x: 10, y: 10 },
        ],
      ],
    },
  };

  expect(toS2(polygon)).toEqual([
    {
      face: 0,
      geometry: {
        is3D: false,
        coordinates: [
          [
            { x: 0.5, y: 0.5 },
            { x: 0.7231719544476624, y: 0.5 },
            { x: 0.9377231592442196, y: 0.5 },
            { x: 0.9377231592442196, y: 0.7786828928924201 },
            { x: 0.7356879031193608, y: 1.0625, t: 1 },
            { x: 0.6583568237637192, y: 1.0625, t: 1 },
            { x: 0.7231719544476622, y: 0.9590168832161913 },
            { x: 0.5, y: 0.9377231592442196 },
            { x: 0.5, y: 0.7231719544476624 },
            { x: 0.5, y: 0.5 },
          ],
          [
            { x: 0.6182598446699807, y: 0.6199075184683839 },
            { x: 0.7231719544476624, y: 0.6250859462252395 },
            { x: 0.8264458251405347, y: 0.6345893512076446 },
            { x: 0.8264458251405347, y: 0.7518028126416558 },
            { x: 0.8264458251405347, y: 0.8660254037844386 },
            { x: 0.7231719544476624, y: 0.8430910345588061 },
            { x: 0.6182598446699807, y: 0.8304773451370653 },
            { x: 0.6182598446699807, y: 0.7260776792851733 },
            { x: 0.6182598446699807, y: 0.6199075184683839 },
          ],
        ],
        offset: [3.241841444519629, 0],
        vecBBox: [0.5, 0.5, 0.9377231592442196, 1.0625],
        type: 'Polygon',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
    {
      face: 2,
      geometry: {
        is3D: false,
        coordinates: [
          [
            { t: 1, x: -0.0625, y: 0.19165525141383033 },
            { x: 0.033200039883945376, y: 0.091961822201713 },
            { t: 1, x: -0.0625, y: 0.15284249599867805 },
            { x: -0.0625, y: 0.19165525141383033, t: 1 },
          ],
        ],
        offset: [1.7505894300567113],
        vecBBox: [-0.0625, 0.091961822201713, 0.033200039883945376, 0.19165525141383033],
        type: 'Polygon',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
  ]);
});

test('toS2 - MultiPolygon', () => {
  const polygon: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      is3D: false,
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 20 },
            { x: 40, y: 40 },
            { x: 20, y: 40 },
            { x: 0, y: 40 },
            { x: 0, y: 20 },
            { x: 0, y: 0 },
          ],
          [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 20 },
            { x: 30, y: 30 },
            { x: 20, y: 30 },
            { x: 10, y: 30 },
            { x: 10, y: 20 },
            { x: 10, y: 10 },
          ],
        ],
      ],
    },
  };

  expect(toS2(polygon)).toEqual([
    {
      face: 0,
      geometry: {
        is3D: false,
        coordinates: [
          [
            { x: 0.5, y: 0.5 },
            { x: 0.7231719544476624, y: 0.5 },
            { x: 0.9377231592442196, y: 0.5 },
            { x: 0.9377231592442196, y: 0.7786828928924201 },
            { x: 0.7356879031193608, y: 1.0625, t: 1 },
            { x: 0.6583568237637192, y: 1.0625, t: 1 },
            { x: 0.7231719544476622, y: 0.9590168832161913 },
            { x: 0.5, y: 0.9377231592442196 },
            { x: 0.5, y: 0.7231719544476624 },
            { x: 0.5, y: 0.5 },
          ],
          [
            { x: 0.6182598446699807, y: 0.6199075184683839 },
            { x: 0.7231719544476624, y: 0.6250859462252395 },
            { x: 0.8264458251405347, y: 0.6345893512076446 },
            { x: 0.8264458251405347, y: 0.7518028126416558 },
            { x: 0.8264458251405347, y: 0.8660254037844386 },
            { x: 0.7231719544476624, y: 0.8430910345588061 },
            { x: 0.6182598446699807, y: 0.8304773451370653 },
            { x: 0.6182598446699807, y: 0.7260776792851733 },
            { x: 0.6182598446699807, y: 0.6199075184683839 },
          ],
        ],
        offset: [3.241841444519629, 0],
        vecBBox: [0.5, 0.5, 0.9377231592442196, 1.0625],
        type: 'Polygon',
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
    {
      face: 2,
      geometry: {
        coordinates: [
          [
            { t: 1, x: -0.0625, y: 0.19165525141383033 },
            { x: 0.033200039883945376, y: 0.091961822201713 },
            { t: 1, x: -0.0625, y: 0.15284249599867805 },
            { x: -0.0625, y: 0.19165525141383033, t: 1 },
          ],
        ],
        offset: [1.7505894300567113],
        vecBBox: [-0.0625, 0.091961822201713, 0.033200039883945376, 0.19165525141383033],
        type: 'Polygon',
        is3D: false,
      },
      id: 1337,
      properties: { a: 1 },
      type: 'S2Feature',
    },
  ]);
});

test('toS2 - Error', () => {
  const err: VectorFeature = {
    id: 1337,
    type: 'VectorFeature',
    properties: { a: 1 },
    geometry: {
      // @ts-expect-error Either the conversion is not yet supported or Invalid S2Geometry type.
      type: 'error',
      coordinates: { x: 0, y: 0 },
    },
  };
  expect(() => toS2(err)).toThrowError(
    'Either the conversion is not yet supported or Invalid S2Geometry type.',
  );

  expect(() => toLL(err)).toThrowError(
    'Either the conversion is not yet supported or Invalid S2Geometry type.',
  );
});

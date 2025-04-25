import { buildSqDists, simplify } from '../../../../../s2/gis-tools';
import { expect, test } from 'vitest';

import type {
  VectorLineStringGeometry,
  VectorMultiLineStringGeometry,
  VectorMultiPolygonGeometry,
  VectorPolygonGeometry,
} from '../../../../../s2/gis-tools/geometry';

const SIMPLIFY_MAXZOOM = 16;

test('LineString', () => {
  const lineString: VectorLineStringGeometry = {
    type: 'LineString',
    is3D: false,
    coordinates: [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.75 },
      { x: 0.25, y: 0.75 },
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  };

  buildSqDists(lineString, 3 / 4_096, SIMPLIFY_MAXZOOM);

  expect(lineString).toEqual({
    type: 'LineString',
    is3D: false,
    coordinates: [
      { x: 0.25, y: 0.25, t: 1 },
      { x: 0.75, y: 0.25, t: 0.125 },
      { x: 0.75, y: 0.75, t: 0.25 },
      { x: 0.25, y: 0.75, t: 1 },
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });

  simplify(lineString, 3 / 4_096, 0, SIMPLIFY_MAXZOOM);
  expect(lineString).toEqual({
    type: 'LineString',
    is3D: false,
    coordinates: [
      { x: 0.25, y: 0.25, t: 1 },
      { x: 0.75, y: 0.25, t: 0.125 },
      { x: 0.75, y: 0.75, t: 0.25 },
      { x: 0.25, y: 0.75, t: 1 },
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });
});

test('MultiLineString', () => {
  const multiLineString: VectorMultiLineStringGeometry = {
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
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.25 },
        { x: 0.75, y: 0.25 },
        { x: 0.75, y: 0.5 },
        { x: 0.5, y: 0.5 },
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  };

  buildSqDists(multiLineString, 3 / 4_096, SIMPLIFY_MAXZOOM);

  expect(multiLineString).toEqual({
    type: 'MultiLineString',
    is3D: false,
    coordinates: [
      [
        { x: 0.25, y: 0.25, t: 1 },
        { x: 0.75, y: 0.25, t: 0.125 },
        { x: 0.75, y: 0.75, t: 0.25 },
        { x: 0.25, y: 0.75, t: 1 },
      ],
      [
        { t: 1, x: 0.5, y: 0.5 },
        { t: 0.03125, x: 0.5, y: 0.25 },
        { t: 0.125, x: 0.75, y: 0.25 },
        { t: 0.03125, x: 0.75, y: 0.5 },
        { t: 1, x: 0.5, y: 0.5 },
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });

  simplify(multiLineString, 3 / 4_096, 0, SIMPLIFY_MAXZOOM);
  expect(multiLineString).toEqual({
    type: 'MultiLineString',
    is3D: false,
    coordinates: [
      [
        { x: 0.25, y: 0.25, t: 1 },
        { x: 0.75, y: 0.25, t: 0.125 },
        { x: 0.75, y: 0.75, t: 0.25 },
        { x: 0.25, y: 0.75, t: 1 },
      ],
      [
        { t: 1, x: 0.5, y: 0.5 },
        { t: 0.03125, x: 0.5, y: 0.25 },
        { t: 0.125, x: 0.75, y: 0.25 },
        { t: 0.03125, x: 0.75, y: 0.5 },
        { t: 1, x: 0.5, y: 0.5 },
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });
});

test('Polygon', () => {
  const polygon: VectorPolygonGeometry = {
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
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.25 },
        { x: 0.75, y: 0.25 },
        { x: 0.75, y: 0.5 },
        { x: 0.5, y: 0.5 },
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  };

  buildSqDists(polygon, 3 / 4_096, SIMPLIFY_MAXZOOM);

  expect(polygon).toEqual({
    type: 'Polygon',
    is3D: false,
    coordinates: [
      [
        { x: 0.25, y: 0.25, t: 1 },
        { x: 0.75, y: 0.25, t: 0.125 },
        { x: 0.75, y: 0.75, t: 0.25 },
        { x: 0.25, y: 0.75, t: 1 },
      ],
      [
        { t: 1, x: 0.5, y: 0.5 },
        { t: 0.03125, x: 0.5, y: 0.25 },
        { t: 0.125, x: 0.75, y: 0.25 },
        { t: 0.03125, x: 0.75, y: 0.5 },
        { t: 1, x: 0.5, y: 0.5 },
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });

  simplify(polygon, 3 / 4_096, 0, SIMPLIFY_MAXZOOM);
  expect(polygon).toEqual({
    type: 'Polygon',
    is3D: false,
    coordinates: [
      [
        { x: 0.25, y: 0.25, t: 1 },
        { x: 0.75, y: 0.25, t: 0.125 },
        { x: 0.75, y: 0.75, t: 0.25 },
        { x: 0.25, y: 0.75, t: 1 },
      ],
      [
        { t: 1, x: 0.5, y: 0.5 },
        { t: 0.03125, x: 0.75, y: 0.5 },
        { t: 0.125, x: 0.75, y: 0.25 },
        { t: 0.03125, x: 0.5, y: 0.25 },
        { t: 1, x: 0.5, y: 0.5 },
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });
});

test('MultiPolygon', () => {
  const multiPolygon: VectorMultiPolygonGeometry = {
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
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 0.25 },
          { x: 0.75, y: 0.25 },
          { x: 0.75, y: 0.5 },
          { x: 0.5, y: 0.5 },
        ],
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  };

  buildSqDists(multiPolygon, 3 / 4_096, SIMPLIFY_MAXZOOM);

  expect(multiPolygon).toEqual({
    type: 'MultiPolygon',
    is3D: false,
    coordinates: [
      [
        [
          { x: 0.25, y: 0.25, t: 1 },
          { x: 0.75, y: 0.25, t: 0.125 },
          { x: 0.75, y: 0.75, t: 0.25 },
          { x: 0.25, y: 0.75, t: 1 },
        ],
        [
          { t: 1, x: 0.5, y: 0.5 },
          { t: 0.03125, x: 0.5, y: 0.25 },
          { t: 0.125, x: 0.75, y: 0.25 },
          { t: 0.03125, x: 0.75, y: 0.5 },
          { t: 1, x: 0.5, y: 0.5 },
        ],
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });

  simplify(multiPolygon, 3 / 4_096, 0, SIMPLIFY_MAXZOOM);
  expect(multiPolygon).toEqual({
    type: 'MultiPolygon',
    is3D: false,
    coordinates: [
      [
        [
          { x: 0.25, y: 0.25, t: 1 },
          { x: 0.75, y: 0.25, t: 0.125 },
          { x: 0.75, y: 0.75, t: 0.25 },
          { x: 0.25, y: 0.75, t: 1 },
        ],
        [
          { t: 1, x: 0.5, y: 0.5 },
          { t: 0.03125, x: 0.75, y: 0.5 },
          { t: 0.125, x: 0.75, y: 0.25 },
          { t: 0.03125, x: 0.5, y: 0.25 },
          { t: 1, x: 0.5, y: 0.5 },
        ],
      ],
    ],
    vecBBox: [0.25, 0.25, 0.75, 0.75],
  });
});

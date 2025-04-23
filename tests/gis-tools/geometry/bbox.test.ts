import {
  bboxOverlap,
  clipBBox,
  fromLineString,
  fromMultiLineString,
  fromMultiPolygon,
  fromPoint,
  fromPolygon,
  mergeBBoxes,
  pointOverlap,
} from '../../../s2/gis-tools/geometry/bbox';
import { describe, expect, it, test } from 'bun:test';

import type { BBox, BBox3D } from '../../../s2/gis-tools/geometry';

describe('pointOverlap', () => {
  it('check if point is within bbox', () => {
    expect(pointOverlap([0, 0, 1, 1], { x: 0.5, y: 0.5 })).toBeTrue();
  });
  it('check if point is not within bbox', () => {
    expect(pointOverlap([0, 0, 1, 1], { x: 2, y: 2 })).toBeFalse();
  });
});

describe('bboxOverlap', () => {
  it('no overlap returns undefined', () => {
    expect(bboxOverlap([0, 0, 1, 1], [2, 2, 3, 3])).toBeUndefined();
  });
  it('overlap returns bbox', () => {
    expect(bboxOverlap([0, 0, 1, 1], [0.5, 0.5, 1.5, 1.5])).toEqual([0.5, 0.5, 1, 1]);
  });
});

describe('mergeBBoxes', () => {
  it('first is 2D, second is 3D', () => {
    const bb1: BBox = [0, 0, 1, 1];
    const bb2: BBox3D = [0.4, 0.4, 1.2, 1.2, 0, 1];

    expect(mergeBBoxes(bb1, bb2)).toEqual([0, 0, 1.2, 1.2, 0, 1]);
  });
});

test('clipBBox', () => {
  const bbox: BBox = [0, 0, 10, 10];
  const res = clipBBox(bbox, 0, 2, 8);
  expect(res).toEqual([2, 0, 8, 10]);
  const res2 = clipBBox(res, 1, 2, 8);
  expect(res2).toEqual([2, 2, 8, 8]);
});

test('fromPoint', () => {
  const res = fromPoint({ x: 0.5, y: 0.5 });
  expect(res).toEqual([0.5, 0.5, 0.5, 0.5]);
});

test('fromLineString', () => {
  const res = fromLineString([
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ]);
  expect(res).toEqual([0, 0, 10, 10]);
});

test('fromMultiLineString', () => {
  const res = fromMultiLineString([
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    [
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ],
  ]);
  expect(res).toEqual([0, 0, 30, 30]);
});

test('fromPolygon', () => {
  const res = fromPolygon([
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    [
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ],
  ]);
  expect(res).toEqual([0, 0, 30, 30]);
});

test('fromMultiPolygon', () => {
  const res = fromMultiPolygon([
    [
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    ],
    [
      [
        { x: 20, y: 20 },
        { x: 30, y: 30 },
      ],
    ],
  ]);
  expect(res).toEqual([0, 0, 30, 30]);
});

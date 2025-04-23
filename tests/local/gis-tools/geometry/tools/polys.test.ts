import { expect, test } from 'bun:test';
import { polygonArea, polygonsArea } from '../../../../../s2/gis-tools/geometry/tools/polys';

test('polygonArea', () => {
  const polygon = [
    [
      { x: 125, y: -15 },
      { x: 113, y: -22 },
      { x: 117, y: -37 },
      { x: 130, y: -33 },
      { x: 148, y: -39 },
      { x: 154, y: -27 },
      { x: 144, y: -15 },
      { x: 125, y: -15 },
    ],
  ];
  expect(polygonArea(polygon)).toEqual(7748891609977.455);
});

test('polygonsArea', () => {
  const polygons = [
    [
      [
        { x: 125, y: -15 },
        { x: 113, y: -22 },
        { x: 117, y: -37 },
        { x: 130, y: -33 },
        { x: 148, y: -39 },
        { x: 154, y: -27 },
        { x: 144, y: -15 },
        { x: 125, y: -15 },
      ],
    ],
  ];
  expect(polygonsArea(polygons)).toEqual(7748891609977.455);
});

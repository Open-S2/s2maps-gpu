import {
  capArea,
  capComplement,
  capContainsS2Cell,
  capContainsS2Point,
  capEmpty,
  capFromS1Angle,
  capFromS1ChordAngle,
  capFromS2Point,
  capFull,
  capGetIntersectingCells,
  capHeight,
  capIntersectsS2CellFast,
  capIsEmpty,
  capIsFull,
  capRadius,
} from '../../../../../s2/gis-tools/geometry/s2/cap';
import { expect, test } from 'vitest';

import { idFromFace, idFromIJ, idToS2Point } from '../../../../../s2/gis-tools/geometry/id';

import type { S2Cap } from '../../../../../s2/gis-tools/geometry/s2/cap';

test('capComplement', () => {
  const cap: S2Cap<{ a: number }> = { center: { x: 1, y: 0, z: 0 }, radius: 1, data: { a: 1 } };
  expect(capComplement(cap)).toEqual({
    center: { x: -1, y: -0, z: -0 },
    radius: 3,
    data: { a: 1 },
  });
});

test('capContainsS2Cell', () => {
  const face = idFromFace(0);
  const subPoint = idFromIJ(0, 10, 10, 5);
  const subPoint2 = idFromIJ(3, 10, 10, 6);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capContainsS2Cell(cap, subPoint)).toEqual(true);
  expect(capContainsS2Cell(cap, subPoint2)).toEqual(false);

  const empty = capEmpty({ a: 1 });
  expect(capContainsS2Cell(empty, subPoint)).toEqual(false);

  const full = capFull({ a: 1 });
  expect(capContainsS2Cell(full, subPoint)).toEqual(true);
});

test('capContainsS2Point', () => {
  const face = idFromFace(0);
  const subPoint = idFromIJ(0, 10, 10, 5);
  const subPoint2 = idFromIJ(3, 10, 10, 6);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capContainsS2Point(cap, idToS2Point(subPoint))).toEqual(true);
  expect(capContainsS2Point(cap, idToS2Point(subPoint2))).toEqual(false);
});

test('capEmpty', () => {
  const cap = capEmpty({ a: 1 });
  expect(cap.center).toEqual({ x: 1, y: 0, z: 0 });
  expect(cap.radius).toEqual(-1);
  expect(cap.data).toEqual({ a: 1 });
});

test('capFromS1Angle', () => {
  const face = idFromFace(0);
  const cap = capFromS1Angle(idToS2Point(face), 1, { a: 1 });
  expect(cap.center).toEqual({ x: 1, y: 0, z: 0 });
  expect(cap.radius).toEqual(0.9193953882637206);
  expect(cap.data).toEqual({ a: 1 });
});

test('capFromS1ChordAngle', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(cap.center).toEqual({ x: 1, y: 0, z: 0 });
  expect(cap.radius).toEqual(1);
  expect(cap.data).toEqual({ a: 1 });
});

test('capFromS2Point', () => {
  const cap = capFromS2Point({ x: 1, y: 0, z: 0 }, { a: 1 });
  expect(cap.center).toEqual({ x: 1, y: 0, z: 0 });
  expect(cap.radius).toEqual(0);
  expect(cap.data).toEqual({ a: 1 });
});

test('capFull', () => {
  const cap = capFull({ a: 1 });
  expect(cap.center).toEqual({ x: 1, y: 0, z: 0 });
  expect(cap.radius).toEqual(4);
  expect(cap.data).toEqual({ a: 1 });
});

test('capArea', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capArea(cap)).toEqual(3.141592653589793);
});

test('height', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capHeight(cap)).toEqual(0.5);
});

test('capIsEmpty', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capIsEmpty(cap)).toEqual(false);

  const empty = capEmpty({ a: 1 });
  expect(capIsEmpty(empty)).toEqual(true);
});

test('capIsFull', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capIsFull(cap)).toEqual(false);

  const full = capFull({ a: 1 });
  expect(capIsFull(full)).toEqual(true);
});

test('radius', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  expect(capRadius(cap)).toBeCloseTo(1.0471975511965976);
});

test('capGetIntersectingCells', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 1, { a: 1 });
  const cells = capGetIntersectingCells(cap);
  expect(cells).toEqual([
    13546827679130451968n,
    12970366926827028480n,
    10664523917613334528n,
    10088063165309911040n,
    5476377146882523136n,
    4899916394579099648n,
    4323455642275676160n,
    2594073385365405696n,
    1152921504606846976n,
  ]);
});

test('capGetIntersectingCells small', () => {
  const cells = capGetIntersectingCells({
    center: { x: 1, y: 0, z: 0 },
    radius: 0.002435949740175752,
    data: undefined,
  });
  expect(cells).toEqual([
    1924162940794044416n,
    1921911140980359168n,
    1919659341166673920n,
    1160802803954745344n,
    1156299204327374848n,
    1154047404513689600n,
    1151795604700004352n,
    1149543804886319104n,
    1145040205258948608n,
    386183668047020032n,
    383931868233334784n,
    381680068419649536n,
  ]);
});

test('capIntersectsS2CellFast', () => {
  const face = idFromFace(0);
  const cap = capFromS1ChordAngle(idToS2Point(face), 0.95, { a: 1 });
  expect(capIntersectsS2CellFast(cap, 13546827679130451968n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 12970366926827028480n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 10664523917613334528n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 10088063165309911040n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 5476377146882523136n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 4899916394579099648n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 4323455642275676160n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 2594073385365405696n)).toEqual(true);
  expect(capIntersectsS2CellFast(cap, 3746994889972252672n)).toEqual(false);
});

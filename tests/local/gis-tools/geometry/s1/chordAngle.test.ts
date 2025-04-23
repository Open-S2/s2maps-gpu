import {
  chordAngCos,
  chordAngFastUpperBoundFrom,
  chordAngFromAngle,
  chordAngFromKM,
  chordAngFromLength2,
  chordAngFromMeters,
  chordAngFromS2Points,
  chordAngIsSpecial,
  chordAngNegativeAngle,
  chordAngRightAngle,
  chordAngSin,
  chordAngSin2,
  chordAngStraightAngle,
  chordAngTan,
  chordAngToAngle,
  chordAngToKM,
  chordAngToMeters,
} from '../../../../../s2/gis-tools/geometry/s1/chordAngle';
import { expect, test } from 'bun:test';

test('chordAngCos', () => {
  expect(chordAngCos(0)).toEqual(1);
  expect(chordAngCos(1)).toEqual(0.5);
  expect(chordAngCos(2)).toEqual(0);
  expect(chordAngCos(3)).toEqual(-0.5);
  expect(chordAngCos(4)).toEqual(-1);
  expect(chordAngCos(5)).toEqual(-1.5);
});

test('chordAngSin', () => {
  expect(chordAngSin(0)).toEqual(0);
  expect(chordAngSin(1)).toEqual(0.8660254037844386);
  expect(chordAngSin(2)).toEqual(1);
  expect(chordAngSin(3)).toEqual(0.8660254037844386);
  expect(chordAngSin(4)).toEqual(0);
  expect(chordAngSin(5)).toEqual(NaN);
});

test('chordAngSin2', () => {
  expect(chordAngSin2(0)).toEqual(0);
  expect(chordAngSin2(1)).toEqual(0.75);
  expect(chordAngSin2(2)).toEqual(1);
  expect(chordAngSin2(3)).toEqual(0.75);
  expect(chordAngSin2(4)).toEqual(0);
  expect(chordAngSin2(5)).toEqual(-1.25);
});

test('chordAngTan', () => {
  expect(chordAngTan(0)).toEqual(0);
  expect(chordAngTan(1)).toEqual(1.7320508075688772);
  expect(chordAngTan(2)).toEqual(Infinity);
  expect(chordAngTan(3)).toEqual(-1.7320508075688772);
  expect(chordAngTan(4)).toEqual(-0);
  expect(chordAngTan(5)).toEqual(NaN);
});

test('chordAngFastUpperBoundFrom', () => {
  expect(chordAngFastUpperBoundFrom(0)).toEqual(0);
  expect(chordAngFastUpperBoundFrom(1)).toEqual(1);
  expect(chordAngFastUpperBoundFrom(2)).toEqual(4);
  expect(chordAngFastUpperBoundFrom(3)).toEqual(4);
});

test('chordAngFromAngle', () => {
  expect(chordAngFromAngle(0)).toEqual(0);
  expect(chordAngFromAngle(1)).toEqual(0.9193953882637206);
  expect(chordAngFromAngle(2)).toEqual(2.8322936730942847);
  expect(chordAngFromAngle(3)).toEqual(3.979984993200891);
  expect(chordAngFromAngle(Math.PI)).toEqual(4);
  expect(chordAngFromAngle(-2)).toEqual(-1);
  expect(chordAngFromAngle(Infinity)).toEqual(Infinity);
});

test('chordAngFromKM', () => {
  expect(chordAngFromKM(0)).toEqual(0);
  expect(chordAngFromKM(6371.0088)).toEqual(0.9193953882637206);
  expect(chordAngFromKM(6371008.8)).toEqual(4);
});

test('chordAngFromLength2', () => {
  expect(chordAngFromLength2(0)).toEqual(0);
  expect(chordAngFromLength2(1)).toEqual(1);
  expect(chordAngFromLength2(2)).toEqual(2);
  expect(chordAngFromLength2(3)).toEqual(3);
  expect(chordAngFromLength2(4)).toEqual(4);
  expect(chordAngFromLength2(5)).toEqual(4);
});

test('chordAngFromMeters', () => {
  expect(chordAngFromMeters(0)).toEqual(0);
  expect(chordAngFromMeters(6371.0088)).toEqual(9.999999166666694e-7);
  expect(chordAngFromMeters(6371008.8)).toEqual(0.9193953882637206);
});

test('chordAngFromS2Points', () => {
  expect(chordAngFromS2Points({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toEqual(0);
  expect(chordAngFromS2Points({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toEqual(1);
  expect(chordAngFromS2Points({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual(1);
});

test('chordAngIsSpecial', () => {
  expect(chordAngIsSpecial(0)).toEqual(false);
  expect(chordAngIsSpecial(-2)).toEqual(true);
  expect(chordAngIsSpecial(Infinity)).toEqual(true);
});

test('chordAngNegativeAngle', () => {
  expect(chordAngNegativeAngle()).toEqual(-1);
});

test('chordAngRightAngle', () => {
  expect(chordAngRightAngle()).toEqual(2);
});

test('chordAngStraightAngle', () => {
  expect(chordAngStraightAngle()).toEqual(4);
});

test('chordAngToAngle', () => {
  expect(chordAngToAngle(0)).toEqual(0);
  expect(chordAngToAngle(0.9193953882637206)).toEqual(1);
  expect(chordAngToAngle(2.8322936730942847)).toEqual(2);
  expect(chordAngToAngle(3.979984993200891)).toEqual(3.0000000000000004);
  expect(chordAngToAngle(4)).toEqual(Math.PI);
});

test('chordAngToKM', () => {
  expect(chordAngToKM(0)).toEqual(0);
  expect(chordAngToKM(0.9193953882637206)).toEqual(6371.0088);
});

test('chordAngToMeters', () => {
  expect(chordAngToMeters(0)).toEqual(0);
  expect(chordAngToMeters(0.9193953882637206)).toEqual(6371008.8);
});

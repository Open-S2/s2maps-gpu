import {
  angleE5,
  angleE6,
  angleE7,
  angleFromDegrees,
  angleFromKM,
  angleFromLonLat,
  angleFromMeters,
  angleFromS2Points,
  angleNormalize,
  angleToDegrees,
  angleToE5,
  angleToE6,
  angleToE7,
  angleToKM,
  angleToMeters,
} from '../../../../../s2/gis-tools/geometry/s1/angle';
import { expect, test } from 'bun:test';

import { pointFromLonLat } from '../../../../../s2/gis-tools/geometry/s2/point';

test('angleE5', () => {
  expect(angleE5(0)).toEqual(0);
  expect(angleE5(1)).toEqual(5729577.951308233);
  expect(angleE5(-1)).toEqual(-5729577.951308233);

  expect(angleE5(angleToE5(0))).toEqual(0);
});

test('angleE6', () => {
  expect(angleE6(0)).toEqual(0);
  expect(angleE6(1)).toEqual(57295779.513082325);
  expect(angleE6(-1)).toEqual(-57295779.513082325);
  expect(angleE6(angleToE6(0))).toEqual(0);
});

test('angleE7', () => {
  expect(angleE7(0)).toEqual(0);
  expect(angleE7(1)).toEqual(572957795.1308233);
  expect(angleE7(-1)).toEqual(-572957795.1308233);
  expect(angleE7(angleToE7(0))).toEqual(0);
});

test('angleFromDegrees', () => {
  expect(angleFromDegrees(0)).toEqual(0);
  expect(angleFromDegrees(1)).toEqual(0.017453292519943295);
  expect(angleFromDegrees(90)).toEqual(1.5707963267948966);
  expect(angleFromDegrees(180)).toEqual(3.141592653589793);
  expect(angleFromDegrees(360)).toEqual(6.283185307179586);
});

test('angleFromKM', () => {
  expect(angleFromKM(0)).toEqual(0);
  expect(angleFromKM(1)).toEqual(0.00015696101377226163);
  expect(angleFromKM(10)).toEqual(0.0015696101377226162);
  expect(angleFromKM(100)).toEqual(0.015696101377226164);
  expect(angleFromKM(1000)).toEqual(0.15696101377226163);
});

test('angleFromLonLat', () => {
  expect(angleFromLonLat({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual(0);
  expect(angleFromLonLat({ x: 1, y: 0 }, { x: 0, y: 0 })).toEqual(0.017453292519943295);
  expect(angleFromLonLat({ x: 90, y: 0 }, { x: 0, y: 0 })).toEqual(1.5707963267948963);
  expect(angleFromLonLat({ x: 45, y: 20 }, { x: 60, y: 40 })).toEqual(0.4148806056779849);
});

test('angleFromMeters', () => {
  expect(angleFromMeters(0)).toEqual(0);
  expect(angleFromMeters(1)).toEqual(1.5696101377226164e-7);
  expect(angleFromMeters(10)).toEqual(0.0000015696101377226163);
  expect(angleFromMeters(100)).toEqual(0.000015696101377226163);
  expect(angleFromMeters(1000)).toEqual(0.00015696101377226163);
});

test('angleFromS2Points', () => {
  expect(
    angleFromS2Points(pointFromLonLat({ x: 0, y: 0 }), pointFromLonLat({ x: 0, y: 0 })),
  ).toEqual(0);
  expect(
    angleFromS2Points(pointFromLonLat({ x: 1, y: 0 }), pointFromLonLat({ x: 0, y: 0 })),
  ).toEqual(0.017453292519943295);
  expect(
    angleFromS2Points(pointFromLonLat({ x: 90, y: 0 }), pointFromLonLat({ x: 0, y: 0 })),
  ).toEqual(1.5707963267948966);
  expect(
    angleFromS2Points(pointFromLonLat({ x: 45, y: 20 }), pointFromLonLat({ x: 60, y: 40 })),
  ).toEqual(0.41488060567798485);
});

test('angleNormalize', () => {
  expect(angleNormalize(0)).toEqual(0);
  expect(angleNormalize(angleFromDegrees(1))).toEqual(0.017453292519943295);
  expect(angleNormalize(angleFromDegrees(180))).toEqual(3.141592653589793);
  expect(angleNormalize(angleFromDegrees(360))).toEqual(0);
});

test('angleToDegrees', () => {
  expect(angleToDegrees(0)).toEqual(0);
  expect(angleToDegrees(0.017453292519943295)).toEqual(1);
  expect(angleToDegrees(1.5707963267948966)).toEqual(90);
  expect(angleToDegrees(3.141592653589793)).toEqual(180);
  expect(angleToDegrees(6.283185307179586)).toEqual(360);
});

test('angleToKM', () => {
  expect(angleToKM(0)).toEqual(0);
  expect(angleToKM(angleFromDegrees(180))).toEqual(20015.114442035923);
});

test('angleToMeters', () => {
  expect(angleToMeters(0)).toEqual(0);
  expect(angleToMeters(angleFromDegrees(180))).toEqual(20015114.442035925);
});

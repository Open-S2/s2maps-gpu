import { expect, test } from 'bun:test';
import {
  llFromS2Point,
  llGetBearing,
  llGetDistance,
  llNormalize,
  llToAngles,
  llToS2Point,
} from '../../../../../s2/gis-tools/geometry/ll';

test('llFromS2Point', () => {
  expect(llFromS2Point({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  expect(llFromS2Point({ x: 1, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  expect(llFromS2Point({ x: 0, y: 1, z: 0 })).toEqual({ x: 90, y: 0 });
  expect(llFromS2Point({ x: 0, y: 0, z: 1 })).toEqual({ x: 0, y: 90 });
});

test('llGetDistance', () => {
  expect(llGetDistance({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual(0);
  expect(llGetDistance({ x: 0.017453292519943295, y: 0 }, { x: 0, y: 0 })).toEqual(
    0.0003046174197867086,
  );
});

test('llNormalize', () => {
  expect(llNormalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  expect(llNormalize({ x: 0.01745329251994, y: 0.111111 })).toEqual({
    x: 0.01745329251991734,
    y: 0.111111,
  });
  expect(llNormalize({ x: 640, y: 100 })).toEqual({ x: -80, y: 90 });
  expect(llNormalize({ x: -640, y: -100 })).toEqual({ x: 80, y: -90 });
});

test('llToAngles', () => {
  expect(llToAngles({ x: 0, y: 0 })).toEqual([0, 0]);
  expect(llToAngles({ x: 0.017453292519943295, y: 0.111111 })).toEqual([
    0.0003046174197867086, 0.0019392527851834194,
  ]);
  expect(llToAngles({ x: 90, y: 180 })).toEqual([1.5707963267948966, 3.141592653589793]);
});

test('llToS2Point', () => {
  expect(llToS2Point({ x: 0, y: 0 })).toEqual({ x: 1, y: 0, z: 0 });
  expect(llToS2Point({ x: 90, y: 0 })).toEqual({ x: 6.123233995736766e-17, y: 1, z: 0 });
  expect(llToS2Point({ x: 0, y: 90 })).toEqual({ x: 6.123233995736766e-17, y: 0, z: 1 });
  expect(llToS2Point({ x: 0, y: 180 })).toEqual({ x: -1, y: -0, z: 1.2246467991473532e-16 });
});

test('llGetBearing', () => {
  expect(llGetBearing({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual(0);
  expect(llGetBearing({ x: 0, y: 0 }, { x: 90, y: 0 })).toEqual(90);
  expect(llGetBearing({ x: 0, y: 0 }, { x: 180, y: 0 })).toEqual(90);
  expect(llGetBearing({ x: 0, y: 0 }, { x: 0, y: 90 })).toEqual(0);
  expect(llGetBearing({ x: 0, y: 0 }, { x: -89.9, y: 0 })).toEqual(270);
  expect(llGetBearing({ x: 0, y: 0 }, { x: 0, y: -90 })).toEqual(180);
  expect(llGetBearing({ x: 0, y: 0 }, { x: -180, y: 0 })).toEqual(270);
  expect(llGetBearing({ x: -60, y: -40 }, { x: 20, y: 10 })).toEqual(75.936859467864);
});

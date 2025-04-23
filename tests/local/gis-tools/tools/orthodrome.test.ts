import { Orthodrome } from '../../../../s2/gis-tools';
import { expect, test } from 'bun:test';

test('orthodrome', () => {
  const orthodrome = new Orthodrome(0, 0, 0, 0);
  expect(orthodrome.a).toEqual(0);
  expect(orthodrome.dist).toEqual(0);
});

test('Orthodrome.fromPoints', () => {
  const orthodrome = Orthodrome.fromPoints({ x: 0, y: 0 }, { x: 0, y: 0 });
  expect(orthodrome.a).toEqual(0);
  expect(orthodrome.dist).toEqual(0);
});

test('intermediatePoints - same', () => {
  const orthodrome = new Orthodrome(0, 0, 0, 0);
  expect(orthodrome.intermediatePoint(0.5)).toEqual({ x: 0, y: 0 });
});

test('intermediatePoints - far', () => {
  const orthodrome = new Orthodrome(-60, -40, 20, 10);
  expect(orthodrome.intermediatePoint(0)).toEqual({ x: -59.99999999999999, y: -40 });
  expect(orthodrome.intermediatePoint(0.2)).toEqual({
    x: -39.13793657428956,
    y: -33.72852197561652,
  });
  expect(orthodrome.intermediatePoint(0.4)).toEqual({
    x: -21.69249756089563,
    y: -24.50037918247324,
  });
  expect(orthodrome.intermediatePoint(0.6)).toEqual({
    x: -6.830669211476937,
    y: -13.564157442008685,
  });
  expect(orthodrome.intermediatePoint(0.8)).toEqual({
    x: 6.673353815433632,
    y: -1.8320330896428327,
  });
  expect(orthodrome.intermediatePoint(1)).toEqual({ x: 20, y: 10 });
});

test('distanceTo - same', () => {
  const orthodrome = new Orthodrome(0, 0, 0, 0);
  expect(orthodrome.distanceTo()).toEqual(0);
});

test('distanceTo - far', () => {
  const orthodrome = new Orthodrome(-60, -40, 20, 10);
  expect(orthodrome.distanceTo()).toEqual(1.5514126949321814);
});

test('intermediatePoints - bearing', () => {
  const orthodrome = new Orthodrome(-60, -40, 20, 10);

  const bearing = orthodrome.bearing();

  expect(bearing).toEqual(75.936859467864);
});

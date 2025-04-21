import { colorParser } from 'style/color';
import { expect, test } from 'bun:test';

test('colorParser - color name', () => {
  expect(colorParser('red')).toEqual(['rgb', [255, 0, 0, 1]]);
});

test('colorParser - hex', () => {
  expect(colorParser('#ff0000')).toEqual(['rgb', [255, 0, 0, 1]]);
});

test('colorParser - partial hex', () => {
  expect(colorParser('#fff')).toEqual(['rgb', [255, 255, 255, 1]]);
});

test('colorParser - semi-partial hex', () => {
  expect(colorParser('#ffdd')).toEqual(['rgb', [255, 255, 221, 0.87]]);
});

test('colorParser - empty hex', () => {
  expect(colorParser('#f')).toEqual(['rgb', [0, 0, 0, 0]]);
});

test('colorParser - hex with alpha', () => {
  expect(colorParser('#ff0000dd')).toEqual(['rgb', [255, 0, 0, 0.87]]);
});

test('colorParser - rgb', () => {
  expect(colorParser('rgb(255, 0, 2)')).toEqual(['rgb', [255, 0, 2, 1]]);
});

test('colorParser - rgba', () => {
  expect(colorParser('rgba(255, 0, 2, 0.6)')).toEqual(['rgb', [255, 0, 2, 0.6]]);
});

test('colorParser - hsv', () => {
  expect(colorParser('hsv(180, 0.9, 0.7843137254901961)')).toEqual([
    'hsv',
    [180, 0.9, 0.7843137254901961, 1],
  ]);
});

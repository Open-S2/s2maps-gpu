import { Color, interpolate } from 'style/color';
import { expect, test } from 'bun:test';

test('Color', () => {
  const color = new Color(255, 0, 0, 1, 'rgb');
  expect(color.getRGB()).toEqual([1, 0, 0, 1]);
  expect(color.getRGB(false)).toEqual([255, 0, 0, 1]);

  expect(color.copy().getRGB()).toEqual([1, 0, 0, 1]);
  expect(color.getLCH()).toEqual([53.24079414130722, 104.55176567686985, 39.99901061253297, 1]);
  expect(color.toHSV().val).toEqual([0.00010218169421125718, 1, 0.9999999186620318, 1]);
  expect(color.toLCH().val).toEqual([53.24080010092155, 104.55173874726269, 39.99902253747467, 1]);

  const hslColor = new Color(45, 220, 115, 1, 'hsl');
  expect(hslColor.toRGB().val).toEqual([-6366075, -3168375, 6424725, 1]);
});

test('Color - colorblind adjusting', () => {
  const color = new Color(220, 60, 135, 1, 'rgb');

  expect(color.getRGB(false)).toEqual([220, 60, 135, 1]);
  expect(color.getRGB(false, 'deuteranopia')).toEqual([220, 92, 217, 1]);
  expect(color.getRGB(false, 'greyscale')).toEqual([116.25, 116.25, 116.25, 1]);
  expect(color.getRGB(false, 'protanopia')).toEqual([220, 141, 233, 1]);
  expect(color.getRGB(false, 'tritanopia')).toEqual([220, 37, 255, 1]);
});

test('Color - sinebow', () => {
  expect(Color.sinebow(0).val).toEqual([0, 0, 255, 1]);
  expect(Color.sinebow(0.25).val).toEqual([0, 212, 141, 1]);
  expect(Color.sinebow(0.5).val).toEqual([97, 235, 0, 1]);
  expect(Color.sinebow(0.75).val).toEqual([250, 49, 0, 1]);
  expect(Color.sinebow(1).val).toEqual([180, 0, 180, 1]);
});

test('Color - fadeToWhite', () => {
  expect(Color.fadeToWhite(0).val).toEqual([180, 0, 180, 1]);
  expect(Color.fadeToWhite(0.25).val).toEqual([198.75, 63.75, 198.75, 1]);
  expect(Color.fadeToWhite(0.5).val).toEqual([217.5, 127.5, 217.5, 1]);
  expect(Color.fadeToWhite(0.75).val).toEqual([236.25, 191.25, 236.25, 1]);
  expect(Color.fadeToWhite(1).val).toEqual([255, 255, 255, 1]);
});

test('Color - interpolate', () => {
  const colorA = new Color(255, 0, 0, 1, 'rgb');
  const colorB = new Color(0, 255, 0, 1, 'hsl');

  const interpolated = interpolate(colorA, colorB, 0.5);
  expect(interpolated.val).toEqual([255, 0, 0, 1]);
});

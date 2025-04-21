import { buildColorRamp, buildDashImage } from 'style/color';
import { expect, test } from 'bun:test';

test('buildColorRamp', () => {
  const length = 4 * 5 * 256;
  const halfLength = length / 2;
  const ramp = buildColorRamp('sinebow', true);
  expect(ramp.length).toEqual(length);
  expect(ramp.slice(halfLength, halfLength + 4)).toEqual(new Uint8ClampedArray([97, 207, 0, 255]));

  const ramp2 = buildColorRamp('sinebow-extended', true);
  expect(ramp2.length).toEqual(length);
  expect(ramp2.slice(halfLength, halfLength + 4)).toEqual(
    new Uint8ClampedArray([186, 56, 255, 255]),
  );

  const ramp3 = buildColorRamp(
    [
      { stop: 0, color: '#ff0000' },
      { stop: 0.5, color: '#00ff00' },
      { stop: 1, color: '#0000ff' },
    ],
    true,
  );
  expect(ramp3.length).toEqual(length);
  expect(ramp3.slice(0, 4)).toEqual(new Uint8ClampedArray([53, 105, 40, 255]));
  expect(ramp3.slice(halfLength, halfLength + 4)).toEqual(
    new Uint8ClampedArray([88, 120, 136, 255]),
  );
});

test('buildDashImage', () => {
  const dashImage = buildDashImage(
    [
      [1, '#ff0000'],
      [1, '#00ff00'],
      [1, '#0000ff'],
    ],
    1,
  );
  expect(dashImage.length).toEqual(256);
  expect(dashImage.dashCount).toEqual(3);
  expect(dashImage.image.length).toEqual(4 * 5 * 256);
  expect(dashImage.image.slice(0, 4)).toEqual(new Uint8ClampedArray([255, 0, 0, 255]));
});

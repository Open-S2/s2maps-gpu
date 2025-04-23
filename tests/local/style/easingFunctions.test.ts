import { Color } from 'style/color/index.js';
import getEasingFunction from 'style/easingFunctions.js';
import { expect, test } from 'bun:test';

test('getEasingFunction - linear', () => {
  const easingFunction = getEasingFunction<number>('lin', 1);
  expect(easingFunction(12, 0, 30, 0, 1)).toEqual(0.4);

  const easingFunction2 = getEasingFunction<number>('lin', 0);
  expect(easingFunction2(12, 0, 30, 0, 1)).toEqual(0.4);

  const easingFunction3 = getEasingFunction<number>('lin', 2);
  expect(easingFunction3(12, 0, 30, 0, 1)).toEqual(0.4);

  const colorA = new Color(255, 0, 0, 1, 'rgb');
  const colorB = new Color(0, 255, 0, 1, 'rgb');
  const easingFunction4 = getEasingFunction<Color>('lin', 1.5);
  expect(easingFunction4(12, 0, 30, colorA, colorB).getRGB()).toEqual([0.6, 0.4, 0, 1]);
});

test('getEasingFunction - step', () => {
  const easingFunction = getEasingFunction<number>('step', 1);
  expect(easingFunction(12, 0, 30, 0, 10)).toEqual(0);

  const easingFunction2 = getEasingFunction<number>('step', 0);
  expect(easingFunction2(12, 0, 30, 0, 10)).toEqual(0);

  const easingFunction3 = getEasingFunction<number>('step', 2);
  expect(easingFunction3(30, 0, 30, 0, 10)).toEqual(10);

  const colorA = new Color(255, 0, 0, 1, 'rgb');
  const colorB = new Color(0, 255, 0, 1, 'rgb');
  const easingFunction4 = getEasingFunction<Color>('step', 1.5);
  expect(easingFunction4(12, 0, 30, colorA, colorB).getRGB()).toEqual([1, 0, 0, 1]);
});

test('getEasingFunction - exponential', () => {
  const easingFunction = getEasingFunction<number>('expo', 1);
  expect(easingFunction(12, 0, 30, 0, 1)).toEqual(0.4);

  const easingFunction2 = getEasingFunction<number>('expo', 0);
  expect(easingFunction2(12, 0, 30, 0, 1)).toEqual(0.999999999999);

  const easingFunction3 = getEasingFunction<number>('expo', 2);
  expect(easingFunction3(12, 0, 30, 0, 1)).toEqual(0.000003813765946602231);

  const colorA = new Color(255, 0, 0, 1, 'rgb');
  const colorB = new Color(0, 255, 0, 1, 'rgb');
  const easingFunction4 = getEasingFunction<Color>('expo', 1.5);
  expect(easingFunction4(12, 0, 30, colorA, colorB).getRGB()).toEqual([
    0.9993285721088917, 0.0006714278911082897, 0, 1,
  ]);
});

test('getEasingFunction - quadratic', () => {
  const easingFunction = getEasingFunction<number>('quad', 1);
  expect(easingFunction(12, 0, 30, 0, 1)).toEqual(0.16);

  const easingFunction2 = getEasingFunction<number>('quad', 0);
  expect(easingFunction2(12, 0, 30, 0, 1)).toEqual(0.16);

  const easingFunction3 = getEasingFunction<number>('quad', 2);
  expect(easingFunction3(12, 0, 30, 0, 1)).toEqual(0.16);

  const colorA = new Color(255, 0, 0, 1, 'rgb');
  const colorB = new Color(0, 255, 0, 1, 'rgb');
  const easingFunction4 = getEasingFunction<Color>('quad', 1.5);
  expect(easingFunction4(12, 0, 30, colorA, colorB).getRGB()).toEqual([0.84, 0.16, 0, 1]);
});

test('getEasingFunction - cubic', () => {
  const easingFunction = getEasingFunction<number>('cubic', 1);
  expect(easingFunction(12, 0, 30, 0, 1)).toEqual(0.064);

  const easingFunction2 = getEasingFunction<number>('cubic', 0);
  expect(easingFunction2(12, 0, 30, 0, 1)).toEqual(0.064);

  const easingFunction3 = getEasingFunction<number>('cubic', 2);
  expect(easingFunction3(12, 0, 30, 0, 1)).toEqual(0.064);

  const colorA = new Color(255, 0, 0, 1, 'rgb');
  const colorB = new Color(0, 255, 0, 1, 'rgb');
  const easingFunction4 = getEasingFunction<Color>('cubic', 1.5);
  expect(easingFunction4(12, 0, 30, colorA, colorB).getRGB()).toEqual([0.936, 0.064, 0, 1]);
});

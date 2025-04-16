import Color, { interpolate } from './color/index.js';

/** Input ease types names */
export type EaseType = 'lin' | 'expo' | 'quad' | 'cubic' | 'step';
/** Ease function container */
export type EaseFunction<T> = (
  zoom: number,
  start: number,
  end: number,
  startValue: T,
  endValue: T,
) => T;

/**
 * Convert a string to a function that will return an interpolation
 * between two values or colors.
 * @param easeType - ease type
 * @param base - base value
 * @returns an easing function
 */
export default function getEasingFunction<T>(
  easeType: EaseType = 'lin',
  base = 1,
): EaseFunction<T> {
  const func =
    easeType === 'lin'
      ? linear
      : easeType === 'expo'
        ? exponential
        : easeType === 'quad'
          ? quad
          : easeType === 'cubic'
            ? cubic
            : step;
  return (zoom: number, start: number, end: number, startValue: T, endValue: T): T => {
    const t = func(zoom, start, end, base);

    if (typeof startValue === 'number' && typeof endValue === 'number')
      return (startValue + t * (endValue - startValue)) as T;
    else if (startValue instanceof Color && endValue instanceof Color)
      return interpolate(startValue, endValue, t) as T;
    else return startValue;
  };
}

/**
 * Linear ease function: y = mx
 * @param input - input value
 * @param start - start value
 * @param end - end value
 * @returns the interpolated value
 */
function linear(input: number, start: number, end: number): number {
  return (input - start) / (end - start);
}

/**
 * Exponential ease function: y = e^x OR y = Math.pow(2, 10 * x)
 * @param input - input value
 * @param start - start value
 * @param end - end value
 * @param base - base value
 * @returns the interpolated value
 */
function exponential(input: number, start: number, end: number, base: number): number {
  // grab change
  const diff = end - start;
  if (diff === 0) return 0;
  // refine base value
  if (base <= 0) base = 0.1;
  else if (base > 2) base = 2;
  // grab diff
  const progress = input - start;
  // linear case
  if (base === 1) return progress / diff;
  // solve
  return (Math.pow(base, progress) - 1) / (Math.pow(base, diff) - 1);
}

/**
 * Quadratic ease function: y = x^2
 * @param input - input value
 * @param start - start value
 * @param end - end value
 * @returns the interpolated value
 */
function quad(input: number, start: number, end: number): number {
  return Math.pow(input - start, 2) / Math.pow(end - start, 2);
}

/**
 * Cubic ease function: y = x^3
 * @param input - input value
 * @param start - start value
 * @param end - end value
 * @returns the interpolated value
 */
function cubic(input: number, start: number, end: number): number {
  return Math.pow(input - start, 3) / Math.pow(end - start, 3);
}

/**
 * Stepping ease function: y = 1 or 0
 * @param input - input value
 * @param _start - start value
 * @param end - end value
 * @returns the interpolated value
 */
function step(input: number, _start: number, end: number): number {
  return input > end ? 1 : 0;
}

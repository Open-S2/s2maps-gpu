import Color, { interpolate } from './color'
// these modules return a value between 0->1 via a start, end, and input
// obviously, the input must be between start and end inclusive: [start, end]

export type EaseType = 'lin' | 'expo' | 'quad' | 'cubic' | 'step'

export type EaseFunction = (zoom: number, start: number, end: number, startValue: number | Color, endValue: number | Color) => number | Color

export default function getEasingFunction (easeType: EaseType, base = 1): EaseFunction {
  const func = (easeType === 'lin')
    ? linear
    : (easeType === 'expo')
        ? exponential
        : (easeType === 'quad')
            ? quad
            : (easeType === 'cubic')
                ? cubic
                : step
  return (zoom: number, start: number, end: number, startValue: number | Color, endValue: number | Color): number | Color => {
    const t = func(zoom, start, end, base)

    if (typeof startValue === 'number' && typeof endValue === 'number') return startValue + t * (endValue - startValue)
    else if (startValue instanceof Color && endValue instanceof Color) return interpolate(startValue, endValue, t)
    else return startValue
  }
}

// y = mx
function linear (input: number, start: number, end: number): number {
  return (input - start) / (end - start)
}

// y = e^x OR y = Math.pow(2, 10 * x)
function exponential (input: number, start: number, end: number, base: number): number {
  // grab change
  const diff = end - start
  if (diff === 0) return 0
  // refine base value
  if (base <= 0) base = 0.1
  else if (base > 2) base = 2
  // grab diff
  const progress = input - start
  // linear case
  if (base === 1) return progress / diff
  // solve
  return (Math.pow(base, progress) - 1) / (Math.pow(base, diff) - 1)
}

// y = x^2
function quad (input: number, start: number, end: number): number {
  return Math.pow(input - start, 2) / Math.pow(end - start, 2)
}

// y = x^3
function cubic (input: number, start: number, end: number): number {
  return Math.pow(input - start, 3) / Math.pow(end - start, 3)
}

function step (input: number, _start: number, end: number): number {
  return (input > end) ? 1 : 0
}

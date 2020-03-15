// @flow
import Color from '../color'
// these modules return a value between 0->1 via a start, end, and input
// obviously, the input must be between start and end inclusive: [start, end]

export type EaseType = 'lin' | 'expo' | 'quad' | 'cubic'

export default function getEasingFunction (easeType: EaseType, base: number = 1): Function {
  const func = (easeType === 'lin')
    ? linear
    : (easeType === 'expo')
      ? exponential
      : (easeType === 'quad')
        ? quad
        : (easeType === 'cubic')
          ? cubic
          : step
  return (zoom, start, end, startValue, endValue) => {
    const t = func(zoom, start, end, base)
    if (isNaN(startValue)) { // we are dealing with colors
      if (startValue instanceof Color) return Color.interpolate(startValue, endValue, t)
      else return startValue // if for instance a string, just ignore the easing (same as a step function)
    } else { // perhaps line-width or some other number value; Given our t depth, convert to a new value
      return startValue + t * (endValue - startValue)
    }
  }
}

// y = mx
function linear (input: number, start: number, end: number) {
  return (input - start) / (end - start)
}

// y = e^x OR y = Math.pow(2, 10 * x)
function exponential (input: number, start: number, end: number, base: number = 1.5) {
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
function quad (input: number, start: number, end: number) {
  return Math.pow(input - start, 2) / Math.pow(end - start, 2)
}

// y = x^3
function cubic (input: number, start: number, end: number) {
  return Math.pow(input - start, 3) / Math.pow(end - start, 3)
}

function step (input: number, start: number, end: number) {
  return 0 // will default to start
}

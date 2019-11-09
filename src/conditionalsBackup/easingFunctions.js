// @flow
// these modules return a value between 0->1 via a start, end, and input
// obviously, the input must be between start and end inclusive: [start, end]

// y = mx
function linear (input, start, end) {
  const diff = input - start
  return diff / (end - start)
}

// y = e^x OR y = Math.pow(2, 10 * x)
function exponential (input, start, end, base = 1.5) {
  if (base <= 1) base = 1.1
  else if (base > 2) base = 2
  const diff = input - start
  if (diff === 0) return 0
  return Math.pow(base, diff) / Math.pow(base, (end - start))
}

// y = x^2
function quad (input, start, end) {
  const diff = input - start
  return Math.pow(diff, 2) / Math.pow(end - start, 2)
}

// y = x^3
function cubic (input, start, end) {
  const diff = input - start
  return Math.pow(diff, 3) / Math.pow(end - start, 3)
}

function step (input, start, end) {
  return 0 // will default to start
}

exports.default = {
  linear,
  exponential,
  quad,
  cubic,
  step
}

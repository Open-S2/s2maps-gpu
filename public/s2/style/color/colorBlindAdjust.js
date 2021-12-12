// @flow
// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js

import type Color from './color'

export type ColorBlindAdjust = 'protanopia' | 'deutranopia' | 'tritanopia'

const CVDTypes = {
  protanope: [ // reds are greatly reduced (1% men)
    0.0, 2.02344, -2.52581,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0
  ],
  deuteranope: [ // greens are greatly reduced (1% men)
    1.0, 0.0, 0.0,
    0.494207, 0.0, 1.24827,
    0.0, 0.0, 1.0
  ],
  tritanopia: [ // blues are greatly reduced (0.003% population)
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    -0.395913, 0.801109, 0.0
  ]
}

export default function colorBlindAdjust (color: Color, type: ColorBlindAdjust = 'tritanopia') {
  // setup adjuster
  const [
    cvdA, cvdB, cvdC,
    cvdD, cvdE, cvdF,
    cvdG, cvdH, cvdI
  ] = CVDTypes[type]
  // ensure we are using RGB and grab the values
  color.toRGB()
  const [r, g, b, a] = color.val
  // RGB to LMS matrix conversion
  const L = (17.8824 * r) + (43.5161 * g) + (4.11935 * b)
  const M = (3.45565 * r) + (27.1554 * g) + (3.86714 * b)
  const S = (0.0299566 * r) + (0.184309 * g) + (1.46709 * b)
  // Simulate color blindness
  const l = (cvdA * L) + (cvdB * M) + (cvdC * S)
  const m = (cvdD * L) + (cvdE * M) + (cvdF * S)
  const s = (cvdG * L) + (cvdH * M) + (cvdI * S)
  // LMS to RGB matrix conversion
  let R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s)
  let G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s)
  let B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s)
  // Isolate invisible colors to color vision deficiency (calculate error matrix)
  R = r - R
  G = g - G
  B = b - B
  // Shift colors towards visible spectrum (apply error modifications)
  const RR = (0.0 * R) + (0.0 * G) + (0.0 * B)
  const GG = (0.7 * R) + (1.0 * G) + (0.0 * B)
  const BB = (0.7 * R) + (0.0 * G) + (1.0 * B)
  // Add compensation to original values
  R = RR + r
  G = GG + g
  B = BB + b
  // Clamp values
  if (R < 0) R = 0
  if (R > 255) R = 255
  if (G < 0) G = 0
  if (G > 255) G = 255
  if (B < 0) B = 0
  if (B > 255) B = 255
  // Record color
  color.val = [R >> 0, G >> 0, B >> 0, a]
}

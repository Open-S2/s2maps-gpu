// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js
import type { ColorArray } from './index.js';

/** color vision deficiency types */
export interface CVDType {
  protanopia: [number, number, number, number, number, number, number, number, number];
  deuteranopia: [number, number, number, number, number, number, number, number, number];
  tritanopia: [number, number, number, number, number, number, number, number, number];
}

const CVD_TYPES: CVDType = {
  /** reds are greatly reduced (1% men) */
  protanopia: [0.0, 2.02344, -2.52581, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
  /** greens are greatly reduced (1% men) */
  deuteranopia: [1.0, 0.0, 0.0, 0.494207, 0.0, 1.24827, 0.0, 0.0, 1.0],
  /** blues are greatly reduced (0.003% population) */
  tritanopia: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, -0.395913, 0.801109, 0.0],
};

/** colorblindness names */
export type ColorBlindAdjust = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'greyscale';

/**
 * given an RGBA value, adjust the values to the appropriate colorbind equivalent.
 * @param color - input RGBA color
 * @param type - the type of colorblindness adjustment
 * @returns the adjusted color
 */
export function colorBlindAdjust(
  color: ColorArray,
  type: ColorBlindAdjust = 'tritanopia',
): ColorArray {
  // ensure we are using RGB and grab the values
  const [r, g, b, a] = color;
  // if greyscale just return the greyscale value
  if (type === 'greyscale') {
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    return [l, l, l, a];
  }
  // setup adjuster
  const [cvdA, cvdB, cvdC, cvdD, cvdE, cvdF, cvdG, cvdH, cvdI] = CVD_TYPES[type];
  // RGB to LMS matrix conversion
  const L = 17.8824 * r + 43.5161 * g + 4.11935 * b;
  const M = 3.45565 * r + 27.1554 * g + 3.86714 * b;
  const S = 0.0299566 * r + 0.184309 * g + 1.46709 * b;
  // Simulate color blindness
  const l = cvdA * L + cvdB * M + cvdC * S;
  const m = cvdD * L + cvdE * M + cvdF * S;
  const s = cvdG * L + cvdH * M + cvdI * S;
  // LMS to RGB matrix conversion
  let R: number = 0.0809444479 * l + -0.130504409 * m + 0.116721066 * s;
  let G: number = -0.0102485335 * l + 0.0540193266 * m + -0.113614708 * s;
  let B: number = -0.000365296938 * l + -0.00412161469 * m + 0.693511405 * s;
  // Isolate invisible colors to color vision deficiency (calculate error matrix)
  R = r - R;
  G = g - G;
  B = b - B;
  // Shift colors towards visible spectrum (apply error modifications)
  const RR: number = 0.0 * R + 0.0 * G + 0.0 * B;
  const GG: number = 0.7 * R + G + 0.0 * B;
  const BB = 0.7 * R + 0.0 * G + B;
  // Add compensation to original values
  R = RR + r;
  G = GG + g;
  B = BB + b;
  // Clamp values
  if (R < 0) R = 0;
  if (R > 255) R = 255;
  if (G < 0) G = 0;
  if (G > 255) G = 255;
  if (B < 0) B = 0;
  if (B > 255) B = 255;
  // Record color
  return [R >> 0, G >> 0, B >> 0, a];
}

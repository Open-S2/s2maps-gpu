import Color, { interpolate } from '.';

import type { ColorArray } from './';
import type { ColorBlindAdjust } from './colorBlindAdjust';

/**
 * Build a color ramp given a string defined ramp style or ramp guide
 * @param ramp - string defined ramp style or ramp guide
 * @param lch - whether or not to use lch
 * @returns Uint8ClampedArray
 */
export function buildColorRamp(
  ramp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number; color: string }>,
  lch = false,
): Uint8ClampedArray {
  const { round } = Math;
  // create ramp image
  // (4) RGBA * (5) height (base color, protanopia, deuteranopia, tritanopia, greyscale) * (255) width
  const rampImage = new Uint8ClampedArray(4 * 5 * 256);
  // prep colors
  let getColor;
  if (typeof ramp === 'string') {
    if (ramp === 'sinebow')
      /**
       * Bbuild a sinebow Color array from an input ramp position
       * @param i - ramp position
       * @param cbAdjust - colorblind adjustment
       * @returns Color as [r, g, b, a]
       */
      getColor = (i: number, cbAdjust?: ColorBlindAdjust): ColorArray =>
        Color.sinebow(i).getRGB(false, cbAdjust);
    else
      /**
       * Build a sinebow extended Color array from an input ramp position
       * @param i - ramp position
       * @param cbAdjust - colorblind adjustment
       * @returns Color as [r, g, b, a]
       */
      getColor = (i: number, cbAdjust?: ColorBlindAdjust): ColorArray =>
        Color.sinebowExtended(i).getRGB(false, cbAdjust);
  } else {
    const colorRamp: Color[] = [];
    const numberRamp: number[] = [];
    for (const { stop, color: c } of ramp) {
      numberRamp.push(stop);
      const color = new Color(c);
      colorRamp.push(lch ? color.toLCH() : color.toRGB());
    }
    /**
     * setup color output function
     * @param t - ramp position
     * @param cbAdjust - colorblind adjustment
     * @returns Color as [r, g, b, a]
     */
    getColor = (t: number, cbAdjust?: ColorBlindAdjust): ColorArray => {
      let i = 0;
      while (t > numberRamp[i]) i++;
      if (t === numberRamp[i])
        return lch ? colorRamp[i].getLCH() : colorRamp[i].getRGB(false, cbAdjust);
      return interpolate(
        colorRamp[i - 1],
        colorRamp[i],
        (t - numberRamp[i - 1]) / (numberRamp[i] - numberRamp[i - 1]),
      ).getRGB(false, cbAdjust);
    };
  }
  // build the ramp for base color and each colorblindness
  const rampMap: Array<undefined | ColorBlindAdjust> = [
    undefined,
    'protanopia',
    'deuteranopia',
    'tritanopia',
    'greyscale',
  ];
  for (let t = 0, tl = rampMap.length; t < tl; t++) {
    const type = rampMap[t];
    const offset = t * 256 * 4;
    for (let i = 0; i < 256; i++) {
      const [r, g, b, a] = getColor(i / 256, type);
      const idx = (i << 2) + offset;
      rampImage[idx] = round(r * a);
      rampImage[idx + 1] = round(g * a);
      rampImage[idx + 2] = round(b * a);
      rampImage[idx + 3] = round(a * 255);
    }
  }

  return rampImage;
}

/** An output for a dash image */
export interface DashImage {
  length: number;
  dashCount: number;
  image: Uint8ClampedArray;
}

/**
 * Build a dash image
 * @param dasharray - dash array
 * @param devicePixelRatio - device pixel ratio
 * @returns the dash image
 */
export function buildDashImage(
  dasharray: Array<[length: number, color: string]>,
  devicePixelRatio: number,
): DashImage {
  const { round } = Math;
  // RGBA * 5 height (base color, protanopia, deuteranopia, tritanopia, grayscale) * found width
  const dashCount = dasharray.reduce((total, current) => total + current[0] * devicePixelRatio, 0);
  // increase length to be divisible by 256
  const length = Math.ceil(dashCount / 256) * 256;
  const dashImage = new Uint8ClampedArray(4 * 5 * length);

  // convert all strings to colors
  const colorDashes: Array<[number, Color]> = dasharray.map(([size, str]) => [
    size * devicePixelRatio,
    new Color(str),
  ]);

  const rampMap: Array<undefined | ColorBlindAdjust> = [
    undefined,
    'protanopia',
    'deuteranopia',
    'tritanopia',
    'greyscale',
  ];
  for (let t = 0, tl = rampMap.length; t < tl; t++) {
    const type = rampMap[t];
    const offset = t * length * 4;
    let pos = 0;
    let dashPosition = 0;
    while (pos < length) {
      const [size, color] = colorDashes[dashPosition % colorDashes.length];
      const [r, g, b, a] = color.getRGB(false, type);
      for (let i = 0; i < size; i++) {
        const idx = (pos++ << 2) + offset;
        dashImage[idx] = round(r * a);
        dashImage[idx + 1] = round(g * a);
        dashImage[idx + 2] = round(b * a);
        dashImage[idx + 3] = round(a * 255);
      }
      dashPosition++;
    }
  }

  return {
    length,
    dashCount,
    image: dashImage,
  };
}

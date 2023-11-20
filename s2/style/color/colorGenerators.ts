import Color, { interpolate } from '.'

import type { ColorBlindAdjust } from './colorBlindAdjust'

export function buildColorRamp (
  ramp: 'sinebow' | 'sinebow-extended' | Array<{ stop: number, color: string }>,
  lch = false
): Uint8ClampedArray {
  const { round } = Math
  // create ramp image
  // RGBA * 4 height (base color, protanopia, deuteranopia, tritanopia) * 255 width
  const rampImage = new Uint8ClampedArray(4 * 4 * 256)
  // prep colors
  let getColor
  if (typeof ramp === 'string') {
    if (ramp === 'sinebow') getColor = (i: number, cbAdjust?: ColorBlindAdjust): [number, number, number, number] => Color.sinebow(i).getRGB(false, cbAdjust)
    else getColor = (i: number, cbAdjust?: ColorBlindAdjust): [number, number, number, number] => Color.sinebowExtended(i).getRGB(false, cbAdjust)
  } else {
    const colorRamp: Color[] = []
    const numberRamp: number[] = []
    for (const { stop, color: c } of ramp) {
      numberRamp.push(stop)
      const color = new Color(c)
      colorRamp.push(lch ? color.toLCH() : color.toRGB())
    }
    // setup color output function
    getColor = (t: number, cbAdjust?: ColorBlindAdjust): [number, number, number, number] => {
      let i = 0
      while (t > numberRamp[i]) i++
      if (t === numberRamp[i]) return lch ? colorRamp[i].getLCH() : colorRamp[i].getRGB(false, cbAdjust)
      return interpolate(colorRamp[i - 1], colorRamp[i], (t - numberRamp[i - 1]) / (numberRamp[i] - numberRamp[i - 1])).getRGB(false, cbAdjust)
    }
  }
  // build the ramp for base color and each colorblindness
  const rampMap: Array<undefined | ColorBlindAdjust> = [undefined, 'protanopia', 'deuteranopia', 'tritanopia', 'greyscale']
  for (let t = 0, tl = rampMap.length; t < tl; t++) {
    const type = rampMap[t]
    const offset = t * 256 * 4
    for (let i = 0; i < 256; i++) {
      const [r, g, b, a] = getColor(i / 256, type)
      const idx = (i << 2) + offset
      rampImage[idx] = round(r * a)
      rampImage[idx + 1] = round(g * a)
      rampImage[idx + 2] = round(b * a)
      rampImage[idx + 3] = round(a * 255)
    }
  }

  return rampImage
}

export function buildDashImage (
  dasharray: Array<[number, string]>
): { length: number, image: Uint8ClampedArray } {
  const { round } = Math
  // RGBA * 4 height (base color, protanopia, deuteranopia, tritanopia) * found width
  const length = dasharray.reduce((total, current) => total + current[0], 0)
  const dashImage = new Uint8ClampedArray(4 * 4 * length)

  // convert all strings to colors
  const colorDashes: Array<[number, Color]> = dasharray.map(([size, str]) => [size, new Color(str)])

  const rampMap: Array<undefined | ColorBlindAdjust> = [undefined, 'protanopia', 'deuteranopia', 'tritanopia']
  for (let t = 0, tl = rampMap.length; t < tl; t++) {
    const type = rampMap[t]
    const offset = t * length * 4
    let pos = 0
    for (const [size, color] of colorDashes) {
      for (let i = 0; i < size; i++) {
        const [r, g, b, a] = color.getRGB(false, type)
        const idx = (++pos << 2) + offset
        dashImage[idx] = round(r * a)
        dashImage[idx + 1] = round(g * a)
        dashImage[idx + 2] = round(b * a)
        dashImage[idx + 3] = round(a * 255)
      }
    }
  }

  return {
    length,
    image: dashImage
  }
}

// @flow
import Color from './color'

export default function buildColorRamp (ramp: string | Array<number | string>, lch?: boolean = false): Uint8ClampedArray {
  const { round } = Math
  // create ramp image
  const rampImage = new Uint8ClampedArray(4 * 1 * 256) // RGBA * 1 height * 255 width
  // prep colors
  let getColor
  if (typeof ramp === 'string') {
    if (ramp === 'sinebow') getColor = (i) => Color.sinebow(i).getRGB(false)
    else if (ramp === 'sinebow-extended') getColor = (i) => Color.sinebowExtended(i).getRGB(false)
  } else {
    for (let i = 0, rl = ramp.length; i < rl; i += 2) {
      const color = new Color(ramp[i + 1])
      ramp[i + 1] = lch ? color.toLCH() : color
    }
    // setup color output function
    getColor = (t: number): [number, number, number, number] => {
      let i = 0
      while (t > ramp[i]) i += 2
      if (t === ramp[i]) return ramp[i + 1].copy().getRGB(false)
      return Color.interpolate(ramp[i - 1], ramp[i + 1], (t - ramp[i - 2]) / (ramp[i] - ramp[i - 2])).getRGB(false)
    }
  }
  // build the ramp
  for (let i = 0; i < 256; i++) {
    const [r, g, b, a] = getColor(i / 256)
    const idx = i << 2
    rampImage[idx] = round(r * a)
    rampImage[idx + 1] = round(g * a)
    rampImage[idx + 2] = round(b * a)
    rampImage[idx + 3] = round(a * 255)
  }

  return rampImage
}

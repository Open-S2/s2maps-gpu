// @flow
import RGBA from 'color-rgba'

// for color interpolation, we should use the LCH color space
// https://www.alanzucconi.com/2016/01/06/colour-interpolation/4/
// use https://github.com/gka/chroma.js as a guide to create best interpolation
// for NOW let's use HSV for cheaper interpolation cost

// color is designed to parse varying inputs
export default class Color {
  r: number = 0
  g: number = 0
  b: number = 0
  a: number = 0
  constructor (color: null | string) {
    if (color) {
      const rgba = RGBA(color)
      this.r = rgba[0]
      this.g = rgba[1]
      this.b = rgba[2]
      this.a = rgba[3]
    }
  }

  getRGB () {
    return new Uint8Array([this.r, this.b, this.g, this.a])
  }

  toHSV () {
    const min_ = Math.min(this.r, this.g, this.b)
    const max_ = Math.max(this.r, this.g, this.b)
    const delta = max_ - min_
    let h, s, v
    v = max_ / 255.0
    if (max_ === 0) {
      h = Number.NaN
      s = 0
    } else {
      s = delta / max_
      if (this.r === max_) h = (this.g - this.b) / delta
      if (this.g === max_) h = 2 + (this.b - this.r) / delta
      if (this.b === max_) h = 4 + (this.r - this.g) / delta
      h *= 60
      if (h < 0) h += 360
    }
    return [h, s, v, this.a]
  }

  // take two hsv values and return an rgb Color
  static interpolate(color1: Color, color2: Color, t: number) {
    // prep variables
    let sat, hue, lbv, dh
    [hue0, sat0, lbv0, alpha0] = color1.toHSV()
    [hue1, sat1, lbv1, alpha1] = color2.toHSV()
    // first manage hue
    if (!isNaN(hue0) && !isNaN(hue1)) {
      if (hue1 > hue0 && hue1 - hue0 > 180) dh = hue1 - (hue0 + 360)
      else if (hue1 < hue0 && hue0 - hue1 > 180) dh = hue1 + 360 - hue0
      else dh = hue1 - hue0
      const hue = hue0 + t * dh
    } else if (!isNaN(hue0)) {
      hue = hue0
      if (lbv1 == 1 || lbv1 == 0) sat = sat0
    } else if (!isNaN(hue1)) {
      hue = hue1
      if (lbv0 == 1 || lbv0 == 0) sat = sat1
    } else {
      hue = null
    }
    // saturation
    if (!sat) sat = sat0 + t * (sat1 - sat0)
    // luminosity
    lbv = lbv0 + t * (lbv1 - lbv0)
    // alpha
    alpha = alpha0 + t * (alpha1 - alpha0)

    return fromHSV(hue, sat, lbv, alpha)
  }

  static fromHSV (h: number = 0, s: number = 0, v: number = 1, a: number = 1) {
    const color = new Color()
    let r, g, b
    v *= 255
    if (s === 0) {
      r = g = b = v
    } else {
      if (h === 360) h = 0
      if (h > 360) h -= 360
      if (h < 0) h += 360
      h /= 60

      const i = Math.floor(h)
      const f = h - i
      const p = v * (1 - s)
      const q = v * (1 - s * f)
      const t = v * (1 - s * (1 - f))

      switch (i) {
        case 0: [r, g, b] = [v, t, p]; break
        case 1: [r, g, b] = [q, v, p]; break
        case 2: [r, g, b] = [p, v, t]; break
        case 3: [r, g, b] = [p, q, v]; break
        case 4: [r, g, b] = [t, p, v]; break
        case 5: [r, g, b] = [v, p, q]; break
      }
    }

    color.r = r
    color.g = g
    color.b = b
    color.a = a
  }
}

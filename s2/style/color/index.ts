import colorBlindAdjust from './colorBlindAdjust'
import colorParser from './colorParser'

import type { ColorBlindAdjust } from './colorBlindAdjust'

export * from './colorGenerators'

export type ColorArray = [r: number, g: number, b: number, a: number]

/**
 * Color class to handle color conversions and adjustments. Supports RGB, HSV, HSL, and LCH.
 * COLOR INTERPOLATION: we support the use of the LCH color space
 * [interpolation guide here.](https://www.alanzucconi.com/2016/01/06/colour-interpolation/4/)
 * use [chroma.js](https://github.com/gka/chroma.js) as a guide to create best interpolation
 * hsv is a good secondary. Saved for posterity.
 * MORE INFORMATION ON COLOR BLIND ADJUST:
 * [link one](https://www.nature.com/articles/nmeth.1618),
 *  [link two](http://www.daltonize.org/),
 *  and [ink three](https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js)
 */
export default class Color {
  val: ColorArray
  type = 'rgb'
  constructor (x: number | string | Color = 0, y = 0, z = 0, a = 1, type = 'rgb') {
    if (x instanceof Color) {
      this.val = x.val
      this.type = x.type
    } else if (typeof x === 'string') {
      const [type, val] = colorParser(x)
      this.type = type
      this.val = val
    } else { // x is a number
      this.val = [x, y, z, a]
      this.type = type
    }
  }

  copy (): Color {
    return new Color(...this.val, this.type)
  }

  getRGB (normalize = true, cbAdjust?: ColorBlindAdjust): ColorArray {
    this.toRGB()
    const color = (cbAdjust !== undefined) ? colorBlindAdjust(this.val, cbAdjust) : this.val.map(n => n)
    return (normalize ? color.map((n, i) => i < 3 ? n / 255 : n) : color) as ColorArray
  }

  getLCH (): ColorArray {
    // now convert to lch
    this.toLCH()

    return this.val
  }

  toRGB (): this {
    if (this.type === 'rgb') return this
    // potentially swing back
    if (this.type === 'hsv') this.HSV2RGB()
    // lch goes to midpoint lab
    if (this.type === 'lch') this.LCH2LAB()
    // lab goes straight to rgb
    if (this.type === 'lab') this.LAB2RGB()
    // hsl goes straight to rgb
    if (this.type === 'hsl') this.HSL2RGB()

    return this
  }

  toHSV (): this {
    if (this.type === 'hsv') return this
    // potentially swing back
    if (this.type === 'lch') this.LCH2LAB()
    if (this.type === 'lab') this.LAB2RGB()
    // now ready for convert
    if (this.type === 'rgb') this.RGB2HSV()

    return this
  }

  toLCH (): this {
    if (this.type === 'lch') return this
    // if outside variables, bring them back to a starting point
    if (this.type === 'hsv') this.HSV2RGB()
    // step 1: rgb to lab
    if (this.type === 'rgb') this.RGB2LAB()
    // step 2: lab to lch
    if (this.type === 'lab') this.LAB2LCH()

    return this
  }

  RGB2LAB (): void {
    this.type = 'lab'
    const [r, g, b, a] = this.val
    const [x, y, z] = rgb2xyz(r, g, b)
    const l = 116 * y - 16
    this.val = [l < 0 ? 0 : l, 500 * (x - y), 200 * (y - z), a]
  }

  LAB2LCH (): void {
    this.type = 'lch'
    const [l, a, b, alpha] = this.val
    const c = Math.sqrt(a * a + b * b)
    let h = (Math.atan2(b, a) * (180 / Math.PI) + 360) % 360
    if (Math.round(c * 10000) === 0) h = 0
    this.val = [l, c, h, alpha]
  }

  LCH2LAB (): void {
    this.type = 'lab'
    let [l, c, h, alpha] = this.val
    h = h * (Math.PI / 180)
    this.val = [l, Math.cos(h) * c, Math.sin(h) * c, alpha]
  }

  LAB2RGB (): void {
    this.type = 'rgb'
    const [l, a, b, alpha] = this.val
    let x: number, y: number, z: number, r: number, g: number, b_: number
    // prep move to xyz
    y = (l + 16) / 116
    x = isNaN(a) ? y : y + a / 500
    z = isNaN(b) ? y : y - b / 200
    // solve x, y, z
    y = 1 * labXyz(y)
    x = 0.950470 * labXyz(x)
    z = 1.088830 * labXyz(z)
    // xyz to rgb
    r = xyzRgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z)
    g = xyzRgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z)
    b_ = xyzRgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z)
    // clip space from 0 to 255
    if (r < 0) r = 0
    else if (r > 255) r = 255
    if (g < 0) g = 0
    else if (g > 255) g = 255
    if (b_ < 0) b_ = 0
    else if (b_ > 255) b_ = 255
    // set new value
    this.val = [r, g, b_, alpha]
  }

  RGB2HSV (): void {
    this.type = 'hsv'
    const [r, g, b, a] = this.val
    const min = Math.min(r, g, b)
    const max = Math.max(r, g, b)
    const delta = max - min
    let h, s
    const v = max / 255.0
    if (max === 0) {
      h = 0
      s = 0
    } else {
      s = delta / max
      if (delta === 0) {
        h = 0
      } else {
        if (r === max) h = (g - b) / delta
        if (g === max) h = 2 + (b - r) / delta
        if (b === max) h = 4 + (r - g) / delta
        if (h === undefined) h = 0
        h *= 60
        if (h < 0) h += 360
      }
    }
    this.val = [h, s, v, a]
  }

  HSV2RGB (): void {
    this.type = 'rgb'
    let [h, s, v, a] = this.val
    v *= 255
    if (s === 0) {
      this.val = [v, v, v, a]
    } else {
      if (h === 360) h = 0
      else if (h > 360) h -= 360
      else if (h < 0) h += 360
      h /= 60

      const i = Math.floor(h)
      const f = h - i
      const p = v * (1 - s)
      const q = v * (1 - s * f)
      const t = v * (1 - s * (1 - f))

      switch (i) {
        case 0: this.val = [v, t, p, a]; break
        case 1: this.val = [q, v, p, a]; break
        case 2: this.val = [p, v, t, a]; break
        case 3: this.val = [p, q, v, a]; break
        case 4: this.val = [t, p, v, a]; break
        case 5: this.val = [v, p, q, a]; break
        default: this.val = [v, t, p, a]; break
      }
    }
  }

  HSL2RGB (): void {
    const { round } = Math
    this.type = 'rgb'
    const [h, s, l, a] = this.val
    let r, g, b
    if (s === undefined) {
      r = g = b = l * 255
    } else {
      const t3 = [0, 0, 0]
      const c = [0, 0, 0]
      const t2 = l < 0.5 ? l * (1 + s) : l + s - l * s
      const t1 = 2 * l - t2
      const h_ = h / 360
      t3[0] = h_ + 1 / 3
      t3[1] = h_
      t3[2] = h_ - 1 / 3
      for (let i = 0; i < 3; i++) {
        if (t3[i] < 0) t3[i] += 1
        if (t3[i] > 1) t3[i] -= 1
        if (6 * t3[i] < 1) c[i] = t1 + (t2 - t1) * 6 * t3[i]
        else if (2 * t3[i] < 1) c[i] = t2
        else if (3 * t3[i] < 2) c[i] = t1 + (t2 - t1) * ((2 / 3) - t3[i]) * 6
        else c[i] = t1
      }
      r = round(c[0] * 255)
      g = round(c[1] * 255)
      b = round(c[2] * 255)
    }
    this.val = [r, g, b, a]
  }

  static sinebow (t: number): Color {
    const { sin, cos, floor, max, PI } = Math
    let rad = t * (2 * PI) * (5 / 6)
    rad *= 0.75 // increase frequency to 2/3 cycle per rad

    const s = sin(rad)
    const c = cos(rad)
    const r = floor(max(0, -c) * 255)
    const g = floor(max(s, 0) * 255)
    const b = floor(max(c, 0, -s) * 255)
    return new Color(r, g, b, 1, 'rgb')
  }

  static fadeToWhite (t: number): Color {
    return interpolate(
      this.sinebow(1),
      new Color(255, 255, 255, 1, 'rgb'),
      t
    )
  }

  static sinebowExtended (t: number): Color {
    return t <= 0.45
      ? this.sinebow(t / 0.45)
      : this.fadeToWhite((t - 0.45) / (1 - 0.45))
  }
}

// everything below this was taken from chroma.js
function rgbXyz (r: number): number {
  if ((r /= 255) <= 0.04045) return r / 12.92
  return Math.pow((r + 0.055) / 1.055, 2.4)
}

function xyzLab (t: number): number {
  if (t > 0.008856452) return Math.pow(t, 1 / 3)
  return t / 0.12841855 + 0.137931034
}

function xyzRgb (r: number): number {
  return 255 * (r <= 0.00304 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055)
}

function labXyz (t: number): number {
  return t > 0.206896552 ? t * t * t : 0.12841855 * (t - 0.137931034)
}

function rgb2xyz (r: number, g: number, b: number): [r: number, g: number, b: number] {
  r = rgbXyz(r)
  g = rgbXyz(g)
  b = rgbXyz(b)
  const x = xyzLab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.950470)
  const y = xyzLab((0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1)
  const z = xyzLab((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.088830)
  return [x, y, z]
}

/**
 * Given two colors, interpolate between them using a t value between 0 and 1.
 * 0 returns color1, 1 returns color2, and anything in between returns a mixture.
 */
export function interpolate (color1: Color, color2: Color, t: number): Color {
  if (color1.type !== color2.type) return new Color(color1.val[0], color1.val[1], color1.val[2], color1.val[3], color1.type)
  if (color1.type === 'rgb') {
    const [r1, g1, b1, a1] = color1.val
    const [r2, g2, b2, a2] = color2.val
    const r = r1 + (r2 - r1) * t
    const g = g1 + (g2 - g1) * t
    const b = b1 + (b2 - b1) * t
    const a = a1 + (a2 - a1) * t
    return new Color(r, g, b, a, 'rgb')
  }
  // prep variables
  let sat: number | undefined, hue: number, dh: number
  const [hue0, sat0, lbv0, alpha0] = color1.val
  const [hue1, sat1, lbv1, alpha1] = color2.val
  // first manage hue
  if (!isNaN(hue0) && !isNaN(hue1)) {
    if (hue1 > hue0 && hue1 - hue0 > 180) dh = hue1 - (hue0 + 360)
    else if (hue1 < hue0 && hue0 - hue1 > 180) dh = hue1 + 360 - hue0
    else dh = hue1 - hue0
    hue = hue0 + t * dh
  } else if (!isNaN(hue0)) {
    hue = hue0
    if (lbv1 === 1 || lbv1 === 0) sat = sat0
  } else if (!isNaN(hue1)) {
    hue = hue1
    if (lbv0 === 1 || lbv0 === 0) sat = sat1
  } else {
    hue = 0
  }
  // saturation
  if (sat === undefined) sat = sat0 + t * (sat1 - sat0)
  // luminosity
  const lbv = lbv0 + t * (lbv1 - lbv0)
  // alpha
  const alpha = alpha0 + t * (alpha1 - alpha0)
  // create the new color
  return new Color(hue, sat, lbv, alpha, color1.type)
}

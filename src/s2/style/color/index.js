// @flow
import colorParser from './colorParser'
import colorBlindAdjust from './colorBlindAdjust'

// for color interpolation, we should use the LCH color space
// https://www.alanzucconi.com/2016/01/06/colour-interpolation/4/
// use https://github.com/gka/chroma.js as a guide to create best interpolation
// hsv is a good secondary. Saved for posterity.

// color is designed to parse varying inputs
export default class Color {
  val: [number, number, number, number] = [0, 0, 0, 0]
  type: string = 'rgb'
  constructor (x: number, y: number, z: number, a: number, type: string) {
    if (typeof x === 'string') {
      const [type, val] = colorParser(x)
      this.type = type
      this.val = val
    } else if (!isNaN(x) && type) {
      this.val = [x, y, z, a]
      this.type = type
    }
  }

  getRGB (colorBlind: boolean = false, normalize: boolean = true): [number, number, number, number] {
    if (colorBlind) colorBlindAdjust(this)
    else this.toRGB()
    if (normalize) return [this.val[0] / 255, this.val[1] / 255, this.val[2] / 255, this.val[3]]
    return this.val
  }

  getLCH (colorBlind: boolean = false): [number, number, number, number] {
    // must be RGB to convert
    if (colorBlind) colorBlindAdjust(this)
    // now convert to lch
    this.toLCH()

    return this.val
  }

  toHSV (): Color {
    if (this.type === 'hsv') return this
    // potentially swing back
    if (this.type === 'lch') this.LCH2LAB()
    if (this.type === 'lab') this.LAB2RGB()
    // now ready for convert
    if (this.type === 'rgb') this.RGB2HSV()

    return this
  }

  toRGB (): Color {
    if (this.type === 'rgb') return this
    // potentially swing back
    if (this.type === 'hsv') this.HSV2RGB()
    // lch goes to midpoint lab
    if (this.type === 'lch') this.LCH2LAB()
    // lab goes straight to rgb
    if (this.type === 'lab') this.LAB2RGB()

    return this
  }

  toLCH (): Color {
    if (this.type === 'lch') return this
    // if outside variables, bring them back to a starting point
    if (this.type === 'hsv') this.HSV2RGB()
    // step 1: rgb to lab
    if (this.type === 'rgb') this.RGB2LAB()
    // step 2: lab to lch
    if (this.type === 'lab') this.LAB2LCH()

    return this
  }

  RGB2LAB () {
    const [r, g, b, a] = this.val
    const [x, y, z] = rgb2xyz(r, g, b)
    const l = 116 * y - 16
    this.val = [l < 0 ? 0 : l, 500 * (x - y), 200 * (y - z), a]
    this.type = 'lab'
  }

  LAB2LCH () {
    const [l, a, b, alpha] = this.val
    const c = Math.sqrt(a * a + b * b)
    let h = (Math.atan2(b, a) * (180 / Math.PI) + 360) % 360
    if (Math.round(c * 10000) === 0) h = 0
    this.val = [l, c, h, alpha]
    this.type = 'lch'
  }

  LCH2LAB () {
    let [l, c, h, alpha] = this.val
    h = h * (Math.PI / 180)
    this.val = [l, Math.cos(h) * c, Math.sin(h) * c, alpha]
    this.type = 'lab'
  }

  LAB2RGB () {
    const [l, a, b, alpha] = this.val
    let x, y, z, r, g, b_
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
    this.type = 'rgb'
  }

  RGB2HSV () {
    const [r, g, b, a] = this.val
    const min = Math.min(r, g, b)
    const max = Math.max(r, g, b)
    const delta = max - min
    let h, s, v
    v = max / 255.0
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
        if (!h) h = 0
        h *= 60
        if (h < 0) h += 360
      }
    }
    this.val = [h, s, v, a]
    this.type = 'hsv'
  }

  HSV2RGB () {
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
    this.type = 'rgb'
  }

  // take two hsv OR  values and return an rgb Color
  static interpolate (color1: Color, color2: Color, t: number): Color {
    if (color1.type !== color2.type) return new Color(color1.val[0], color1.val[1], color1.val[2], color1.val[3], color1.type)
    // prep variables
    let sat, hue, lbv, dh, alpha
    let [hue0, sat0, lbv0, alpha0] = color1.val
    let [hue1, sat1, lbv1, alpha1] = color2.val
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
    if (!sat) sat = sat0 + t * (sat1 - sat0)
    // luminosity
    lbv = lbv0 + t * (lbv1 - lbv0)
    // alpha
    alpha = alpha0 + t * (alpha1 - alpha0)
    // create the new color
    return new Color(hue, sat, lbv, alpha, color1.type)
  }
}

// everything below this was taken from chroma.js
const rgbXyz = (r) => {
  if ((r /= 255) <= 0.04045) return r / 12.92
  return Math.pow((r + 0.055) / 1.055, 2.4)
}

const xyzLab = (t) => {
  if (t > 0.008856452) return Math.pow(t, 1 / 3)
  return t / 0.12841855 + 0.137931034
}

const xyzRgb = (r) => {
  return 255 * (r <= 0.00304 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055)
}

const labXyz = (t) => {
  return t > 0.206896552 ? t * t * t : 0.12841855 * (t - 0.137931034)
}

const rgb2xyz = (r, g, b) => {
  r = rgbXyz(r)
  g = rgbXyz(g)
  b = rgbXyz(b)
  const x = xyzLab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.950470)
  const y = xyzLab((0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1)
  const z = xyzLab((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.088830)
  return [x, y, z]
}

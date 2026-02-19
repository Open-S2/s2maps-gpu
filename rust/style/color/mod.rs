/// adjustment for RGBA for colorblindness
pub mod color_blind_adjust;
/// Color Generator (Color Ramps, Gradients, etc.)
pub mod color_generators;
/// Parse colors from hex, names, or color-strings
pub mod color_parser;

use alloc::{format, string::String};
use bytemuck::{Pod, Zeroable};
pub use color_blind_adjust::*;
pub use color_generators::*;
pub use color_parser::*;
use core::f64::consts::PI;
use libm::{atan2, cos, floor, pow, round, sin, sqrt};
use serde::{Deserialize, Serialize};

/// ColorArray - [r, g, b, a]
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ColorArray(pub f64, pub f64, pub f64, pub f64);
impl From<ColorArray> for u32 {
    fn from(color: ColorArray) -> u32 {
        let ColorArray(r, g, b, _) = color;
        ((r * 255.0) as u32) << 16 | ((g * 255.0) as u32) << 8 | (b * 255.0) as u32
    }
}
impl From<(u8, u8, u8, u8)> for ColorArray {
    fn from(color: (u8, u8, u8, u8)) -> ColorArray {
        ColorArray(
            color.0 as f64 / 255.0,
            color.1 as f64 / 255.0,
            color.2 as f64 / 255.0,
            color.3 as f64 / 255.0,
        )
    }
}
impl From<u32> for ColorArray {
    /// Create a ColorArray from u32
    fn from(color: u32) -> ColorArray {
        ColorArray(
            (color & 0xFF) as f64,
            ((color >> 8) & 0xFF) as f64,
            ((color >> 16) & 0xFF) as f64,
            0.0,
        )
    }
}
impl From<ColorArray> for Vec<f32> {
    fn from(color: ColorArray) -> Vec<f32> {
        vec![color.0 as f32, color.1 as f32, color.2 as f32, color.3 as f32]
    }
}
impl ColorArray {
    /// Convert to an ID
    pub fn to_id(&self) -> u32 {
        (*self).into()
    }
    /// Convert from an ID
    pub fn from_id(id: u32) -> ColorArray {
        id.into()
    }
    /// Convert to a ColorArrayF32
    pub fn to_gpu(&self) -> ColorArrayF32 {
        ColorArrayF32::from(*self)
    }
}

/// ColorArray for the GPU - [r, g, b, a]
#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize, Pod, Zeroable)]
pub struct ColorArrayF32(pub f32, pub f32, pub f32, pub f32);
impl From<ColorArray> for ColorArrayF32 {
    fn from(color: ColorArray) -> ColorArrayF32 {
        ColorArrayF32(color.0 as f32, color.1 as f32, color.2 as f32, color.3 as f32)
    }
}

/// Color Type
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ColorType {
    /// RGB
    #[serde(rename = "rgb")]
    #[default]
    RGB,
    /// HSV
    #[serde(rename = "hsv")]
    HSV,
    /// HSL
    #[serde(rename = "hsl")]
    HSL,
    /// LCH
    #[serde(rename = "lch")]
    LCH,
    /// LAB
    #[serde(rename = "lab")]
    LAB,
}
impl From<&str> for ColorType {
    fn from(value: &str) -> Self {
        match value {
            "hsv" => ColorType::HSV,
            "hsl" => ColorType::HSL,
            "lch" => ColorType::LCH,
            "lab" => ColorType::LAB,
            _ => ColorType::RGB,
        }
    }
}

/**
 * # Color manager
 *
 * ### Description
 * Color class to handle color conversions, adjustments, and interpolations.
 *
 * Supports RGB, HSV, HSL, LAB, and LCH (along with their Alpha variants e.g. RGBA, HSVA, ...).
 *
 * ### Example Usage
 *
 * ex. name string
 * ```ts
 * let color = new Color('red');
 * let rgb = color.getRGB();
 * ```
 *
 * ex. Hex string
 * ```ts
 * let color = new Color('#ff0000');
 * let rgb = color.getRGB();
 * ```
 *
 * ex. String input array
 * ```ts
 * let color = new Color('hsv(180, 0.9, 0.7843137254901961)');
 * let rgb = color.getRGB();
 * ```
 *
 * ex. RGBA array
 * ```ts
 * let color = new Color(255, 0, 0, 1, 'rgb');
 * let rgb = color.getRGB();
 * ```
 *
 * ### COLOR INTERPOLATION: we support the use of the LCH color space:
 * - [interpolation guide here.](https://www.alanzucconi.com/2016/01/06/colour-interpolation/4/)
 * - use [chroma.js](https://github.com/gka/chroma.js) as a guide to create best interpolation
 * hsv is a good secondary. Saved for posterity.
 *
 * ### MORE INFORMATION ON COLOR BLIND ADJUST:
 * - [Link one](https://www.nature.com/articles/nmeth.1618),
 * - [Link two](http://www.daltonize.org/),
 * - [Link three](https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js)
 */
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Color {
    val: ColorArray,
    r#type: ColorType,
}
impl From<&String> for Color {
    fn from(value: &String) -> Self {
        let (r#type, val) = color_parser(value);
        Color { val, r#type }
    }
}
impl From<&str> for Color {
    fn from(value: &str) -> Self {
        let (r#type, val) = color_parser(value);
        Color { val, r#type }
    }
}
impl From<Color> for String {
    fn from(mut value: Color) -> Self {
        value.to_rgb();
        let ColorArray(r, g, b, a) = value.val;
        let r = round(r).clamp(0.0, 255.0) as u8;
        let g = round(g).clamp(0.0, 255.0) as u8;
        let b = round(b).clamp(0.0, 255.0) as u8;
        let a = round(a * 255.0).clamp(0.0, 255.0) as u8;

        if a < 255 {
            format!("#{:02X}{:02X}{:02X}{:02X}", r, g, b, a)
        } else {
            format!("#{:02X}{:02X}{:02X}", r, g, b)
        }
    }
}
impl Color {
    /**
     * @param x - either an input color, string defining a color, or first color value
     * @param y - second color value
     * @param z - third color value
     * @param a - alpha value
     * @param type - color type
     */
    pub fn new(r: f64, g: f64, b: f64, a: f64, r#type: ColorType) -> Self {
        Color { val: ColorArray(r, g, b, a), r#type: r#type }
    }

    /**
     * Get a sinebow color via interpolation input value
     * @param t - input value
     * @returns sinebow color at t
     */
    pub fn sinebow(t: f64) -> Color {
        let mut rad = t * (2. * PI) * (5. / 6.);
        rad *= 0.75; // increase frequency to 2/3 cycle per rad

        let s = sin(rad);
        let c = cos(rad);
        let r = floor(f64::max(0., -c) * 255.);
        let g = floor(f64::max(s, 0.) * 255.);
        let b = floor(f64::max(f64::max(c, 0.), -s) * 255.);
        Color::new(r, g, b, 1., ColorType::RGB)
    }

    /**
     * Get a white color via interpolation
     * @param t - input value
     * @returns white color at t
     */
    pub fn fade_to_white(t: f64) -> Color {
        Color::interpolate(
            t,
            &Color::sinebow(1.),
            &Color::new(255., 255., 255., 1., ColorType::RGB),
        )
    }

    /**
     * Get a sinebow extended color via interpolation
     * @param t - input value
     * @returns sinebow extended color at t
     */
    pub fn sinebow_extended(t: f64) -> Color {
        if t <= 0.45 {
            Color::sinebow(t / 0.45)
        } else {
            Color::fade_to_white((t - 0.45) / (1. - 0.45))
        }
    }

    /**
     * Get the rgb values of the color
     * @param normalize - whether to normalize the values
     * @param cb_adjust - colorblind adjustment
     * @returns Color as [r, g, b, a]
     */
    pub fn get_rgb(
        &mut self,
        normalize: Option<bool>,
        cb_adjust: Option<ColorBlindAdjust>,
    ) -> ColorArray {
        let normalize = normalize.unwrap_or(true);
        self.to_rgb();
        let mut color = if let Some(cb_adjust) = cb_adjust {
            color_blind_adjust(self.val, cb_adjust)
        } else {
            self.val
        };
        if normalize {
            color.0 /= 255.;
            color.1 /= 255.;
            color.2 /= 255.;
        }

        color
    }

    /** @returns the lch values of the color */
    pub fn get_lch(&mut self) -> ColorArray {
        // now convert to lch
        self.to_lch();

        self.val
    }

    /** @returns the rgb values of the color */
    pub fn to_rgb(&mut self) {
        if self.r#type == ColorType::RGB {
            return;
        }
        // potentially swing back
        if self.r#type == ColorType::HSV {
            self.hsv2rgb();
        }
        // lch goes to midpoint lab
        if self.r#type == ColorType::LCH {
            self.lch2lab();
        }
        // lab goes straight to rgb
        if self.r#type == ColorType::LAB {
            self.lab2rgb();
        }
        // hsl goes straight to rgb
        if self.r#type == ColorType::HSL {
            self.hsl2rgb();
        }
    }

    /// @returns the hsv values of the color */
    pub fn to_hsv(&mut self) {
        if self.r#type == ColorType::HSV {
            return;
        }
        // potentially swing back
        if self.r#type == ColorType::LCH {
            self.lch2lab();
        }
        if self.r#type == ColorType::LAB {
            self.lab2rgb();
        }
        // now ready for convert
        if self.r#type == ColorType::RGB {
            self.rgb2hsv();
        }
    }

    /// Mutate the color in place to lch
    pub fn to_lch(&mut self) {
        if self.r#type == ColorType::LCH {
            return;
        }
        // if outside variables, bring them back to a starting point
        if self.r#type == ColorType::HSV {
            self.hsv2rgb();
        }
        // step 1: rgb to lab
        if self.r#type == ColorType::RGB {
            self.rgb2lab();
        }
        // step 2: lab to lch
        if self.r#type == ColorType::LAB {
            self.lab2lch();
        }
    }

    /** Convert rgb to lab */
    pub fn rgb2lab(&mut self) {
        self.r#type = ColorType::LAB;
        let ColorArray(r, g, b, a) = self.val;
        let (x, y, z) = rgb2xyz(r, g, b);
        let l = 116. * y - 16.;
        self.val = ColorArray(if l < 0. { 0. } else { l }, 500. * (x - y), 200. * (y - z), a);
    }

    /** Convert lab to lch */
    pub fn lab2lch(&mut self) {
        self.r#type = ColorType::LCH;
        let ColorArray(l, a, b, alpha) = self.val;
        let c = sqrt(a * a + b * b);
        let mut h = (atan2(b, a) * (180. / PI) + 360.) % 360.;
        if round(c * 10000.) == 0. {
            h = 0.;
        }
        self.val = ColorArray(l, c, h, alpha);
    }

    /** Convert lch to lab */
    pub fn lch2lab(&mut self) {
        self.r#type = ColorType::LAB;
        let ColorArray(l, c, h_o, alpha) = self.val;
        let h = h_o * (PI / 180.);
        self.val = ColorArray(l, cos(h) * c, sin(h) * c, alpha);
    }

    /** Convert lab to rgb */
    pub fn lab2rgb(&mut self) {
        self.r#type = ColorType::RGB;
        let ColorArray(l, a, b, alpha) = self.val;
        let mut x: f64;
        let mut y: f64;
        let mut z: f64;
        let mut r: f64;
        let mut g: f64;
        let mut b_: f64;
        // prep move to xyz
        y = (l + 16.) / 116.;
        x = if a.is_nan() { y } else { y + a / 500. };
        z = if b.is_nan() { y } else { y - b / 200. };
        // solve x, y, z
        y = lab_xyz(y);
        x = 0.95047 * lab_xyz(x);
        z = 1.08883 * lab_xyz(z);
        // xyz to rgb
        r = xyz_rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
        g = xyz_rgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z);
        b_ = xyz_rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
        // clip space from 0 to 255
        if r < 0. {
            r = 0.;
        } else if r > 255. {
            r = 255.;
        }
        if g < 0. {
            g = 0.;
        } else if g > 255. {
            g = 255.;
        }
        if b_ < 0. {
            b_ = 0.;
        } else if b_ > 255. {
            b_ = 255.;
        }
        // set new value
        self.val = ColorArray(r, g, b_, alpha);
    }

    /** Convert rgb to hsv */
    pub fn rgb2hsv(&mut self) {
        self.r#type = ColorType::HSV;
        let ColorArray(r, g, b, a) = self.val;
        let min = f64::min(f64::min(r, g), b);
        let max = f64::max(f64::max(r, g), b);
        let delta = max - min;
        let mut h = 0.;
        let s;
        let v = max / 255.0;
        if max == 0. {
            s = 0.;
        } else {
            s = delta / max;
            if delta != 0. {
                if r == max {
                    h = (g - b) / delta;
                }
                if g == max {
                    h = 2. + (b - r) / delta;
                }
                if b == max {
                    h = 4. + (r - g) / delta;
                }
                h *= 60.;
                if h < 0. {
                    h += 360.
                }
            }
        }
        self.val = ColorArray(h, s, v, a);
    }

    /** Convert hsv to rgb */
    pub fn hsv2rgb(&mut self) {
        self.r#type = ColorType::RGB;
        let ColorArray(mut h, s, mut v, a) = self.val;
        v *= 255.;
        if s == 0. {
            self.val = ColorArray(v, v, v, a);
        } else {
            if h == 360. {
                h = 0.;
            } else if h > 360. {
                h -= 360.;
            } else if h < 0. {
                h += 360.;
            }
            h /= 60.;

            let i = floor(h);
            let f = h - i;
            let p = v * (1. - s);
            let q = v * (1. - s * f);
            let t = v * (1. - s * (1. - f));

            match i as usize {
                0 => self.val = ColorArray(v, t, p, a),
                1 => self.val = ColorArray(q, v, p, a),
                2 => self.val = ColorArray(p, v, t, a),
                3 => self.val = ColorArray(p, q, v, a),
                4 => self.val = ColorArray(t, p, v, a),
                5 => self.val = ColorArray(v, p, q, a),
                _ => self.val = ColorArray(v, t, p, a),
            }
        }
    }

    /** Convert hsl to rgb */
    pub fn hsl2rgb(&mut self) {
        self.r#type = ColorType::RGB;
        let ColorArray(h, s, l, a) = self.val;
        let r: f64;
        let g: f64;
        let b: f64;
        if s.is_nan() {
            b = l * 255.;
            g = b;
            r = g;
        } else {
            let mut t3 = [0., 0., 0.];
            let mut c = [0., 0., 0.];
            let t2 = if l < 0.5 { l * (1. + s) } else { l + s - l * s };
            let t1 = 2. * l - t2;
            let h_ = h / 360.;
            t3[0] = h_ + 1. / 3.;
            t3[1] = h_;
            t3[2] = h_ - 1. / 3.;
            for i in 0..3 {
                if t3[i] < 0. {
                    t3[i] += 1.;
                }
                if t3[i] > 1. {
                    t3[i] -= 1.;
                }
                if 6. * t3[i] < 1. {
                    c[i] = t1 + (t2 - t1) * 6. * t3[i];
                } else if 2. * t3[i] < 1. {
                    c[i] = t2;
                } else if 3. * t3[i] < 2. {
                    c[i] = t1 + (t2 - t1) * (2. / 3. - t3[i]) * 6.;
                } else {
                    c[i] = t1;
                }
            }
            r = round(c[0] * 255.);
            g = round(c[1] * 255.);
            b = round(c[2] * 255.);
        }
        self.val = ColorArray(r, g, b, a);
    }

    /**
     * Given two colors, interpolate between them using a t value between 0 and 1.
     * 0 returns color1, 1 returns color2, and anything in between returns a mixture.
     * @param color1 - first color
     * @param color2 - second color
     * @param t - t value between 0 and 1
     * @returns interpolated color
     */
    pub fn interpolate(t: f64, color1: &Color, color2: &Color) -> Color {
        if color1.r#type != color2.r#type {
            return color1.clone();
        }
        if color1.r#type == ColorType::RGB {
            let ColorArray(r1, g1, b1, a1) = color1.val;
            let ColorArray(r2, g2, b2, a2) = color2.val;
            let r = r1 + (r2 - r1) * t;
            let g = g1 + (g2 - g1) * t;
            let b = b1 + (b2 - b1) * t;
            let a = a1 + (a2 - a1) * t;
            return Color::new(r, g, b, a, ColorType::RGB);
        }
        // prep variables
        //   let sat: f64 | undefined, hue: f64, dh: f64;
        let mut sat: Option<f64> = None;
        let hue: f64;
        let dh: f64;
        let ColorArray(hue0, sat0, lbv0, alpha0) = color1.val;
        let ColorArray(hue1, sat1, lbv1, alpha1) = color2.val;
        // first manage hue
        if !hue0.is_nan() && !hue1.is_nan() {
            if hue1 > hue0 && hue1 - hue0 > 180. {
                dh = hue1 - (hue0 + 360.);
            } else if hue1 < hue0 && hue0 - hue1 > 180. {
                dh = hue1 + 360. - hue0;
            } else {
                dh = hue1 - hue0;
            }
            hue = hue0 + t * dh;
        } else if !hue0.is_nan() {
            hue = hue0;
            if lbv1 == 1. || lbv1 == 0. {
                sat = Some(sat0);
            }
        } else if !hue1.is_nan() {
            hue = hue1;
            if lbv0 == 1. || lbv0 == 0. {
                sat = Some(sat1);
            }
        } else {
            hue = 0.;
        }
        // saturation
        if sat.is_none() {
            sat = Some(sat0 + t * (sat1 - sat0));
        }
        // luminosity
        let lbv = lbv0 + t * (lbv1 - lbv0);
        // alpha
        let alpha = alpha0 + t * (alpha1 - alpha0);
        // create the new color
        return Color::new(hue, sat.unwrap(), lbv, alpha, color1.r#type);
    }
}

// everything below self was taken from chroma.js

/**
 * Convert rgb to xyz
 * @param r - red/green/blue value
 * @returns xyz value
 */
fn rgb_xyz(mut r: f64) -> f64 {
    r /= 255.;
    if r <= 0.04045 { r / 12.92 } else { pow((r + 0.055) / 1.055, 2.4) }
}

/**
 * Convert xyz to lab
 * @param t - xyz value
 * @returns lab value
 */
fn xyz_lab(t: f64) -> f64 {
    if t > 0.008856452 { pow(t, 1. / 3.) } else { t / 0.12841855 + 0.137931034 }
}

/**
 * Convert rgb to xyz
 * @param r - red/green/blue value
 * @returns xyz value
 */
fn xyz_rgb(r: f64) -> f64 {
    255. * (if r <= 0.00304 { 12.92 * r } else { 1.055 * pow(r, 1. / 2.4) - 0.055 })
}

/**
 * Convert lab to xyz
 * @param t - lab value
 * @returns xyz value
 */
fn lab_xyz(t: f64) -> f64 {
    if t > 0.206896552 { t * t * t } else { 0.12841855 * (t - 0.137931034) }
}

/**
 * Convert rgb to xyz
 * @param r - red value
 * @param g - green value
 * @param b - blue value
 * @returns xyz value
 */
fn rgb2xyz(mut r: f64, mut g: f64, mut b: f64) -> (f64, f64, f64) {
    r = rgb_xyz(r);
    g = rgb_xyz(g);
    b = rgb_xyz(b);
    let x = xyz_lab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
    let y = xyz_lab((0.2126729 * r + 0.7151522 * g + 0.072175 * b) / 1.);
    let z = xyz_lab((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);

    (x, y, z)
}

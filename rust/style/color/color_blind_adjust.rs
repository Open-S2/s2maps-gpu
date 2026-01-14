// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js

use crate::style::ColorArray;
use libm::floor;

/// Color vision deficiency types
#[derive(Debug, Default, Copy, Clone, PartialEq)]
pub enum ColorBlindAdjust {
    /// Protanopia
    Protanopia,
    /// Deuteranopia
    Deuteranopia,
    /// Tritanopia
    Tritanopia,
    /// Greyscale
    Greyscale,
    /// None
    #[default]
    None,
}
impl ColorBlindAdjust {
    /// Convert ColorBlindAdjust enum to CVD matrix
    pub fn to_cvd(&self) -> (f64, f64, f64, f64, f64, f64, f64, f64, f64) {
        match self {
            ColorBlindAdjust::Protanopia => (0.0, 2.02344, -2.52581, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0),
            ColorBlindAdjust::Deuteranopia => {
                (1.0, 0.0, 0.0, 0.494207, 0.0, 1.24827, 0.0, 0.0, 1.0)
            }
            ColorBlindAdjust::Tritanopia => {
                (1.0, 0.0, 0.0, 0.0, 1.0, 0.0, -0.395913, 0.801109, 0.0)
            }
            _ => (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
        }
    }
}

/// given an RGBA value, adjust the values to the appropriate colorbind equivalent.
///
/// ## Parameters
/// - `color`: input RGBA color
/// - `type`: the type of colorblindness adjustment
///
/// ## Returns
/// the adjusted color
pub fn color_blind_adjust(color: ColorArray, mode: ColorBlindAdjust) -> ColorArray {
    // ensure we are using RGB and grab the values
    let ColorArray(r, g, b, a) = color;
    // if greyscale just return the greyscale value
    if mode == ColorBlindAdjust::Greyscale {
        let l = 0.3 * r + 0.59 * g + 0.11 * b;
        return ColorArray(l, l, l, a);
    }
    // setup adjuster
    let (cvd_a, cvd_b, cvd_c, cvd_d, cvd_e, cvd_f, cvd_g, cvd_h, cvd_i) = mode.to_cvd();
    // RGB to LMS matrix conversion
    let _l = 17.8824 * r + 43.5161 * g + 4.11935 * b;
    let _m = 3.45565 * r + 27.1554 * g + 3.86714 * b;
    let _s = 0.0299566 * r + 0.184309 * g + 1.46709 * b;
    // Simulate color blindness
    let l = cvd_a * _l + cvd_b * _m + cvd_c * _s;
    let m = cvd_d * _l + cvd_e * _m + cvd_f * _s;
    let s = cvd_g * _l + cvd_h * _m + cvd_i * _s;
    // LMS to RGB
    let mut _r = 0.0809444479 * l + -0.130504409 * m + 0.116721066 * s;
    let mut _g = -0.0102485335 * l + 0.0540193266 * m + -0.113614708 * s;
    let mut _b = -0.000365296938 * l + -0.00412161469 * m + 0.693511405 * s;
    // Isolate invisible colors to color vision deficiency (calculate error matrix)
    _r = r - _r;
    _g = g - _g;
    _b = b - _b;
    // Shift colors towards visible spectrum (apply error modifications)
    let rr = 0.0 * _r + 0.0 * _g + 0.0 * _b;
    let gg = 0.7 * _r + _g + 0.0 * _b;
    let bb = 0.7 * _r + 0.0 * _g + _b;
    // Add compensation to original values
    _r = rr + r;
    _g = gg + g;
    _b = bb + b;
    // Clamp values
    _r = _r.clamp(0.0, 255.0);
    _g = _g.clamp(0.0, 255.0);
    _b = _b.clamp(0.0, 255.0);

    ColorArray(floor(_r), floor(_g), floor(_b), a)
}

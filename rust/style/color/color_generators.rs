use crate::style::{Color, ColorArray, ColorBlindAdjust, ColorRamp};
use alloc::{string::String, vec::Vec};
use libm::{ceil, round};

impl ColorRamp {
    /// Grab the color from the ramp
    pub fn get_color(&self, t: f64, cb_adjust: ColorBlindAdjust, lch: bool) -> ColorArray {
        match self {
            ColorRamp::Sinebow => {
                let mut val = Color::sinebow(t);
                if lch { val.get_lch() } else { val.get_rgb(Some(false), Some(cb_adjust)) }
            }
            ColorRamp::SinebowExtended => {
                let mut val = Color::sinebow_extended(t);
                if lch { val.get_lch() } else { val.get_rgb(Some(false), Some(cb_adjust)) }
            }
            ColorRamp::ColorRampInput(ramp) => {
                if ramp.is_empty() {
                    return ColorArray(0., 0., 0., 0.);
                }
                let mut i = 0;
                while t > ramp.get(i).or(ramp.last()).unwrap().stop {
                    i += 1;
                }
                let mut color = if t == ramp[i].stop {
                    Color::from(&ramp[i].color)
                } else {
                    let first = Color::from(&ramp.get(i - 1).or(ramp.get(i)).unwrap().color);
                    let second = Color::from(&ramp.get(i).unwrap().color);
                    Color::interpolate(
                        (t - ramp[i - 1].stop) / (ramp[i].stop - ramp[i - 1].stop),
                        &first,
                        &second,
                    )
                };

                if lch { color.get_lch() } else { color.get_rgb(Some(false), Some(cb_adjust)) }
            }
        }
    }
}

/**
 * Build a color ramp given a string defined ramp style or ramp guide
 * @param ramp - string defined ramp style or ramp guide
 * @param lch - whether or not to use lch
 * @returns Uint8ClampedArray
 */
pub fn build_color_ramp(ramp: &ColorRamp, lch: Option<bool>) -> Vec<u8> {
    let lch = lch.unwrap_or(false);
    // create ramp image
    // (4) RGBA * (5) height (base color, protanopia, deuteranopia, tritanopia, greyscale) * (255) width
    let mut ramp_image = Vec::with_capacity(4 * 5 * 256);
    // build the ramp for base color and each colorblindness
    let ramp_map: [ColorBlindAdjust; 5] = [
        ColorBlindAdjust::None,
        ColorBlindAdjust::Protanopia,
        ColorBlindAdjust::Deuteranopia,
        ColorBlindAdjust::Tritanopia,
        ColorBlindAdjust::Greyscale,
    ];
    for t in 0..ramp_map.len() {
        let r#type = ramp_map[t];
        let offset = t * 256 * 4;
        for i in 0..256 {
            let ColorArray(r, g, b, a) = ramp.get_color(i as f64 / 256., r#type, lch);
            let idx = (i << 2) + offset;
            ramp_image[idx] = round(r * a) as u8;
            ramp_image[idx + 1] = round(g * a) as u8;
            ramp_image[idx + 2] = round(b * a) as u8;
            ramp_image[idx + 3] = round(a * 255.) as u8;
        }
    }

    ramp_image
}

/** An output for a dash image */
#[derive(Debug, Default, Clone, PartialEq)]
pub struct DashImage {
    /// The length of the dashes
    pub length: usize,
    /// The number of dashes
    pub dash_count: usize,
    /// The dash image
    pub image: Vec<u8>,
}

/**
 * Build a dash image
 * @param dasharray - dash array
 * @param device_pixel_ratio - device pixel ratio
 * @returns the dash image
 */
pub fn build_dash_image(dasharray: Vec<(f64, String)>, device_pixel_ratio: f64) -> DashImage {
    // RGBA * 5 height (base color, protanopia, deuteranopia, tritanopia, grayscale) * found width
    let dash_count: f64 = dasharray.iter().map(|(size, _)| round(*size) * device_pixel_ratio).sum();
    // increase length to be divisible by 256
    let length = (ceil(dash_count / 256.) * 256.) as usize;
    let mut dash_image = Vec::with_capacity(4 * 5 * length);

    // convert all strings to colors
    let color_dashes: Vec<(f64, Color)> = dasharray
        .iter()
        .map(|(size, _str)| (size * device_pixel_ratio, (&(**_str)).into()))
        .collect();

    let ramp_map: [ColorBlindAdjust; 5] = [
        ColorBlindAdjust::None,
        ColorBlindAdjust::Protanopia,
        ColorBlindAdjust::Deuteranopia,
        ColorBlindAdjust::Tritanopia,
        ColorBlindAdjust::Greyscale,
    ];
    for t in 0..ramp_map.len() {
        let r#type = ramp_map[t];
        let offset = t * length * 4;
        let mut pos = 0;
        let mut dash_position = 0;
        while pos < length {
            let (size, mut color) = color_dashes[dash_position % color_dashes.len()];
            let ColorArray(r, g, b, a) = color.get_rgb(Some(false), Some(r#type));
            for _ in 0..(round(size) as usize) {
                pos += 1;
                let idx = (pos << 2) + offset;
                dash_image[idx] = round(r * a) as u8;
                dash_image[idx + 1] = round(g * a) as u8;
                dash_image[idx + 2] = round(b * a) as u8;
                dash_image[idx + 3] = round(a * 255.) as u8;
            }
            dash_position += 1;
        }
    }

    DashImage { length, dash_count: dash_count as usize, image: dash_image }
}

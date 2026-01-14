use crate::style::{ColorArray, ColorType};
use alloc::{boxed::Box, string::String, vec::Vec};

/// ColorDefinition -> (encoding, colors)
pub type ColorDefinition = (ColorType, ColorArray);

fn color_map(input: &str) -> String {
    match input {
        "aqua" => "#00ffff".into(),
        "black" => "#000000".into(),
        "blue" => "#0000ff".into(),
        "fuchsia" => "#ff00ff".into(),
        "gray" => "#808080".into(),
        "green" => "#008000".into(),
        "lime" => "#00ff00".into(),
        "maroon" => "#800000".into(),
        "navy" => "#000080".into(),
        "olive" => "#808000".into(),
        "orange" => "#ffa500".into(),
        "purple" => "#800080".into(),
        "red" => "#ff0000".into(),
        "silver" => "#c0c0c0".into(),
        "teal" => "#008080".into(),
        "white" => "#ffffff".into(),
        "yellow" => "#ffff00".into(),
        _ => input.into(),
    }
}

/**
 * There are four types of strings to parse:
 * - color names: 'red', 'black', etc
 * - Hex: #ededed
 * - lastly type encodings:
 * - * rgb(255, 255, 255)
 * - * rgba(255, 255, 255, 255)
 * - * hsv(180, 0.9, 0.7843137254901961)
 * - * hsva(180, 0.9, 0.7843137254901961, 1)
 * @param input - the string to parse
 * @returns the parsed color
 */
pub fn color_parser(input: &str) -> ColorDefinition {
    // Convert input into a hex value if the input is a color name
    let input = color_map(input);
    // parse hex or color string
    if input.chars().nth(0) == Some('#') { parse_hex(&input) } else { parse_string(&input) }
}

/**
 * Parse a hex string
 * @param input - the string to parse
 * @returns the parsed color
 */
fn parse_hex(input: &str) -> ColorDefinition {
    let mut s = &input[1..]; // drop '#'

    // 3 or 6 chars
    if s.len() % 3 == 0 {
        let mut buf = String::new();

        if s.len() == 3 {
            for c in s.chars() {
                buf.push(c);
                buf.push(c);
            }
            s = Box::leak(buf.into_boxed_str());
        }

        let u = u32::from_str_radix(s, 16).unwrap_or(0);
        let r = ((u >> 16) & 0xff) as f64;
        let g = ((u >> 8) & 0xff) as f64;
        let b = (u & 0xff) as f64;

        return (ColorType::RGB, ColorArray(r, g, b, 1.0));
    }

    // 4 or 8 chars
    if s.len() % 4 == 0 {
        let mut buf = String::new();

        if s.len() == 4 {
            for c in s.chars() {
                buf.push(c);
                buf.push(c);
            }
            s = Box::leak(buf.into_boxed_str());
        }

        let u = u32::from_str_radix(s, 16).unwrap_or(0);
        let r = ((u >> 24) & 0xff) as f64;
        let g = ((u >> 16) & 0xff) as f64;
        let b = ((u >> 8) & 0xff) as f64;

        let a_raw = (u & 0xff) as f64;
        let a = ((a_raw / 255.0) * 100.0).round() / 100.0;

        return (ColorType::RGB, ColorArray(r, g, b, a));
    }

    (ColorType::RGB, ColorArray(0.0, 0.0, 0.0, 0.0))
}

/**
 * Parse a type encoding into a color
 * Examples:
 * - * rgba(255, 255, 255, 255)
 * - * hsv(180, 0.9, 0.7843137254901961)
 * - * hsva(180, 0.9, 0.7843137254901961, 1)
 * @param input - the string to parse
 * @returns the parsed color
 */
fn parse_string(input: &str) -> ColorDefinition {
    let mut parts = input.split('(');
    let mut name = parts.next().unwrap().trim();
    let vals = parts.next().unwrap();

    let mut nums: Vec<f64> = vals
        .split(')')
        .next()
        .unwrap()
        .split(',')
        .map(|v| v.trim().parse::<f64>().unwrap_or(0.0))
        .collect();

    if name.len() == 3 {
        nums.push(1.0);
    } else {
        name = &name[..name.len() - 1]; // drop trailing 'a'
        if nums[3] > 1.0 {
            nums[3] /= 255.0;
        }
    }

    (
        name.into(),
        ColorArray(
            *nums.get(0).unwrap_or(&0.0),
            *nums.get(1).unwrap_or(&0.0),
            *nums.get(2).unwrap_or(&0.0),
            *nums.get(3).unwrap_or(&0.0),
        ),
    )
}

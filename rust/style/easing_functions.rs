use crate::style::{Alignment, Anchor, Cap, Color, Join, Placement, TextField};
use alloc::string::String;
use libm::{pow, round};
use s2json::{Point, PrimitiveValue, ValueType};
use serde::{Deserialize, Serialize};

/// Input ease types names. Defaults to linear
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub enum EaseType {
    /// Linear
    #[serde(rename = "lin")]
    #[default]
    Lin,
    /// Exponential
    #[serde(rename = "expo")]
    Expo,
    /// Quadratic
    #[serde(rename = "quad")]
    Quad,
    /// Cubic
    #[serde(rename = "cubic")]
    Cubic,
    /// Step
    #[serde(rename = "step")]
    Step,
}
impl EaseType {
    /// Convert the ease type to a function
    pub fn to_func(&self) -> EaseFunction {
        match self {
            EaseType::Lin => linear,
            EaseType::Expo => exponential,
            EaseType::Quad => quad,
            EaseType::Cubic => cubic,
            EaseType::Step => step,
        }
    }
}

/// Ease mechanic for any input
pub trait Easing
where
    Self: Sized,
{
    /// Ease function for a style. All the components necessary to properly compute the current property relative to the start and end values.
    fn ease(
        zoom: f64,
        start: f64,
        end: f64,
        start_value: &Self,
        end_value: &Self,
        ease_type: Option<EaseType>,
        base: Option<f64>,
    ) -> Self {
        let ease_type = ease_type.unwrap_or_default();
        let base = base.unwrap_or(1.);
        let func = ease_type.to_func();
        let t = func(zoom, start, end, base);
        Easing::interpolate(t, start_value, end_value)
    }

    /// Interpolation function. All assumed types are implemented below
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self;
}
macro_rules! impl_binary_easing {
    ($ty:ty) => {
        impl Easing for $ty {
            fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
                if t < 0.5 { *start_value } else { *end_value }
            }
        }
    };
}
impl_binary_easing!(bool);
impl_binary_easing!(Anchor);
impl_binary_easing!(Placement);
impl_binary_easing!(Alignment);
impl_binary_easing!(Cap);
impl_binary_easing!(Join);
impl Easing for f32 {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        let start_value = *start_value as f64;
        (start_value + t * (*end_value as f64 - start_value)) as f32
    }
}
impl Easing for f64 {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        start_value + t * (end_value - start_value)
    }
}
impl Easing for u64 {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        let start_value = *start_value as f64;
        round(start_value + t * ((*end_value as f64) - start_value)) as u64
    }
}
impl Easing for i64 {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        let start_value = *start_value as f64;
        round(start_value + t * ((*end_value as f64) - start_value)) as i64
    }
}
impl Easing for Color {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        Color::interpolate(t, start_value, end_value)
    }
}
impl Easing for String {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        let start_value: Color = start_value.as_str().into();
        let end_value: Color = end_value.as_str().into();
        let res_color = Color::interpolate(t, &start_value, &end_value);

        res_color.into()
    }
}
impl Easing for TextField {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        match (start_value, end_value) {
            (TextField::Field(start), TextField::Field(end)) => {
                let val = if t < 0.5 { start } else { end };
                val.clone().into()
            }
            (TextField::Expression(start), TextField::Expression(end)) => {
                let val = if t < 0.5 { start } else { end };
                val.clone().into()
            }
            (TextField::Field(start), _) => start.clone().into(),
            (_, TextField::Field(end)) => end.clone().into(),
            _ => start_value.clone(),
        }
    }
}
impl Easing for Point {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        let x = f64::interpolate(t, &start_value.0, &end_value.0);
        let y = f64::interpolate(t, &start_value.1, &end_value.1);
        Point(x, y)
    }
}
impl Easing for PrimitiveValue {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        match (start_value, end_value) {
            (PrimitiveValue::Bool(start), PrimitiveValue::Bool(end)) => {
                bool::interpolate(t, start, end).into()
            }
            (PrimitiveValue::String(start), PrimitiveValue::String(end)) => {
                String::interpolate(t, start, end).into()
            }
            (PrimitiveValue::F32(start), PrimitiveValue::F32(end)) => {
                f32::interpolate(t, start, end).into()
            }
            (PrimitiveValue::F64(start), PrimitiveValue::F64(end)) => {
                f64::interpolate(t, start, end).into()
            }
            (PrimitiveValue::U64(start), PrimitiveValue::U64(end)) => {
                u64::interpolate(t, start, end).into()
            }
            (PrimitiveValue::I64(start), PrimitiveValue::I64(end)) => {
                i64::interpolate(t, start, end).into()
            }
            _ => PrimitiveValue::Null,
        }
    }
}
impl Easing for ValueType {
    fn interpolate(t: f64, start_value: &Self, end_value: &Self) -> Self {
        match (start_value, end_value) {
            (ValueType::Primitive(start), ValueType::Primitive(end)) => {
                (&PrimitiveValue::interpolate(t, start, end)).into()
            }
            _ => ValueType::Primitive(PrimitiveValue::Null),
        }
    }
}

/// Ease function container
pub type EaseFunction = fn(zoom: f64, start: f64, end: f64, base: f64) -> f64;

/// Linear ease function: y = mx
///
/// ## Parameters
/// - `input`: input value
/// - `start`: start value
/// - `end`: end value
///
/// ## Returns
/// the interpolated value
fn linear(input: f64, start: f64, end: f64, _base: f64) -> f64 {
    (input - start) / (end - start)
}

/// Exponential ease function: y = e^x OR y = Math.pow(2, 10 * x)
///
/// ## Parameters
/// - `input`: input value
/// - `start`: start value
/// - `end`: end value
///
/// ## Returns
/// the interpolated value
fn exponential(input: f64, start: f64, end: f64, mut base: f64) -> f64 {
    // grab change
    let diff = end - start;
    if diff == 0. {
        return 0.;
    }
    // refine base value
    if base <= 0. {
        base = 0.1;
    } else if base > 2. {
        base = 2.;
    }
    // grab diff
    let progress = input - start;
    // linear case
    if base == 1. {
        return progress / diff;
    }
    // solve
    (pow(base, progress) - 1.) / (pow(base, diff) - 1.)
}

/// Quadratic ease function: y = x^2
///
/// ## Parameters
/// - `input`: input value
/// - `start`: start value
/// - `end`: end value
///
/// ## Returns
/// the interpolated value
fn quad(input: f64, start: f64, end: f64, _base: f64) -> f64 {
    pow(input - start, 2.) / pow(end - start, 2.)
}

/// Cubic ease function: y = x^3
///
/// ## Parameters
/// - `input`: input value
/// - `start`: start value
/// - `end`: end value
///
/// ## Returns
/// the interpolated value
fn cubic(input: f64, start: f64, end: f64, _base: f64) -> f64 {
    pow(input - start, 3.) / pow(end - start, 3.)
}

/// Stepping ease function: y = 1 or 0
///
/// ## Parameters
/// - `input`: input value
/// - `start`: start value
/// - `end`: end value
///
/// ## Returns
/// the interpolated value
fn step(input: f64, _start: f64, end: f64, _base: f64) -> f64 {
    if input >= end { 1. } else { 0. }
}

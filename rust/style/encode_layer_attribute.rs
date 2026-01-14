use crate::style::{
    Alignment, Anchor, Cap, Color, ColorArray, ConditionFilter, DataCondition, DataRange,
    DataRangeEase, DataRangeStep, EaseType, FeatureState, Input, InputRange, InputRangeEase,
    InputRangeStep, InputRangeType, InputValueType, Join, Placement, Property, Range, TextField,
};
use alloc::{string::String, vec, vec::Vec};
use s2json::{Point, PrimitiveValue, ValuePrimitiveType, ValueType};

/// # Encode Layer Attributes
///
/// Trait for encoding layer attributes
///
/// This encoder is built for webgl/webgpu to parse for conditional drawing.
/// The Style object will parse all layers' attributes like "color", "fill", "width", etc.
/// The code will be placed into "LayerCode" for the GPU shader to utiilize as necessary.
///
/// CONDITION ENCODINGS: 128 positions possible
/// - 0 -> null
/// - 1 -> value
/// - 2 -> data-condition
/// - 3 -> input-condition
/// - 4 -> data-range
/// - 5 -> input-range
/// - 6 -> feature-state (this updates for each draw assuming the feature has a "feature-state")
/// - 7 -> animation-state (this updates for each draw assuming the feature has a "animation-state")
/// - 8 -> input-value (this is a constant value pulled from properties)
///
/// FEATURE-STATE ENCODINGS:
/// - 0 -> default (inactive)
/// - 1 -> hover
/// - 2 -> active
/// - 3 -> selected
/// - 4 -> disabled
///
/// INPUT RANGE/CONDITION ENCODINGS:
/// - 0 -> zoom
/// - 1 -> lon
/// - 2 -> lat
/// - 3 -> angle
/// - 4 -> pitch
/// - 5 -> time
///
/// INTERPOLATION ENCODINGS: data-ranges or input-ranges have either linear or exponential interpolations
/// if exponential the base must also be encoded, after the type
/// - 0 -> linear
/// - 1 -> exponential
/// - 2 -> quad-bezier
/// - 3 -> cubic-bezier
/// - 4 -> step
///
/// ## Parameters
/// - `input`: the value to encode
/// - `lch`: whether to encode in lch
///
/// ## Returns
/// an array of numbers encoded for the GPU to utilize
pub trait EncodeLayerAttribute {
    /// Encode a layer attribute into a vector of bytes for the GPU to decode
    ///
    /// The top level encoder used by the style engine is [`Input`].
    fn encode_attribute(&self, lch: bool) -> Vec<f32>;
}

/// ## Parameters
/// - `input`: the value to encode
/// - `lch`: whether to encode in lch
///
/// ## Returns
/// an array of numbers encoded for the GPU to utilize
impl<T: InputValueType> EncodeLayerAttribute for Input<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let mut encodings = vec![0.]; // store a null no matter what to be updated later
        match self {
            Input::Property(prop) => {
                match prop {
                    Property::DataCondition(data_condition) => {
                        // set the condition bits as data-condition
                        encodings[0] += (2 << 4) as f32;
                        // encode the condition type
                        encodings.extend(data_condition.encode_attribute(lch));
                    }
                    Property::InputCondition => {
                        // set the condition bits as input-condition
                        encodings[0] += (3 << 4) as f32;
                        // TODO: encode the condition type correctly
                    }
                    Property::DataRange(data_range) => {
                        // set the condition bits as data-range
                        encodings[0] += (4 << 4) as f32;
                        // encode the interpolation type
                        if let DataRange::Ease(dre) = data_range
                            && dre.ease == Some(EaseType::Expo)
                        {
                            encodings[0] += 1.;
                            encodings.push(dre.base.unwrap_or(1.) as f32);
                        }
                        // encode range data and store
                        encodings.extend(data_range.encode_attribute(lch));
                    }
                    Property::InputRange(input_range) => {
                        let base = input_range.base();
                        let ease = input_range.ease();
                        let r#type = input_range.r#type();
                        // set the condition bits as input-range
                        encodings[0] += (5 << 4) as f32;
                        // encode the input-range type
                        match r#type {
                            InputRangeType::Zoom => encodings[0] += (0 << 1) as f32,
                            InputRangeType::Lon => encodings[0] += (1 << 1) as f32,
                            InputRangeType::Lat => encodings[0] += (2 << 1) as f32,
                            InputRangeType::Angle => encodings[0] += (3 << 1) as f32,
                            InputRangeType::Pitch => encodings[0] += (4 << 1) as f32,
                        }
                        //   encode the interpolation type (ONLY expo takes a base)
                        if ease == EaseType::Expo {
                            encodings[0] += 1.;
                            encodings.push(base.unwrap_or(1.) as f32);
                        }
                        // encode range data and store
                        encodings.extend(input_range.encode_attribute(lch));
                    }
                    Property::FeatureState(feature_state) => {
                        // set the condition bits as feature-state
                        encodings[0] += (6 << 4) as f32;
                        // encode the feature-states and store
                        encodings.extend(feature_state.encode_attribute(lch));
                    }
                    Property::InputValue(_) => {
                        // set the condition bits as input-condition
                        encodings[0] += (8 << 4) as f32;
                    }
                    Property::Fallback(_) => {}
                }
            }
            Input::Value(value) => {
                encodings[0] += (1 << 4) as f32; // set the condition bits as 1 (value)
                encodings.extend(value.encode_attribute(lch));
            }
        }
        // lastly store length of the current encoding
        encodings[0] += (encodings.len() << 10) as f32;

        encodings
    }
}

/// Encode a data condition
///
/// ## Parameters
/// - `data_condition`: the data condition to encode
/// - `lch`: whether or not to use lch
///
/// ## Returns
/// the encoded data condition
impl<T: InputValueType> EncodeLayerAttribute for DataCondition<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let Self { conditions, fallback } = self;
        let mut encoding = vec![];
        let mut i = 1;

        for ConditionFilter { input, .. } in conditions {
            encoding.push(i as f32);
            encoding.extend(input.encode_attribute(lch));
            i += 1;
        }
        encoding.push(0.);
        encoding.extend(fallback.encode_attribute(lch));

        encoding
    }
}

/// Encode a data range
///
/// ## Parameters
/// - `data_range`: the data range to encode
/// - `lch`: whether or not to use lch
///
/// ## Returns
/// the encoded data range
impl<T: InputValueType> EncodeLayerAttribute for DataRange<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        match self {
            DataRange::Ease(data_range) => data_range.encode_attribute(lch),
            DataRange::Step(data_range) => data_range.encode_attribute(lch),
        }
    }
}
impl<T: InputValueType> EncodeLayerAttribute for DataRangeEase<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let Self { ranges, .. } = self;
        let mut encoding = vec![];

        for Range { stop, input } in ranges {
            encoding.push(*stop);
            encoding.extend(input.encode_attribute(lch));
        }

        encoding
    }
}
impl<T: InputValueType> EncodeLayerAttribute for DataRangeStep<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let Self { ranges, .. } = self;
        let mut encoding = vec![];

        for Range { stop, input } in ranges {
            encoding.push(*stop);
            encoding.extend(input.encode_attribute(lch));
        }

        encoding
    }
}

/// Encode a input range
///
/// ## Parameters
/// - `input_range`: the input range to encode
/// - `lch`: whether or not to use lch
///
/// ## Returns
/// the encoded input range
impl<T: InputValueType> EncodeLayerAttribute for InputRange<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        match self {
            InputRange::Ease(input_range) => input_range.encode_attribute(lch),
            InputRange::Step(input_range) => input_range.encode_attribute(lch),
        }
    }
}
impl<T: InputValueType> EncodeLayerAttribute for InputRangeEase<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let Self { ranges, .. } = self;
        let mut encoding = vec![];

        for Range { stop, input } in ranges {
            encoding.push(*stop);
            encoding.extend(input.encode_attribute(lch));
        }

        encoding
    }
}
impl<T: InputValueType> EncodeLayerAttribute for InputRangeStep<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let Self { ranges, .. } = self;
        let mut encoding = vec![];

        for Range { stop, input } in ranges {
            encoding.push(*stop);
            encoding.extend(input.encode_attribute(lch));
        }

        encoding
    }
}

/**
 * Encode a feature state
 * @param feature_state - the feature state to encode
 * @param lch - whether or not to use lch
 * @returns the encoded feature state
 */
impl<T: InputValueType> EncodeLayerAttribute for FeatureState<T> {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let Self { condition, input, .. } = self;
        let mut encoding = vec![];

        // store condition
        encoding.push((*condition).into());
        encoding.extend(input.encode_attribute(lch));

        encoding
    }
}

// Basic Types

macro_rules! impl_simple_encoding {
    ($ty:ty) => {
        impl EncodeLayerAttribute for $ty {
            fn encode_attribute(&self, _lch: bool) -> Vec<f32> {
                vec![*self as f32]
            }
        }
    };
}
macro_rules! impl_two_step_encoding {
    ($ty:ty) => {
        impl EncodeLayerAttribute for $ty {
            fn encode_attribute(&self, _lch: bool) -> Vec<f32> {
                vec![*self as u64 as f32]
            }
        }
    };
}
impl_simple_encoding!(f32);
impl_simple_encoding!(f64);
impl_simple_encoding!(u64);
impl_simple_encoding!(i64);
impl_two_step_encoding!(bool);
impl_two_step_encoding!(Placement);
impl_two_step_encoding!(Anchor);
impl_two_step_encoding!(Alignment);
impl_two_step_encoding!(Cap);
impl_two_step_encoding!(Join);

impl EncodeLayerAttribute for String {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        Color::from(self).encode_attribute(lch)
    }
}
impl EncodeLayerAttribute for Color {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        let mut color = self.clone();
        let ColorArray(r, g, b, a) = if lch { color.get_lch() } else { color.get_rgb(None, None) };
        vec![r as f32, g as f32, b as f32, a as f32]
    }
}
impl EncodeLayerAttribute for Point {
    fn encode_attribute(&self, _lch: bool) -> Vec<f32> {
        vec![self.0 as f32, self.1 as f32]
    }
}
impl EncodeLayerAttribute for TextField {
    fn encode_attribute(&self, _lch: bool) -> Vec<f32> {
        match self {
            TextField::Field(s) => s.encode_attribute(_lch),
            TextField::Expression(e) => e.iter().flat_map(|s| s.encode_attribute(_lch)).collect(),
            _ => vec![],
        }
    }
}
impl EncodeLayerAttribute for PrimitiveValue {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        match self {
            PrimitiveValue::String(s) => s.encode_attribute(lch),
            PrimitiveValue::U64(u) => u.encode_attribute(lch),
            PrimitiveValue::I64(i) => i.encode_attribute(lch),
            PrimitiveValue::F32(f) => f.encode_attribute(lch),
            PrimitiveValue::F64(f) => f.encode_attribute(lch),
            PrimitiveValue::Bool(b) => b.encode_attribute(lch),
            PrimitiveValue::Null => vec![],
        }
    }
}
impl EncodeLayerAttribute for ValuePrimitiveType {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        match self {
            ValuePrimitiveType::Primitive(p) => p.encode_attribute(lch),
            _ => vec![],
        }
    }
}
impl EncodeLayerAttribute for ValueType {
    fn encode_attribute(&self, lch: bool) -> Vec<f32> {
        match self {
            ValueType::Primitive(p) => p.encode_attribute(lch),
            ValueType::Array(arr) => arr.iter().flat_map(|v| v.encode_attribute(lch)).collect(),
            _ => vec![],
        }
    }
}

// import getEasingFunction from './easingFunctions.js';
// import parseFilter from './parseFilter.js';
use crate::style::{
    Alignment, Anchor, Cap, DataCondition, DataRange, Easing, FilterFunction, Input, InputKey,
    InputRange, InputValue, InputValueType, Join, LayerWorkerFunction, NestedKey, Placement,
    Property, TextField,
};
use alloc::{string::String, vec::Vec};
use s2json::{Point, PrimitiveValue, Properties, ValuePrimitiveType, ValueType};

/// Data Condition wrapper
#[derive(Debug, Clone)]
pub struct DataConditionList<U> {
    /// The Condition that must be met to pass a result
    pub condition: FilterFunction,
    /// The process to run if the condition is met
    pub result: LayerWorkerFunction<U>,
}
/// Callback for various conditions
pub type Callback<T, U> = fn(i: T) -> U;

/// Feature Parser takes a style definition input and a callback function and on request
/// will parse input zoom and properties to output the desired value
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct FeatureParser<T: InputValueType, U> {
    pub input: Input<T>,
    pub cb: Callback<T, U>,
}
impl<T: InputValueType, U> FeatureParser<T, U> {
    /// Create a new feature parser
    pub fn new(input: Input<T>, cb: Callback<T, U>) -> Self {
        Self { input, cb }
    }
    /// Parse a feature given inputs
    pub fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, zoom: u8) -> U {
        let res = self.input.parse_feature(code, properties, zoom);
        (self.cb)(res)
    }
}

/// This functionality is built for the tile worker. It helps with building data the GPU can parse
/// to manipulate input values into output values on the GPU.
pub trait ParseFeature<T: InputValueType> {
    /// Parse a feature given the code to update and the feature's properties
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, zoom: u8) -> T;
}

/// This functionality is built for the tile worker. It helps with building data the GPU can parse
/// to manipulate input values into output values on the GPU.
///
/// ## Parameters
/// - `code` - The code to store the input in
/// - `properties` - The properties to check
/// - `zoom` - The zoom level
///
/// ## Returns
/// The parsed value
impl<T: InputValueType> ParseFeature<T> for Input<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, zoom: u8) -> T {
        match self {
            Input::Property(property) => match property {
                Property::InputValue(input_value) => {
                    input_value.parse_feature(code, properties, zoom)
                }
                Property::DataCondition(data_condition) => {
                    data_condition.parse_feature(code, properties, zoom)
                }
                Property::DataRange(data_range) => data_range.parse_feature(code, properties, zoom),
                Property::InputRange(input_range) => {
                    input_range.parse_feature(code, properties, zoom)
                }
                Property::Fallback(fallback) => {
                    fallback.as_ref().parse_feature(code, properties, zoom)
                }
                _ => panic!("Invalid input"),
            },
            Input::Value(value) => value.clone(),
        }
    }
}

/// Parse an input value itself into an [`InputValueType`]
///
/// ## Parameters
/// - `code` - The code to store the input in
/// - `properties` - The properties to check
/// - `zoom` - The zoom level
///
/// ## Returns
/// The parsed value
impl<T: InputValueType> ParseFeature<T> for InputValue<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, _zoom: u8) -> T {
        let mut properties = properties;
        let Self { key, fallback } = self;
        // dive into nested properties if needed
        let end_key: String;
        match key {
            InputKey::Key(in_key) => end_key = in_key.clone(),
            InputKey::Nested(in_key) => {
                let mut nested_key = in_key.nested_key.clone();
                while nested_key.len() > 1 {
                    let key = nested_key.remove(0);
                    properties =
                        properties.get(&key).map(|v| v.into()).unwrap_or(Properties::default());
                }
                end_key = nested_key[0].clone();
            }
        }
        // return the input if it exists, otherwise fallback
        let res = properties.get(&end_key).map(|v| v.into()).unwrap_or(fallback.clone());
        code.extend(res.to_gpu_code());

        res
    }
}

/// Data condition function parser
///
/// ## Parameters
/// - `code` - The code to store the input in
/// - `properties` - The properties to check
/// - `zoom` - The zoom level
///
/// ## Returns
/// The parsed value
impl<T: InputValueType> ParseFeature<T> for DataCondition<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, zoom: u8) -> T {
        let conditions = &self.conditions;
        let fallback = self.fallback.as_ref();
        // test each condition, if one passes, store it as the answer
        for (i, condition) in conditions.iter().enumerate() {
            if condition.filter.filter(Some(&properties)) {
                code.push((i as f32) + 1.);
                return condition.input.parse_feature(code, properties, zoom);
            }
        }
        // if we made it here, just run the fallback
        code.push(0.);
        fallback.parse_feature(code, properties, zoom)
    }
}

/// Data range function parser
///
/// ## Parameters
/// - `code` - The code to store the input in
/// - `properties` - The properties to check
/// - `zoom` - The zoom level
///
/// ## Returns
/// The parsed value
impl<T: InputValueType> ParseFeature<T> for DataRange<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, mut properties: Properties, zoom: u8) -> T {
        let key = self.key();
        let ranges = self.ranges();
        let ease = self.ease();
        let base = self.base();

        let mut end_key: InputKey = key;
        // dive into nested properties if needed
        while let InputKey::Nested(nk) = end_key {
            let mut nested_key = nk.nested_key.clone();
            while nested_key.len() > 1 {
                let prop_value: Option<Properties> =
                    properties.get(&nested_key[0]).map(|v| v.into());
                properties = prop_value.unwrap_or(properties.clone());
                nested_key.remove(0);
            }
            end_key = nested_key[0].clone().into();
        }
        let InputKey::Key(end_key) = end_key else {
            panic!("end_key is not a key");
        };

        let data_input = properties
            .get(&end_key)
            .and_then(|v| v.to_prim().cloned().unwrap_or_default().to_f32())
            .unwrap_or(0.0);

        if data_input <= ranges[0].stop {
            // less then or equal to first stop
            return ranges[0].input.parse_feature(code, properties, zoom);
        } else if data_input >= ranges[ranges.len() - 1].stop {
            // greater then or equal to last stop
            return ranges[ranges.len() - 1].input.parse_feature(code, properties, zoom);
        } else {
            // somewhere inbetween two stops. lets interpolate
            let mut i = 0;
            while i < ranges.len() && ranges[i].stop <= data_input {
                i += 1;
            }
            if i == ranges.len() {
                i -= 1;
            }
            let start_value = ranges[i - 1].input.parse_feature(code, properties.clone(), zoom);
            let start_stop = ranges[i - 1].stop;
            let end_value = ranges[i].input.parse_feature(code, properties, zoom);
            let end_stop = ranges[i].stop;
            Easing::ease(
                data_input as f64,
                start_stop as f64,
                end_stop as f64,
                &start_value,
                &end_value,
                Some(ease),
                base,
            )
        }
    }
}

// TODO: Support type property (defaults to 'zoom')
/// Input range function parser
///
/// ## Parameters
/// - `code` - The code to store the input in
/// - `properties` - The properties to check
/// - `zoom` - The zoom level
///
/// ## Returns
/// The parsed value
impl<T: InputValueType> ParseFeature<T> for InputRange<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, zoom: u8) -> T {
        let ease = self.ease();
        let base = self.base();
        let ranges = self.ranges();

        let zoom_f32 = zoom as f32;
        if zoom_f32 <= ranges[0].stop {
            ranges[0].input.parse_feature(code, properties, zoom)
        } else if zoom_f32 >= ranges[ranges.len() - 1].stop {
            ranges[ranges.len() - 1].input.parse_feature(code, properties, zoom)
        } else {
            let mut i = 0;
            while ranges[i].stop <= zoom_f32 {
                i += 1;
            }
            if i == ranges.len() {
                i -= 1;
            }
            let start_value = ranges[i - 1].input.parse_feature(code, properties.clone(), zoom);
            let start_stop = ranges[i - 1].stop;
            let end_value = ranges[i].input.parse_feature(code, properties, zoom);
            let end_stop = ranges[i].stop;
            Easing::ease(
                zoom_f32 as f64,
                start_stop as f64,
                end_stop as f64,
                &start_value,
                &end_value,
                Some(ease),
                base,
            )
        }
    }
}

// Needed conversions from JSON objects

macro_rules! from_value_type {
    ($target:ty) => {
        impl From<&ValueType> for $target {
            fn from(value: &ValueType) -> Self {
                match value {
                    ValueType::Primitive(prim) => prim.to_u64().unwrap_or_default().into(),
                    _ => <$target>::default(),
                }
            }
        }
    };
}
from_value_type!(Placement);
from_value_type!(Alignment);
from_value_type!(Anchor);
from_value_type!(Cap);
from_value_type!(Join);

impl From<&ValueType> for TextField {
    fn from(value: &ValueType) -> Self {
        match value {
            ValueType::Primitive(s) => TextField::Field(s.to_string().unwrap_or_default()),
            ValueType::Array(arr) => TextField::Expression(arr.iter().map(|s| s.into()).collect()),
            ValueType::Nested(nest) => {
                if nest.contains_key("nested_key") {
                    TextField::Nested(nest.get("nested_key").unwrap().into())
                } else {
                    TextField::default()
                }
            }
        }
    }
}
impl From<&ValueType> for NestedKey {
    fn from(value: &ValueType) -> Self {
        match value {
            ValueType::Array(arr) => NestedKey {
                nested_key: arr
                    .into_iter()
                    .map(|s| {
                        s.to_prim()
                            .unwrap_or(&PrimitiveValue::default())
                            .to_string()
                            .unwrap_or_default()
                    })
                    .collect(),
            },
            _ => NestedKey::default(),
        }
    }
}

/// Convert the data to a f32 array for the GPU to utilze the data
pub trait ToGPUReadable {
    /// Convert the data to a f32 array
    fn to_gpu_code(&self) -> Vec<f32>;
}
macro_rules! impl_to_gpu_code {
    ($($t:ty),*) => {
        $(
            impl ToGPUReadable for $t {
                fn to_gpu_code(&self) -> Vec<f32> {
                    // We cast to u64 first to handle enums safely,
                    // then to f32 as per your requirement.
                    vec![1.0, *self as u64 as f32]
                }
            }
        )*
    };
}
macro_rules! impl_to_f32_empty {
    ($($t:ty),*) => {
        $(
            impl ToGPUReadable for $t {
                fn to_gpu_code(&self) -> Vec<f32> {
                    vec![]
                }
            }
        )*
    };
}
impl_to_gpu_code!(
    Placement, Alignment, Anchor, Cap, Join, bool, f32, f64, u32, u64, i32, i64, usize
);
impl_to_f32_empty!(String, TextField, NestedKey);
impl ToGPUReadable for Point {
    fn to_gpu_code(&self) -> Vec<f32> {
        vec![2., self.0 as f32, self.1 as f32]
    }
}
impl ToGPUReadable for PrimitiveValue {
    fn to_gpu_code(&self) -> Vec<f32> {
        if let Some(num) = self.to_f32() { vec![1., num] } else { vec![] }
    }
}
impl ToGPUReadable for ValuePrimitiveType {
    fn to_gpu_code(&self) -> Vec<f32> {
        match self {
            ValuePrimitiveType::Primitive(p) => p.to_gpu_code(),
            _ => vec![],
        }
    }
}
impl ToGPUReadable for ValueType {
    fn to_gpu_code(&self) -> Vec<f32> {
        match self {
            ValueType::Primitive(p) => p.to_gpu_code(),
            ValueType::Array(arr) => arr.iter().flat_map(|v| v.to_gpu_code()).collect(),
            _ => vec![],
        }
    }
}

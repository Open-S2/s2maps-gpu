// import getEasingFunction from './easingFunctions.js';
// import parseFilter from './parseFilter.js';
use crate::style::{
    Alignment, Anchor, Cap, DataCondition, DataRange, FilterFunction, Input, InputKey, InputRange,
    InputValue, InputValueType, Join, LayerWorkerFunction, NestedKey, Placement, TextField,
};
use alloc::{string::String, vec::Vec};
use s2json::{PrimitiveValue, Properties, ValueType};

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
/// - `input`: input value or property
/// - `cb`: callback function
///
/// ## Returns
/// a generic layer worker function
impl<T: InputValueType> ParseFeature<T> for Input<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, zoom: u8) -> T {
        //         match self {
        //             Input::Property(property) => match property {
        //                 Property::InputCondition => parse_default_case<T, U>(cb),
        //                 Property::InputValue(input_value) => input_value.parse_feature(cb),
        //                 Property::DataCondition(data_condition) => data_condition.parse_feature(cb),
        //                 Property::DataRange(data_range) => data_range.parse_feature(cb),
        //                 Property::InputRange(input_range) => input_range.parse_feature(cb),
        //                 Property::FeatureState(feature_state) => {
        //                     |code: &mut Vec<f32>, properties: &Properties, zoom: u8| -> U { cb(T::default()) }
        //                 }
        //                 Property::Fallback(fallback) => fallback.as_ref().parse_feature(cb),
        //             },
        //             Input::Value(value) => {
        //                 |code: &mut Vec<f32>, properties: &Properties, zoom: u8| -> U { cb(value) }
        //             }
        //         }
        todo!()
    }
}

/**
 * Input value function parser
 * @param input_value - input value
 * @param cb - callback function
 * @returns a generic layer worker function designed for input values
 */
fn input_value_function<T: InputValueType, U>(
    input_value: InputValue<T>,
    cb: Callback<T, U>,
) -> LayerWorkerFunction<U> {
    //   return (code: number[], properties: Properties): U => {
    //     const { key, fallback } = input_value;
    //     // dive into nested properties if needed
    //     let end_key: string;
    //     if (typeof key === 'object') {
    //       const nested_key = [...key.nested_key];
    //       while (nested_key.length > 1) {
    //         properties = (properties[nested_key[0]] ?? {}) as Properties;
    //         nested_key.shift();
    //       }
    //       end_key = nested_key[0];
    //     } else {
    //       end_key = key;
    //     }
    //     // return the input if it exists, otherwise fallback
    //     const res = (properties[end_key] ?? fallback) as T;
    //     const cbValue = cb(res);
    //     if (typeof cbValue === 'number') code.push(1, cbValue);
    //     else if (Array.isArray(cbValue)) code.push(cbValue.length, ...cbValue);
    //     return cbValue;
    //   };
    todo!()
}

impl<T: InputValueType> ParseFeature<T> for InputValue<T> {
    fn parse_feature(&self, code: &mut Vec<f32>, properties: Properties, _zoom: u8) -> T {
        let mut properties = properties;
        let Self { key, fallback } = self;
        // dive into nested properties if needed
        let mut end_key: String;
        // if (typeof key === 'object') {
        //   const nested_key = [...key.nested_key];
        //   while (nested_key.length > 1) {
        //     properties = (properties[nested_key[0]] ?? {}) as Properties;
        //     nested_key.shift();
        //   }
        //   end_key = nested_key[0];
        // } else {
        //   end_key = key;
        // }
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
        // let res = (properties[end_key] ?? fallback) as T;
        let res = properties.get(&end_key).map(|v| v.into()).unwrap_or(fallback.clone());
        // const cbValue = cb(res);
        // if (typeof cbValue === 'number') code.push(1, cbValue);
        // else if (Array.isArray(cbValue)) code.push(cbValue.length, ...cbValue);
        // return cbValue;

        todo!()
    }
}

/**
 * Data condition function parser
 * @param data_condition - data condition input
 * @param cb - callback function
 * @returns a generic layer worker function designed for data conditions
 */
fn data_condition_function<T: InputValueType, U>(
    data_condition: DataCondition<T>,
    cb: Callback<T, U>,
) -> LayerWorkerFunction<U> {
    //   const { conditions, fallback } = data_condition;
    //   const conditionList: Array<DataConditionList<U>> = [];
    //   const fallbackCondition = parseFeature(fallback);
    //   // store conditions
    //   for (const condition of conditions) {
    //     conditionList.push({
    //       condition: parseFilter(condition.filter),
    //       result: parseFeature(condition.input, cb),
    //     });
    //   }
    //   // build function
    //   return (code: number[], properties: Properties, zoom = 0): U => {
    //     if (properties !== undefined) {
    //       for (let i = 0, cl = conditionList.length; i < cl; i++) {
    //         // run through the conditionList
    //         const { condition, result } = conditionList[i];
    //         if (condition(properties)) {
    //           code.push(i + 1);
    //           return result(code, properties, zoom);
    //         }
    //       }
    //     }
    //     // if we made it here, just run the fallback
    //     code.push(0);
    //     const fallback = fallbackCondition?.(code, properties, zoom) as T;
    //     return cb(fallback);
    //   };
    todo!()
}

/**
 * Data range function parser
 * @param data_range - data range
 * @param cb - callback function
 * @returns a generic layer worker function for data ranges
 */
fn data_range_function<T: InputValueType, U>(
    data_range: DataRange<T>,
    cb: Callback<T, U>,
) -> LayerWorkerFunction<U> {
    //   const { key, ranges, ease, base } = data_range;
    //   const easeFunction = getEasingFunction<U>(ease, base);

    //   const parsed_ranges = ranges.map(({ stop, input }) => {
    //     return {
    //       stop,
    //       input: parseFeature(input, cb),
    //     };
    //   });

    //   return (code: number[], properties: Properties, _zoom: number): U => {
    //     let end_key: InputKey = key;
    //     // dive into nested properties if needed
    //     while (typeof end_key === 'object' && 'nested_key' in end_key) {
    //       const nested_key = [...end_key.nested_key];
    //       while (nested_key.length > 1) {
    //         properties = (properties[nested_key[0]] ?? {}) as Properties;
    //         nested_key.shift();
    //       }
    //       end_key = nested_key[0];
    //     }
    //     const dataInput =
    //       properties[end_key] !== undefined && !isNaN(properties[end_key] as number)
    //         ? Number(properties[end_key])
    //         : 0;
    //     if (dataInput <= parsed_ranges[0].stop) {
    //       // less then or equal to first stop
    //       return parsed_ranges[0].input(code, properties, dataInput);
    //     } else if (dataInput >= parsed_ranges[parsed_ranges.length - 1].stop) {
    //       // greater then or equal to last stop
    //       return parsed_ranges[parsed_ranges.length - 1].input(code, properties, dataInput);
    //     } else {
    //       // somewhere inbetween two stops. lets interpolate
    //       let i = 0;
    //       while (parsed_ranges[i] !== undefined && parsed_ranges[i].stop <= dataInput) i++;
    //       if (parsed_ranges.length === i) i--;
    //       const startValue = parsed_ranges[i - 1].input(code, properties, dataInput);
    //       const startStop: number = parsed_ranges[i - 1].stop;
    //       const endValue = parsed_ranges[i].input(code, properties, dataInput);
    //       const endStop: number = parsed_ranges[i].stop;
    //       return easeFunction(dataInput, startStop, endStop, startValue, endValue);
    //     }
    //   };
    todo!()
}

// TODO: Support type property (defaults to 'zoom')
/// Input range function parser
///
/// ## Parameters
/// - `input_range`: input range
/// - `cb`: callback function
///
/// ## Returns
/// a generic layer worker function for input ranges
fn input_range_function<T: InputValueType, U>(
    input_range: InputRange<T>,
    cb: Callback<T, U>,
) -> LayerWorkerFunction<U> {
    //   const { ranges, ease, base } = input_range;
    //   const easeFunction = getEasingFunction<U>(ease, base);

    //   // first ensure each result property is parsed:
    //   const parsed_ranges = ranges.map(({ stop, input }) => {
    //     return {
    //       stop,
    //       input: parseFeature(input, cb),
    //     };
    //   });

    //   return (code: number[], properties: Properties, zoom: number): U => {
    //     if (zoom <= parsed_ranges[0].stop) {
    //       return parsed_ranges[0].input(code, properties, zoom);
    //     } else if (zoom >= parsed_ranges[parsed_ranges.length - 1].stop) {
    //       return parsed_ranges[parsed_ranges.length - 1].input(code, properties, zoom);
    //     } else {
    //       let i = 0;
    //       while (parsed_ranges[i] !== undefined && parsed_ranges[i].stop <= zoom) i++;
    //       if (parsed_ranges.length === i) i--;
    //       const startValue = parsed_ranges[i - 1].input(code, properties, zoom);
    //       const startStop: number = parsed_ranges[i - 1].stop;
    //       const endValue = parsed_ranges[i].input(code, properties, zoom);
    //       const endStop: number = parsed_ranges[i].stop;
    //       return easeFunction(zoom, startStop, endStop, startValue, endValue);
    //     }
    //   };
    todo!()
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

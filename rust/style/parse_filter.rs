use crate::style::{Comparator, InputKey, InputValueType, coalesce_field};
use alloc::{string::String, vec::Vec};
use s2json::{PrimitiveValue, Properties, ValuePrimitiveType, ValueType};
use serde::{Deserialize, Serialize};

// examples:
// filter: { key: 'class', comparator: '==', value: 'ocean' }
// filter: { or: [{ key: 'class', comparator: '==', value: 'ocean' }, { key: 'class', comparator: '==', value: 'river' }] }
// filter: { and: [{ key: 'class', comparator: '==', value: 'ocean' }, { key: 'class', comparator: '==', value: 'lake' }, { key: 'class', comparator: '!=', value: 'river' }] }

/// Conditional function build for filtering
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct ConditionFunction {
    pub comparator: Comparator,
    pub value: Option<ValueType>,
}
impl ConditionFunction {
    /// Create a new conditional function build
    pub fn new(comparator: Comparator, value: Option<ValueType>) -> Self {
        Self { comparator, value }
    }
}
/// Filter function
pub type FilterFunction = fn(properties: &Properties) -> bool;
/// Key condition contains the key itself and a function that returns a boolean if it passes the condition
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct KeyCondition {
    /// The key
    pub key: String,
    /// The key's conditional function
    pub key_function: ConditionFunction,
}
impl PartialEq for KeyCondition {
    fn eq(&self, other: &Self) -> bool {
        self.key == other.key
    }
}
/// Conditional manager
#[derive(Debug, Default, Clone)]
pub struct Conditional {
    /// Key condition
    pub key_condition: Option<KeyCondition>,
    /// Filter Condition
    pub filter_condition: Option<FilterFunction>,
}
impl PartialEq for Conditional {
    fn eq(&self, other: &Self) -> bool {
        self.key_condition == other.key_condition
    }
}

/// Condition object.
///
/// ### Properties
/// - `key`: [See {@link NestedKey}] The key to pull the value from the properties to compare
/// - `comparator`: [See {@link Comparator}] Used by the filter function to determine if a feature should be included in the render.
/// - `value`: [See {@link NotNullOrObject}] optional value to compare against
///
/// When creating conditionals, you have two ways to do it:
///
/// ## 1. key_condition
///
/// ```json
/// { "filter": { "key": "type", "comparator": "in", "value": ["ocean", "lake"] } }
///
/// ## 2. filter_condition
///
/// ```json
/// { "filter": { "and": [{ "key": "class", "comparator": "==", "value": "ocean" }, { "key": "size", "comparator": "==", "value": "large" }, { "key": "type", "comparator": "!=", "value": "pacific" }] } }
/// ```
///
/// ## Nesting
///
/// Sometimes vector data's properties are complex objects. To access nested fields, you can simulate dot notation:
///
/// ```json
/// { "filter": { "key": { "nestedKey": ["class", "type"] }, "comparator": "==", "value": "ocean" } }
/// ```
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Condition {
    /// The key, either the objects top level key name or a pathway to the nested object's key name
    pub key: InputKey,
    /// One of `"==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "!in" | "has" | "!has"`
    /// Used by the filter function to determine if a feature should be included in the render.
    ///
    /// NOTE: "in" means "in the array" and "has" means "has the key"
    ///
    /// ex.
    /// ```json
    /// { "filter": { "key": "type", "comparator": "in", "value": ["ocean", "lake"] } }
    /// ```
    /// this would be used to filter features where `feature.properties.type` is either "ocean" or "lake"
    ///
    /// ex.
    /// ```json
    /// { "filter": { "key": "type", "comparator": "has", "value": "ocean" } }
    /// ```
    /// this would be used to filter features where `feature.properties.type` is an array that has the key "ocean"
    pub comparator: Comparator,
    /// A non null object.
    ///
    /// Must be an array for "in" or "!in"
    pub value: Option<ValueType>,
}

/// Filter Definition
///
/// A filter is a set of conditions that are used to filter out features.
///
/// ### Forms
/// - And Gate Filter: {@link AndFilter}
/// - Or Gate Filter: {@link OrFilter}
/// - Condition: {@link Condition}
///
/// ### Condition Parameters
/// - `key`: The key to filter on
/// - `comparator`: [See {@link Comparator}] The comparator to use
/// - `value`: The value to compare
///
/// example:
///
/// ```json
/// "filter": { "key": "class", "comparator": "==", "value": "ocean" }
/// ```
///
/// another example:
///
/// ```json
/// "filter": {
///  "or": [
///    { "key": "class", "comparator": "==", "value": "ocean" },
///    { "key": "class", "comparator": "==", "value": "bay" }
///  ]
/// }
/// ```
///
/// another example:
///
/// ```json
/// "filter": {
///  "and": [
///    { "key": "class", "comparator": "==", "value": "ocean" },
///    { "key": "size", "comparator": "==", "value": "large" },
///    { "key": "type", "comparator": "!=", "value": "pacific" }
///  ]
/// }
/// ```
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Filter {
    /// And Gate
    And(AndFilter),
    /// Or Gate
    Or(OrFilter),
    /// Conditional Filter
    Condition(Condition),
}
impl Default for Filter {
    fn default() -> Self {
        Filter::And(AndFilter::default())
    }
}
/// And Gate Filter
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct AndFilter {
    /// The list AND conditions
    pub and: Vec<Filter>,
}
/// Or Gate Filter
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrFilter {
    /// The list OR conditions
    pub or: Vec<Filter>,
}
impl Filter {
    /// Parse a filter into a filter function
    ///
    /// ## Parameters
    /// - `filter`: input user defined filter
    ///
    /// ## Returns
    /// a filter function that represents the user defined filter
    pub fn filter(&self, properties: Option<&Properties>) -> bool {
        match self {
            Filter::And(filter) => {
                for filter in filter.and.iter() {
                    if !filter.filter(properties) {
                        return false;
                    }
                }
                return true;
            }
            Filter::Or(filter) => {
                for filter in filter.or.iter() {
                    if filter.filter(properties) {
                        return true;
                    }
                }
                return false;
            }
            Filter::Condition(cond) => {
                let Condition { key, comparator, value } = cond;
                let field =
                    coalesce_field(key.into(), properties.cloned().unwrap_or_default(), Some(true));
                // cond.
                ConditionFunction::new(comparator.clone(), value.clone())
                    .filter(&field.into(), properties)
            }
        }
    }
}

/// Parse a filter condition
///
/// ## Parameters
/// - `comparator`: comparator operator
/// - `value`: input value
///
/// ## Returns
/// Condition function result
impl ConditionFunction {
    /// filter out the feature
    pub fn filter(&self, input: &ValueType, properties: Option<&Properties>) -> bool {
        if self.value.is_none() {
            return false;
        }
        let value = self.value.as_ref().unwrap();
        // manage multiple comparators
        match self.comparator {
            Comparator::Eq => {
                // ['class', '==', 'ocean'] OR ['elev', '==', 50]
                *input == build_value(value, properties)
            }
            Comparator::NotEq => {
                // ['class', '!=', 'ocean'] OR ['elev', '!=', 50]
                *input != build_value(value, properties)
            }
            Comparator::Gt => {
                // ['elev', '>', 50]
                input.to_prim().unwrap().to_f64().unwrap() > build_value(value, properties)
            }
            Comparator::Gte => {
                // ['elev', '>=', 50]
                input.to_prim().unwrap().to_f64().unwrap() >= build_value(value, properties)
            }
            Comparator::Lt => {
                // ['elev', '<', 50]
                input.to_prim().unwrap().to_f64().unwrap() < build_value(value, properties)
            }
            Comparator::Lte => {
                // ['elev', '<=', 50]
                input.to_prim().unwrap().to_f64().unwrap() <= build_value(value, properties)
            }
            Comparator::Has => {
                // ['class', 'has', ['ocean', 'river']]
                let arrs = build_values(value, properties);
                arrs.contains(input)
            }
            Comparator::NotHas => {
                // ['class', '!has', ['ocean', 'river']]
                let arrs = build_values(value, properties);
                !arrs.contains(input)
            }
            Comparator::In => {
                // ['elev', 'in', 50]
                if let ValueType::Array(input) = input
                    && let Some(ValueType::Primitive(value)) = &self.value
                {
                    input.contains(&ValuePrimitiveType::Primitive(value.clone()))
                } else {
                    false
                }
            }
            Comparator::NotIn => {
                // ['class', '!in', 'ocean'] OR ['elev', '!in', 50]
                if let ValueType::Array(input) = input
                    && let Some(ValueType::Primitive(value)) = &self.value
                {
                    !input.contains(&ValuePrimitiveType::Primitive(value.clone()))
                } else {
                    true
                }
            }
        }
    }
}

/// Build a value from a string or an array of strings
///
/// ## Parameters
/// - `value`: input value
/// - `properties`: properties to coalesce
///
/// ## Returns
/// The built value
fn build_value<T: InputValueType>(value: &ValueType, properties: Option<&Properties>) -> T {
    if is_string(value)
        && let Some(properties) = properties
    {
        let strings = to_strings(value);
        let res = coalesce_field(strings.into(), properties.clone(), None);
        let res_to_val: ValueType = res.into();
        return (&res_to_val).into();
    }
    value.into()
}

/// Build a value from a string or an array of strings
///
/// ## Parameters
/// - `value`: input value
/// - `properties`: properties to coalesce
///
/// ## Returns
/// The built value
fn build_values<T: InputValueType>(value: &ValueType, properties: Option<&Properties>) -> Vec<T> {
    if is_string(value) && properties.is_some() {
        vec![build_value(value, properties)]
    } else if let ValueType::Array(arr) = value {
        arr.iter().map(|v| build_value(&ValueType::Primitive(v.into()), properties)).collect()
    } else {
        vec![value.into()]
    }
}

/// Returns true if the value is a string or an array of strings
fn is_string(value: &ValueType) -> bool {
    match value {
        ValueType::Primitive(PrimitiveValue::String(_)) => true,
        ValueType::Array(a) => {
            a.iter().all(|v| matches!(v, ValuePrimitiveType::Primitive(PrimitiveValue::String(_))))
        }
        _ => false,
    }
}
/// Return a collection of strings
fn to_strings(value: &ValueType) -> Vec<String> {
    match value {
        ValueType::Primitive(PrimitiveValue::String(v)) => vec![v.clone()],
        ValueType::Array(a) => a
            .iter()
            .filter_map(|v| match v {
                ValuePrimitiveType::Primitive(PrimitiveValue::String(v)) => Some(v.clone()),
                _ => None,
            })
            .collect(),
        _ => vec![],
    }
}

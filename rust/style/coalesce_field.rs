use crate::style::TextField;
use alloc::{
    string::{String, ToString},
    vec,
    vec::Vec,
};
use s2json::{Properties, ValueType};

/// Get the current language from the environment
#[cfg(feature = "std")]
pub fn language() -> String {
    std::env::var("LANG")
        .ok()
        .and_then(|v| v.split('.').next().map(|s| s.to_string()))
        .and_then(|v| v.split('_').next().map(|s| s.to_string()))
        .unwrap_or_else(|| "en".into())
}

/// Get the current language from the environment
#[cfg(not(feature = "std"))]
pub fn language() -> String {
    "en".into()
}

/// Coalesce text layout property "field"
///
/// examples:
///
/// ```ts
/// // example 1
/// const properties = { abbr: 'U.S.', name: 'United States', ... }
/// const field = ["\"", "?abbr,?name", "\""] // here we coallese to abbr if the property exists, otherwise we fallback on name
/// cooalesceField(field) // returns "U.S." or "United States" depending on whether abbr exists
///
/// // example 2
/// const properties = { type: 'airplane', ... }
/// const field = ["?type", "-16"]
/// cooalesceField(field) // 'airplane-16'
/// ```
///
/// ## Parameters
/// - `field`: string field, array of string fields, or nested key
/// - `properties`: properties to coalesce
/// - `field_is_key`: whether the field is the key in properties or a value to coalesce
///
/// ## Returns
/// the coalesced field
pub fn coalesce_field(
    mut field: TextField,
    mut properties: Properties,
    field_is_key: Option<bool>,
) -> String {
    let field_is_key = field_is_key.unwrap_or(false);
    // first dive into nested properties if field is an object
    while let TextField::Nested(nest_key) = field {
        // let NestedKey { nested_key } = nest_key;
        let mut nested_key = nest_key.nested_key.clone();
        while nested_key.len() > 1 {
            let key = nested_key.remove(0);
            properties = properties.get(&key).map(|v| v.into()).unwrap_or_default();
        }
        field = TextField::Field(nested_key[0].clone());
    }
    // now coalesce the field
    match field {
        TextField::Field(text) => coalesce_text(&text, &properties, field_is_key),
        TextField::Expression(texts) => {
            let mut result = String::new();
            for text in texts {
                result.push_str(&coalesce_text(&text, &properties, field_is_key));
            }
            result
        }
        _ => String::new(),
    }
}

/// Parse unique strings that start with:
/// - "?": coalesce from properties
/// - "!": transform the result
/// - - "U": uppercase
/// - - "L": lowercase
/// - - "C": capitalize
/// - "P": language aquisition (e.g. "XX" -> "en"). Defined by navigator.language (browser)
///
/// ## Parameters
/// - `field`: field string to parse
/// - `properties`: properties to coalesce
/// - `field_is_key`: whether the field is the key in properties or a value to coalesce
///
/// ## Returns
/// the coalesced field
pub fn coalesce_text(field: &str, properties: &Properties, field_is_key: bool) -> String {
    if field.starts_with("?") {
        // corner case - use defined that they needed to start with a ?
        if field.chars().nth(1) == Some('?') {
            return field[1..].into();
        }
        for piece in field.split(',') {
            let mut piece: String = piece.into();
            // prep variables
            let mut char_index = 1;
            let mut next_char: char;
            let mut transforms: Vec<fn(input: String) -> String> = vec![];
            while piece.chars().nth(char_index) == Some('!') {
                char_index += 1;
                next_char = piece.chars().nth(char_index).unwrap_or_default();
                char_index += 1;
                if next_char == 'U' {
                    transforms.push(|input: String| -> String { input.to_uppercase() });
                }
                // all uppercase
                else if next_char == 'L' {
                    transforms.push(|input: String| -> String { input.to_uppercase() });
                }
                // all lowercase
                else if next_char == 'C' {
                    transforms.push(|input: String| -> String {
                        input
                            .split(' ')
                            .map(|i| {
                                let mut c = i.chars();
                                let first: String = c
                                    .next()
                                    .map(|ch| ch.to_uppercase().to_string())
                                    .unwrap_or_default();
                                let rest = c.as_str().to_lowercase();
                                first + &rest
                            })
                            .collect::<Vec<_>>()
                            .join(" ")
                    });
                }
                // first letter capitalized, rest lower
                else if next_char == 'P' {
                    piece = piece.replace("XX", &language());
                }
            }
            let key = &piece[char_index..];
            if let Some(key) = properties.get(key) {
                let mut res: String = key.into();
                for transform in transforms {
                    res = transform(res);
                }
                return res;
            }
            todo!()
        }
        return "".into();
    } else {
        if field_is_key {
            properties.get(field).unwrap_or(&ValueType::default()).into()
        } else {
            String::from(field)
        }
    }
}

use crate::{
    render::WebGPUBuffer,
    style::{
        ColorArray, EaseType, Easing, EncodeLayerAttribute, Filter, FilterFunction, ToGPUReadable,
    },
    ui::View,
    util::UrlMap,
    workers::MarkerMetadata,
};
use alloc::{boxed::Box, collections::btree_map::BTreeMap, string::String, vec::Vec};
use bytemuck::{Pod, Zeroable};
use gistools::data_structures::{ClusterOptions, TileStoreOptions};
use s2_tilejson::{MapboxTileJSONMetadata, Metadata, UnknownMetadata};
use s2json::{JSONCollection, MValue, Point, Properties, ValueType};
use serde::{Deserialize, Serialize};

// assistive macro to ensure an object value contains a certain string name
macro_rules! must_be_str {
    ($name:ident, $expected:expr) => {
        fn $name<'de, D: serde::Deserializer<'de>>(d: D) -> Result<String, D::Error> {
            let v = String::deserialize(d)?;
            if v == $expected {
                Ok(v)
            } else {
                Err(serde::de::Error::custom(concat!("type must be \"", $expected, "\"")))
            }
        }
    };
}
must_be_str!(must_be_json, "json");
must_be_str!(must_be_markers, "markers");
must_be_str!(must_be_fill, "fill");
must_be_str!(must_be_glyph, "glyph");
must_be_str!(must_be_heatmap, "heatmap");
must_be_str!(must_be_line, "line");
must_be_str!(must_be_point, "point");
must_be_str!(must_be_raster, "raster");
must_be_str!(must_be_hillshade, "hillshade");
must_be_str!(must_be_sensor, "sensor");
must_be_str!(must_be_shade, "shade");

/// Input Values that are used by the style enging all follow these rules to ensure they can
/// be serialized, deserialized, then used by the style engine in various ways including interpolation
pub trait InputValueType:
    Clone
    + Default
    + Easing
    + EncodeLayerAttribute
    + for<'a> From<&'a ValueType>
    + ToGPUReadable
    + PartialEq
{
}
impl<T> InputValueType for T where
    T: Clone
        + Default
        + Easing
        + EncodeLayerAttribute
        + for<'a> From<&'a ValueType>
        + ToGPUReadable
        + PartialEq
{
}

/// Whether the projection is S2 or WM
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum Projection {
    /// S2
    #[default]
    S2,
    /// WM
    WM,
}
impl From<Projection> for s2json::Projection {
    fn from(p: Projection) -> Self {
        match p {
            Projection::S2 => s2json::Projection::S2,
            Projection::WM => s2json::Projection::WG,
        }
    }
}

/// All source input objects contain these shapes
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SourceActualMetadata {
    /// S2 TileJSON Metadata
    Metadata(Box<Metadata>),
    /// Mapbox TileJSON Metadata
    Mapbox(Box<MapboxTileJSONMetadata>),
    /// Cluster Options
    ClusterOptions(Box<ClusterOptions>),
    /// Tile Store Options
    TileStoreOptions(Box<TileStoreOptions>),
}
impl Default for SourceActualMetadata {
    fn default() -> Self {
        SourceActualMetadata::Metadata(Box::new(Metadata::default()))
    }
}
impl SourceActualMetadata {
    /// Get the TileStoreOptions
    pub fn tile_options(&self) -> Option<TileStoreOptions> {
        match self {
            SourceActualMetadata::TileStoreOptions(options) => Some(options.as_ref().clone()),
            _ => None,
        }
    }
}
/// User Defined Inputs
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct SourceMetadata<M = ()> {
    /// Sometimes provided for to have easier access to fetch the source data
    pub path: Option<String>,
    /// The size of the tile in pixels if some form of raster data
    /// required by raster type sources
    pub size: Option<u32>, // required by raster type sources
    /// The time interval in milliseconds each frame is.
    /// Used by sensor sources.
    pub interval: Option<f64>,
    /// Specify the name of the source in order to access it.
    /// This is useful if you want to make requests without first having to request the metadata
    pub source_name: Option<String>,
    /// If you want to directly inject the geojson or s2json data
    pub data: Option<JSONCollection<M>>,
    /// Other build engines place layer data inside a json string
    pub json: Option<String>,
    /// Flattens the actual metadata. Can be any number of metadata types. Previous top level
    /// fields are user defined attributes
    #[serde(flatten)]
    pub metadata: SourceActualMetadata,
}
impl<M> SourceMetadata<M> {
    /// Get the minimum zoom level
    pub fn minzoom(&self) -> u8 {
        match &self.metadata {
            SourceActualMetadata::Metadata(m) => m.minzoom,
            SourceActualMetadata::Mapbox(m) => m.minzoom.unwrap_or(0),
            SourceActualMetadata::ClusterOptions(m) => m.minzoom.unwrap_or(0),
            SourceActualMetadata::TileStoreOptions(m) => m.minzoom.unwrap_or(0),
        }
    }
    /// Get the maximum zoom level
    pub fn maxzoom(&self) -> u8 {
        match &self.metadata {
            SourceActualMetadata::Metadata(m) => m.minzoom,
            SourceActualMetadata::Mapbox(m) => m.minzoom.unwrap_or(0),
            SourceActualMetadata::ClusterOptions(m) => m.minzoom.unwrap_or(0),
            SourceActualMetadata::TileStoreOptions(m) => m.minzoom.unwrap_or(0),
        }
    }
    /// Get the metadata
    pub fn meta(&self) -> Option<&Metadata> {
        match &self.metadata {
            SourceActualMetadata::Metadata(m) => Some(m),
            _ => None,
        }
    }
}
impl<M: Default> From<Metadata> for SourceMetadata<M> {
    fn from(meta: Metadata) -> Self {
        Self { metadata: SourceActualMetadata::Metadata(Box::new(meta)), ..Default::default() }
    }
}
impl<M: Default> From<UnknownMetadata> for SourceMetadata<M> {
    fn from(unknown: UnknownMetadata) -> Self {
        Self {
            metadata: SourceActualMetadata::Metadata(Box::new(unknown.to_metadata())),
            ..Default::default()
        }
    }
}

/// JSON Source allows inlined geometry in your style
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JSONSource<M = (), P: Clone + Default = Properties, D: Clone + Default = MValue> {
    /// The type of the source. Must be "json"
    #[serde(deserialize_with = "must_be_json")]
    pub r#type: String,
    /// The JSON data
    pub data: JSONCollection<M, P, D>,
}

/// A Marker source is a local cache that specifically tracks and maintains markers
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarkerSource<P: Clone + Default = Properties, D: Clone + Default = MValue> {
    /// The type of the source. Must be "markers"
    #[serde(deserialize_with = "must_be_markers")]
    pub r#type: String,
    /// The JSON data
    pub data: JSONCollection<MarkerMetadata, P, D>,
}
/// List of all source inputs. A String is just a href to SourceMetadata
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Source<M = (), P: Clone + Default = Properties, D: Clone + Default = MValue> {
    /// String input, should be an href
    Href(String),
    /// Input metadata pointing to an external source and it's attributes
    SourceMetadata(SourceMetadata<M>),
    /// JSON data source
    JSONSource(JSONSource<M, P, D>),
    /// Local Source has predefined geometry in this library you can use
    LocalSource,
    /// Marker Source are a collection of points with predefined data
    MarkerSource(MarkerSource<P, D>),
}
impl From<String> for Source {
    fn from(value: String) -> Self {
        Source::Href(value)
    }
}
impl<M> From<SourceMetadata<M>> for Source<M> {
    fn from(value: SourceMetadata<M>) -> Self {
        Source::<M>::SourceMetadata(value)
    }
}
impl<M, P: Clone + Default, D: Clone + Default> From<JSONCollection<M, P, D>> for Source<M, P, D> {
    fn from(value: JSONCollection<M, P, D>) -> Self {
        Source::JSONSource(JSONSource { r#type: "json".into(), data: value })
    }
}
impl<P: Clone + Default, D: Clone + Default> From<MarkerSource<P, D>>
    for Source<MarkerMetadata, P, D>
{
    fn from(value: MarkerSource<P, D>) -> Self {
        Source::MarkerSource(value)
    }
}

/// Where to fetch data and JSON guides on how to fetch them. If JSON data, it can be included directly in the source
///
/// ex.
/// ```json
/// "sources": {
///   "countries": "/s2json/countriesHD.s2json",
///   "earthquakes": "/s2json/earthquakes.s2json"
/// }
/// ```
pub type Sources = BTreeMap<String, Source>;

/// GLYPHS, FONTS, SPRITES, AND ICONS

/// Glyph Data (both fonts and icons) and how to fetch them
///
/// ex.
/// ```json
/// "glyphs": {
///   "robotoMedium": "/api/glyphs-v2/RobotoMedium",
///   "streets": "/api/glyphs-v2/streets"
/// }
/// ```
pub type Glyphs = BTreeMap<String, String>;
/// Fonts and how to fetch them
///
/// ex.
/// ```json
/// "fonts": {
///   "robotoMedium": "/api/glyphs-v2/RobotoMedium"
/// }
/// ```
pub type Fonts = Glyphs;
/// Icons and how to fetch them
///
/// ex.
/// ```json
/// "icons": {
///   "streets": "/api/glyphs-v2/streets"
/// }
/// ```
pub type Icons = Glyphs;
/// Sprites names and where to fetch
///
/// Sprites have a default expectancy of a `png` image.
///
/// If you want to use a different format, you can use an object instead of a string.
///
/// See {@link UrlMap} to use your own scheme/protocol for the URL path.
///
/// ### Parameters
/// - `path`: The path to the sprite
/// - `fileType`: The file type of the sprite
///
/// ex.
/// ```json
/// "sprites": {
///    "streets": "/sprites/streets/sprite@2x"
/// }
/// ```
///
/// ex.
/// ```json
/// "sprites": {
///    "streets": {
///      "path": "/sprites/streets/sprite@2x",
///      "fileType": "jpg"
///    }
/// }
/// ```
pub type Sprites = BTreeMap<String, SpriteSource>;

/// Sprite Source. Either an href or an object defining the path and file type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SpriteSource {
    /// href input
    Href(String),
    /// Object
    Object(SpriteSourceObject),
}

/// An object that defines the path and file type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpriteSourceObject {
    /// The URL path to the sprite
    pub path: String,
    /// The file type of the sprite. e.g. `png`, `jpg`, `webp`, etc.
    #[serde(rename = "fileType")]
    pub file_type: String,
}

// LAYER MANAGMENT
// User defined layers are stored in the style.layers array.
// To ensure proper ordering (future GPU use) and ensure valid data,
// the layer data is sent to the appropriate workflow to process into a "Definition" version.
// Style -> Definition
//
// The next step deviates upon whether the layer is used for rendering (workflow), or for filtering (worker).
//
// Worflow (program / pipeline):
// Definition[paint + layout] ->
//   webgl1: encodeLayerAttribute (stores "code" var)
//   webgl2 + webgpu: encodeLayerAttribute (stores "code" var)
//
// Worker:
// Definition[paint + layout] -> parseFeature (updates all paint + layout properties to LayerFunction)

/// # Cursor Options
/// [MDN Reference](https://developer.mozilla.org/docs/Web/CSS/cursor)
///
/// Matches the `CSSStyleDeclaration['cursor']` property
///
/// The default is `"default"`
///
/// ### Common Options
/// - `"pointer"`
/// - `"progress"`
/// - `"crosshair"`
/// - `"move"`
/// - `"text"`
/// - `"grab"`
/// - `"grabbing"`
/// - `"help"`
/// - `"none"`
/// - `"zoom-in"`
/// - `"zoom-out"`
pub type Cursor = String;

/// The workflow takes a layer and builds a function that modifies a feature into renderable data
pub type LayerWorkerFunction<U> = fn(code: &[u32], properties: &Properties, zoom: u8) -> U;
/// An workflow interpretor to create code for the GPU to translate into renderable data
pub type BuildCodeFunction = fn(zoom: u8, properties: &Properties) -> (Vec<u32>, Vec<f32>);
/// An workflow interpretor to create code for the GPU to translate into renderable data
pub type BuildCodeFunctionZoom = fn(zoom: u8) -> Vec<f32>;

/// # Comparator
///
/// One of `"==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "!in" | "has" | "!has"`
///
/// Used by the filter function to determine if a feature should be included in the render.
///
/// `NOTE`: "in" means "in the array" and "has" means "has the key"
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
///
/// this would be used to filter features where `feature.properties.type` is an array that has the key "ocean"
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub enum Comparator {
    /// Equal
    #[serde(rename = "==")]
    #[default]
    Eq,
    /// Not Equal
    #[serde(rename = "!=")]
    NotEq,
    /// Greater Than
    #[serde(rename = ">")]
    Gt,
    /// Greater than or Equal
    #[serde(rename = ">=")]
    Gte,
    /// Less Than
    #[serde(rename = "<")]
    Lt,
    /// Less Than or Equal to
    #[serde(rename = "<=")]
    Lte,
    /// Inside/Contains
    #[serde(rename = "in")]
    In,
    /// Not Inside / Not Contained
    #[serde(rename = "!in")]
    NotIn,
    /// Has
    #[serde(rename = "has")]
    Has,
    /// Does not Have
    #[serde(rename = "!has")]
    NotHas,
}

/// # Nested Key
///
/// Access value in feature properties by either its key or dive into a neste key
///
/// ### Key
/// - If the key is immediately accessible, set the key.
/// - If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
///
/// ex.
/// ```json
/// { "filter": { "key": "class", "comparator": "==", "value": "ocean" } }
/// ```
///
/// ### Nested Key
/// - Nested conditions are used to dive into nested properties
/// - If the feature properties has say `feature.properties.class.type === 'ocean'` and we want to access the `type` key
///
/// ex.
/// ```json
/// { "filter": { "key": { "nestedKey": ["class", "type"] }, "comparator": "==", "value": "ocean" } }
/// ```
#[derive(Debug, Default, Clone, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct NestedKey {
    /// nested conditions are used to dive into nested properties
    ///
    /// ex.
    /// ```json
    /// { "filter": { "key": { "nestedKey": ["class", "type"] }, "comparator": "==", "value": "ocean" } }
    /// ```
    ///
    /// this would be used to filter features where `feature.properties.class.type === 'ocean'`
    #[serde(rename = "nestedKey")]
    pub nested_key: Vec<String>,
}
/// # Input Key
///
/// Either the key itself, or path towards a nested key
///
/// See [`NestedKey`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InputKey {
    /// The Key
    Key(String),
    /// The Nested Key Pathway
    Nested(NestedKey),
}
impl Default for InputKey {
    fn default() -> Self {
        InputKey::Key(String::default())
    }
}
impl From<String> for InputKey {
    fn from(value: String) -> Self {
        InputKey::Key(value)
    }
}
impl From<&InputKey> for TextField {
    fn from(value: &InputKey) -> Self {
        match value {
            InputKey::Key(key) => TextField::Field(key.clone()),
            InputKey::Nested(nested_key) => TextField::Nested(nested_key.clone()),
        }
    }
}

/// # Input Value
///
/// Input values directly access properties data from the feature.
///
/// ex.
///
/// Lets say you have a feature with the following properties:
/// ```ts
/// const properties = {
///   class: {
///     type: 'blue',
///     subclass: 'deep'
///   }
/// }
/// ```
///
/// You can utilize/access the `type` property with the following:
///
/// ```json
/// {
///   "color": {
///      "inputValue": {
///         "key": {
///            "nestedKey": ["class", "type"],
///         },
///         "fallback": "blue"
///      }
///   }
/// }
/// ```
///
/// ### Properties:
/// - `key`: [See {@link NestedKey}] Access value in feature properties by either its key or a nested key.
/// - `fallback`: If the property search for a key turns up no value, the fallback is used.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct InputValue<T: InputValueType> {
    /// Access value in feature properties by either its key or a nested key.
    ///
    /// If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
    ///
    /// nested conditions are used to dive into nested properties
    ///
    /// ex.
    /// ```json
    /// { "filter": { "key": { "nestedKey": ["class", "type"] }, "comparator": "==", "value": "ocean" } }
    /// ```
    /// this would be used to filter features where `feature.properties.class.type === 'ocean'`
    pub key: InputKey,
    /// If the property search for a key turns up no value, the fallback is used.
    pub fallback: T,
}

/// # Condition
///
/// Data conditions are used to filter features based on what property values the feature has.
/// - If the condition's filter passes, the input is used.
/// - If all conditions fail, the fallback is used.
///
/// ### Properties:
/// - `filter`: [See {@link Filter}] Filter conditions are used to filter features based on what property values the feature has.
/// - `input`: [See {@link Property}] Input values directly access properties data from the feature. The input value must be a {@link NotNullOrObject}
///
/// ex.
/// ```json
/// {
///   "filter": { "key": "country", "comparator": "==", "value": "US" },
///   "input": "#007bfe"
/// }
/// ```
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConditionFilter<T: InputValueType> {
    /// The condition filter
    pub filter: Filter,
    /// The input if the condition passes
    pub input: Input<T>,
}

/// # Data Condition
///
/// Data conditions are used to filter features based on what property values the feature has.
/// - If the condition's filter passes, the input is used.
/// - If all conditions fail, the fallback is used.
/// - Input value must be at a minimum a {@link NotNullOrObject}
///
/// ### Properties:
/// - `conditions`: [See {@link ConditionFilter}] array of `{ filter: Filter, input: Input<T> }`. If Filter passes, the input is used
/// - `fallback`: if all else fails, use this value. A value of `T` itself or pull from feature properties using {@link Property}
///
/// ex.
/// ```json
/// "color": {
///   "dataCondition": {
///     "conditions": [
///       {
///         "filter": { "key": "country", "comparator": "==", "value": "US" },
///         "input": "#007bfe"
///       }
///     ],
///     "fallback": "#23374d"
///   }
/// }
/// ```
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataCondition<T: InputValueType> {
    /// conditions is an array of `{ filter: Filter, input: Input<T> }`
    /// If the filter passes, the input is used.
    pub conditions: Vec<ConditionFilter<T>>,
    /// If the conditional search fails, the fallback is used.
    pub fallback: Box<Input<T>>,
}

/// One of [`DataRangeEase`] or [`DataRangeStep`]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DataRange<T: InputValueType> {
    /// Ease Case
    Ease(DataRangeEase<T>),
    /// Step Case
    Step(DataRangeStep<T>),
}
impl<T: InputValueType> Default for DataRange<T> {
    fn default() -> Self {
        DataRange::Ease(Default::default())
    }
}
impl<T: InputValueType> DataRange<T> {
    /// Get the Base Value
    pub fn base(&self) -> Option<f64> {
        match self {
            DataRange::Ease(ease) => ease.base,
            DataRange::Step(_) => None,
        }
    }
    /// Get the Ease Type
    pub fn ease(&self) -> EaseType {
        match self {
            DataRange::Ease(ease) => ease.ease.clone().unwrap_or_default(),
            DataRange::Step(_) => EaseType::Step,
        }
    }
    /// Get the collection of ranges
    pub fn ranges(&self) -> &Vec<Range<T>> {
        match self {
            DataRange::Ease(ease) => &ease.ranges,
            DataRange::Step(step) => &step.ranges,
        }
    }
    /// Get the key
    pub fn key(&self) -> InputKey {
        match self {
            DataRange::Ease(ease) => ease.key.clone(),
            DataRange::Step(step) => step.key.clone(),
        }
    }
}

/// One of [`InputRangeEase`] or [`InputRangeStep`]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InputRange<T: InputValueType> {
    /// Ease Case
    Ease(InputRangeEase<T>),
    /// Step Case
    Step(InputRangeStep<T>),
}
impl<T: InputValueType> Default for InputRange<T> {
    fn default() -> Self {
        InputRange::Ease(Default::default())
    }
}
impl<T: InputValueType> InputRange<T> {
    /// Get the Base Value
    pub fn base(&self) -> Option<f64> {
        match self {
            InputRange::Ease(ease) => ease.base,
            InputRange::Step(_) => None,
        }
    }
    /// Get the Ease Type
    pub fn ease(&self) -> EaseType {
        match self {
            InputRange::Ease(ease) => ease.ease.clone().unwrap_or_default(),
            InputRange::Step(_) => EaseType::Step,
        }
    }
    /// Get the Input Range Type
    pub fn r#type(&self) -> InputRangeType {
        match self {
            InputRange::Ease(ease) => ease.r#type,
            InputRange::Step(step) => step.r#type,
        }
    }
    /// Get the collection of ranges
    pub fn ranges(&self) -> &Vec<Range<T>> {
        match self {
            InputRange::Ease(ease) => &ease.ranges,
            InputRange::Step(step) => &step.ranges,
        }
    }
}

/// # Range
///
/// Set the range stops and the input values to apply at those stops.
///
/// ### Properties
/// - `stop`: A stop point in the range.
/// - `input`: [See {@link Property}] A value to apply at the stop. The input value must be a {@link NotNullOrObject}
///
/// ex.
/// ```json
/// "ranges": [
///   { "stop": 0, "input": 0 },
///   { "stop": 5, "input": 0.5 },
///   { "stop": 8, "input": 1 }
/// ]
/// ```
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Range<T: InputValueType> {
    /// Stop point
    pub stop: f32,
    /// Input Value at said stop point
    pub input: Input<T>,
}

/// # Data Range Ease
///
/// Data Range is used to group features based on a range of values and apply specific design attributes for those groups.
/// If the feature's value falls within the range, the fallback is used.
///
/// ex.
/// ```json
/// "weight": {
///   "dataRange": {
///     "key": "mag",
///     "ease": "expo",
///     "base": 1.5,
///     "ranges": [
///       { "stop": 0, "input": 0 },
///       { "stop": 8, "input": 1 }
///     ]
///   }
/// }
/// ```
///
/// ### Properties:
/// - `key`: [See {@link NestedKey}] Access value in feature properties by either its key or a nested key.
/// - `ease`: [See {@link EaseType}] The ease effect. Choose between `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
/// - `base`: Used by `expo`, `quad`, or `cubic` ease functions. Ranges from 0 -> 2 where 1 is linear, 0 is slow start, 2 is slow finish. [default: 1]
/// - `ranges`: [See {@link Range}] Set the range stops and the input values to apply at those stops.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataRangeEase<T: InputValueType> {
    /// Access value in feature properties by either its key or a nested key.
    ///
    /// If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
    ///
    /// nested conditions are used to dive into nested properties
    /// ex.
    /// ```json
    /// { "filter": { "key": { "nestedKey": ["class", "type"] }, "comparator": "==", "value": "ocean" } }
    /// ```
    /// this would be used to filter features where `feature.properties.class.type === 'ocean'`
    pub key: InputKey, // the objects[key] -> value used as position on range
    /// `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ease: Option<EaseType>,
    /// Used by `expo`, `quad`, or `cubic` ease functions
    ///
    /// Ranges from 0 -> 2 [default: 1]
    ///
    /// - `1` is the default and a linear ease
    /// - `0` is the slowest ease early on
    /// - `2` is the fastest ease
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<f64>, // 0 -> 2
    /// Set the range stops and the input values to apply at those stops.
    ///
    /// ex.
    /// ```json
    /// "ranges": [
    ///   { "stop": 0, "input": 0 },
    ///   { "stop": 5, "input": 0.5 },
    ///   { "stop": 8, "input": 1 }
    /// ]
    /// ```
    pub ranges: Vec<Range<T>>,
}

/// # Data Range Step
///
/// Data Range Step is used to group features based on a range of values and apply specific design
/// attributes for those groups. If the feature's value falls within the range, the fallback is used.
///
/// The "step" type is more limited than an ease type, often used by LAYOUT styling where the change is
/// immediate to each stop.
///
/// ex.
/// ```json
/// "opacity": {
///   "inputRange": {
///     "type": "zoom",
///     "ease": "step",
///     "ranges": [
///       { "stop": 0, "input": 1 },
///       { "stop": 5, "input": 0 }
///     ]
///   }
/// }
/// ```
///
/// ### Properties
/// - `ease`: Must be `"step"` if provided
/// - `key`: [See {@link NestedKey}] Access value in feature properties by either its key or a nested key.
/// - `ranges`: [See {@link Range}] Set the range stops and the input values to apply at those stops.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataRangeStep<T: InputValueType> {
    /// Access value in feature properties by either its key or a nested key.
    ///
    /// If the key is `class` for example, this would be used to filter feature's values where `feature.properties.class === 'ocean'`
    ///
    /// nested conditions are used to dive into nested properties
    /// ex.
    /// ```json
    /// { "filter": { "key": { "nestedKey": ["class", "type"] }, "comparator": "==", "value": "ocean" } }
    /// ```
    /// this would be used to filter features where `feature.properties.class.type === 'ocean'`
    pub key: InputKey, // the objects[key] -> value used as position on range
    /// Used by `expo`, `quad`, or `cubic` ease functions
    ///
    /// Ranges from 0 -> 2 [default: 1]
    ///
    /// - `1` is the default and a linear ease
    /// - `0` is the slowest ease early on
    /// - `2` is the fastest ease
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<f64>, // 0 -> 2
    /// Set the range stops and the input values to apply at those stops.
    ///
    /// ex.
    /// ```json
    /// "ranges": [
    ///   { "stop": 0, "input": 0 },
    ///   { "stop": 5, "input": 0.5 },
    ///   { "stop": 8, "input": 1 }
    /// ]
    /// ```
    pub ranges: Vec<Range<T>>,
}

/// Input Range Variable to apply as the input
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum InputRangeType {
    /// Zoom
    #[serde(rename = "zoom")]
    #[default]
    Zoom,
    /// Longitude
    #[serde(rename = "lon")]
    Lon,
    /// Latitude
    #[serde(rename = "lat")]
    Lat,
    /// Angle
    #[serde(rename = "angle")]
    Angle,
    /// Pitch
    #[serde(rename = "pitch")]
    Pitch,
}

/// # Input Range Ease
///
/// Input Range is used to group features based on a range of values based upon a `type` provided and apply specific design attributes for those groups.
/// If the feature's value falls within the range, the fallback is used.
///
/// ex.
/// ```json
/// "radius": {
///   "inputRange": {
///     "type": "zoom",
///     "ease": "expo",
///     "base": 1.5,
///     "ranges": [
///       { "stop": 0, "input": 3 },
///       { "stop": 8, "input": 30 }
///     ]
///   }
/// }
/// ```
///
/// ### Properties
/// - `type`: The type of input to use. Options are `zoom` | `lon` | `lat` | `angle` | `pitch`
/// - `ease`: [See {@link EaseType}] The ease effect. Choose between `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
/// - `base`: Used by `expo`, `quad`, or `cubic` ease functions. Ranges from 0 -> 2 where 1 is linear, 0 is slow start, 2 is slow finish. [default: 1]
/// - `ranges`: [See {@link Range}] Set the range stops and the input values to apply at those stops.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct InputRangeEase<T: InputValueType> {
    /// `zoom` | `lon` | `lat` | `angle` | `pitch`
    pub r#type: InputRangeType,
    /// `lin` | `expo` | `quad` | `cubic` | `step` [default: `lin`]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ease: Option<EaseType>,
    /// Used by `expo`, `quad`, or `cubic` ease functions
    ///
    /// Ranges from 0 -> 2 [default: 1]
    ///
    /// - `1` is the default and a linear ease
    /// - `0` is the slowest ease early on
    /// - `2` is the fastest ease
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<f64>, // 0 -> 2
    /// Set the range stops and the input values to apply at those stops.
    ///
    /// ex.
    /// ```json
    /// "ranges": [
    ///   { "stop": 0, "input": "#f28cb1" },
    ///   { "stop": 100, "input": "#f1f075" },
    ///   { "stop": 750, "input": "#51bbd6" }
    /// ]
    /// ```
    pub ranges: Vec<Range<T>>,
}

/// # Input Range Step
///
/// Input Range is used to group features based on a range of values based upon a `type` provided and apply specific design attributes for those groups.
/// If the feature's value falls within the range, the fallback is used.
///
/// The "step" type is more limited than an ease type, often used by LAYOUT styling where the change is
/// immediate to each stop.
///
/// ex.
/// ```json
/// "radius": {
///   "inputRange": {
///     "type": "zoom",
///     "ease": "expo",
///     "base": 1.5,
///     "ranges": [
///       { "stop": 0, "input": 3 },
///       { "stop": 8, "input": 30 }
///     ]
///   }
/// }
/// ```
///
/// ### Properties
/// - `ease`: Must be `"step"`
/// - `type`: The type of input to use. Options are `zoom` | `lon` | `lat` | `angle` | `pitch`
/// - `ranges`: [See {@link Range}] Set the range stops and the input values to apply at those stops.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct InputRangeStep<T: InputValueType> {
    /// `zoom` | `lon` | `lat` | `angle` | `pitch`
    pub r#type: InputRangeType,
    /// Used by `expo`, `quad`, or `cubic` ease functions
    ///
    /// Ranges from 0 -> 2 [default: 1]
    ///
    /// - `1` is the default and a linear ease
    /// - `0` is the slowest ease early on
    /// - `2` is the fastest ease
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base: Option<f64>, // 0 -> 2
    /// Set the range stops and the input values to apply at those stops.
    ///
    /// ex.
    /// ```json
    /// "ranges": [
    ///   { "stop": 0, "input": "#f28cb1" },
    ///   { "stop": 100, "input": "#f1f075" },
    ///   { "stop": 750, "input": "#51bbd6" }
    /// ]
    /// ```
    pub ranges: Vec<Range<T>>,
}

/// The Feature State's Condition
///
/// UNDER CONSTRUCTION - DO NOT USE EXPECTING CONSISTENT RESULTS
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FeatureStateCondition {
    /// Default
    #[serde(rename = "default")]
    #[default]
    Default,
    /// Inactive
    #[serde(rename = "inactive")]
    Inactive,
    /// Active
    #[serde(rename = "active")]
    Active,
    /// Hover
    #[serde(rename = "hover")]
    Hover,
    /// Selected
    #[serde(rename = "selected")]
    Selected,
    /// Disabled
    #[serde(rename = "disabled")]
    Disabled,
}
impl From<FeatureStateCondition> for f32 {
    fn from(condition: FeatureStateCondition) -> Self {
        match condition {
            FeatureStateCondition::Default => 0.,
            FeatureStateCondition::Hover => 1.,
            FeatureStateCondition::Active => 2.,
            FeatureStateCondition::Inactive => 3.,
            FeatureStateCondition::Selected => 4.,
            FeatureStateCondition::Disabled => 5.,
        }
    }
}

/// # Feature State
///
/// UNDER CONSTRUCTION - DO NOT USE EXPECTING CONSISTENT RESULTS
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct FeatureState<T: InputValueType> {
    /// The feature state's condition.
    /// Options are 'default' /* (inactive) */ | 'active' | 'hover' | 'selected' | 'disabled'
    pub condition: FeatureStateCondition,
    /// The input Key
    pub key: InputKey,
    /// The value
    pub value: T,
    /// The input to check against
    pub input: Input<T>,
}

/// Either the value type itself or a property object wrapping the value type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Input<T: InputValueType> {
    /// The value itself
    Value(T),
    /// The property wrapper that encodes the value along variable types
    Property(Property<T>),
}
impl<T: InputValueType> Default for Input<T> {
    fn default() -> Self {
        Input::Value(T::default())
    }
}
/// Either the value type itself or a property object wrapping the value type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum InputOnlyStep<T: InputValueType> {
    /// The value itself
    Value(T),
    /// The property wrapper that encodes the value along variable types
    Property(PropertyOnlyStep<T>),
}
impl<T: InputValueType> Default for InputOnlyStep<T> {
    fn default() -> Self {
        InputOnlyStep::Value(T::default())
    }
}

/// # Property
///
/// An extremely maleable input that allows you to style input data as either the value itself or
/// something that mutates on user input changes, data input changes, feature state like hovering, etc.
///
/// ex.
/// ```json
/// { "color": "rgba(240, 2, 5, 1)" }
/// ```
///
/// ex.
/// ```json
/// { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
/// ```
///
/// ex.
/// ```json
/// "weight": {
///   "dataRange": {
///     "key": "mag",
///     "ease": "expo",
///     "base": 1.5,
///     "ranges": [
///       { "stop": 0, "input": 0 },
///       { "stop": 8, "input": 1 }
///     ]
///   }
/// }
/// ```
///
/// ### Your list of options are:
/// - `inputValue`: [See {@link InputValue}] access value in feature properties
/// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
/// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
/// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
/// - `featureState`: [See {@link FeatureState}] filter based on feature state
/// - `fallback`: if all else fails, use this value. A value of `T` itself or pull from feature properties using {@link Property}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Property<T: InputValueType> {
    /// Input values directly access properties data from the feature. To be created
    #[serde(rename = "inputCondition")]
    InputCondition,
    /// Input values directly access properties data from the feature.
    /// @example Simple Key Access
    ///
    /// Lets say you have a feature with the following properties:
    /// ```ts
    /// const properties = {
    ///   class: {
    ///     type: 'color-scheme',
    ///     subclass: 'deep'
    ///   }
    /// }
    /// ```
    ///
    /// You can utilize/access the `type` property with the following:
    ///
    /// ```json
    /// {
    ///   "color": {
    ///      "inputValue": {
    ///         "key": {
    ///            "nestedKey": ["class", "type"],
    ///         },
    ///         "fallback": "blue"
    ///      }
    ///   }
    /// }
    /// ```
    /// @example Nested Key Access
    /// to get a better understanding of the `nestedKey`: (this is a contrived example)
    ///
    /// Lets say you have a feature with the following properties:
    /// ```ts
    /// const properties = {
    ///   a: {
    ///     b: {
    ///        c: '#fff'
    ///     }
    ///   }
    /// }
    /// ```
    ///
    /// You can utilize/access the `type` property with the following:
    ///
    /// ```json
    /// {
    ///   "color": {
    ///      "inputValue": {
    ///         "key": {
    ///            "nestedKey": ["a", "b", "c"],
    ///         },
    ///         "fallback": "blue"
    ///       }
    ///    }
    /// }
    /// ```
    #[serde(rename = "inputValue")]
    InputValue(InputValue<T>),
    /// Data conditions are used to filter features based on what property values the feature has.
    /// If the condition's filter passes, the input is used.
    /// If all conditions fail, the fallback is used.
    ///
    /// ex.
    /// ```json
    /// "color": {
    ///    "dataCondition": {
    ///      "conditions": [
    ///        {
    ///          "filter": { "key": "country", "comparator": "==", "value": "US" },
    ///          "input": "#007bfe"
    ///         }
    ///      ],
    ///      "fallback": "#23374d"
    ///    }
    ///  }
    /// ```
    ///
    /// ex.
    ///
    /// When using a cluster source you can access its sum:
    ///
    /// ```json
    /// "color": {
    ///  "dataCondition": {
    ///     "conditions": [
    ///       {
    ///         "filter": { "key": "__sum", "comparator": ">", "value": 750 },
    ///         "input": "#f28cb1"
    ///       },
    ///       {
    ///         "filter": { "key": "__sum", "comparator": ">", "value": 100 },
    ///         "input": "#f1f075"
    ///       }
    ///     ],
    ///     "fallback": "#51bbd6"
    ///   }
    /// }
    /// ```
    #[serde(rename = "dataCondition")]
    DataCondition(DataCondition<T>),
    /// Data Range is used to group features based on a range of values and apply specific design attributes for those groups.
    /// If the feature's value falls within the range, the fallback is used.
    ///
    /// ex.
    /// ```json
    /// "weight": {
    ///   "dataRange": {
    ///     "key": "mag",
    ///     "ease": "expo",
    ///     "base": 1.5,
    ///     "ranges": [
    ///       { "stop": 0, "input": 0 },
    ///       { "stop": 8, "input": 1 }
    ///     ]
    ///   }
    /// }
    /// ```
    ///
    /// ex.
    /// If the layer type is a LAYOUT, you are limited to using the `step` ease function.
    /// ```json
    /// "opacity": {
    ///   "dataRange": {
    ///     "key": "age",
    ///     "ease": "step",
    ///     "ranges": [
    ///       { "stop": 0, "input": 0 },
    ///       { "stop": 50, "input": 1 }
    ///     ]
    ///   }
    /// }
    /// ```
    #[serde(rename = "dataRange")]
    DataRange(DataRange<T>),
    /// Input Range is used to group features based on a range of values based upon a `type` provided and apply specific design attributes for those groups.
    /// If the feature's value falls within the range, the fallback is used.
    ///
    /// The types you can use are:
    /// - `zoom`
    /// - `lon`
    /// - `lat`
    /// - `angle`
    /// - `pitch`
    ///
    /// ex.
    /// ```json
    /// "radius": {
    ///   "inputRange": {
    ///     "type": "zoom",
    ///     "ease": "expo",
    ///     "base": 1.5,
    ///     "ranges": [
    ///       { "stop": 0, "input": 3 },
    ///       { "stop": 8, "input": 30 }
    ///     ]
    ///   }
    /// }
    /// ```
    ///
    /// ex.
    /// If the layer type is a LAYOUT, you are limited to using the `step` ease function.
    /// ```json
    /// "opacity": {
    ///   "inputRange": {
    ///     "type": "zoom",
    ///     "ease": "step",
    ///     "ranges": [
    ///       { "stop": 0, "input": 1 },
    ///       { "stop": 5, "input": 0 }
    ///     ]
    ///   }
    /// }
    /// ```
    #[serde(rename = "inputRange")]
    InputRange(InputRange<T>),
    /// Feature State is still under construction and incomplete
    #[serde(rename = "featureState")]
    FeatureState(Box<FeatureState<T>>),
    /// Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
    /// You will never directly call this at the top level but as an internal fallback for the other types.
    Fallback(Box<Input<T>>),
}
impl<T: InputValueType> Default for Property<T> {
    fn default() -> Self {
        Property::Fallback(Box::new(Input::default()))
    }
}

/// # Property Only Step
///
/// An extremely maleable input that allows you to style input data as either the value itself or
/// something that mutates on user input changes, data input changes, feature state like hovering, etc.
///
/// The "step" type is more limited than a standard Property, often used by LAYOUT styling where the change is
/// immediate to each stop if ranges are used. Thus impacts `dataRange` and `inputRange` exclusively.
///
/// ex.
/// ```json
/// { "color": "rgba(240, 2, 5, 1)" }
/// ```
///
/// ex.
/// ```json
/// { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
/// ```
///
/// ex.
/// ```json
/// "opacity": {
///   "dataRange": {
///     "key": "age",
///     "ease": "step",
///     "ranges": [
///       { "stop": 0, "input": 0 },
///       { "stop": 50, "input": 1 }
///     ]
///   }
/// }
/// ```
///
/// ### Your list of Property options are:
/// - `inputValue`: [See {@link InputValue}] access value in feature properties
/// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
/// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
/// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
/// - `featureState`: [See {@link FeatureState}] filter based on feature state
/// - `fallback`: if all else fails, use this value. A value of `T` itself or pull from feature properties using {@link Property}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PropertyOnlyStep<T: InputValueType> {
    /// Input values directly access properties data from the feature.
    ///
    /// ex.
    ///
    /// Lets say you have a feature with the following properties:
    /// ```ts
    /// const properties = {
    ///   class: {
    ///     type: 'blue',
    ///     subclass: 'deep'
    ///   }
    /// }
    /// ```
    ///
    /// You can utilize/access the `type` property with the following:
    ///
    /// ```json
    /// { "color": { "inputValue": { "key": { "nestedKey": ["class", "type"] }, "fallback": "blue" } } }
    /// ```
    ///
    /// another ex. to get a better understanding of the `nestedKey`: (this is a contrived example)
    ///
    /// Lets say you have a feature with the following properties:
    /// ```ts
    /// const properties = {
    ///   a: {
    ///     b: {
    ///        c: '#fff'
    ///     }
    ///   }
    /// }
    /// ```
    ///
    /// You can utilize/access the `type` property with the following:
    ///
    /// ```json
    /// { "color": { "inputValue": { "key": { "nestedKey": ["a", "b", "c"] }, "fallback": "blue" } } }
    /// ```
    #[serde(rename = "inputValue")]
    InputValue(InputValue<T>),
    /// Data conditions are used to filter features based on what property values the feature has.
    /// If the condition's filter passes, the input is used.
    /// If all conditions fail, the fallback is used.
    ///
    /// ex.
    /// ```json
    /// "color": {
    ///    "dataCondition": {
    ///     "conditions": [
    ///       {
    ///         "filter": { "key": "country", "comparator": "==", "value": "US" },
    ///         "input": "#007bfe"
    ///       }
    ///     ],
    ///     "fallback": "#23374d"
    ///   }
    /// }
    /// ```
    ///
    /// ex.
    ///
    /// When using a cluster source you can access its sum:
    ///
    /// ```json
    /// "color": {
    ///    "dataCondition": {
    ///       "conditions": [
    ///         {
    ///           "filter": { "key": "__sum", "comparator": ">", "value": 750 },
    ///           "input": "#f28cb1"
    ///         },
    ///         {
    ///           "filter": { "key": "__sum", "comparator": ">", "value": 100 },
    ///           "input": "#f1f075"
    ///         }
    ///       ],
    ///       "fallback": "#51bbd6"
    ///     }
    ///   }
    /// ```
    #[serde(rename = "dataCondition")]
    DataCondition(DataCondition<T>),
    /// Data Range is used to group features based on a range of values and apply specific design attributes for those groups.
    /// If the feature's value falls within the range, the fallback is used.
    ///
    /// ex.
    /// ```json
    /// "weight": {
    ///   "dataRange": {
    ///     "key": "mag",
    ///     "ease": "expo",
    ///     "base": 1.5,
    ///     "ranges": [
    ///       { "stop": 0, "input": 0 },
    ///       { "stop": 8, "input": 1 }
    ///     ]
    ///   }
    /// }
    /// ```
    ///
    /// ex.
    /// If the layer type is a LAYOUT, you are limited to using the `step` ease function.
    /// ```json
    /// "opacity": {
    ///   "dataRange": {
    ///     "key": "age",
    ///     "ease": "step",
    ///     "ranges": [
    ///       { "stop": 0, "input": 0 },
    ///       { "stop": 50, "input": 1 }
    ///     ]
    ///   }
    /// }
    /// ```
    #[serde(rename = "dataRange")]
    DataRange(DataRangeStep<T>),
    /// Input Range is used to group features based on a range of values based upon a `type` provided and apply specific design attributes for those groups.
    /// If the feature's value falls within the range, the fallback is used.
    ///
    /// The types you can use are:
    /// - `zoom`
    /// - `lon`
    /// - `lat`
    /// - `angle`
    /// - `pitch`
    ///
    /// ex.
    /// ```json
    /// "radius": {
    ///   "inputRange": {
    ///     "type": "zoom",
    ///     "ease": "expo",
    ///     "base": 1.5,
    ///     "ranges": [
    ///       { "stop": 0, "input": 3 },
    ///       { "stop": 8, "input": 30 }
    ///     ]
    ///   }
    /// }
    /// ```
    ///
    /// ex.
    /// If the layer type is a LAYOUT, you are limited to using the `step` ease function.
    /// ```json
    /// "opacity": {
    ///   "inputRange": {
    ///     "type": "zoom",
    ///     "ease": "step",
    ///     "ranges": [
    ///       { "stop": 0, "input": 1 },
    ///       { "stop": 5, "input": 0 }
    ///     ]
    ///   }
    /// }
    /// ```
    #[serde(rename = "inputRange")]
    InputRange(InputRangeStep<T>),
    /// Feature State is still under construction and incomplete
    #[serde(rename = "featureState")]
    FeatureState(FeatureState<T>),
    /// Used in conjunction with one of the other types ("inputValue" | "dataCondition" | "dataRange" | "inputRange" | "featureState").
    /// You will never directly call this at the top level but as an internal fallback for the other types.
    Fallback(Input<T>),
}
impl<T: InputValueType> Default for PropertyOnlyStep<T> {
    fn default() -> Self {
        PropertyOnlyStep::Fallback(Input::default())
    }
}

/// The layer type's that can be used.
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum LayerType {
    /// Fill
    #[default]
    #[serde(rename = "fill")]
    Fill,
    /// Glyph
    #[serde(rename = "glyph")]
    Glyph,
    /// Heatmap
    #[serde(rename = "heatmap")]
    Heatmap,
    /// Line
    #[serde(rename = "line")]
    Line,
    /// Point
    #[serde(rename = "point")]
    Point,
    /// Raster
    #[serde(rename = "raster")]
    Raster,
    /// Hillshade
    #[serde(rename = "hillshade")]
    Hillshade,
    /// Sensor
    #[serde(rename = "sensor")]
    Sensor,
}

/// # Base Layer
///
/// The base layer style. Used by almost all layers to define common attributes.
///
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct LayerStyleBase<M: Default + Clone = ()> {
    /// The type of layer
    pub r#type: Option<LayerType>,
    /// The name of the layer - useful for sorting a layer on insert or for removal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// The source used to generate the layer
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// The source's layer. Default for JSON data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layer: Option<String>,
    /// The minimum zoom level at which the layer will be visible
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minzoom: Option<u8>,
    /// The maximum zoom level at which the layer will be visible
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maxzoom: Option<u8>,
    /// A filter function to filter out features from the source layer.
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<Filter>,
    /// Use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lch: Option<bool>,
    /// Whether the layer is visible or not
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visible: Option<bool>,
    /// Additional metadata. Used by style generators.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<M>,
}

/// refines the style.json to ensure all variables exist that need to
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct LayerDefinitionBase {
    pub r#type: LayerType,
    pub name: String,
    #[serde(rename = "layerIndex")]
    pub layer_index: u32,
    pub source: String,
    pub layer: String,
    pub minzoom: u8,
    pub maxzoom: u8,
    pub lch: bool,
    pub visible: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filter: Option<Filter>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interactive: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opaque: Option<bool>,
}
impl LayerDefinitionBase {
    /// build a LayerDefinitionBase from a LayerStyleBase
    pub fn from_layer<M: Clone + Default>(layer: &LayerStyleBase<M>, layer_index: u32) -> Self {
        LayerDefinitionBase {
            r#type: layer.r#type.unwrap_or_default(),
            name: layer.name.clone().unwrap_or_default(),
            layer_index,
            source: layer.source.clone().unwrap_or_default(),
            layer: layer.layer.clone().unwrap_or("default".into()),
            minzoom: layer.minzoom.unwrap_or(0),
            maxzoom: layer.maxzoom.unwrap_or(20),
            lch: layer.lch.unwrap_or(false),
            visible: layer.visible.unwrap_or(true),
            filter: layer.filter.clone(),
            interactive: None,
            opaque: None,
        }
    }
}
/// uses definition to create a guide for the workflow (program/pipeline)
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LayerWorkflowGuideBase {
    pub source_name: String,
    pub layer_index: u32,
    pub layer_code: Vec<f32>,
    pub lch: bool,
    pub visible: bool,
    pub interactive: bool,
    pub opaque: bool,
}
/// worker takes the definition and creates a layer to prep input data for workflow (program/pipeline)
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct LayerWorkerBase {
    // pub r#type: LayerType,
    pub name: String,
    pub layer_index: u32,
    pub source: String,
    pub layer: String,
    pub minzoom: u8,
    pub maxzoom: u8,
    pub filter: FilterFunction,
}
impl PartialEq for LayerWorkerBase {
    fn eq(&self, other: &Self) -> bool {
        self.name == other.name
            && self.layer_index == other.layer_index
            && self.source == other.source
            && self.layer == other.layer
            && self.minzoom == other.minzoom
            && self.maxzoom == other.maxzoom
    }
}
/// worker takes the definition and creates a layer to prep input data for workflow (program/pipeline)
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LayerWorkerBaseRaster {
    // pub r#type: LayerType,
    pub name: String,
    pub layer_index: usize,
    pub source: String,
    pub layer: String,
    pub minzoom: u8,
    pub maxzoom: u8,
}
/// Default case for unknown layer types, should never be used
pub type UnknownLayerStyle<M> = LayerStyleBase<M>;

// Generic Layer Style Types //

/// The types of vector geometry that can be filtered
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum GeoFilter {
    /// Point
    #[default]
    #[serde(rename = "point")]
    Point,
    /// LineString
    #[serde(rename = "line")]
    Line,
    /// Polygon
    #[serde(rename = "poly")]
    Poly,
}
/// List of vector geometry filters
pub type GeoFilters = Vec<GeoFilter>;
/// Color Ramp Interpolation guide
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct ColorRampInput {
    /// A stop position of the color ramp
    pub stop: f64,
    /// A color at the stop position. Refer to {@link Color} for a list of valid colors
    pub color: String,
}
/// Color Ramp options
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub enum ColorRamp {
    /// Sinebow (input string)
    #[serde(rename = "sinebow")]
    #[default]
    Sinebow,
    /// Sinebow Extended (input string)
    #[serde(rename = "sinebowExtended")]
    SinebowExtended,
    /// Input is an actual array of color stops
    ColorRampInput(Vec<ColorRampInput>),
}

// FILL //

/// # Fill Style Guide
///
/// ## Description
///
/// A Fill layer guide defines how polygons should be colored, if they include patterns,
/// are inverted, interactive, etc.
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `color`: {@link Color} of the fill. Input either a `string` pull out the value using a {@link Property}.
/// - `opacity`: the opacity of the fill. Choose between [0, 1], or pull out the value using a {@link Property}.
///
/// ### Optional layout properties:
/// - `pattern`: Draw a pattern on the fill given an input image. Input either a `string` pull out the value using a {@link PropertyOnlyStep}.
/// - `patternMovement`: Boolean flag. If true, the pattern will move with the map rather than being static. Input either a `boolean` or pull out the value using a {@link PropertyOnlyStep}.
/// - `patternFamily`: If left as the default, the pattern will be searched within any images added to the style. Otherwise use a sprite sheet. Input is either a string to the sprite sheet name, or pull out the value using a {@link PropertyOnlyStep}.
///
/// ### Optional properties:
/// - `invert`: if true, invert where the fill is drawn to on the map
/// - `interactive`: boolean flag. If true, when hovering over the fill, the property data will be sent to the UI via an Event
/// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the fill
/// - `opaque`: if true, the fill will be drawn opaque and not allow transparency. Used for performance gains.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct FillStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Fill Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `color`: {@link Color} of the fill. Input either a `string` pull out the value using a {@link Property}.
    /// - `opacity` the opacity of the fill. Choose between [0, 1], or pull out the value using a {@link Property}.
    ///
    /// ### Optional layout properties:
    /// - `pattern`: Draw a pattern on the fill given an input image. Input either a `string` pull out the value using a {@link PropertyOnlyStep}.
    /// - `patternMovement`: Boolean flag. If true, the pattern will move with the map rather than being static. Input either a `boolean` or pull out the value using a {@link PropertyOnlyStep}.
    /// - `patternFamily`: If left as the default, the pattern will be searched within any images added to the style. Otherwise use a sprite sheet. Input is either a string to the sprite sheet name, or pull out the value using a {@link PropertyOnlyStep}.
    ///
    /// ### Optional properties:
    /// - `invert`: if true, invert where the fill is drawn to on the map
    /// - `interactive`: boolean flag. If true, when hovering over the fill, the property data will be sent to the UI via an Event
    /// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the fill
    /// - `opaque`: if true, the fill will be drawn opaque and not allow transparency. Used for performance gains.
    #[serde(deserialize_with = "must_be_fill")]
    pub r#type: String,
    // paint
    /// A PAINT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 1)"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "color": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<Input<String>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    // layout
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `undefined`
    ///
    /// ex.
    ///
    /// Setting up the style definition with an image:
    /// ```ts
    /// const style: StyleDefinition = {
    ///  // ...
    ///  images: { whale: '/images/whale.jpg' }
    /// }
    /// ```
    ///
    /// You can then add to the layer:
    ///
    /// ```json
    /// { "type": "fill", "pattern": "whale" }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pattern: Option<InputOnlyStep<String>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `false`
    ///
    /// ex.
    ///
    /// ```json
    /// { "type": "fill", "pattern": "whale", "patternMovement": true }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `boolean` itself or pull from feature properties using {@link Property}
    #[serde(rename = "patternMovement", skip_serializing_if = "Option::is_none")]
    pub pattern_movement: Option<InputOnlyStep<bool>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `"__images"`
    ///
    /// If left as the default, the pattern will be searched within any images added to the style. Otherwise,
    /// you're most likely using a sprite sheet and you'll need to specify the "family" of the pattern which is the name of the sprite sheet.
    ///
    /// ex.
    ///
    /// Setting up the style definition with an image:
    /// ```ts
    /// const style: StyleDefinition = {
    ///    // ...
    ///    sprites: { fishSprites: { path: 'http://...' } }
    /// }
    /// ```
    ///
    /// See {@link UrlMap} to use your own scheme/protocol for the URL path.
    ///
    /// You can then add to the layer:
    ///
    /// ```json
    /// { "type": "fill", "pattern": "whale", "patternFamily": "fishSprites" }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(rename = "patternFamily", skip_serializing_if = "Option::is_none")]
    pub pattern_family: Option<InputOnlyStep<String>>,
    // properties
    /// If true, invert where the fill is drawn to on the map. Defaults to `false`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invert: Option<bool>,
    /// If true, when hovering over the fill, the property data will be sent to the UI via an Event. Defaults to `false`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interactive: Option<bool>,
    /// The cursor to use when hovering over the fill. Defaults to `default`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<Cursor>,
    /// If true, the fill will be drawn opaque and not allow transparency. Used for performance gains. Defaults to `false`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opaque: Option<bool>,
}
/// Parsed Fill Layer used by a Fill workflow
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct FillDefinition {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    // paint
    pub color: Input<String>,
    pub opacity: Input<f32>,
    // layout
    pub pattern: Option<InputOnlyStep<String>>,
    #[serde(rename = "patternMovement")]
    pub pattern_movement: InputOnlyStep<bool>,
    #[serde(rename = "patternFamily")]
    pub pattern_family: InputOnlyStep<String>,
    // properties
    pub invert: bool,
    pub interactive: bool,
    pub cursor: Cursor,
    pub opaque: bool,
}
/// Parsed Fill Layer used by a Fill Tile Worker
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct FillWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub color: Option<LayerWorkerFunction<ColorArray>>,
    pub opacity: Option<LayerWorkerFunction<Vec<f32>>>,
    pub invert: bool,
    pub pattern: bool,
}
impl PartialEq for FillWorkflowLayerGuide {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base && self.invert == other.invert && self.pattern == other.pattern
    }
}
/// Expanded Fill Workflow for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FillWorkflowLayerGuideGPU {
    pub guide: FillWorkflowLayerGuide,
    pub layer_buffer: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
}
/// Parsed Fill Layer used by a Fill Tile Worker
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct FillWorkerLayer {
    pub base: LayerWorkerBase,
    pub get_code: BuildCodeFunction,
    pub invert: bool,
    pub interactive: bool,
    pub cursor: Cursor,
    pub opaque: bool,
    pub pattern: Option<LayerWorkerFunction<String>>,
    pub pattern_family: LayerWorkerFunction<String>,
    pub pattern_movement: LayerWorkerFunction<bool>,
}
impl PartialEq for FillWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
            && self.invert == other.invert
            && self.interactive == other.interactive
            && self.cursor == other.cursor
            && self.opaque == other.opaque
    }
}

// GLYPH //

// TODO: Add opacity
/// Anchor position for a glyph layer
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Anchor {
    /// Center
    #[serde(rename = "center")]
    #[default]
    Center = 0,
    /// Top
    #[serde(rename = "top")]
    Top = 1,
    /// Top Right
    #[serde(rename = "top-right")]
    TopRight = 2,
    /// Right
    #[serde(rename = "right")]
    Right = 3,
    /// Bottom Right
    #[serde(rename = "bottom-right")]
    BottomRight = 4,
    /// Bottom
    #[serde(rename = "bottom")]
    Bottom = 5,
    /// Bottom Left
    #[serde(rename = "bottom-left")]
    BottomLeft = 6,
    /// Left
    #[serde(rename = "left")]
    Left = 7,
    /// Top Left
    #[serde(rename = "top-left")]
    TopLeft = 8,
}
impl From<u64> for Anchor {
    fn from(value: u64) -> Self {
        match value {
            1 => Anchor::Top,
            2 => Anchor::TopRight,
            3 => Anchor::Right,
            4 => Anchor::BottomRight,
            5 => Anchor::Bottom,
            6 => Anchor::BottomLeft,
            7 => Anchor::Left,
            8 => Anchor::TopLeft,
            _ => Anchor::Center,
        }
    }
}
/// Alignment for a glyph layer
#[derive(Debug, Default, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub enum Alignment {
    /// Auto
    #[serde(rename = "auto")]
    #[default]
    Auto = 0,
    /// Center
    #[serde(rename = "center")]
    Center = 1,
    /// Left
    #[serde(rename = "left")]
    Left = 2,
    /// Right
    #[serde(rename = "right")]
    Right = 3,
}
impl From<u64> for Alignment {
    fn from(value: u64) -> Self {
        match value {
            1 => Alignment::Center,
            2 => Alignment::Left,
            3 => Alignment::Right,
            _ => Alignment::Auto,
        }
    }
}
/// Placement for a glyph layer
#[derive(Debug, Default, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub enum Placement {
    /// Point
    #[serde(rename = "point")]
    #[default]
    Point = 0,
    /// Line
    #[serde(rename = "line")]
    Line = 1,
    /// Line Center Point
    #[serde(rename = "line-center-point")]
    LineCenterPoint = 2,
    /// Line Center Path
    #[serde(rename = "line-center-path")]
    LineCenterPath = 3,
}
impl From<u64> for Placement {
    fn from(value: u64) -> Self {
        match value {
            1 => Placement::Line,
            2 => Placement::LineCenterPoint,
            3 => Placement::LineCenterPath,
            _ => Placement::Point,
        }
    }
}

/// Text Shapes
#[derive(Debug, Clone, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TextField {
    /// Singular text string
    Field(String),
    /// Collection of texts, usually with transforms
    Expression(Vec<String>),
    /// Nested Key Pathway pointing to a Field
    Nested(NestedKey),
}
impl From<String> for TextField {
    fn from(value: String) -> Self {
        TextField::Field(value)
    }
}
impl From<Vec<String>> for TextField {
    fn from(value: Vec<String>) -> Self {
        TextField::Expression(value)
    }
}
impl Default for TextField {
    fn default() -> Self {
        TextField::Field(String::default())
    }
}

/// # Glyph Style Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `textSize`: size of the glyphs in pixels
/// - `textFill`: fill color for glyphs
/// - `textStroke`: stroke color for glyphs
/// - `textStrokeWidth`: stroke width for glyphs in pixels
/// - `iconSize`: size of the icons in pixels
///
/// ### Optional layout properties:
/// - `placement`: Can be `point`, `line`, `line-center-path` or `line-center-point`. Only relavent if geometry is not a point.
/// - `spacing`: The distance between glyphs in pixels. Only relavent if geometry is not a point.
/// - `textFamily`: The font family to use for the glyphs. Can be multiple options, first is default with each proceeding option as a fallback.
/// - `textField`: The description of the content to be rendered. Can be the text itself, or can be a transfromation input that uses the features properties to build a text string.
/// - `textAnchor`: The anchor position for the text being rendered. An example is "center" or "bottom-left"
/// - `textOffset`: The x and y offset of the text relative to the anchor in pixels
/// - `textPadding`: The width and height padding around the rendered glyphs to ensure stronger filtering of other text/icons nearby
/// - `textRotate`: The rotation of the glyphs relative to the anchor
/// - `textWordWrap`: Wrapping size in pixels. This ensures a max width of the box containing the words.
/// - `textAlign`: Alignment tool to build the words from the `left`, `middle` or `right` positions. Only noticable if words are wrapping.
/// - `textKerning`: Excess kerning for each glyph for individual glyph spacing between eachother.
/// - `textLineHeight`: Adjust the lineheight of glyphs to improve vertical spacing.
/// - `iconFamily`: The source family name to use for the icons. Can be multiple options, first is default with each proceeding option as a fallback.
/// - `iconField`: The name of the icon to render. Can be multiple options, first is default with each proceeding option as a fallback.
/// - `iconAnchor`: The anchor position for the icon to be rendered relative to the centerpoint of the icon. An example is "center" or "bottom-left"
/// - `iconOffset`: The x and y offset of the icon relative to the anchor in pixels
/// - `iconPadding`: The width and height padding around the rendered icon to ensure stronger filtering of other text/icons nearby
/// - `iconRotate`: The rotation of the icons relative to the anchor
///
/// ### Optional properties:
/// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn. Options are `point`, `line`, `poly`
/// - `overdraw`: if true, the layer will be drawn regardless of other glyph layers
/// - `interactive`: boolean flag. If true, when hovering over the glyph, the property data will be sent to the UI via an Event
/// - `viewCollisions`: if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not
/// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the glyph
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct GlyphStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Glyph Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `textSize`: size of the glyphs in pixels
    /// - `textFill`: fill color for glyphs
    /// - `textStroke`: stroke color for glyphs
    /// - `textStrokeWidth`: stroke width for glyphs in pixels
    /// - `iconSize`: size of the icons in pixels
    ///
    /// ### Optional layout properties:
    /// - `placement`: Can be `point`, `line`, `line-center-path` or `line-center-point`. Only relavent if geometry is not a point.
    /// - `spacing`: The distance between glyphs in pixels. Only relavent if geometry is not a point.
    /// - `textFamily`: The font family to use for the glyphs. Can be multiple options, first is default with each proceeding option as a fallback.
    /// - `textField`: The description of the content to be rendered. Can be the text itself, or can be a transfromation input that uses the features properties to build a text string.
    /// - `textAnchor`: The anchor position for the text being rendered. An example is "center" or "bottom-left"
    /// - `textOffset`: The x and y offset of the text relative to the anchor in pixels
    /// - `textPadding`: The width and height padding around the rendered glyphs to ensure stronger filtering of other text/icons nearby
    /// - `textRotate`: The rotation of the glyphs relative to the anchor
    /// - `textWordWrap`: Wrapping size in pixels. This ensures a max width of the box containing the words.
    /// - `textAlign`: Alignment tool to build the words from the `left`, `middle` or `right` positions. Only noticable if words are wrapping.
    /// - `textKerning`: Excess kerning for each glyph for individual glyph spacing between eachother.
    /// - `textLineHeight`: Adjust the lineheight of glyphs to improve vertical spacing.
    /// - `iconFamily`: The source family name to use for the icons. Can be multiple options, first is default with each proceeding option as a fallback.
    /// - `iconField`: The name of the icon to render. Can be multiple options, first is default with each proceeding option as a fallback.
    /// - `iconAnchor`: The anchor position for the icon to be rendered relative to the centerpoint of the icon. An example is "center" or "bottom-left"
    /// - `iconOffset`: The x and y offset of the icon relative to the anchor in pixels
    /// - `iconPadding`: The width and height padding around the rendered icon to ensure stronger filtering of other text/icons nearby
    /// - `iconRotate`: The rotation of the icons relative to the anchor
    ///
    /// ### Optional properties:
    /// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn. Options are `point`, `line`, `poly`
    /// - `overdraw`: if true, the layer will be drawn regardless of other glyph layers
    /// - `interactive`: boolean flag. If true, when hovering over the glyph, the property data will be sent to the UI via an Event
    /// - `viewCollisions`: if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not
    /// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the glyph
    #[serde(deserialize_with = "must_be_glyph")]
    pub r#type: String,
    // paint
    /// A PAINT `Property`.
    /// @defaultValue `16`
    ///
    /// ex.
    /// ```json
    /// { "textSize": 24 }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "textSize": { "inputValue": { "key": "size", "fallback": 36 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textSize", skip_serializing_if = "Option::is_none")]
    pub text_size: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 1)"`
    ///
    /// ex.
    /// ```json
    /// { "textFill": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "textFill": { "inputValue": { "key": "size", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textFill", skip_serializing_if = "Option::is_none")]
    pub text_fill: Option<Input<String>>,
    /// A PAINT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 1)"`
    ///
    /// ex.
    /// ```json
    /// { "textStroke": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "textStroke": { "inputValue": { "key": "stroke", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textStroke", skip_serializing_if = "Option::is_none")]
    pub text_stroke: Option<Input<String>>,
    /// A PAINT `Property`.
    /// @defaultValue `0`
    ///
    /// ex.
    /// ```json
    /// { "textStrokeWidth": 2 }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "textStrokeWidth": { "inputValue": { "key": "strokeWidth", "fallback": 0 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textStrokeWidth", skip_serializing_if = "Option::is_none")]
    pub text_stroke_width: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `16`
    ///
    /// ex.
    /// ```json
    /// { "iconSize": 24 }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "iconSize": { "inputValue": { "key": "size", "fallback": 42 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "iconSize", skip_serializing_if = "Option::is_none")]
    pub icon_size: Option<Input<f32>>,
    // layout
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `"line"`
    ///
    /// Can be `point`, `line`, `line-center-path` or `line-center-point`.
    /// Only relavent if geometry is not a point.
    /// Line and Polygon geometries will use the `placement` type to determine
    /// how the glyphs are drawn. Regardless of the placement type, the glyphs
    /// will be drawn at `spacing` intervals.
    ///
    /// If set to `point`, the geometry will be simplified down to a set
    /// of points of minimum distance `spacing` apart.
    ///
    /// If set to `line`, the glyphs will draw along the line path.
    ///
    /// If set to `line-center-path`, the geometry will resolve to a single point
    /// at the center of the line. The `spacing` property will have no effect.
    /// The starting point will be at the center of each line, and the glyphs will be drawn
    /// along the line path.
    ///
    /// If set to `line-center-point`, the geometry will resolve to a single point
    /// at the center of the line. The `spacing` property will have no effect.
    /// The starting point will be at the center of each line, and the glyphs will be drawn
    /// as points are (box shaped).
    ///
    /// ex.
    /// ```json
    /// { "type": "glyph", "placement": "point" }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "placement": { "inputValue": { "key": "placementType", "fallback": "point" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Placement` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub placement: Option<InputOnlyStep<Placement>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `325`
    ///
    /// The distance between glyphs in pixels. Only relavent if geometry is not a point.
    ///
    /// ex.
    /// ```json
    /// { "spacing": 250 }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "spacing": { "inputValue": { "key": "space-between", "fallback": 350 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spacing: Option<Input<f32>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `""` (empty string)
    ///
    /// If applying an array, the first value will be used. If the first value is not found, the second value will be used, and so on.
    ///
    /// If left as the default, the pattern will be searched within any images added to the style. Otherwise,
    /// you're most likely using a sprite sheet and you'll need to specify the "family" of the pattern which is the name of the sprite sheet.
    ///
    /// ex.
    /// Setting up the style definition with an image:
    /// ```ts
    /// const style: StyleDefinition = {
    ///    // ...
    ///    fonts: {
    ///      robotoMedium: 'apiURL://glyphs-v2/RobotoMedium',
    ///      notoMedium: 'apiURL://glyphs-v2/notoMedium'
    ///    }
    /// }
    /// ```
    ///
    /// You can then add to the layer:
    ///
    /// ```json
    /// { "type": "glyph", "textFamily": ["robotoMedium", "notoMedium"] }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string | string[]` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textFamily", skip_serializing_if = "Option::is_none")]
    pub text_family: Option<InputOnlyStep<TextField>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `""` (empty string)
    ///
    /// The description of the content to be rendered. Can be the text itself, or can be a transfromation
    /// input that uses the features properties to build a text string.
    ///
    /// ex.
    ///
    /// ```json
    /// { "textField": "?name" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textField": { "inputValue": { "key": "?abbreviation", "fallback": "?name" } } }
    /// ```
    ///
    /// If using an array, it will merge the values into a single string. but apply the effects/transformations to each component first.
    ///
    /// an example of utilizing an array:
    /// ```ts
    /// // example 1
    /// const properties = { abbr: 'U.S.', name: 'United States', ... }
    /// const textField = ["\"", "?abbr,?name", "\""] // here we coallese to abbr if the property exists, otherwise we fallback on name
    /// // cooalesced: returns "U.S." or "United States" depending on whether abbr exists
    ///
    /// // example 2
    /// const properties = { type: 'airplane', ... }
    /// const textField = ["?type", "-16"]
    /// // // cooalesced: 'airplane-16'
    /// ```
    ///
    /// Transforms:
    /// - `"?"`: coalesce from properties
    /// - `"!"`: transform the result
    /// - - `"U"`: uppercase
    /// - - `"L"`: lowercase
    /// - - `"C"`: capitalize
    /// - `"P"`: language aquisition (e.g. "XX" -> "en"). Defined by navigator.language (browser)
    ///
    /// ex.
    /// ```json
    /// { "textField": ["?!Labbr", " - " "?!Uname"] }
    /// // cooalesced: "u.s. - UNITED STATES"
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string | string[]` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textField", skip_serializing_if = "Option::is_none")]
    pub text_field: Option<InputOnlyStep<TextField>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `"center"`
    ///
    /// The anchor position for the text being rendered.
    ///
    /// Options are `"center"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textAnchor": "top-left" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textAnchor": { "inputValue": { "key": "anchor", "fallback": "center" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Anchor` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textAnchor", skip_serializing_if = "Option::is_none")]
    pub text_anchor: Option<InputOnlyStep<Anchor>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `[0, 0]`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textOffset": [2, 2] }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textOffset": { "inputValue": { "key": "offset", "fallback": [0, 0] } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Point` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textOffset", skip_serializing_if = "Option::is_none")]
    pub text_offset: Option<InputOnlyStep<Point>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `[0, 0]`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textPadding": [2, 2] }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textPadding": { "inputValue": { "key": "padding", "fallback": [0, 0] } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Point` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textPadding", skip_serializing_if = "Option::is_none")]
    pub text_padding: Option<InputOnlyStep<Point>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `0`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textWordWrap": 8 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textWordWrap": { "inputValue": { "key": "wrapSize", "fallback": 6 } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textWordWrap", skip_serializing_if = "Option::is_none")]
    pub text_word_wrap: Option<InputOnlyStep<f32>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `"center"`
    ///
    /// Options are `"center"`, `"left"`, `"right"`, `"auto"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textAlign": "left" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textAlign": { "inputValue": { "key": "align", "fallback": "center" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Alignment` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textAlign", skip_serializing_if = "Option::is_none")]
    pub text_align: Option<InputOnlyStep<Alignment>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `0`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textKerning": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textKerning": { "inputValue": { "key": "kerning", "fallback": 0 } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textKerning", skip_serializing_if = "Option::is_none")]
    pub text_kerning: Option<InputOnlyStep<f32>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `0`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textLineHeight": 1 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textLineHeight": { "inputValue": { "key": "lineHeight", "fallback": 0 } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "textLineHeight", skip_serializing_if = "Option::is_none")]
    pub text_line_height: Option<InputOnlyStep<f32>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `""` (empty string)
    ///
    /// If applying an array, the first value will be used. If the first value is not found, the second value will be used, and so on.
    ///
    /// If left as the default, the pattern will be searched within any images added to the style. Otherwise,
    /// you're most likely using a sprite sheet and you'll need to specify the "family" of the pattern which is the name of the sprite sheet.
    ///
    /// ex.
    ///
    /// Setting up the style definition with an image:
    /// ```ts
    /// const style: StyleDefinition = {
    ///    // ...
    ///    icons: {
    ///      streets: 'apiURL://glyphs-v2/streets',
    ///      base: 'apiURL://glyphs-v2/base'
    ///    }
    /// }
    /// ```
    ///
    /// You can then add to the layer:
    ///
    /// ```json
    /// { "type": "glyph", "iconFamily": ["streets", "base"] }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string | string[]` itself or pull from feature properties using {@link Property}
    #[serde(rename = "iconFamily", skip_serializing_if = "Option::is_none")]
    pub icon_family: Option<InputOnlyStep<TextField>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `""` (empty string)
    ///
    /// ex.
    /// ```json
    /// { "iconField": "plane" }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "iconField": { "inputValue": { "key": "aircraft", "fallback": "plane" } } }
    /// ```
    ///
    /// If using an array, it will merge the values into a single string. but apply the effects/transformations to each component first.
    ///
    /// an example of utilizing an array:
    /// ```ts
    /// // example 1
    /// const properties = { abbr: 'U.S.', name: 'United States', ... }
    /// const iconField = ["\"", "?abbr,?name", "\""] // here we coallese to abbr if the property exists, otherwise we fallback on name
    /// // cooalesced: returns "U.S." or "United States" depending on whether abbr exists
    ///
    /// // example 2
    /// const properties = { type: 'airplane', ... }
    /// const iconField = ["?type", "-16"]
    /// // // cooalesced: 'airplane-16'
    /// ```
    ///
    /// Transforms:
    /// - `"?"`: coalesce from properties
    /// - `"!"`: transform the result
    /// - - `"U"`: uppercase
    /// - - `"L"`: lowercase
    /// - - `"C"`: capitalize
    /// - `"P"`: language aquisition (e.g. "XX" -> "en"). Defined by navigator.language (browser)
    ///
    /// ex.
    /// ```json
    /// { "iconField": ["?!Labbr", " - " "?!Uname"] }
    /// // cooalesced: "u.s. - UNITED STATES"
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string | string[]` itself or pull from feature properties using {@link Property}
    #[serde(rename = "iconField", skip_serializing_if = "Option::is_none")]
    pub icon_field: Option<InputOnlyStep<TextField>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `"center"`
    ///
    /// Options are `"center"`, `"left"`, `"right"`, `"top"`, `"bottom"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "textOffset": "top-left" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "textOffset": { "inputValue": { "key": "positioning", "fallback": "center" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Anchor` itself or pull from feature properties using {@link Property}
    #[serde(rename = "iconAnchor", skip_serializing_if = "Option::is_none")]
    pub icon_anchor: Option<InputOnlyStep<Anchor>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `[0, 0]`
    ///
    /// ex.
    ///
    /// ```json
    /// { "iconOffset": [2, 2] }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "iconOffset": { "inputValue": { "key": "offset", "fallback": [0, 0] } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Point` itself or pull from feature properties using {@link Property}
    #[serde(rename = "iconOffset", skip_serializing_if = "Option::is_none")]
    pub icon_offset: Option<InputOnlyStep<Point>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `[0, 0]`
    ///
    /// ex.
    ///
    /// ```json
    /// { "iconPadding": [2, 2] }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "iconPadding": { "inputValue": { "key": "padding", "fallback": [0, 0] } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Point` itself or pull from feature properties using {@link Property}
    #[serde(rename = "iconPadding", skip_serializing_if = "Option::is_none")]
    pub icon_padding: Option<InputOnlyStep<Point>>,
    // properties
    /// Filter the geometry types that will be drawn.
    /// An empty array will support all geometry types.
    /// Ex. `["line"]`: only draw lines
    /// Defaults to empty.
    #[serde(rename = "geoFilter", skip_serializing_if = "Option::is_none")]
    pub geo_filter: Option<GeoFilters>,
    /// if true, the layer will be drawn regardless of other glyph layers. Default false
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overdraw: Option<bool>,
    /// if true, when hovering over the glyph, the property data will be sent to the UI via an Event. Default false
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interactive: Option<bool>,
    /// if true, the layer glyphs will display the collision boxes and colorize them based on if they are colliding or not. Default false
    #[serde(rename = "viewCollisions", skip_serializing_if = "Option::is_none")]
    pub view_collisions: Option<bool>,
    /// if true, it's assumed RTL text has been preshaped so do not apply RTL inversion again. Defaults to false
    #[serde(rename = "noShaping", skip_serializing_if = "Option::is_none")]
    pub no_shaping: Option<bool>,
    /// the cursor to use when hovering over the glyph. Default "default"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<Cursor>,
}
/// Parsed Glyph Layer used by a Glyph workflow
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct GlyphDefinition {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    // paint
    #[serde(rename = "textSize")]
    pub text_size: Input<f32>,
    #[serde(rename = "textFill")]
    pub text_fill: Input<String>,
    #[serde(rename = "textStroke")]
    pub text_stroke: Input<String>,
    #[serde(rename = "textStrokeWidth")]
    pub text_stroke_width: Input<f32>,
    #[serde(rename = "iconSize")]
    pub icon_size: Input<f32>,
    // layout
    pub placement: InputOnlyStep<Placement>,
    pub spacing: Input<f32>,
    #[serde(rename = "textFamily")]
    pub text_family: InputOnlyStep<TextField>,
    #[serde(rename = "textField")]
    pub text_field: InputOnlyStep<TextField>,
    #[serde(rename = "textAnchor")]
    pub text_anchor: InputOnlyStep<Anchor>,
    #[serde(rename = "textOffset")]
    pub text_offset: InputOnlyStep<Point>,
    #[serde(rename = "textPadding")]
    pub text_padding: InputOnlyStep<Point>,
    #[serde(rename = "textWordWrap")]
    pub text_word_wrap: InputOnlyStep<f32>,
    #[serde(rename = "textAlign")]
    pub text_align: InputOnlyStep<Alignment>,
    #[serde(rename = "textKerning")]
    pub text_kerning: InputOnlyStep<f32>,
    #[serde(rename = "textLineHeight")]
    pub text_line_height: InputOnlyStep<f32>,
    #[serde(rename = "iconFamily")]
    pub icon_family: InputOnlyStep<TextField>,
    #[serde(rename = "iconField")]
    pub icon_field: InputOnlyStep<TextField>,
    #[serde(rename = "iconAnchor")]
    pub icon_anchor: InputOnlyStep<Anchor>,
    #[serde(rename = "iconOffset")]
    pub icon_offset: InputOnlyStep<Point>,
    #[serde(rename = "iconPadding")]
    pub icon_padding: InputOnlyStep<Point>,
    // properties
    #[serde(rename = "geoFilter")]
    pub geo_filter: GeoFilters,
    pub overdraw: bool,
    pub interactive: bool,
    #[serde(rename = "noShaping")]
    pub no_shaping: bool,
    #[serde(rename = "viewCollisions")]
    pub view_collisions: bool,
    pub cursor: Cursor,
}
/// Glyph Layer used by a Glyph Tile Worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub cursor: Cursor,
    pub overdraw: bool,
    pub view_collisions: bool,
}
/// Extended Glyph Layer used by WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphWorkflowLayerGuideGPU {
    pub guide: GlyphWorkflowLayerGuide,
    pub layer_buffer: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
}
/// Glyph Layer used by a Glyph Tile Worker
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct GlyphWorkerLayer {
    //   type: 'glyph';
    pub base: LayerWorkerBase,
    pub text_get_code: BuildCodeFunction,
    pub icon_get_code: BuildCodeFunction,
    // paint
    pub icon_paint: Option<Vec<u32>>,
    pub text_size: LayerWorkerFunction<f32>,
    pub icon_size: LayerWorkerFunction<f32>,
    // layout
    pub placement: LayerWorkerFunction<Placement>,
    pub spacing: LayerWorkerFunction<f32>,
    pub text_family: LayerWorkerFunction<TextField>,
    pub text_field: LayerWorkerFunction<TextField>,
    pub text_anchor: LayerWorkerFunction<String>,
    pub text_offset: LayerWorkerFunction<Point>,
    pub text_padding: LayerWorkerFunction<Point>,
    pub text_word_wrap: LayerWorkerFunction<f32>,
    pub text_align: LayerWorkerFunction<Alignment>,
    pub text_kerning: LayerWorkerFunction<f32>,
    pub text_line_height: LayerWorkerFunction<f32>,
    pub icon_family: LayerWorkerFunction<TextField>,
    pub icon_field: LayerWorkerFunction<TextField>,
    pub icon_anchor: LayerWorkerFunction<Anchor>,
    pub icon_offset: LayerWorkerFunction<Point>,
    pub icon_padding: LayerWorkerFunction<Point>,
    // properties
    pub geo_filter: GeoFilters,
    pub overdraw: bool,
    pub interactive: bool,
    pub no_shaping: bool,
    pub cursor: Cursor,
}
impl PartialEq for GlyphWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
            && self.icon_paint == other.icon_paint
            && self.geo_filter == other.geo_filter
            && self.overdraw == other.overdraw
            && self.interactive == other.interactive
            && self.no_shaping == other.no_shaping
            && self.cursor == other.cursor
    }
}

// HEATMAP //

/// # Heatmap Layer Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// Optional paint properties:
/// - `radius`: the radius of the heatmap in pixels
/// - `opacity`: the opacity of the heatmap. Choose between [0, 1], or pull out the value using a {@link Property}.
/// - `intensity`: the intensity of the heatmap
///
/// ### Optional layout properties:
/// - `weight`: A weight multiplier to apply to each of the heatmap's points
///
/// ### Optional properties:
/// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn.
/// - `colorRamp`: [See {@link ColorRamp}] Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeatmapStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Heatmap Layer Guide
    ///
    /// # Base Properties:
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `radius`: the radius of the heatmap in pixels
    /// - `opacity`: the opacity of the heatmap. Choose between [0, 1], or pull out the value using a {@link Property}.
    /// - `intensity`: the intensity of the heatmap
    ///
    /// ### Optional layout properties:
    /// - `weight`: A weight multiplier to apply to each of the heatmap's points
    ///
    /// ### Optional properties:
    /// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn. Options are `point`, `line`, `poly`.
    /// - `colorRamp`: [See {@link ColorRamp}] Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
    #[serde(deserialize_with = "must_be_heatmap")]
    pub r#type: String, // 'heatmap',
    // paint
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "radius": 5 } }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "radius": { "inputValue": { "key": "size", "fallback": 3.5 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "intensity": 2.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "intensity": { "inputValue": { "key": "strength", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intensity: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "weight": 2.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "weight": { "inputValue": { "key": "impact", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<Input<f32>>,
    // properties
    /// Define a color ramp to be used for a feature
    /// @defaultValue `sinebow`.
    ///
    /// ex.
    /// ```json
    /// {
    ///  "colorRamp": [
    /// { "stop": 0, "color": "rgba(33,102,172,0)" },
    /// { "stop": 0.2, "color": "rgba(103,169,207, 0.85)" },
    /// { "stop": 0.4, "color": "rgb(209,229,240)" },
    /// { "stop": 0.6, "color": "rgb(253,219,199)" },
    /// { "stop": 0.8, "color": "rgb(239,138,98)" },
    /// { "stop": 1, "color": "rgb(178,24,43)" }
    /// ]
    /// }
    /// ```
    #[serde(rename = "colorRamp", skip_serializing_if = "Option::is_none")]
    pub color_ramp: Option<ColorRamp>,
    /// Filter the geometry types that will be drawn.
    /// An empty array will support all geometry types.
    /// Ex. `["line"]`: only draw lines
    /// Defaults to `['line', 'poly']` (only points will be drawn).
    #[serde(rename = "geoFilter", skip_serializing_if = "Option::is_none")]
    pub geo_filter: Option<GeoFilters>,
}
/// A parsed heatmap guide that injects defaults for missing properties
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct HeatmapDefinition {
    //   type: 'heatmap',
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    // paint
    pub radius: Input<f32>,
    pub opacity: Input<f32>,
    pub intensity: Input<f32>,
    pub weight: Input<f32>,
    // properties
    #[serde(rename = "ColorRamp")]
    pub color_ramp: ColorRamp,
    #[serde(rename = "geoFilter")]
    pub geo_filter: GeoFilters,
}
/// A built heatmap guide used by the heatmap workflow.
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HeatmapWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub color_ramp: wgpu::Texture,
}
/// An extended heatmap guide used by the heatmap workflow for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HeatmapWorkflowLayerGuideGPU {
    pub base: LayerWorkflowGuideBase,
    pub color_ramp: wgpu::Texture,
    pub _b: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
    pub texture_bind_group: wgpu::BindGroup,
    pub render_target: wgpu::Texture,
    // NOTE: The TS version keeps track of the GPURenderPassDescriptor, but it has a lifetime,
    // So instead we keep track of the view. We rebuild the renderPass each frame.
    // Keeping the secondary option of setting up a function that returns the renderPassDescriptor
    // as a secondary option when it comes time to write the code.
    pub render_target_view: wgpu::TextureView,
    // pub render_pass_descriptor: Box<dyn Fn(&wgpu::TextureView) -> wgpu::RenderPassDescriptor>,
}
/// A heatmap Tile Worker layer
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct HeatmapWorkerLayer {
    //   type: 'heatmap',
    pub base: LayerWorkerBase,
    pub get_code: BuildCodeFunction,
    pub weight: LayerWorkerFunction<f32>,
    pub geo_filter: GeoFilters,
}
impl PartialEq for HeatmapWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base && self.geo_filter == other.geo_filter
    }
}

// LINE //

/// Line cap options
#[derive(Debug, Default, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub enum Cap {
    /// Butt
    #[serde(rename = "butt")]
    #[default]
    Butt = 0,
    /// Square
    #[serde(rename = "square")]
    Square = 1,
    /// Round
    #[serde(rename = "round")]
    Round = 2,
}
impl From<u64> for Cap {
    fn from(value: u64) -> Self {
        match value {
            1 => Cap::Square,
            2 => Cap::Round,
            _ => Cap::Butt,
        }
    }
}
/// Line join options
#[derive(Debug, Default, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub enum Join {
    /// Bevel
    #[serde(rename = "bevel")]
    #[default]
    Bevel = 0,
    /// Miter
    #[serde(rename = "miter")]
    Miter = 1,
    /// Round
    #[serde(rename = "round")]
    Round = 2,
}
impl From<u64> for Join {
    fn from(value: u64) -> Self {
        match value {
            1 => Join::Miter,
            2 => Join::Round,
            _ => Join::Bevel,
        }
    }
}
/// Line Style Guide
///
/// # Base Properties:
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `color`: {@link Color} of the line. Input either a `string` pull out the value using a {@link Property}.
/// - `opacity`: the opacity of the line. Choose between [0, 1], or pull out the value using a {@link Property}.
/// - `width`: the width of the line in pixels
/// - `gapWidth`: split the line into two segments to reduce rendering artifacts
///
/// ### Optional layout properties:
/// - `cap`: [See {@link Cap}] the cap of the line. Either `butt`, `square`, or `round`
/// - `join`: [See {@link Join}] the joiner used for the line. Either `bevel`, `miter`, or `round`
/// - `dasharray`: A sequence of lengths and gaps that describe the pattern of dashes and gaps used to draw the line. Written as `Array<[length: number, color: string]>`
///
/// ### Optional properties:
/// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn.
/// - `interactive`: boolean flag. If true, when hovering over the line, the property data will be sent to the UI via an Event
/// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the line
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Line Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `color`: {@link Color} of the line. Input either a `string` pull out the value using a {@link Property}.
    /// - `opacity`: the opacity of the line. Choose between [0, 1], or pull out the value using a {@link Property}.
    /// - `width`: the width of the line in pixels
    /// - `gapWidth`: split the line into two segments to reduce rendering artifacts
    ///
    /// ### Optional layout properties:
    /// - `cap`: [See {@link Cap}] the cap of the line. Either `butt`, `square`, or `round`
    /// - `join`: [See {@link Join}] the joiner used for the line. Either `bevel`, `miter`, or `round`
    /// - `dasharray`: A sequence of lengths and gaps that describe the pattern of dashes and gaps used to draw the line. Written as `Array<[length: number, color: string]>`
    ///
    /// ### Optional properties:
    /// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn. Options are `point`, `line`, `poly`.
    /// - `interactive`: boolean flag. If true, when hovering over the line, the property data will be sent to the UI via an Event
    /// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the line
    #[serde(deserialize_with = "must_be_line")]
    pub r#type: String,
    // paint
    /// A PAINT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 1)"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "color": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<Input<String>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "width": 5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "width": { "inputValue": { "key": "roadWidth", "fallback": 3.5 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `0`
    ///
    /// To improve render performance, you can provide a gap width to not draw a portion inside the line.
    ///
    /// `NOTE`: This feature is currently not supported.
    ///
    /// ex.
    ///
    /// ```json
    /// { "gapWidth": 3 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "gapWidth": { "inputValue": { "key": "partitionSize", "fallback": 1.5 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(rename = "gapWidth", skip_serializing_if = "Option::is_none")]
    pub gap_width: Option<Input<f32>>,
    // layout
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `butt`
    ///
    /// can use `butt`, `square`, or `round`
    ///
    /// ex.
    ///
    ///
    /// ```json
    /// { "cap": "round" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "cap": { "inputValue": { "key": "capType", "fallback": "round" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Cap` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cap: Option<InputOnlyStep<Cap>>,
    /// A LAYOUT `PropertyOnlyStep`.
    /// @defaultValue `miter`
    ///
    /// can use `bevel`, `miter`, or `round`
    ///
    /// ex.
    ///
    /// ```json
    /// { "join": "round" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "join": { "inputValue": { "key": "joinType", "fallback": "round" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `Join` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub join: Option<InputOnlyStep<Join>>,
    // properties
    /// The line will be dashed between visible and invisible.
    /// @defaultValue `[]` (empty array)
    ///
    /// ex.
    ///
    /// ```json
    /// { "dasharray": [ [30, "#bbd3de"], [12, "rgba(255, 255, 255, 0)"] ] }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dasharray: Option<Vec<(f64, String)>>, // Array<[length: number, color: string]>;
    /// Filter the geometry types that will be drawn.
    /// @defaultValue `[]` (empty array)
    ///
    /// An empty array will supports both `line` & `polygon` geometry types.
    ///
    /// Ex. `["line"]`: only draw lines
    #[serde(rename = "geoFilter", skip_serializing_if = "Option::is_none")]
    pub geo_filter: Option<GeoFilters>,
    /// if true, when hovering over the line, the property data will be sent to the UI via an Event. Defaults to `false`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interactive: Option<bool>,
    /// the cursor to use when hovering over the line. Defaults to "default"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<Cursor>,
}
/// A parsed user defined layer guide that replaced undefined values with defaults
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct LineDefinition {
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    //   type: 'line';
    // paint
    pub color: Input<String>,
    pub opacity: Input<f32>,
    pub width: Input<f32>,
    #[serde(rename = "gapWidth")]
    pub gap_width: Input<f32>,
    // layout
    pub cap: InputOnlyStep<Cap>,
    pub join: InputOnlyStep<Join>,
    // properties
    pub dasharray: Vec<(f64, String)>,
    pub dashed: bool,
    #[serde(rename = "geoFilter")]
    pub geo_filter: GeoFilters,
    pub interactive: bool,
    pub cursor: Cursor,
}
/// A Line layer guide setup for the workflow to build layer feature data
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LineWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub dashed: bool,
    pub dash_count: f32,
    pub dash_length: f32,
    pub dash_texture: wgpu::Texture,
    pub interactive: bool,
    pub cursor: Cursor,
}
/// An extension to the line workflow layer guide for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LineWorkflowLayerGuideGPU {
    pub guide: LineWorkflowLayerGuide,
    pub _b: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
    pub dash_texture: wgpu::Texture,
}
/// Line Worker Layer guide to help process line feature data to be rendered
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct LineWorkerLayer {
    pub base: LayerWorkerBase,
    //   type: 'line';
    pub cap: LayerWorkerFunction<Cap>,
    pub join: LayerWorkerFunction<Join>,
    // properties
    pub get_code: BuildCodeFunction,
    pub dashed: bool,
    pub geo_filter: GeoFilters,
    pub interactive: bool,
    pub cursor: Cursor,
}
impl PartialEq for LineWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
            && self.dashed == other.dashed
            && self.geo_filter == other.geo_filter
            && self.interactive == other.interactive
            && self.cursor == other.cursor
    }
}

// POINT //

/// # Point Style Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `color`: {@link Color} of the point. Input either a `string` pull out the value using a {@link Property}.
/// - `radius`: radial size of the point in pixels. Input either a `number` pull out the value using a {@link Property}.
/// - `stroke`: {@link Color} of the stroke. Input either a `string` pull out the value using a {@link Property}.
/// - `strokeWidth`: the width of the stroke in pixels. Input either a `number` pull out the value using a {@link Property}.
/// - `opacity`: the opacity of the point. Choose between [0, 1], or pull out the value using a {@link Property}.
///
/// ### Optional properties:
/// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn.
/// - `interactive`: boolean flag. If true, when hovering over the line, the property data will be sent to the UI via an Event
/// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the line
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct PointStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Point Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `color`: {@link Color} of the point. Input either a `string` pull out the value using a {@link Property}.
    /// - `radius`: radial size of the point in pixels. Input either a `number` pull out the value using a {@link Property}.
    /// - `stroke`: {@link Color} of the stroke. Input either a `string` pull out the value using a {@link Property}.
    /// - `strokeWidth`: the width of the stroke in pixels. Input either a `number` pull out the value using a {@link Property}.
    /// - `opacity`: the opacity of the point. Choose between [0, 1], or pull out the value using a {@link Property}.
    ///
    /// ### Optional properties:
    /// - `geoFilter`: [See {@link GeoFilter}] filter the geometry types that will be drawn. Options are `point`, `line`, `poly`.
    /// - `interactive`: boolean flag. If true, when hovering over the line, the property data will be sent to the UI via an Event
    /// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the line
    #[serde(deserialize_with = "must_be_point")]
    pub r#type: String, // 'point';
    // paint
    /// A PAINT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 0)"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "color": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<Input<String>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "radius": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "radius": { "inputValue": { "key": "size", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 0)"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "stroke": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "stroke": { "inputValue": { "key": "stroke", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stroke: Option<Input<String>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "strokeWidth": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "strokeWidth": { "inputValue": { "key": "strokeSize", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `strokeWidth` itself or pull from feature properties using {@link Property}
    #[serde(rename = "strokeWidth", skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `opacity` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    // properties
    /// Filter the geometry types that will be drawn.
    /// An empty array will support all geometry types.
    /// Ex. `["line"]`: only draw lines
    /// Defaults to `['line', 'poly']`.
    #[serde(rename = "geoFilter", skip_serializing_if = "Option::is_none")]
    pub geo_filter: Option<GeoFilters>,
    /// if true, when hovering over the line, the property data will be sent to the UI via an Event. Defaults to `false`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interactive: Option<bool>,
    /// the cursor to use when hovering over the line. Defaults to "default"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<Cursor>,
}
/// Internal interface that builds a point layer with defaults for properties that were not defined by the user
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct PointDefinition {
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    //   type: 'point';
    // paint
    pub color: Input<String>,
    pub radius: Input<f32>,
    pub stroke: Input<String>,
    #[serde(rename = "strokeWidth")]
    pub stroke_width: Input<f32>,
    pub opacity: Input<f32>,
    // properties
    #[serde(rename = "geoFilter")]
    pub geo_filter: GeoFilters,
    pub interactive: bool,
    pub cursor: Cursor,
}
/// Internal interface acting as a WebGL(1|2) draw guide for Points
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct PointWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub cursor: Cursor,
}
/// Internal interface acting as a WebGPU draw guide for Points
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct PointWorkflowLayerGuideGPU {
    pub base: PointWorkflowLayerGuide,
    pub _b: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
}
/// Internal interface using user defined layer guide via a Tile Worker to prepare data for rendering
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct PointWorkerLayer {
    //   type: 'point',
    pub base: LayerWorkerBase,
    pub geo_filter: GeoFilters,
    pub interactive: bool,
    pub cursor: Cursor,
}
impl PartialEq for PointWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
            && self.geo_filter == other.geo_filter
            && self.interactive == other.interactive
            && self.cursor == other.cursor
    }
}

// RASTER //

/// Raster resampling method. Either `nearest` or `linear`
pub type Resampling = wgpu::FilterMode;
/// # Raster Style Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `opacity`: the opacity of the raster. Choose between [0, 1], or pull out the value using a {@link Property}.
/// - `saturation`: the saturation of the raster. Choose between [-1, 1], or pull out the value using a {@link Property}.
/// - `contrast`: the contrast of the raster. Choose between [-1, 1], or pull out the value using a {@link Property}.
///
/// ### Optional layout properties:
/// - `resampling`: [See {@link Resampling}] The resampling method. Either `nearest` or `linear`
/// - `fadeDuration`: The time it takes for each raster tile to fade in and out of view in milliseconds
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct RasterStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Raster Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `opacity`: the opacity of the raster. Choose between [0, 1], or pull out the value using a {@link Property}.
    /// - `saturation`: the saturation of the raster. Choose between [-1, 1], or pull out the value using a {@link Property}.
    /// - `contrast`: the contrast of the raster. Choose between [-1, 1], or pull out the value using a {@link Property}.
    ///
    /// ### Optional layout properties:
    /// - `resampling`: [See {@link Resampling}] The resampling method. Either `nearest` or `linear`
    /// - `fadeDuration`: The time it takes for each raster tile to fade in and out of view in milliseconds
    #[serde(deserialize_with = "must_be_raster")]
    pub r#type: String,
    // paint
    /// A PAINT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `opacity` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `0`
    ///
    /// ex.
    ///
    /// ```json
    /// { "saturation": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "saturation": { "inputValue": { "key": "saturation", "fallback": 0.5 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `saturation` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub saturation: Option<Input<f32>>,
    /// A PAINT `Property`.
    /// @defaultValue `0`
    ///
    /// ex.
    ///
    /// ```json
    /// { "contrast": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "contrast": { "inputValue": { "key": "contrast", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contrast: Option<Input<f32>>,
    // properties
    /// Decide how the GPU samples the texture. Either `nearest` or `linear`. Linear is smoother but nearest has better performance.
    ///
    /// Defaults to `linear`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resampling: Option<Resampling>,
    /// The duration of the fade in milliseconds. Defaults to `300`
    #[serde(rename = "fadeDuration", skip_serializing_if = "Option::is_none")]
    pub fade_duration: Option<f32>,
}
/// A Raster layer guide parsed from a user defined layer guide, replacing undefined values with defaults
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct RasterDefinition {
    //   type: 'raster';
    base: LayerDefinitionBase,
    // paint
    opacity: Input<f32>,
    saturation: Input<f32>,
    contrast: Input<f32>,
}
/// A worflow layer guide parsed from a user defined layer guide, designed to help shape raster feature data into renderable targets
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct RasterWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub fade_duration: f32,
    pub resampling: Resampling,
}
/// An extension to the raster workflow layer guide for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct RasterWorkflowLayerGuideGPU {
    pub guide: RasterWorkflowLayerGuide,
    pub layer_buffer: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
}
/// A worker layer guide parsed from a user defined layer guide for the Tile Raster Workers to prepare data for rendering
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct RasterWorkerLayer {
    //   type: 'raster',
    pub base: LayerWorkerBaseRaster,
    pub get_code: BuildCodeFunctionZoom,
}
impl PartialEq for RasterWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
    }
}

// HILLSHADE //

/// Hillshade unpacking guide to convert RGBA encoded values into a f32
#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize, Pod, Zeroable)]
pub struct UnpackDefinition {
    /// the offset to the hillshade data
    pub offset: f32,
    /// The z factor or elevation multiplier
    #[serde(rename = "zFactor")]
    pub z_factor: f32,
    /// The multiplier (decode factor) for the red channel
    #[serde(rename = "rMultiplier")]
    pub r_multiplier: f32,
    /// The multiplier (decode factor) for the green channel
    #[serde(rename = "gMultiplier")]
    pub g_multiplier: f32,
    /// The multiplier (decode factor) for the blue channel
    #[serde(rename = "bMultiplier")]
    pub b_multiplier: f32,
    /// The multiplier (decode factor) for the alpha channel
    #[serde(rename = "aMultiplier")]
    pub a_multiplier: f32,
}
/// # Hillshade Style Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `opacity`: the opacity of the hillshade. Choose between [0, 1], or pull out the value using a {@link Property}.
/// - `azimuth`: the azimuth of the sun's position casting the light in degrees [0, 360]. Input a `number` or pull out the value using a {@link Property}.
/// - `altitude`: the altitude of the raster in degrees [0, 90]. Input a `number` or pull out the value using a {@link Property}.
/// - `shadowColor`: {@link Color} of the shadows. Input either a `string` pull out the value using a {@link Property}.
/// - `highlightColor`: {@link Color} of the highlights. Input either a `string` pull out the value using a {@link Property}.
/// - `accentColor`: {@link Color} of the accents. Input either a `string` pull out the value using a {@link Property}.
///
/// ### Optional layout properties:
/// - `fadeDuration`: The time it takes for each raster tile to fade in and out of view in milliseconds
/// - `unpack`: Descriptor to help the GPU know how to unpack the incoming RGBA data into a f32.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct HillshadeStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Hillshade Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `opacity`: the opacity of the hillshade. Choose between [0, 1], or pull out the value using a {@link Property}.
    /// - `azimuth`: the azimuth of the sun's position casting the light in degrees [0, 360]. Input a `number` or pull out the value using a {@link Property}.
    /// - `altitude`: the altitude of the raster in degrees [0, 90]. Input a `number` or pull out the value using a {@link Property}.
    /// - `shadowColor`: {@link Color} of the shadows. Input either a `string` pull out the value using a {@link Property}.
    /// - `highlightColor`: {@link Color} of the highlights. Input either a `string` pull out the value using a {@link Property}.
    /// - `accentColor`: {@link Color} of the accents. Input either a `string` pull out the value using a {@link Property}.
    ///
    /// ### Optional layout properties:
    /// - `fadeDuration`: The time it takes for each raster tile to fade in and out of view in milliseconds
    /// - `unpack`: [See {@link UnpackDefinition}] Descriptor to help the GPU know how to unpack the incoming RGBA data into a f32.
    #[serde(deserialize_with = "must_be_hillshade")]
    pub r#type: String,
    // layout
    /// A LAYOUT `Property`.
    /// @defaultValue `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `315`
    ///
    /// ex.
    ///
    /// ```json
    /// { "azimuth": 115 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "azimuth": { "inputValue": { "key": "az", "fallback": 0 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub azimuth: Option<Input<f32>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `45`
    ///
    /// ex.
    ///
    /// ```json
    /// { "altitude": 45 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "altitude": { "inputValue": { "key": "alt", "fallback": 45 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub altitude: Option<Input<f32>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `"#000"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "shadowColor": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "shadowColor": { "inputValue": { "key": "shadow", "fallback": "black" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(rename = "shadowColor", skip_serializing_if = "Option::is_none")]
    pub shadow_color: Option<Input<String>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `"#fff"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "highlightColor": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "highlightColor": { "inputValue": { "key": "accent", "fallback": "white" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(rename = "highlightColor", skip_serializing_if = "Option::is_none")]
    pub highlight_color: Option<Input<String>>,
    /// A LAYOUT `Property`.
    /// @defaultValue `"#000"`
    ///
    /// ex.
    ///
    /// ```json
    /// { "accentColor": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "accentColor": { "inputValue": { "key": "accent", "fallback": "black" } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(rename = "accentColor", skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<Input<String>>,
    // properties
    /// The duration of the fade in milliseconds. Defaults to `300`
    #[serde(rename = "fadeDuration", skip_serializing_if = "Option::is_none")]
    pub fade_duration: Option<f32>,
    /// A property to unpack the hillshade data via the GPU.
    ///
    /// The formula used by the GPU is as follow:
    /// `(color.r * rMultiplier + color.g * gMultiplier + color.b * bMultiplier + color.a * aMultiplier) * zFactor + offset`
    ///
    /// The WebGPU code is as follows:
    ///
    /// ```wgsl
    /// fn getElevation(
    /// uv: vec2<f32>,
    /// ) -> f32 {
    /// var color = textureSample(demTexture, imageSampler, uv);
    /// return (
    /// (
    /// color.r * unpack.rMultiplier +
    /// color.g * unpack.gMultiplier +
    /// color.b * unpack.bMultiplier +
    /// color.a * unpack.aMultiplier
    /// ) * unpack.zFactor
    /// ) + unpack.offset;
    /// }
    /// ```
    /// @defaultValue (Mapbox encoding):
    ///
    /// ```json
    /// {
    ///   "offset": -10000,
    ///   "zFactor": 0.1,
    ///   "aMultiplier": 0,
    ///   "bMultiplier": 1,
    ///   "gMultiplier": 256,
    ///   "rMultiplier": 65536 // 256 * 256
    /// }
    /// ```
    ///
    /// Should you need to use terrarium data, you can copy paste the following values:
    ///
    /// ```json
    /// {
    ///   // (color.r * 256. + color.g + color.b / 256.) - 32768.;
    ///   "offset": -32768,
    ///   "zFactor": 1,
    ///   "aMultiplier": 0,
    ///   "bMultiplier": 0.00390625, // 1 / 256
    ///   "gMultiplier": 1,
    ///   "rMultiplier": 256
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unpack: Option<UnpackDefinition>,
}
/// Parsed user hillshade layer guide that replaced undefined values with defaults
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct HillshadeDefinition {
    //   type: 'hillshade';
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    // layout
    pub opacity: Input<f32>,
    pub azimuth: Input<f32>,
    pub altitude: Input<f32>,
    #[serde(rename = "shadowColor")]
    pub shadow_color: Input<String>,
    #[serde(rename = "highlightColor")]
    pub highlight_color: Input<String>,
    #[serde(rename = "accentColor")]
    pub accent_color: Input<String>,
    pub unpack: UnpackDefinition,
}
/// A worflow layer guide parsed from a user defined layer guide, designed to help shape hillshade feature data into renderable targets
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HillshadeWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    pub fade_duration: f32,
    pub unpack: UnpackDefinition,
}
/// An extension to the hillshade workflow layer guide for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HillshadeWorkflowLayerGuideGPU {
    pub guide: HillshadeWorkflowLayerGuide,
    pub _b: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
    pub unpack_buffer: WebGPUBuffer,
}
/// A worker layer guide parsed from a user defined layer guide for the Tile Raster Workers to
/// prepare data for rendering
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct HillshadeWorkerLayer {
    //   type: 'hillshade';
    pub base: LayerWorkerBaseRaster,
    pub get_code: BuildCodeFunctionZoom,
}
impl PartialEq for HillshadeWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
    }
}

// SENSOR //

/// # Sensor Style Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `opacity`: the opacity of the sensor. Choose between [0, 1], or pull out the value using a {@link Property}.
///
/// ### Optional layout properties:
/// - `fadeDuration`: The time it takes for each raster tile to fade in and out of view in milliseconds
/// - `colorRamp`: [See {@link ColorRamp}] Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
///
/// ### Optional properties:
/// - `interactive`: boolean flag. If true, when hovering over the fill, the property data will be sent to the UI via an Event
/// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the fill
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct SensorStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Sensor Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `opacity`: the opacity of the sensor. Choose between [0, 1], or pull out the value using a {@link Property}.
    ///
    /// ### Optional layout properties:
    /// - `fadeDuration`: The time it takes for each raster tile to fade in and out of view in milliseconds
    /// - `colorRamp`: [See {@link ColorRamp}] Build a interpolation ramp to help the sensor data be converted into RGBA. May be `sinebow` or `sinebow-extended`
    ///
    /// ### Optional properties:
    /// - `interactive`: boolean flag. If true, when hovering over the fill, the property data will be sent to the UI via an Event
    /// - `cursor`: [See {@link Cursor}] the cursor to use when hovering over the fill
    #[serde(deserialize_with = "must_be_sensor")]
    pub r#type: String, // 'sensor';
    // paint
    /// A PAINT `Property`. Default value of `1`
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": 0.5 }
    /// ```
    ///
    /// ex.
    ///
    /// ```json
    /// { "opacity": { "inputValue": { "key": "opacity", "fallback": 1 } } }
    /// ```
    ///
    /// ### Your list of {@link Property} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRange}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRange}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `number` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<Input<f32>>,
    // properties
    /// The duration of the fade in milliseconds. Defaults to `300`
    #[serde(rename = "fadeDuration", skip_serializing_if = "Option::is_none")]
    pub fade_duration: Option<f32>,
    /// Defaults to `sinebow`.
    ///
    /// ex.
    /// ```json
    /// {
    ///  "colorRamp": [
    /// { "stop": 0, "color": "rgba(33,102,172,0)" },
    /// { "stop": 0.2, "color": "rgba(103,169,207, 0.85)" },
    /// { "stop": 0.4, "color": "rgb(209,229,240)" },
    /// { "stop": 0.6, "color": "rgb(253,219,199)" },
    /// { "stop": 0.8, "color": "rgb(239,138,98)" },
    /// { "stop": 1, "color": "rgb(178,24,43)" }
    /// ]
    /// }
    /// ```
    #[serde(rename = "colorRamp", skip_serializing_if = "Option::is_none")]
    pub color_ramp: Option<ColorRamp>,
    /// if true, when hovering over the fill, the property data will be sent to the UI via an Event. Defaults to false
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interactive: Option<bool>,
    /// the cursor to use when hovering over the fill. Defaults to "default"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor: Option<Cursor>,
}
/// A Raster layer guide parsed from a user defined layer guide, replacing undefined values with defaults
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct SensorDefinition {
    //   type: 'sensor';
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    // paint
    pub opacity: Input<f32>,
    // properties
    #[serde(rename = "fadeDuration")]
    pub fade_duration: f32,
    #[serde(rename = "colorRamp")]
    pub color_ramp: ColorRamp,
    pub interactive: bool,
    pub cursor: Cursor,
}
/// A worflow layer guide parsed from a user defined layer guide, designed to help shape sensor
/// feature data into renderable targets
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SensorWorkflowLayerGuide {
    pub base: LayerWorkflowGuideBase,
    // properties
    pub fade_duration: f32,
    pub color_ramp: wgpu::Texture,
}
/// An extension to the sensor workflow layer guide for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SensorWorkflowLayerGuideGPU {
    pub guide: SensorWorkflowLayerGuide,
    pub color_ramp_texture: wgpu::Texture,
}
/// A worker layer guide parsed from a user defined layer guide for the Tile Sensor Workers to prepare data for rendering
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct SensorWorkerLayer {
    //   type: 'sensor';
    pub base: LayerWorkerBaseRaster,
    pub get_code: BuildCodeFunctionZoom,
}
impl PartialEq for SensorWorkerLayer {
    fn eq(&self, other: &Self) -> bool {
        self.base == other.base
    }
}

// Shade //

/// # Shade Style Guide
///
/// ### Base Properties:
/// [See {@link LayerStyleBase}]
/// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
/// - `source`: the name of the source whose data this layer will use
/// - `layer`: the source's layer. Defaults to "default" for JSON data
/// - `minzoom`: the minimum zoom level at which the layer will be visible
/// - `maxzoom`: the maximum zoom level at which the layer will be visible
/// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
/// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
/// - `visible`: whether the layer is visible or not
/// - `metadata`: additional metadata. Used by style generators
///
/// ### Optional paint properties:
/// - `color`: {@link Color} of the shade. Input either a `string` pull out the value using a {@link PropertyOnlyStep}.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShadeStyle<M: Clone + Default = ()> {
    /// Flatten the base properties
    #[serde(flatten)]
    pub base: LayerStyleBase<M>,
    /// # Shade Style Guide
    ///
    /// ### Base Properties:
    /// [See {@link LayerStyleBase}]
    /// - `name`: the name of the layer, useful for sorting a layer on insert or for removal
    /// - `source`: the name of the source whose data this layer will use
    /// - `layer`: the source's layer. Defaults to "default" for JSON data
    /// - `minzoom`: the minimum zoom level at which the layer will be visible
    /// - `maxzoom`: the maximum zoom level at which the layer will be visible
    /// - `filter`: [See {@link Filter}] a filter function to filter out features from the source layer
    /// - `lch`: use LCH coloring instead of RGB. Useful for color changing when the new color is very different from the old one
    /// - `visible`: whether the layer is visible or not
    /// - `metadata`: additional metadata. Used by style generators
    ///
    /// ### Optional paint properties:
    /// - `color`: {@link Color} of the shade. Input either a `string` pull out the value using a {@link PropertyOnlyStep}.
    #[serde(deserialize_with = "must_be_shade")]
    pub r#type: String,
    // layout
    /// A LAYOUT `Property`.
    /// @defaultValue `"rgba(0, 0, 0, 1)"`
    ///
    /// ex.
    /// ```json
    /// { "color": "rgba(240, 2, 5, 1)" }
    /// ```
    ///
    /// ex.
    /// ```json
    /// { "color": { "inputValue": { "key": "type", "fallback": "blue" } } }
    /// ```
    ///
    /// ### Your list of {@link PropertyOnlyStep} options are:
    /// - `inputValue`: [See {@link InputValue}] access value in feature properties
    /// - `dataCondition`: [See {@link DataCondition}] filter based on feature property conditions
    /// - `dataRange`: [See {@link DataRangeStep}] filter based on feature property ranges
    /// - `inputRange`: [See {@link InputRangeStep}] filter based on map conditions like "zoom", "lon", "lat", "angle", or "pitch"
    /// - `featureState`: [See {@link FeatureState}] filter based on feature state
    /// - `fallback`: if all else fails, use this value. A value of `string` itself or pull from feature properties using {@link Property}
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<InputOnlyStep<String>>,
}
/// Parsed user shade layer guide that replaced undefined values with defaults
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct ShadeDefinition {
    //   type: 'shade';
    #[serde(flatten)]
    pub base: LayerDefinitionBase,
    // layout
    pub color: InputOnlyStep<String>,
}
/// A worflow layer guide parsed from a user defined layer guide, designed to help shape shade feature data into renderable targets
pub type ShadeWorkflowLayerGuide = LayerWorkflowGuideBase;
/// An extension to the shade workflow layer guide for WebGPU
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ShadeWorkflowLayerGuideGPU {
    pub guide: ShadeWorkflowLayerGuide,
    pub layer_buffer: WebGPUBuffer,
    pub layer_code_buffer: WebGPUBuffer,
}
/// A worker layer guide parsed from a user defined layer guide for the Tile Workers to prepare data for rendering
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ShadeWorkerLayer {
    //   type: 'shade';
    pub base: LayerWorkerBase,
}

/// All possible layer styles to use
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayerStyle<M: Clone + Default = ()> {
    /// Uknown layer style. Only has base properties and not enough information to be useful
    Unknown(UnknownLayerStyle<M>),
    /// Fill
    Fill(FillStyle<M>),
    /// Glyph
    Glyph(GlyphStyle<M>),
    /// Heatmap
    Heatmap(HeatmapStyle<M>),
    /// Hillshade
    Hillshade(HillshadeStyle<M>),
    /// Line
    Line(LineStyle<M>),
    /// Point
    Point(PointStyle<M>),
    /// Raster
    Raster(RasterStyle<M>),
    /// Sensor
    Sensor(SensorStyle<M>),
    /// Shade
    Shade(ShadeStyle<M>),
}
impl<M: Clone + Default> Default for LayerStyle<M> {
    fn default() -> Self {
        LayerStyle::Unknown(UnknownLayerStyle::default())
    }
}
impl<M: Clone + Default> LayerStyle<M> {
    /// Get the base layer style
    pub fn base(&self) -> &LayerStyleBase<M> {
        match self {
            LayerStyle::Fill(layer) => &layer.base,
            LayerStyle::Glyph(layer) => &layer.base,
            LayerStyle::Heatmap(layer) => &layer.base,
            LayerStyle::Hillshade(layer) => &layer.base,
            LayerStyle::Line(layer) => &layer.base,
            LayerStyle::Point(layer) => &layer.base,
            LayerStyle::Raster(layer) => &layer.base,
            LayerStyle::Sensor(layer) => &layer.base,
            LayerStyle::Shade(layer) => &layer.base,
            LayerStyle::Unknown(layer) => &layer,
        }
    }
}
/// All layer definitions that are used by the painter workflows
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum LayerDefinition {
    /// Fill
    Fill(FillDefinition),
    /// Glyph
    Glyph(GlyphDefinition),
    /// Heatmap
    Heatmap(HeatmapDefinition),
    /// Hillshade
    Hillshade(HillshadeDefinition),
    /// Line
    Line(LineDefinition),
    /// Point
    Point(PointDefinition),
    /// Raster
    Raster(RasterDefinition),
    /// Sensor
    Sensor(SensorDefinition),
    /// Shade
    Shade(ShadeDefinition),
}
impl From<FillDefinition> for LayerDefinition {
    fn from(f: FillDefinition) -> Self {
        LayerDefinition::Fill(f)
    }
}
impl LayerDefinition {
    /// Get the base layer definition
    pub fn base(&self) -> &LayerDefinitionBase {
        match self {
            LayerDefinition::Fill(layer) => &layer.base,
            LayerDefinition::Glyph(layer) => &layer.base,
            LayerDefinition::Heatmap(layer) => &layer.base,
            LayerDefinition::Hillshade(layer) => &layer.base,
            LayerDefinition::Line(layer) => &layer.base,
            LayerDefinition::Point(layer) => &layer.base,
            LayerDefinition::Raster(layer) => &layer.base,
            LayerDefinition::Sensor(layer) => &layer.base,
            LayerDefinition::Shade(layer) => &layer.base,
        }
    }
    /// Get the layer name
    pub fn layer(&self) -> String {
        self.base().name.clone()
    }
    /// Get the source name
    pub fn source(&self) -> String {
        self.base().source.clone()
    }
    /// Get the layer index
    pub fn layer_index(&self) -> u32 {
        self.base().layer_index
    }
}
impl Default for LayerDefinition {
    fn default() -> Self {
        LayerDefinition::Fill(FillDefinition::default())
    }
}
/// Tile Worker layer processors
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum WorkerLayer {
    /// Fill
    Fill(FillWorkerLayer),
    /// Glyph
    Glyph(GlyphWorkerLayer),
    /// Heatmap
    Heatmap(HeatmapWorkerLayer),
    /// Hillshade
    Hillshade(HillshadeWorkerLayer),
    /// Line
    Line(LineWorkerLayer),
    /// Point
    Point(PointWorkerLayer),
    /// Raster
    Raster(RasterWorkerLayer),
    /// Sensor
    Sensor(SensorWorkerLayer),
}
/// Tile Worker layer processors that are Vector Geometry specific
#[derive(Debug, Clone, PartialEq)]
pub enum VectorWorkerLayer {
    /// Fill
    Fill(FillWorkerLayer),
    /// Glyph
    Glyph(GlyphWorkerLayer),
    /// Heatmap
    Heatmap(HeatmapWorkerLayer),
    /// Line
    Line(LineWorkerLayer),
    /// Point
    Point(PointWorkerLayer),
}
/// Layer types that can be interactive
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum InteractiveWorkerLayer {
    Fill(FillWorkerLayer),
    Glyph(GlyphWorkerLayer),
    Line(LineWorkerLayer),
    Point(PointWorkerLayer),
}
impl InteractiveWorkerLayer {
    /// Returns the cursor for the layer
    pub fn cursor(&self) -> String {
        match self {
            InteractiveWorkerLayer::Fill(worker_layer) => worker_layer.cursor.clone(),
            InteractiveWorkerLayer::Glyph(worker_layer) => worker_layer.cursor.clone(),
            InteractiveWorkerLayer::Line(worker_layer) => worker_layer.cursor.clone(),
            InteractiveWorkerLayer::Point(worker_layer) => worker_layer.cursor.clone(),
        }
    }
    /// Get the name of the layer
    pub fn name(&self) -> String {
        match self {
            InteractiveWorkerLayer::Fill(worker_layer) => worker_layer.base.name.clone(),
            InteractiveWorkerLayer::Glyph(worker_layer) => worker_layer.base.name.clone(),
            InteractiveWorkerLayer::Line(worker_layer) => worker_layer.base.name.clone(),
            InteractiveWorkerLayer::Point(worker_layer) => worker_layer.base.name.clone(),
        }
    }
    /// Get the source of the layer
    pub fn source(&self) -> String {
        match self {
            InteractiveWorkerLayer::Fill(worker_layer) => worker_layer.base.source.clone(),
            InteractiveWorkerLayer::Glyph(worker_layer) => worker_layer.base.source.clone(),
            InteractiveWorkerLayer::Line(worker_layer) => worker_layer.base.source.clone(),
            InteractiveWorkerLayer::Point(worker_layer) => worker_layer.base.source.clone(),
        }
    }
    /// Get the layer data of the worker layer
    pub fn layer(&self) -> String {
        match self {
            InteractiveWorkerLayer::Fill(worker_layer) => worker_layer.base.layer.clone(),
            InteractiveWorkerLayer::Glyph(worker_layer) => worker_layer.base.layer.clone(),
            InteractiveWorkerLayer::Line(worker_layer) => worker_layer.base.layer.clone(),
            InteractiveWorkerLayer::Point(worker_layer) => worker_layer.base.layer.clone(),
        }
    }
}

/// GPU Context Type
/// - `0` -> DOM
/// - `1` -> WebGL1
/// - `2` -> WebGL2
/// - `3` -> WebGPU
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum GPUType {
    /// Render using the DOM (WASM/Web Components)
    DOM = 0,
    /// Render using the WebGL spec (For Rust this maps to OpenGL)
    WebGL1 = 1,
    /// Render using the WebGL2 spec (For Rust this maps to OpenGL)
    WebGL2 = 2,
    /// Render using the WebGPU spec
    #[default]
    WebGPU = 3,
}

/// Basic analytics information sent to servers
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct S2MapsAnalytics {
    pub gpu: String,
    pub context: GPUType,
    pub language: String,
    pub width: u32,
    pub height: u32,
}

/// Style package is an internal tool to ship information about the map to the workers
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct StylePackage {
    pub projection: Projection,
    #[serde(rename = "gpuType")]
    pub gpu_type: GPUType,
    pub sources: Sources,
    pub fonts: Fonts,
    pub icons: Icons,
    pub glyphs: Glyphs,
    pub sprites: Sprites,
    pub images: BTreeMap<String, String>,
    pub layers: Vec<LayerDefinition>,
    pub minzoom: f64,
    pub maxzoom: f64,
    #[serde(rename = "tileSize")]
    pub tile_size: u64,
    pub analytics: S2MapsAnalytics,
    pub experimental: bool,
    #[serde(rename = "apiKey", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(rename = "urlMap", skip_serializing_if = "Option::is_none")]
    pub url_map: Option<UrlMap>,
}

/// # Skybox Style
///
/// Render a skybox image as a background to the map.
///
/// ex. [See {@link UrlMap} to understand how to use the `path` property like this example]
/// ```json
/// "skybox": {
///   "path": "baseURL://backgrounds/milkyway",
///   "loadingBackground": "rgb(9, 8, 17)",
///   "size": 2048,
///   "type": "webp",
/// }
/// ```
///
/// ### Common Folder Structure
/// ```markdown
/// ./public/backgrounds
/// └── milkyway
///     ├── 1024
///     │   ├── 0.jpg
///     │   ├── 0.webp
///     │   ├── 1.jpg
///     │   ├── 1.webp
///     │   ├── 2.jpg
///     │   ├── 2.webp
///     │   ├── 3.jpg
///     │   ├── 3.webp
///     │   ├── 4.jpg
///     │   ├── 4.webp
///     │   ├── 5.jpg
///     │   └── 5.webp
///     └── 2048
///         ├── 0.jpg
///         ├── 0.png
///         ├── 0.webp
///         ├── 1.jpg
///         ├── 1.png
///         ├── 1.webp
///         ├── 2.jpg
///         ├── 2.png
///         ├── 2.webp
///         ├── 3.jpg
///         ├── 3.png
///         ├── 3.webp
///         ├── 4.jpg
///         ├── 4.png
///         ├── 4.webp
///         ├── 5.jpg
///         ├── 5.png
///         └── 5.webp
/// ```
///
/// ### Properties
/// - `path`: path to the skybox image folder
/// - `size`: size of the skybox image (the path's folder may support multiple)
/// - `type`: type of image (the path's folder may support multiple)
/// - `loadingBackground`: background color of the skybox while waiting for it to load images
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct SkyboxStyle {
    /// path to the skybox image folder
    pub path: String,
    /// size of the skybox image (the path's folder may support multiple)
    pub size: usize,
    /// type of image (the path's folder may support multiple)
    pub r#type: String,
    /// background color of the skybox while waiting for it to load images
    #[serde(rename = "loadingBackground", skip_serializing_if = "Option::is_none")]
    pub loading_background: Option<String>,
}

/// # Wallpaper Style
///
/// Wallpaper is often used with vector data. Control the coloring of the background.
///
/// ex.
///
/// ```json
/// "wallpaper": {
///   "background": "#030a2d",
///   "fade1": "rgb(138, 204, 255)",
///   "fade2": "rgb(217, 255, 255)",
///   "halo": "rgb(230, 255, 255)"
/// }
/// ```
///
/// ### Properties
/// - `background`: background color is the most seen color zoomed out
/// - `fade1`: color of the border around the sphere
/// - `fade2`: second color of the border around the sphere (further away then fade1)
/// - `halo`: color of the softest border around the sphere (closest to the sphere and smallest fade factor)
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct WallpaperStyle {
    /// background color is the most seen color zoomed out
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    /// color of the border around the sphere
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade1: Option<String>,
    /// second color of the border around the sphere (further away then fade1)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fade2: Option<String>,
    /// color of the border around the sphere (closest to the sphere and smallest fade factor)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub halo: Option<String>,
}

// TIME SERIES //

/// # Time Series Style
///
/// Temporal data is a series of gridded tiles that can be visualized as an animation.
/// Describe the time series beginning and end dates, speed, and pause duration.
///
/// ### Properties
/// - `start_date`: Date formatted string or unix timestamp (e.g. 1631124000000)
/// - `end_date`: Date formatted string or unix timestamp (e.g. 1631124000000)
/// - `speed`: Seconds in time series per second (e.g. 10800 seconds per second)
/// - `pause_duration`: Time to wait before animating in seconds (e.g. 3 seconds)
/// - `auto_play`: If true, start playing automatically
/// - `loop`: If true, loop the animation
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct TimeSeriesStyle {
    /// Date formatted string or unix timestamp (e.g. 1631124000000)
    #[serde(rename = "startDate", skip_serializing_if = "Option::is_none")]
    pub start_date: Option<i64>,
    /// Date formatted string or unix timestamp (e.g. 1631124000000)
    #[serde(rename = "endDate", skip_serializing_if = "Option::is_none")]
    pub end_date: Option<i64>,
    /// Seconds in time series per second (e.g. 10800 seconds per second)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed: Option<f64>,
    /// Time to wait before animating in seconds (e.g. 3 seconds)
    #[serde(rename = "pauseDuration", skip_serializing_if = "Option::is_none")]
    pub pause_duration: Option<f64>,
    /// If true, start playing automatically
    #[serde(rename = "autoPlay", skip_serializing_if = "Option::is_none")]
    pub auto_play: Option<bool>,
    /// If true, loop the animation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#loop: Option<bool>,
}

// STYLE DEFINITION //

/// # MapOptions Style Input
///
/// Either an href pointing to the Style object or the style object itself
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum MapStyleInput {
    /// href
    Href(String),
    /// Style Definition
    Style(StyleDefinition),
}
impl From<String> for MapStyleInput {
    fn from(href: String) -> Self {
        MapStyleInput::Href(href)
    }
}
impl From<StyleDefinition> for MapStyleInput {
    fn from(style: StyleDefinition) -> Self {
        MapStyleInput::Style(style)
    }
}
impl MapStyleInput {
    /// Get the projection of the style. If it's still in href form return nothing
    pub fn projection(&self) -> Option<Projection> {
        match self {
            MapStyleInput::Href(_) => None,
            MapStyleInput::Style(style) => style.projection,
        }
    }
}
impl Default for MapStyleInput {
    fn default() -> Self {
        MapStyleInput::Href(String::default())
    }
}

/// # STYLE DEFINITION
///
/// ### Description
/// This is the user defined guide for how to render the map. This definition includes directions of what data
/// to render, where to get said data, and how to style each data as layers.
///
/// ### Rendering Properties
/// - `projection`: [See {@link Projection}] `"S2"` (Spherical Geometry) or `"WM"` (Web Mercator). Defaults to S2
/// - `sources`: [See {@link Sources}] Most critical, a list of source data, how to fetch for rendering
/// - `timeSeries`: [See {@link TimeSeriesStyle}] Time series data is a WIP. Is a guide on how to render &/ animate data at various timestamps
/// - `layers`: [See {@link LayerStyle}] array of layer definitions, describing how to render the scene
/// - `glyphs`: [See {@link Glyphs}] Glyph Data (both fonts and icons) and how to fetch them
/// - `icons`: [See {@link Icons}] Icon sources and how to fetch them
/// - `fonts`: [See {@link Fonts}] Font sources and how to fetch them
/// - `sprites`: [See {@link Sprites}] Sprites sources, where to fetch, can be a string or an object
/// - `images`: Image names and where to fetch them
/// - `skybox`: [See {@link SkyboxStyle}] Skybox is often used as a background feature for raster data. Uses a skybox image to render to the screen.
/// - `wallpaper`: [See {@link WallpaperStyle}] Wallpaper is often used with vector data. Control the coloring of the background.
/// - `clearColor`: Background color for sections where the painter doesn't draw to. Defaults to `rgba(0, 0, 0, 0)`
///
/// ### Camera Properties
/// - `view`: [See {@link View}] `zoom`, `lon`, `lat`, `bearing`, `pitch`. Defaults to 0 for all.
/// - `zNear`: zNear is a parameter for the camera. Recommend not touching.
/// - `zFar`: zFar is a parameter for the camera. Recommend not touching.
/// - `minzoom`: The furthest away from the planet you allow
/// - `maxzoom`: The closest to the planet you allow
/// - `minLatPosition`: The minimum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms
/// - `maxLatPosition`: The maximum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms
/// - `zoomOffset`: Often times to improve the quality of raster data, you can apply a zoomOffset for tiles to render.
///
/// ### Base Properties
/// - `version`: version of the style - not used for anything other than debugging
/// - `name`: name of the style - not used for anything other than debugging
/// - `description`: description of the style - not used for anything other than debugging
///
/// ### Flags
/// - `constrainZoomToFill`: Strictly a WM Projection property. Force the view to fill. Defaults to `false`
/// - `duplicateHorizontally`: Strictly a WM Projection property. Render the world map as necessary to fill the screen horizontally. Defaults to `true`
/// - `noClamp`: Allow the camera to go past the max-min latitudes. Useful for animations. Defaults to `false`
/// - `experimental`: Enable experimental features
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct StyleDefinition {
    /// version of the style - not used for anything other than debugging
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<usize>,
    /// name of the style - not used for anything other than debugging
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Use Either The Web Mercator "WM" or the "S2" Projection. [Default: `"S2"`]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projection: Option<Projection>,
    /// description of the style - not used for anything other than debugging
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Set the camera view.
    /// Properties include:
    /// - `zoom`: the zoom level of the map
    /// - `lon`: the longitude of the map
    /// - `lat`: the latitude of the map
    /// - `bearing`: the bearing/compass of the map camera
    /// - `pitch`: the pitch/vertical-angle of the map camera
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view: Option<View>,
    /// zNear is a parameter for the camera. Recommend not touching
    #[serde(rename = "zNear", skip_serializing_if = "Option::is_none")]
    pub z_near: Option<f64>,
    /// zFar is a parameter for the camera. Recommend not touching
    #[serde(rename = "zFar", skip_serializing_if = "Option::is_none")]
    pub z_far: Option<f64>,
    /// The furthest away from the planet you allow
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minzoom: Option<f64>,
    /// The closest you allow the camera to get to the planet
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maxzoom: Option<f64>,
    /// Strictly a WM Projection property. Force the view to fill.
    /// Defaults to `false`.
    #[serde(rename = "constrainZoomToFill", skip_serializing_if = "Option::is_none")]
    pub constrain_zoom_to_fill: Option<bool>,
    /// Strictly a WM Projection property. Render the world map as necessary to fill the screen horizontally.
    /// Defaults to `true`.
    #[serde(rename = "duplicateHorizontally", skip_serializing_if = "Option::is_none")]
    pub duplicate_horizontally: Option<bool>,
    /// The minimum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms
    #[serde(rename = "minLatPosition", skip_serializing_if = "Option::is_none")]
    pub min_lat_position: Option<f64>,
    /// The maximum latitude position. Useful for the S2 Projection to avoid wonky movemeny at low zooms
    #[serde(rename = "maxLatPosition", skip_serializing_if = "Option::is_none")]
    pub max_lat_position: Option<f64>,
    /// Often times to improve the quality of raster data, you can apply a zoomOffset for tiles to render.
    #[serde(rename = "zoomOffset", skip_serializing_if = "Option::is_none")]
    pub zoom_offset: Option<f64>,
    /// Allow the camera to go past the max-min latitudes. Useful for animations.
    #[serde(rename = "noClamp", skip_serializing_if = "Option::is_none")]
    pub no_clamp: Option<bool>,
    /// Where to fetch data and JSON guides on how to fetch them. If JSON data, it can be included directly in the source
    ///
    /// ex.
    /// ```json
    /// "sources": {
    ///    "countries": "/s2json/countriesHD.s2json",
    ///    "earthquakes": "/s2json/earthquakes.s2json"
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Sources>,
    /// Time series data is a WIP. Is a guide on how to render &/ animate data at various timestamps
    #[serde(rename = "timeSeries", skip_serializing_if = "Option::is_none")]
    pub time_series: Option<TimeSeriesStyle>,
    /// Glyph Data (both fonts and icons) and how to fetch them
    ///
    /// ex.
    /// ```json
    /// "glyphs": {
    ///  "robotoMedium": "/api/glyphs-v2/RobotoMedium",
    ///  "streets": "/api/glyphs-v2/streets"
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub glyphs: Option<Glyphs>,
    /// Fonts and how to fetch them
    ///
    /// ex.
    /// ```json
    /// "fonts": {
    ///  "robotoMedium": "/api/glyphs-v2/RobotoMedium"
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fonts: Option<Fonts>,
    /// Icons and how to fetch them
    ///
    /// ex.
    /// ```json
    /// "icons": {
    ///  "streets": "/api/glyphs-v2/streets"
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icons: Option<Icons>,
    /// Sprites names and where to fetch
    ///
    /// Sprites have a default expectancy of a `png` image.
    ///
    /// If you want to use a different format, you can use an object instead of a string.
    ///
    /// See {@link UrlMap} to use your own scheme/protocol for the URL path.
    ///
    /// ex.
    /// ```json
    /// "sprites": {
    ///    "streets": "/sprites/streets/sprite@2x"
    /// }
    /// ```
    ///
    /// ex.
    /// ```json
    /// "sprites": {
    ///    "streets": {
    ///      "path": "/sprites/streets/sprite@2x",
    ///      "fileType": "jpg"
    ///    }
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sprites: Option<Sprites>,
    /// Image names and where to fetch
    ///
    /// ex.
    /// ```json
    /// "images": {
    ///   "pattern": "/images/pattern.jpg"
    /// }
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<BTreeMap<String, String>>,
    /// Skybox is often used as a background feature for raster data. Uses a skybox image to render to the screen.
    ///
    /// See {@link UrlMap} to use your own scheme/protocol for the URL path.
    ///
    /// ex.
    /// ```json
    /// "skybox": {
    ///    "path": "baseURL://backgrounds/milkyway",
    ///    "loadingBackground": "rgb(9, 8, 17)",
    ///    "size": 2048,
    ///    "type": "webp"
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skybox: Option<SkyboxStyle>,
    /// Wallpaper is often used with vector data. Control the coloring of the background.
    ///
    /// ex.
    ///
    /// ```json
    /// "wallpaper": {
    ///   "background": "#030a2d",
    ///   "fade1": "rgb(138, 204, 255)",
    ///   "fade2": "rgb(217, 255, 255)",
    ///   "halo": "rgb(230, 255, 255)"
    /// }
    /// ```
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallpaper: Option<WallpaperStyle>,
    /// background color for sections where the painter doesn't draw to
    /// Default is `rgba(0, 0, 0, 0)` (transparent)
    #[serde(rename = "clearColor", skip_serializing_if = "Option::is_none")]
    pub clear_color: Option<ColorArray>,
    /// Layers are the main way to render data on the map.
    /// Your layer options are:
    /// - fill - Draw polygons with a fill color, outline, and opacity
    /// - glyph - Draw text, icons, sprites, etc.
    /// - heatmap - Takes lots of points as an input and produces a heatmap
    /// - hillshade - Draw hillshading on the map given an input elevation tile.
    /// - line - Lines with variable width, cap, and join types
    /// - point - Draw individual points, even if they're clustered, deconstruct lines and polygons, etc.
    /// - raster - RGBA encoded tile data
    /// - sensor - Sensor data is a temporal construct that takes gridded data and draws it on the map using a color ramp.
    /// - shade - Draw a nice "shade" gradient on the globe to give it depth if you're using the S2 Projection. Usually only want one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layers: Option<Vec<LayerStyle>>,
    /// @experimental Utilize WIP experimental components that still have bugs in them.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub experimental: Option<bool>,
}

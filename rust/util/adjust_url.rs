use alloc::{collections::BTreeMap, format, string::String};
use core::ops::{Deref, DerefMut};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// # URL Map
///
/// A convenient way to define scheme/protocol of the URL and it's replacement.
/// This can be defined by the user in the {@link MapOptions} `urlMap` property.
///
/// The default replacement key-values are:
/// - s2maps: 'https://api.s2maps.com'
/// - opens2: 'https://api.opens2.com'
/// - mapbox: 'https://api.mapbox.com'
/// - apiURL: 'https://api.opens2.com'
/// - baseURL: 'https://opens2.com'
///
/// Let's say I want to add a skybox to the scene:
/// ```json
/// "skybox": {
///   "path": "baseURL://backgrounds/milkyway",
///   "loadingBackground": "rgb(9, 8, 17)",
///   "size": 2048,
///   "type": "webp",
/// }
/// ```
///
/// Then we can modify the baseURL to point to the correct location:
/// ```rust
/// use s2maps_gpu::{S2Map, ui::MapOptions, util::UrlMap};
///
/// let url_map: UrlMap::from([
///   ("baseURL".into(), "http://localhost:3000".into()),
/// ]);
/// let map = S2Map::new(MapOptions { url_map, ..Default::default() });
/// ```
///
/// This is obviously more useful when working with environment variables to point to development
/// and production servers without having to change the code.
/// @see {@link adjustURL} for details on implementation
#[derive(Debug, Default, Clone, PartialEq)]
pub struct UrlMap {
    /** { schemeName: href } */
    map: BTreeMap<String, String>,
}
impl UrlMap {
    /// Create a new URL Map
    pub fn new() -> Self {
        let mut map = BTreeMap::new();

        map.insert("s2maps".into(), "https://api.s2maps.com".into());
        map.insert("opens2".into(), "https://api.opens2.com".into());
        map.insert("mapbox".into(), "https://api.mapbox.com".into());
        map.insert("apiURL".into(), "https://api.opens2.com".into());
        map.insert("baseURL".into(), "https://opens2.com".into());

        Self { map }
    }

    /// Adjust a URL either using:
    /// the URL_MAP (replace "s2maps://", "opens2://", or "mapbox://")
    /// the apiURL (replace "apiURL://") or baseURL (replace "baseURL://")
    /// which is defined by the user in the {@link MapOptions} `urlMap` property.
    ///
    /// ## Parameters
    /// - `input`: the input URL
    /// - `userMap`: the user defined guide on how to replace the URL_MAP
    ///
    /// ## Returns
    /// the adjusted URL
    pub fn adjust_url(&self, mut input: String) -> String {
        // replace all URL_MAP instances
        for (key, value) in &self.map {
            input = input.replace(&format!("{}://", key), &format!("{}:", value));
        }
        input
    }
}
// Automatically expose BTreeMap's methods
impl Deref for UrlMap {
    type Target = BTreeMap<String, String>;

    fn deref(&self) -> &Self::Target {
        &self.map
    }
}
impl DerefMut for UrlMap {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.map
    }
}
impl From<BTreeMap<String, String>> for UrlMap {
    fn from(map: BTreeMap<String, String>) -> Self {
        let mut url_map = UrlMap::new();
        url_map.extend(map);
        url_map
    }
}
// Enable `UrlMap::from([(_, _), ...])` (same as BTreeMap::from)
impl<const N: usize> From<[(String, String); N]> for UrlMap {
    fn from(arr: [(String, String); N]) -> Self {
        Self { map: BTreeMap::from(arr) }
    }
}
// Custom serialization
impl Serialize for UrlMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.map.serialize(serializer) // Serialize only the inner BTreeMap
    }
}
// Custom deserialization
impl<'de> Deserialize<'de> for UrlMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let map = BTreeMap::deserialize(deserializer)?;
        Ok(Self { map }) // Deserialize directly into the inner BTreeMap
    }
}

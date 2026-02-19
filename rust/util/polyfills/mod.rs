/// Polyfill for createImageBitmap
pub mod create_image_bitmap;
/// Fetch polyfills
pub mod fetch;
/// Promise like handler
pub mod promise;
/// Polyfill for Instant. Different platforms have different Instant implementations
pub mod time;

pub use create_image_bitmap::*;
pub use fetch::*;
pub use promise::*;
pub use time::*;

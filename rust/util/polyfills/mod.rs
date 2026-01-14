/// Polyfill for createImageBitmap
pub mod create_image_bitmap;
/// Fetch polyfills
pub mod fetch;
/// Polyfill for Instant. Different platforms have different Instant implementations
pub mod time;

pub use create_image_bitmap::*;
pub use fetch::*;
pub use time::*;

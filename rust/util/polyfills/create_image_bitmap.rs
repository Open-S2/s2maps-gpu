#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ImageBitmap {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// Create an ImageBitmap from raw bytes
///
/// ## NOTE
/// This actually supports all feature flags and frameworks. If std is not enabled, the only
/// images supported are PNG and JPEG
///
/// ## Parameters
/// - `image_bytes` - The raw bytes of the image. Usually received from a fetch request
pub async fn create_image_bitmap(image_bytes: Vec<u8>) -> Result<ImageBitmap, ()> {
    let img = image::load_from_memory(&image_bytes).map_err(|_| ())?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    Ok(ImageBitmap { width, height, data: rgba.into_raw() })
}

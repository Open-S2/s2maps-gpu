#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ImageBitmap {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Copy, Default)]
#[allow(missing_docs)]
pub enum PremultiplyAlpha {
    #[default]
    None,
    Premultiply,
}

#[derive(Debug, Clone, Copy, Default)]
#[allow(missing_docs)]
pub enum ImageOrientation {
    #[default]
    None,
    FlipY,
}

#[derive(Debug, Clone, Copy, Default)]
#[allow(missing_docs)]
pub struct ImageBitmapOptions {
    pub premultiply_alpha: PremultiplyAlpha,
    pub image_orientation: ImageOrientation,
}

/// Create an ImageBitmap from raw bytes
///
/// ## NOTE
/// This actually supports all feature flags and frameworks. If std is not enabled, the only
/// images supported are PNG and JPEG
///
/// ## Parameters
/// - `image_bytes` - The raw bytes of the image. Usually received from a fetch request
pub async fn create_image_bitmap(
    image_bytes: Vec<u8>,
    options: Option<ImageBitmapOptions>,
) -> Result<ImageBitmap, ()> {
    let options = options.unwrap_or_default();
    let img = image::load_from_memory(&image_bytes).map_err(|_| ())?;
    let mut rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // If premultiply is requested, modify the buffer in-place
    if matches!(options.premultiply_alpha, PremultiplyAlpha::Premultiply) {
        for pixel in rgba.chunks_exact_mut(4) {
            let a = pixel[3] as u32;
            if a < 255 {
                // R, G, and B are multiplied by Alpha / 255
                pixel[0] = ((pixel[0] as u32 * a) / 255) as u8;
                pixel[1] = ((pixel[1] as u32 * a) / 255) as u8;
                pixel[2] = ((pixel[2] as u32 * a) / 255) as u8;
            }
        }
    }

    if matches!(options.image_orientation, ImageOrientation::FlipY) {
        rgba = image::imageops::flip_vertical(&rgba);
    }

    Ok(ImageBitmap { width, height, data: rgba.into_raw() })
}

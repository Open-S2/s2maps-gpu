use crate::{
    util::{
        ImageBitmapOptions, ImageOrientation, MsgSender, PremultiplyAlpha, create_image_bitmap,
    },
    workers::{
        Glyph, ImageMetadata, ImageSource, ImageSourceMetadata, MapID, Session,
        SourceWorkerMessage, SourceWorkerMessageOutput, SpriteImageMessage, TexturePack,
    },
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use serde::{Deserialize, Serialize};

/// Sprite Metadata
#[derive(Debug, Clone, PartialEq, PartialOrd, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct SpriteMetadata {
    pub id: u32,
    pub width: u32,
    pub height: u32,
    pub x: u32,
    pub y: u32,
    pub pixel_ratio: f32,
}
/// Collection of Sprites Metadata
pub type SpritesMetadata = BTreeMap<String, SpriteMetadata>;

/// # SpriteSource
///
/// A collection of images relating to a single source
#[derive(Debug)]
pub struct SpriteSource {
    /// The image source is the majority of the workflow outside building the metadata
    pub image_source: ImageSource,
}
impl SpriteSource {
    /// Create a new image source
    ///
    /// ## Parameters
    /// - `name`: the name of the source
    /// - `path`: the path to the source
    /// - `texture_pack`: the texture pack to store the glyphs/images into
    /// - `session`: the session
    /// - `file_type`: the file type
    pub fn new(
        name: String,
        path: String,
        texture_pack: Rc<TexturePack>,
        session: Rc<RefCell<Session>>,
        file_type: Option<String>,
        source_worker: MsgSender<SourceWorkerMessageOutput>,
    ) -> Self {
        Self {
            image_source: ImageSource::new(
                name,
                path,
                texture_pack,
                session,
                file_type,
                source_worker,
            ),
        }
    }

    /// Add an image to the source collection
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to build for
    /// - `name`: the name of the image
    /// - `path`: the path to the image
    ///
    /// ## Returns
    /// The image metadata if successful
    pub async fn add_image(
        &mut self,
        map_id: MapID,
        name: String,
        path: String,
    ) -> Option<ImageSourceMetadata> {
        self.image_source.add_image(map_id, name, path).await
    }

    /// Fetch an image
    ///
    /// ## Parameters
    /// - `path`: the path to the image or metadata
    /// - `map_id`: the id of the map
    ///
    /// ## Returns
    /// The image or metadata
    pub async fn _fetch(&mut self, path: String, map_id: MapID) -> Option<Vec<u8>> {
        self.image_source._fetch(path, map_id).await
    }

    /// Build the image source metadata
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map to build for
    ///
    /// ## Returns
    /// The image metadata
    pub async fn build(&mut self, map_id: MapID) -> Option<ImageSourceMetadata> {
        let name = self.image_source.name.clone();
        let file_type = self.image_source.file_type.clone();
        let path = self.image_source.path.clone();
        let texture_pack = self.image_source.texture_pack.clone();
        // grab the metadata and sprites
        let Some(sprite_meta) = self
            ._fetch(format!("{path}.json"), map_id)
            .await
            .map(|meta| {
                if let Ok(meta) = serde_json::from_slice::<SpritesMetadata>(&meta) {
                    Some(meta)
                } else {
                    None
                }
            })
            .unwrap()
        else {
            // panic!("Failed to fetch sprite metadata {name}");
            self.image_source.active = false;
            return None;
        };
        let Some(sprites) = self._fetch(format!("{path}.{file_type}"), map_id).await else {
            // panic!("Failed to fetch sprite data {name}");
            self.image_source.active = false;
            return None;
        };
        //       const metadata: ImageMetadata = {};
        let mut metadata: ImageMetadata = ImageMetadata::default();
        // store the metadata
        let mut tex_w = 0;
        let mut tex_h = 0;
        for meta in sprite_meta.values() {
            tex_w = u32::max(tex_w, meta.width + meta.x);
            tex_h = u32::max(tex_h, meta.height + meta.y);
        }
        // update the texture pack
        let (offset_x, offset_y) = texture_pack.add_glyph(tex_w, tex_h);
        // invert the y axis for each glyph & add offsets
        for (name, mut meta) in sprite_meta {
            // fix the y axis to be inverted
            meta.y = tex_h - meta.y - meta.height + offset_y;
            let SpriteMetadata { x, y, width, height, pixel_ratio, .. } = meta;
            let width = width as f32;
            let height = height as f32;
            metadata.insert(
                name.clone(),
                Glyph {
                    code: name,
                    tex_x: (x + offset_x) as f32,
                    tex_y: (y + offset_y) as f32,
                    tex_w: width,
                    tex_h: height,
                    x_offset: 0.,
                    y_offset: 0.,
                    width: width / pixel_ratio,
                    height: height / pixel_ratio,
                    advance_width: 0.,
                },
            );
        }
        // prebuild the sprite sheet if possible
        let image = create_image_bitmap(
            sprites,
            Some(ImageBitmapOptions {
                premultiply_alpha: PremultiplyAlpha::None,
                image_orientation: ImageOrientation::FlipY,
            }),
        )
        .await
        .unwrap();

        // ship the sprites to the map
        let sprite_image_message = SpriteImageMessage {
            name: name.clone(),
            offset_x,
            offset_y,
            width: tex_w,
            height: tex_h,
            max_height: texture_pack.height(),
            image,
        };
        self.image_source
            .source_worker
            .send(SourceWorkerMessageOutput {
                map_id,
                message: SourceWorkerMessage::SpriteImage(sprite_image_message),
            })
            .await;

        Some(ImageSourceMetadata { name, metadata })
    }
}

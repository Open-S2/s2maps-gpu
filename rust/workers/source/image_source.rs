use crate::{
    util::{
        ImageBitmapOptions, ImageOrientation, MsgSender, PremultiplyAlpha, create_image_bitmap,
    },
    workers::{
        Glyph, MapID, Session, SourceWorkerMessage, SourceWorkerMessageOutput, SpriteImageMessage,
        TexturePack,
    },
};
use alloc::{collections::btree_map::BTreeMap, rc::Rc, string::String};
use core::cell::RefCell;
use gistools::util::fetch_url;

/// Metadata for an image source
pub type ImageMetadata = BTreeMap<String, Glyph>;
/// Full metadata for an image source including name
#[derive(Debug, Clone, PartialEq)]
pub struct ImageSourceMetadata {
    /// The name of the source
    pub name: String,
    /// The image metadata
    pub metadata: ImageMetadata,
}

/// # ImageSource
///
/// ## Description
/// A collection of images relating to a single source
#[derive(Debug)]
#[allow(missing_docs)]
pub struct ImageSource {
    pub active: bool,
    pub name: String,
    pub path: String,
    pub file_type: String,
    pub metadata: ImageMetadata,
    pub session: Rc<RefCell<Session>>,
    pub texture_pack: Rc<TexturePack>,
    pub source_worker: MsgSender<SourceWorkerMessageOutput>,
}
impl ImageSource {
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
            active: true,
            name,
            path,
            file_type: file_type.unwrap_or("png".into()),
            metadata: BTreeMap::new(),
            session,
            texture_pack,
            source_worker,
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
        // grab the metadata and sprites
        let data = self._fetch(path, map_id).await;
        // if either failed, stop their
        if data.is_none() {
            self.active = false;
            // panic!("Failed to fetch sprite source {name}");
            return None;
        }
        let data = data.unwrap();
        let mut image_metadata = Glyph {
            code: name.clone(),
            tex_x: 0.,
            tex_y: 0.,
            tex_w: 0.,
            tex_h: 0.,
            x_offset: 0.,
            y_offset: 0.,
            width: 0.,
            height: 0.,
            advance_width: 0.,
        };
        // prebuild the sprite sheet if possible
        let image = create_image_bitmap(
            data,
            Some(ImageBitmapOptions {
                premultiply_alpha: PremultiplyAlpha::None,
                image_orientation: ImageOrientation::FlipY,
            }),
        )
        .await
        .ok()
        .unwrap();
        // update metadata width and height
        image_metadata.width = image.width as f32;
        image_metadata.height = image.height as f32;
        image_metadata.tex_w = image.width as f32;
        image_metadata.tex_h = image.height as f32;
        // get offsets from texture_pack
        let (offset_x, offset_y) = self.texture_pack.add_glyph(image.width, image.height);
        // update image_metadata x and y
        image_metadata.tex_x = offset_x as f32;
        image_metadata.tex_y = offset_y as f32;
        // store the metadata
        self.metadata.insert(name, image_metadata);

        // ship the sprites to the map
        self.source_worker
            .send(SourceWorkerMessageOutput {
                map_id,
                message: SourceWorkerMessage::SpriteImage(SpriteImageMessage {
                    name: self.name.clone(),
                    offset_x,
                    offset_y,
                    width: image.width,
                    height: image.height,
                    max_height: self.texture_pack.height(),
                    image,
                }),
            })
            .await;
        Some(ImageSourceMetadata { name: self.name.clone(), metadata: self.metadata.clone() })
    }

    /// Fetch an image
    ///
    /// ## Parameters
    /// - `path`: the path to the image or metadata
    /// - `map_id`: the id of the map
    ///
    /// ## Returns
    /// The image or metadata
    async fn _fetch(&mut self, path: String, map_id: MapID) -> Option<Vec<u8>> {
        let mut headers: Vec<(&str, &str)> = vec![];
        let authorization: Option<String>;
        let session = &mut self.session.borrow_mut();
        if session.has_api_key(&map_id) {
            authorization = session.request_session_token(map_id).await;
            if authorization.is_none() || authorization == Some("failed".into()) {
                return None;
            }
            headers.push(("Authorization", authorization.as_ref().unwrap().as_str()));
        }
        fetch_url::<Vec<u8>>(&path, &headers, None, None).await.ok()
    }
}

/// Glyph Source Data
pub mod glyph_source;
/// Image Source
pub mod image_source;
/// JSON Data Source. Either a tile store or a point cluster
pub mod json_source;
/// Local Source
pub mod local_source;
/// Marker Source Data
pub mod marker_source;
/// S2 PMTILES Source
pub mod s2pmtiles_source;
/// S2 TILES Source
pub mod s2tiles_source;
/// Session manager
pub mod session;
/// Base Source Manager
pub mod source;
/// Sprite Source
pub mod sprite_source;
/// Texture Pack stores fonts and builds out SDF characters onto a texture sheet
pub mod texture_pack;

pub use glyph_source::*;
pub use image_source::*;
pub use json_source::*;
pub use local_source::*;
pub use marker_source::*;
pub use s2pmtiles_source::*;
pub use s2tiles_source::*;
pub use session::*;
pub use source::*;
pub use sprite_source::*;
pub use texture_pack::*;

#[derive(Debug)]
#[allow(missing_docs)]
pub enum Source {
    Glyph(GlyphSource),
    Image(ImageSource),
    JSON(JSONSource),
    Local(LocalSource),
    Marker(MarkerSource),
    S2PMTiles(S2PMTilesSource),
    S2Tiles(S2TilesSource),
    Sprite(SpriteSource),
}
impl Source {
    /// Get the glyph source if the source is a glyph source
    pub fn glyph_source(&mut self) -> Option<&mut GlyphSource> {
        match self {
            Source::Glyph(glyph_source) => Some(glyph_source),
            _ => None,
        }
    }
}
// TODO: impl SourceSpec for Source { ... }
impl From<GlyphSource> for Source {
    fn from(glyph_source: GlyphSource) -> Self {
        Source::Glyph(glyph_source)
    }
}
impl From<ImageSource> for Source {
    fn from(image_source: ImageSource) -> Self {
        Source::Image(image_source)
    }
}
impl From<JSONSource> for Source {
    fn from(json_source: JSONSource) -> Self {
        Source::JSON(json_source)
    }
}
impl From<LocalSource> for Source {
    fn from(local_source: LocalSource) -> Self {
        Source::Local(local_source)
    }
}
impl From<MarkerSource> for Source {
    fn from(marker_source: MarkerSource) -> Self {
        Source::Marker(marker_source)
    }
}
impl From<S2PMTilesSource> for Source {
    fn from(s2pmtiles_source: S2PMTilesSource) -> Self {
        Source::S2PMTiles(s2pmtiles_source)
    }
}
impl From<S2TilesSource> for Source {
    fn from(s2tiles_source: S2TilesSource) -> Self {
        Source::S2Tiles(s2tiles_source)
    }
}
impl From<SpriteSource> for Source {
    fn from(sprite_source: SpriteSource) -> Self {
        Source::Sprite(sprite_source)
    }
}

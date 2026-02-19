use crate::{
    style::ColorArray,
    ui::TileID,
    workers::{ImageMetadata, ImageSourceMetadata},
};
use alloc::{
    collections::{btree_map::BTreeMap, btree_set::BTreeSet},
    string::String,
    vec::Vec,
};
use gistools::parsers::Buffer;

/// A Glyph Container. Tracks all the glyph's properties, shape, size, etc.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Glyph {
    /// code represents either the unicode value or substitution value
    pub code: String,
    /// tex_x is the x position on the texture sheet
    pub tex_x: f32,
    /// tex_y is the y position on the texture sheet
    pub tex_y: f32,
    /// tex_w is the width of the glyph on the texture sheet
    pub tex_w: f32,
    /// tex_h is the height of the glyph on the texture sheet
    pub tex_h: f32,
    /// x_offset is the x offset for the glyph
    pub x_offset: f32,
    /// y_offset is the y offset for the glyph
    pub y_offset: f32,
    /// width is the width of the glyph
    pub width: f32,
    /// height is the height of the glyph
    pub height: f32,
    /// advance_width is how far to move the cursor
    pub advance_width: f32,
}
impl Glyph {
    /// Create a null glyph
    pub fn null() -> Self {
        Glyph { ..Default::default() }
    }
}

/// An Icon's id/name and it's associative color
#[derive(Debug, Clone, PartialEq)]
pub struct IconPiece {
    /// glyph_id is the glyph_id of the icon
    pub glyph_id: String,
    /// color_id is the color_id of the icon
    pub color: ColorArray,
}
/// List of IconPieces
pub type Icon = Vec<IconPiece>;

/// Ligature Substitution Tree Node
#[derive(Debug, Clone, PartialEq)]
pub struct LigatureSubstitute {
    /// The substitution value
    pub substitute: String,
    /// The unicode components
    pub components: Vec<String>,
}
/// Ligature Substitution Tree
#[derive(Debug, Default, Clone, PartialEq)]
pub struct LigatureTree {
    /// The unicode components
    pub node: BTreeMap<u32, LigatureTree>,
    /// unicode substitute if it ends here
    pub substitute: Option<String>,
}
impl LigatureTree {
    /// Get the ligature tree (upflow the tree)
    pub fn get(&self, code: &u32) -> Option<&LigatureTree> {
        self.node.get(code)
    }
    /// Get the ligature tree mutably (upflow the tree)
    pub fn get_mut(&mut self, code: &u32) -> Option<&mut LigatureTree> {
        self.node.get_mut(code)
    }
}
/// Icon's name id and color id, whereas an `IconPiece`, the color is mapped
#[derive(Debug, Clone, PartialEq)]
pub struct IconDefinition {
    /// The unicode of the icon
    pub glyph_id: String,
    /// Pointer to the color of the icon
    pub color_id: u32,
}
/** Map of icons to their collection of images that make them up */
pub type IconMap = BTreeMap<String, Vec<IconDefinition>>; // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)
/** Set of unicodes that are part of the family */
pub type GlyphSet = BTreeSet<String>;
/** Map of IDs to RGBA colors */
pub type ColorMap = BTreeMap<u32, ColorArray>;

/// # Family Source
///
/// Maintain a store of the Font/Icon family, it's glyphs, ligatures, icons, and colors associated
/// with it. Make requests to the source worker for missing glyphs.
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FamilySource {
    pub name: String,
    pub extent: f64,
    pub default_advance: f64,
    pub glyph_set: GlyphSet, // existing glyphs
    pub ligatures: LigatureTree,
    // cache system
    pub glyph_cache: BTreeMap<String, Glyph>, // glyphs we have built already
    pub icon_cache: BTreeMap<String, Icon>,
    // track missing glyphs for future requests to the source worker
    pub glyph_request_list: BTreeMap<TileID, BTreeSet<String>>,
    pub is_icon: bool,
}
impl FamilySource {
    /// Create a new family source
    ///
    /// ## Parameters
    /// - `name`: the name of the family
    /// - `metadata`: the raw metadata to unpack
    pub fn new(name: String, metadata: Option<Vec<u8>>) -> Self {
        let mut this = Self {
            name,
            extent: 0.,
            default_advance: 0.,
            glyph_set: GlyphSet::new(),
            ligatures: LigatureTree::default(),
            glyph_cache: BTreeMap::default(),
            icon_cache: BTreeMap::default(),
            glyph_request_list: BTreeMap::default(),
            is_icon: false,
        };
        if metadata.is_none() {
            return this;
        }
        let metadata = metadata.unwrap();

        let mut meta = Buffer::new(metadata[0..30].to_vec());
        this.extent = meta.get_u16_at(0) as f64;
        this.default_advance = meta.get_u16_at(8) as f64 / this.extent;
        let glyph_count = meta.get_u16_at(10) as usize;
        let icon_map_size = meta.get_u32_at(12) as usize;
        let color_buf_size = meta.get_u16_at(16) as usize * 4;
        let substitute_size = meta.get_u32_at(18) as usize;
        this.is_icon = icon_map_size > 0;

        // store glyph_set
        let glyph_end = 30 + glyph_count * 2;
        let mut gmdv = Buffer::new(metadata[30..(30 + (glyph_count * 2))].to_vec());
        // for (let i = 0; i < glyph_count; i++) {
        for i in 0..glyph_count {
            this.glyph_set.insert(gmdv.get_u16_at(i * 2).to_string());
        }
        // build icon metadata
        let mut icon_map_buffer =
            Buffer::new(metadata[glyph_end..(glyph_end + icon_map_size)].to_vec());
        let icon_map = this._build_icon_map(icon_map_size, &mut icon_map_buffer);
        let mut color_buffer = Buffer::new(
            metadata[glyph_end + icon_map_size..(glyph_end + icon_map_size + color_buf_size)]
                .to_vec(),
        );
        let colors = this._build_color_map(color_buf_size, &mut color_buffer);
        // store the icon
        for (name, pieces) in icon_map.iter() {
            this.icon_cache.insert(
                name.clone(),
                pieces
                    .iter()
                    .map(|piece| IconPiece {
                        glyph_id: piece.glyph_id.clone(),
                        color: colors[piece.color_id as usize],
                    })
                    .collect(),
            );
        }
        let mut substitute_buffer =
            Buffer::new(metadata[glyph_end + icon_map_size + color_buf_size..].to_vec());
        this._build_substitute_map(substitute_size, &mut substitute_buffer);

        // store space (32)
        if !this.is_icon {
            this.glyph_cache.insert(
                "32".into(),
                Glyph {
                    code: "32".into(),
                    tex_x: 0.,
                    tex_y: 0.,
                    tex_w: 0.,
                    tex_h: 0.,
                    x_offset: 0.,
                    y_offset: 0.,
                    width: 0.,
                    height: 0.,
                    advance_width: this.default_advance as f32,
                },
            );
        }

        this
    }

    /// Given an image metadata input, build a FamilySource
    ///
    /// ## Parameters
    /// - `image_source`: the image metadata
    ///
    /// ## Returns
    /// A new FamilySource
    pub fn from_image_metadata(image_source: ImageSourceMetadata) -> Self {
        let mut fs = FamilySource::new(image_source.name, None);
        fs.add_metadata(image_source.metadata);
        fs
    }

    /// Check if the Family Source has an existing glyph/icon
    ///
    /// ## Parameters
    /// - `code`: glyph code
    ///
    /// ## Returns
    /// true if the glyph/icon exists
    pub fn has(&self, code: String) -> bool {
        self.glyph_set.contains(&code)
    }

    /// Check if this source is missing a glyph/icon
    ///
    /// ## Parameters
    /// - `code`: the code of the glyph/icon
    ///
    /// ## Returns
    /// true if the glyph/icon is missing
    pub fn missing_glyph(&self, code: String) -> bool {
        let Self { is_icon, glyph_set, glyph_cache, .. } = self;
        if *is_icon {
            !glyph_cache.contains_key(&code)
        } else {
            glyph_set.contains(&code) && !glyph_cache.contains_key(&code)
        }
    }

    /// Add image metadata to the source
    ///
    /// ## Parameters
    /// - `metadata`: the image metadata
    pub fn add_metadata(&mut self, metadata: ImageMetadata) {
        for (code, glyph) in metadata.iter() {
            self.glyph_set.insert(code.clone());
            self.glyph_cache.insert(code.clone(), glyph.clone());
            if !self.icon_cache.contains_key(code) {
                self.icon_cache.insert(
                    code.clone(),
                    vec![IconPiece { glyph_id: code.clone(), color: ColorArray(0., 0., 0., 0.) }],
                );
            }
        }
    }

    /// Add a glyph request to be processed
    ///
    /// ## Parameters
    /// - `tile_id`: the id of the tile that requested the glyph
    /// - `code`: the code of the glyph/icon
    pub fn add_glyph_request(&mut self, tile_id: TileID, code: String) {
        if !self.glyph_request_list.contains_key(&tile_id) {
            self.glyph_request_list.insert(tile_id, BTreeSet::new());
        }
        if let Some(requests) = self.glyph_request_list.get_mut(&tile_id) {
            requests.insert(code);
        }
    }

    /// Get the glyph requests for a tile
    ///
    /// ## Parameters
    /// - `tile_id`: the id of the tile that requested the glyph/icon
    ///
    /// ## Returns
    /// The list of glyph/icon requests
    pub fn get_requests(&mut self, tile_id: TileID) -> Vec<String> {
        let mut res = vec![];
        if let Some(glyph_list) = self.glyph_request_list.get(&tile_id) {
            res = glyph_list.iter().cloned().collect();
        }
        // cleanup requests that we are pulling from the cache
        self.glyph_request_list.remove(&tile_id);

        res
    }

    /// Build a collection of icons and their associated glyphs & colors
    ///
    /// ## Parameters
    /// - `icon_map_size`: the size of the icon map
    /// - `dv`: the data view to read from
    ///
    /// ## Returns
    /// The icon map
    fn _build_icon_map(&self, icon_map_size: usize, dv: &mut Buffer) -> IconMap {
        let mut icon_map = IconMap::default();
        let mut pos = 0;
        while pos < icon_map_size {
            let name_length = dv.get_u8_at(pos) as usize;
            let map_length = dv.get_u8_at(pos + 1) as usize;
            pos += 2;
            let mut id = vec![];
            for i in 0..name_length {
                id.push(dv.get_u8_at(pos + i));
            }
            let name: String = String::from_utf8_lossy(&id).into();
            pos += name_length;
            let mut map: Vec<IconDefinition> = vec![];
            for _ in 0..map_length {
                map.push(IconDefinition {
                    glyph_id: dv.get_u16_at(pos).to_string(),
                    color_id: dv.get_u16_at(pos + 2) as u32,
                });
                pos += 4;
            }
            icon_map.insert(name, map);
        }

        icon_map
    }

    /// Build a collection of colors
    ///
    /// ## Parameters
    /// - `color_size`: the size of the color map
    /// - `dv`: the data view to read from
    ///
    /// ## Returns
    /// The color map
    fn _build_color_map(&self, color_size: usize, dv: &mut Buffer) -> Vec<ColorArray> {
        let mut colors: Vec<ColorArray> = vec![];
        for i in (0..color_size).step_by(4) {
            colors.push(
                (dv.get_u8_at(i), dv.get_u8_at(i + 1), dv.get_u8_at(i + 2), dv.get_u8_at(i + 3))
                    .into(),
            );
        }

        colors
    }

    /// Build a collection of ligature substitutions
    ///
    /// ## Parameters
    /// - `substitute_size`: the size of the ligature map
    /// - `dv`: the data view to read from
    fn _build_substitute_map(&mut self, substitute_size: usize, dv: &mut Buffer) {
        let mut pos = 0;
        while pos < substitute_size {
            let r#type = dv.get_u8_at(pos) as usize;
            if r#type == 4 {
                // LIGATURE TYPE
                let count = dv.get_u8_at(pos + 1) as usize;
                let mut components: Vec<String> = vec![];
                for j in 0..count {
                    components.push(dv.get_u16_at(pos + 2 + j * 2).to_string());
                }
                let substitute = components.join(".");
                self.glyph_set.insert(substitute.clone());
                let mut tree = &mut self.ligatures;
                // dive to the end of the tree to properly place the substitute
                for component in &components {
                    let unicode = component.parse::<u32>().unwrap_or_default();
                    // Insert an empty LigatureTree if it does not exist
                    tree = tree.node.entry(unicode).or_insert(LigatureTree::default());
                }
                tree.substitute = Some(substitute);
                pos += 2 + count * 2;
            } else {
                panic!("Unknown substitute type: {type}");
            }
        }
    }

    /// Zero Width Joiner pass goes first
    ///
    /// ## Parameters
    /// - `str_codes`: array of codes to parse
    /// - `zwj_pass`: true if we are in the zero width joiner pass
    pub fn parse_ligatures(&self, mut str_codes: Vec<String>, zwj_pass: Option<bool>) {
        let zwj_pass = zwj_pass.unwrap_or(false);
        // iterate through the unicodes and follow the tree, if we find a substitute,
        // replace the unicodes with the substitute, but don't stop diving down the tree until we don't find
        // a substitute. This is because we want to find the longest ligature match possible.
        for i in 0..str_codes.len() {
            let mut code = str_codes[i].parse::<u32>().unwrap();
            let tree = &self.ligatures;
            let mut j = i;
            let mut zwj = false;
            while let Some(tree) = tree.get(&code) {
                if code == 8205 {
                    zwj = true;
                }
                if let Some(sub) = tree.substitute.clone()
                    && (if zwj_pass { zwj } else { true })
                {
                    str_codes.splice(i..=j, core::iter::once(sub));
                } else {
                    j += 1;
                }
                code = str_codes[j].parse::<u32>().unwrap();
            }
        }
        todo!()
    }
}

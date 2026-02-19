use std::cell::RefCell;

use alloc::collections::btree_map::BTreeMap;

/// Local Texture Pack area tracker
#[derive(Debug, Clone)]
pub struct Space {
    /// Width offset
    pub width_offset: u32,
    /// Height offset
    pub height_offset: u32,
}

/// The texture pack data
#[derive(Debug, Clone)]
pub struct TexturePackData {
    /// Height
    pub height: u32,
    /// Max Width
    pub max_width: u32,
    /// Space Storage
    pub spaces: BTreeMap<u32, Space>,
}
impl TexturePackData {
    /// Internal function to add a glyph
    pub fn add_glyph(&mut self, width: u32, height: u32) -> (u32, u32) {
        // if spaces doesn't have the height OR the width of the space is maxed out, create new
        let space = self.spaces.get(&height);
        if space.is_none() || (space.unwrap().width_offset + width > self.max_width) {
            self.spaces.insert(height, Space { height_offset: self.height + 1, width_offset: 0 });
            // update height offset of texture
            self.height += height + 1;
        }

        // add to the space
        let Space { width_offset, height_offset } = &mut self.spaces.get_mut(&height).unwrap();
        // update width offset of row
        *width_offset += width + 1;

        // return the textures position
        (*width_offset, *height_offset)
    }
}

/// Texture pack stores fonts and builds out SDF characters onto a texture sheet
/// each time we encounter a new character, we need to build the fills and strokes
/// and let the main painting thread know about the update
/// each font will have its own vertical row, and if a row is filled, we start a new one
/// the horizontal space is 2048 and we start a new row
#[derive(Debug, Clone)]
pub struct TexturePack {
    /// Container for the texture pack data.
    pub data: RefCell<TexturePackData>,
}
impl TexturePack {
    /// Create a new texture pack
    pub fn new() -> Self {
        Self {
            data: RefCell::new(TexturePackData {
                height: 0,
                max_width: 2048,
                spaces: BTreeMap::new(),
            }),
        }
    }
    /// Add a glyph
    ///
    /// ## Parameters
    /// - `width`: width of glyph
    /// - `height`: height of glyph
    ///
    /// ## Returns
    /// the position of the glyph in the texture `(offsetX: u32, offsetY: u32)`
    pub fn add_glyph(&self, width: u32, height: u32) -> (u32, u32) {
        let mut data = self.data.borrow_mut();
        data.add_glyph(width, height)
    }
    /// Get the height of the texture pack
    pub fn height(&self) -> u32 {
        self.data.borrow().height
    }
}

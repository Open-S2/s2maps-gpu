use crate::{
    style::{Alignment, Anchor, ColorArray},
    workers::PathData,
};
use alloc::{string::String, vec::Vec};
use bytemuck::{Pod, Zeroable};
use s2json::Point;

/// a bounding box like structure
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct SquareNode {
    /// ID of the node
    pub id: u64,
    /// minimum x
    pub min_x: f64,
    /// minimum y
    pub min_y: f64,
    /// maximum x
    pub max_x: f64,
    /// maximum y
    pub max_y: f64,
}

/// a bounding circle like structure
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct RoundNode {
    /// X
    pub x: f64,
    /// Y
    pub y: f64,
    /// Radius
    pub r: f64,
}

/// collection of round nodes
#[derive(Debug, Default, Clone, PartialEq)]
pub struct RoundNodes {
    /// ID
    pub id: u64,
    /// List of round nodes
    pub nodes: Vec<RoundNode>,
}

/// a node is a collection of square or round nodes
#[derive(Debug, Clone, PartialEq)]
pub enum Node {
    /// Square
    Square(SquareNode),
    /// Round
    Round(RoundNodes),
}
impl From<SquareNode> for Node {
    fn from(node: SquareNode) -> Self {
        Node::Square(node)
    }
}
impl From<RoundNodes> for Node {
    fn from(node: RoundNodes) -> Self {
        Node::Round(node)
    }
}

// /// a glyph descriptor
// #[derive(Debug, Clone, PartialEq)]
// pub struct GlyphDescription {
//     /// Family name
//     pub family: String,
//     /// Character
//     pub r#char: char,
// }

#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub enum GlyphType {
    #[default]
    Text = 0,
    Icon = 1,
}

#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub enum GlyphRenderType {
    #[default]
    Point = 0,
    Path = 1,
}

#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct GlyphQuad {
    pub s: f32,
    pub t: f32,
    pub x_offset: f32,
    pub y_offset: f32,
    pub x_pos: f32,
    pub y_pos: f32,
    pub width: f32,
    pub height: f32,
    pub tex_x: f32,
    pub tex_y: f32,
    pub tex_width: f32,
    pub tex_height: f32,
}

/// Glyph Base properties found in all glyph types
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphBase {
    // organization parameters
    pub id: u64,
    pub id_rgb: ColorArray,
    pub layer_index: usize,
    pub gl2_code: Vec<f32>,
    pub code: Vec<f32>,
    // layout
    pub overdraw: bool,
    pub family: Vec<String>,
    pub field: String,
    pub field_codes: Vec<String>,
    pub spacing: f32,
    pub offset: Point,
    pub padding: Point,
    pub kerning: f32,
    pub line_height: f32,
    pub r#type: GlyphType,
    pub word_wrap: f32, // 0 means no word wrap
    pub align: Alignment,
    pub anchor: Anchor, // 0 => center ; 1 => top; 2 => topRight ; 3 => right ; 4 => bottomRight ; 5 => bottom ; 6 => bottomLeft ; 7 => left ; 8 => topLeft
    // paint
    pub size: f32,
    /// grouped sets of: [s, t, xOffset, yOffset, xPos, yPos, width, height, texX, texY, texWidth, texHeight]
    pub quads: Vec<GlyphQuad>,
    /// if icon add to color
    /// grouped sets of: [r, g, b, a]
    pub color: Vec<f32>,
    /// missing chars or icons so it neeeds to wait for data
    pub missing: bool,
}

#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct GlyphPointFilter {
    pub s: f32,
    pub t: f32,
    pub x_pos: f32,
    pub y_pos: f32,
    pub offset_x: f32,
    pub offset_y: f32,
    pub padding_x: f32,
    pub padding_y: f32,
    pub max_width: f32,
    pub max_height: f32,
}

/// Glyph Point is a glyph rendering that has a singular anchor point to render from
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphPoint {
    /// Base properties
    pub base: GlyphBase,
    /// The square node information
    pub node: SquareNode,
    /// tile's S position
    pub s: f64,
    /// tile's T position
    pub t: f64,
    /// NOTE: offsetX and offsetY are the pixel based offset
    /// while xPos and yPos are the 0->1 ratio placement that will be multiplied by size
    /// [s, t, xPos, yPos, offsetX, offsetY, paddingX, paddingY, maxWidth, maxHeight, index, id]
    /// NOTE: index and id will be added later
    pub filter: GlyphPointFilter,
}

/// Glyph's renderered along a path have their own filter data
#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Zeroable, Pod)]
#[allow(missing_docs)]
pub struct GlyphPathFilter {
    pub s: f32,
    pub t: f32,
    pub offset_x: f32,
    pub offset_y: f32,
    pub x_pos: f32,
    pub y_pos: f32,
    pub path1: [f32; 2],
    pub path2: [f32; 2],
    pub path3: [f32; 2],
    pub padding: f32,
}

/// Glyph Path data is a collection of glyphs that follow along a vector line
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphPath {
    //   glyphType: 'path';
    pub base: GlyphBase,
    pub nodes: RoundNodes,
    /// store geometry data and type to properly build later
    pub extent: u32,
    pub path_data: PathData<()>,
    /// [s, t, offsetX, offsetY, posX, posY, path1X, path1Y, path2X, path2Y, path3X, path3Y, padding, index, id]
    // pub filters: Vec<GlyphPathFilter>,
    pub filters: Vec<f32>,
}

/// A Glpyh object is either a GlyphPoint or GlyphPath
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum GlyphObject {
    Point(GlyphPoint),
    Path(GlyphPath),
}
impl GlyphObject {
    /// Get the layer index from the glyph object
    pub fn layer_index(&self) -> usize {
        match self {
            GlyphObject::Point(point) => point.base.layer_index,
            GlyphObject::Path(path) => path.base.layer_index,
        }
    }
    /// Get the render type
    pub fn render_type(&self) -> GlyphRenderType {
        match self {
            GlyphObject::Point(_) => GlyphRenderType::Point,
            GlyphObject::Path(_) => GlyphRenderType::Path,
        }
    }
    /// Get the type from the glyph object
    pub fn glyph_type(&self) -> GlyphType {
        match self {
            GlyphObject::Point(point) => point.base.r#type,
            GlyphObject::Path(path) => path.base.r#type,
        }
    }
    /// Get their gl2_codes
    pub fn gl2_code(&self) -> &Vec<f32> {
        match self {
            GlyphObject::Point(point) => &point.base.gl2_code,
            GlyphObject::Path(path) => &path.base.gl2_code,
        }
    }
}
impl From<GlyphPoint> for GlyphObject {
    fn from(value: GlyphPoint) -> Self {
        GlyphObject::Point(value)
    }
}
impl From<GlyphPath> for GlyphObject {
    fn from(value: GlyphPath) -> Self {
        GlyphObject::Path(value)
    }
}
impl From<GlyphObject> for u8 {
    fn from(value: GlyphObject) -> Self {
        match value {
            GlyphObject::Point(_) => 0,
            GlyphObject::Path(_) => 1,
        }
    }
}

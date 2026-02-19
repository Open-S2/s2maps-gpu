/// S2 functions to find the tiles in view
pub mod s2;
/// WM functions to find the tiles in view
pub mod wm;

use crate::ui::Vec4;
use gistools::geometry::{CellId, S2CellId};
pub use s2::*;
use s2json::Face;
pub use wm::*;

/// Tile ID. It handles a single quadtree supporting id's that fall outside the range of the tree
#[derive(Default, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub struct TileID {
    pub id: S2CellId,
    pub remainder: u64,
}
impl ToString for TileID {
    fn to_string(&self) -> String {
        self.id.to_string()
    }
}
impl TileID {
    /// Create a new TileID
    pub fn new(id: S2CellId, remainder: u64) -> Self {
        Self { id, remainder }
    }
}
impl From<S2CellId> for TileID {
    fn from(id: S2CellId) -> Self {
        TileID { id, remainder: 0 }
    }
}
impl From<FaceZXY> for TileID {
    fn from(fzxy: FaceZXY) -> Self {
        TileID { id: fzxy.into(), remainder: 0 }
    }
}

/// Track the face-zoom-i-j positions
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct FaceZXY {
    /// The face
    pub face: u8,
    /// The zoom level
    pub zoom: u8,
    /// The i component
    pub x: i64,
    /// The j component
    pub y: i64,
}
impl From<Face> for FaceZXY {
    fn from(face: Face) -> Self {
        let cell = CellId::from_face(face.into());
        cell.into()
    }
}
impl From<CellId> for FaceZXY {
    fn from(cell_id: CellId) -> Self {
        let (face, zoom, x, y) = cell_id.to_face_ij();
        Self { face, zoom, x: x as i64, y: y as i64 }
    }
}
impl From<FaceZXY> for CellId {
    fn from(fzij: FaceZXY) -> Self {
        CellId::from_face_ij(fzij.face.into(), fzij.x as u32, fzij.y as u32, Some(fzij.zoom))
    }
}

/// Found tile's allow easy access to it's shape and support out of bounds for WM
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct TileInView {
    /// The Cell ID of the Tile
    pub id: TileID,
    /// The face of the tile
    pub face: u8,
    /// The zoom level
    pub zoom: u8,
    /// The x coordinates of the tile
    pub x: i64,
    /// The y coordinates of the tile
    pub y: i64,
    /// If the tile is out of bounds, this will point to the "wrapped"/legal ID
    pub wrapped_id: Option<S2CellId>,
}
impl From<&Face> for TileInView {
    fn from(face: &Face) -> Self {
        Self::new((*face).into())
    }
}
impl From<&FaceZXY> for TileInView {
    fn from(fzxy: &FaceZXY) -> Self {
        Self::new(*fzxy)
    }
}
impl TileInView {
    /// Create a new TileInView
    pub fn new(fzxy: FaceZXY) -> Self {
        let id = fzxy.into();
        let FaceZXY { face, zoom, x, y } = fzxy;
        Self { id, face, zoom, x, y, wrapped_id: None }
    }
    /// Check if the tile is out of bounds
    pub fn is_out_of_bounds(&self) -> bool {
        self.wrapped_id.is_some()
    }
    /// Get the cell id. Default to wrapped first if it exists
    pub fn id(&self) -> S2CellId {
        self.wrapped_id.unwrap_or(self.id.id)
    }
}

/// Check 3D point boundries of a rectangle are within the range of [-1,1]
///
/// ## Parameters
/// - `bl`: bottom left point
/// - `br`: bottom right point
/// - `tl`: top left point
/// - `tr`: top right point
///
/// ## Returns
/// true if any point is within the range of [-1,1]
pub fn point_boundaries(bl: &Vec4, br: &Vec4, tl: &Vec4, tr: &Vec4) -> bool {
    (tl.x() <= 1. && tl.x() >= -1. && tl.y() <= 1. && tl.y() >= -1.)
        || (tr.x() <= 1. && tr.x() >= -1. && tr.y() <= 1. && tr.y() >= -1.)
        || (bl.x() <= 1. && bl.x() >= -1. && bl.y() <= 1. && bl.y() >= -1.)
        || (br.x() <= 1. && br.x() >= -1. && br.y() <= 1. && br.y() >= -1.)
}

/**
/// Test box_intersect against the 4 lines of a rectangle
///
/// ## Parameters
/// - `bl`: bottom left
/// - `br`: bottom right
/// - `tl`: top left
/// - `tr`: top right
///
/// ## Returns
/// true if any line intersects
 */
pub fn box_intersects(bl: &Vec4, br: &Vec4, tl: &Vec4, tr: &Vec4) -> bool {
    box_intersect(tl, bl) || // leftLine
    box_intersect(br, tr) || // rightLine
    box_intersect(bl, br) || // bottomLine
    box_intersect(tr, tl) // topLine
}

/// check line intersections of p1 and p2 against a [[-1, -1], [1, 1]] box.
///
/// ## Parameters
/// - `p1`: the first point
/// - `p2`: the second point
///
/// ## Returns
/// true if any line intersects with the box
pub fn box_intersect(p1: &Vec4, p2: &Vec4) -> bool {
    line_intersect(p1.x(), p1.y(), p2.x(), p2.y(), -1., -1., -1., 1.) || // leftLineBox
    line_intersect(p1.x(), p1.y(), p2.x(), p2.y(), 1., -1., 1., 1.) || // rightLineBox
    line_intersect(p1.x(), p1.y(), p2.x(), p2.y(), -1., -1., 1., -1.) || // bottomLineBox
    line_intersect(p1.x(), p1.y(), p2.x(), p2.y(), -1., 1., 1., 1.) // topLineBox
}

/// check if two lines intersect
///
/// ## Parameters
/// - `x1`: the x-coordinate of the first point
/// - `y1`: the y-coordinate of the first point
/// - `x2`: the x-coordinate of the second point
/// - `y2`: the y-coordinate of the second point
/// - `x3`: the x-coordinate of the third point
/// - `y3`: the y-coordinate of the third point
/// - `x4`: the x-coordinate of the fourth point
/// - `y4`: the y-coordinate of the fourth point
///
/// ## Returns
/// true if the lines intersect
pub fn line_intersect(
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
    x3: f32,
    y3: f32,
    x4: f32,
    y4: f32,
) -> bool {
    let denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if denom == 0. {
        return false;
    }
    let lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom;
    let gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom;
    lambda > 0. && lambda < 1. && gamma > 0. && gamma < 1.
}

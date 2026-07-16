// Type for temporary WMID. It handles a single quadtree supporting id's that fall outside the
// range of the tree
use crate::ui::{Mat4, Projector, TileID, TileInView, Vec4, box_intersects, point_boundaries};
use alloc::collections::{BTreeMap, BTreeSet};
use gistools::geometry::{S2CellId, ll_to_tile, ll_to_tile_px};
use libm::{floor, pow};
use pbf::zigzag;
use s2json::Point;

/// Track the zoom-x-y positions
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub struct ZoomXY {
    pub zoom: u8,
    pub x: i64,
    pub y: i64,
}

/// Given a zoom, lon, lat, and projector, get the tiles in view
/// Due to the nature of the Web Mercator design,
/// it's easiest to store an MVP matrix for each tile
///
/// NOTE: Real World Tiles must be created/cached BEFORE creating out of bounds tiles
/// as the out of bounds tiles will need to reference the real world tiles.
/// So we sort all out of bounds tiles to the end of the list.
///
/// ## Parameters
/// - `zoom`: the zoom leve
/// - `lon`: the longitude
/// - `lat`: the latitude
/// - `projector`: the projection object
///
/// ## Returns
/// A list of Tile IDs in view
pub fn get_tiles_in_view_wm(
    mut zoom: f64,
    lon: f64,
    lat: f64,
    projector: &mut Projector,
) -> Vec<TileInView> {
    let Projector { tile_size, duplicate_horizontally: dup_h, .. } = *projector;
    if zoom < 1. {
        zoom = 0.;
    }
    let mut tiles = BTreeMap::<TileID, TileInView>::new();
    let mut check_list: Vec<ZoomXY> = vec![];
    let mut checked_tiles = BTreeSet::<ZoomXY>::new();
    let zoom = floor(zoom) as u8; // move to whole number
    let size = 1 << zoom;

    // let's find the current tile and store it
    let (x, y) = ll_to_tile(&(lon, lat), zoom as f64);
    let id = S2CellId::from_face_ij(0, x as u32, y as u32, Some(zoom));
    tiles.insert(id.into(), TileInView { id: id.into(), face: 0, zoom, x, y, wrapped_id: None });
    // add the first set of neighbors
    add_neighbors(zoom, x as i64, y as i64, dup_h, &mut checked_tiles, &mut check_list);

    //   while (check_list.length > 0) {
    while let Some(check) = check_list.pop() {
        let ZoomXY { x: x_check, y: y_check, .. } = check;
        // get the tiles matrix
        let matrix = tile_matrix(projector, zoom, x_check, y_check);
        // project the four corners of the tile
        let bl = matrix.project(&Vec4([0., 0., 0., 0.]));
        let br = matrix.project(&Vec4([1., 0., 0., 0.]));
        let tl = matrix.project(&Vec4([0., 1., 0., 0.]));
        let tr = matrix.project(&Vec4([1., 1., 0., 0.]));
        // check if the tile is in view
        if point_boundaries(&bl, &br, &tl, &tr) || box_intersects(&bl, &br, &tl, &tr) {
            // ensure S2CellId uses the wrapped x-y values.
            let s2_id = S2CellId::from_face_ij(
                0,
                modulo(x_check, size) as u32,
                modulo(y_check as i64, size) as u32,
                Some(zoom),
            );
            // if the tile is in view, add it to the list
            let wm_id = to_wm_id(zoom, x_check, y_check, dup_h);
            let id = wm_id.unwrap_or(s2_id.into()); // ?? s2_id;
            // IF the wm_id exists, it means it's an out of bounds ID, we we need to store the "wrapped" id which is the s2CellId
            let wrapped_id: Option<S2CellId> = if wm_id.is_none() { Some(s2_id) } else { None };
            tiles.insert(
                id,
                TileInView { id, face: 0, zoom: zoom, x: x_check, y: y_check, wrapped_id },
            );
            // add the surounding tiles we have not checked
            add_neighbors(zoom, x_check, y_check, dup_h, &mut checked_tiles, &mut check_list);
        }
    }

    let mut res: Vec<TileInView> = tiles.values().cloned().collect();
    res.sort_by_key(|t| (t.x, t.y));
    res
}

/**
 * Add neighbors to the check_list
 * @param zoom - the zoom level
 * @param x - the x tile-coordinate
 * @param y - the y tile-coordinate
 * @param duplicate_horizontally - whether to duplicate horizontally
 * @param checked_tiles - the set of tiles we have already checked
 * @param check_list - the list of tiles to check
 */
fn add_neighbors(
    zoom: u8,
    x: i64,
    y: i64,
    duplicate_horizontally: bool,
    checked_tiles: &mut BTreeSet<ZoomXY>,
    check_list: &mut Vec<ZoomXY>,
) {
    // add the surounding tiles we have not checked
    for zxy in neighbors_xy(zoom, x, y, Some(duplicate_horizontally)) {
        if !checked_tiles.contains(&zxy) {
            checked_tiles.insert(zxy);
            check_list.push(zxy);
        }
    }
}

/**
 * Get the matrix for a specific tile
 * @param projector - the projection object's current state
 * @param tile_zoom - the zoom level
 * @param tile_x - the x tile-coordinate
 * @param tile_y - the y tile-coordinate
 * @returns the matrix for the tile
 */
fn tile_matrix(projector: &mut Projector, tile_zoom: u8, tile_x: i64, tile_y: i64) -> Mat4 {
    let Projector { zoom, lon, lat, .. } = *projector;
    let scale = pow(2., zoom - (tile_zoom as f64));
    let offset = ll_to_tile_px(&Point(lon, lat), (tile_zoom, tile_x, tile_y), Some(1));

    projector.get_matrix_wm(scale, Some(offset))
}

/**
 * grab the tiles next to the current tiles zoom-x-y
 * only include adjacent tiles, not diagonal.
 * If include_out_of_bounds set to true, it will include out of bounds tiles
 * on the x-axis
 * @param zoom - tile's zoom
 * @param x - tile's x-coordinate
 * @param y - tile's y-coordinate
 * @param include_out_of_bounds - flag to keep out of bounds tiles if true
 * @returns neighboring tiles, including out of bounds if flag set
 */
pub fn neighbors_xy(zoom: u8, x: i64, y: i64, include_out_of_bounds: Option<bool>) -> Vec<ZoomXY> {
    let include_out_of_bounds = include_out_of_bounds.unwrap_or(false);
    let size = 1 << zoom;
    let mut neighbors: Vec<ZoomXY> = vec![];
    let x_out_of_bounds = x < 0 || x >= size;
    if x - 1 >= 0 || include_out_of_bounds {
        neighbors.push(ZoomXY { zoom, x: x - 1, y });
    }
    if x + 1 < size || include_out_of_bounds {
        neighbors.push(ZoomXY { zoom, x: x + 1, y });
    }
    if !x_out_of_bounds {
        neighbors.push(ZoomXY { zoom, x, y: y - 1 });
    }
    if !x_out_of_bounds && y + 1 < (1 << zoom) {
        neighbors.push(ZoomXY { zoom, x, y: y + 1 });
    }
    neighbors
}

/**
 * Convert zoom-x-y to a singular number
 * It may resolve to itself. This is useful for maps that have
 * `duplicate_horizontally` set to true. It forces the tile to be
 * within the bounds of the quad tree.
 * @param zoom - the zoom level
 * @param x - the x tile-coordinate
 * @param y - the y tile-coordinate
 * @param duplicate_horizontally - whether to duplicate horizontally
 * @returns the singular number
 */
pub fn to_wm_id(zoom: u8, x: i64, y: i64, duplicate_horizontally: bool) -> Option<TileID> {
    if !duplicate_horizontally {
        return None;
    }
    // skip tiles that are NOT out of bounds
    if x >= 0 && x < (1 << zoom) && y < (1 << zoom) {
        return None;
    }
    // otherwise store the out of boudns tile
    let adjusted_x = modulo(x, 1 << zoom); // Adjust x to be within [0, max_x)
    let remainder = zigzag(x - adjusted_x);
    let zoom = zoom as u64;
    let adjusted_x = adjusted_x as u64;
    let y = y as u64;
    Some(TileID { id: (((1 << zoom) * y + adjusted_x) * 32 + zoom).into(), remainder })
}

/// a modulo function that works with negative numbers
///
/// ## Parameters
/// - `x`: the number
/// - `n`: the modulus
///
/// ## Returns
/// The result
fn modulo(x: i64, n: i64) -> i64 {
    ((x % n) + n) % n
}

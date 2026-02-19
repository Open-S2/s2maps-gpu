use crate::ui::{FaceZXY, Mat4, TileID, TileInView, Vec4, box_intersects, point_boundaries};
use alloc::{collections::btree_set::BTreeSet, vec, vec::Vec};
use gistools::geometry::{CellId, S2CellId, S2Point};
use libm::floor;
use s2json::{BBox, Face, Point3D};

const ZERO_TILES: [Face; 6] =
    [Face::Face0, Face::Face1, Face::Face2, Face::Face3, Face::Face4, Face::Face5];

/**
 * Given a camera position, get the tiles in current view
 * @param zoom - the zoom level
 * @param lon - the longitude
 * @param lat - the latitude
 * @param matrix - the projection matrix
 * @param radius - the radius of the sphere
 * @returns list of Tile IDs
 */
pub fn get_tiles_in_view_s2(
    zoom: f64,
    lon: f64,
    lat: f64,
    matrix: &Mat4,
    radius: Option<f64>,
) -> Vec<TileInView> {
    let radius = radius.unwrap_or(1.);
    if zoom < 1. {
        return ZERO_TILES.iter().map(Into::into).collect();
    }
    let mut tiles: Vec<TileInView> = vec![];
    let mut check_list: Vec<FaceZXY> = vec![];
    let mut checked_tiles = BTreeSet::<FaceZXY>::new();
    let zoom = floor(zoom) as u8; // move to whole number

    // grab the first tile and prep neighbors for checks
    let (face, i, j) = S2Point::from_lon_lat(&Point3D(lon, lat, 0.)).to_face_ij(Some(zoom));
    let id = S2CellId::from_face_ij(face, i, j, Some(zoom));
    let facezxy = FaceZXY { face, zoom, x: i as i64, y: j as i64 };
    let tile_id: TileID = id.into();
    tiles.push(TileInView { id: tile_id, face, zoom, x: i as i64, y: j as i64, wrapped_id: None });
    checked_tiles.insert(facezxy);
    add_neighbors(facezxy, &mut checked_tiles, &mut check_list);
    let zero = matrix.project(&Vec4([0., 0., 0., 0.])).z();

    while let Some(check) = check_list.pop() {
        // grab a tile to check and get its face and bounds
        let FaceZXY { face, x, y, .. } = check;
        let BBox { left, bottom, right, top } = BBox::from_st_zoom(x as f64, y as f64, zoom);
        // grab the four points from the bbox and project them
        let mut tl_point = S2Point::from_face_st_gl(face, left, top);
        tl_point.normalize();
        tl_point *= radius;
        let tl_proj = matrix.project(&(&tl_point).into());
        let mut tr_point = S2Point::from_face_st_gl(face, right, top);
        tr_point.normalize();
        tr_point *= radius;
        let tr_proj = matrix.project(&(&tr_point).into());
        let mut bl_point = S2Point::from_face_st_gl(face, left, bottom);
        bl_point.normalize();
        bl_point *= radius;
        let bl_proj = matrix.project(&(&bl_point).into());
        let mut br_point = S2Point::from_face_st_gl(face, right, bottom);
        br_point.normalize();
        br_point *= radius;
        let br_proj = matrix.project(&(&br_point).into());
        // check if any of the 4 edge points or lines interact with a -1 to 1 x and y projection plane
        // if tile is part of the view, we add to tiles and tileSet and add all surounding tiles
        if less_than_zero(zero, bl_proj.z(), br_proj.z(), tl_proj.z(), tr_proj.z())
            && (point_boundaries(&bl_proj, &br_proj, &tl_proj, &tr_proj)
                || box_intersects(&bl_proj, &br_proj, &tl_proj, &tr_proj))
        {
            let id = S2CellId::from_face_ij(face, x as u32, y as u32, Some(zoom));
            tiles.push(TileInView { id: id.into(), face, zoom, x, y, wrapped_id: None });
            add_neighbors(FaceZXY { face, zoom, x, y }, &mut checked_tiles, &mut check_list);
        }
    }

    // we sort by id to avoid text filtering to awkwardly swap back and forth
    tiles.sort_by(|a, b| a.id.cmp(&b.id));

    tiles
}

/// Add neighbors to the check_list
///
/// ## Parameters
/// - `current`: the current tile to check against
/// - `checked_tiles`: the set of tiles we have already checked
/// - `check_list`: the list of tiles to check
fn add_neighbors(
    current: FaceZXY,
    checked_tiles: &mut BTreeSet<FaceZXY>,
    check_list: &mut Vec<FaceZXY>,
) {
    // add the surounding tiles we have not checked
    let neighbors =
        CellId::neighbors_ij(current.face.into(), current.x as u32, current.y as u32, current.zoom);
    for n in neighbors {
        let n_fzij = FaceZXY::from(n);
        if !checked_tiles.contains(&n_fzij) {
            checked_tiles.insert(n_fzij);
            check_list.push(n_fzij);
        }
    }
}

/**
 * check if any 4 points in a rectangle is less than zero
 * @param zero - the zero reference point to compare against
 * @param bl - bottom left point
 * @param br - bottom right point
 * @param tl - top left point
 * @param tr - top right point
 * @returns true if any point is less than zero
 */
pub fn less_than_zero(zero: f32, bl: f32, br: f32, tl: f32, tr: f32) -> bool {
    bl < zero || br < zero || tl < zero || tr < zero
}

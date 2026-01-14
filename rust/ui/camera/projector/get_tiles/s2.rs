// import { project } from '../mat4.js';
// import {
//   bboxST,
//   getNeighborsIJ,
//   idFromFace,
//   idFromIJ,
//   pointFromLonLat,
//   pointFromSTGL,
//   pointMulScalar,
//   pointNormalize,
//   pointToIJ,
// } from 'gis-tools/index.js';
// import { boxIntersects, pointBoundaries } from './index.js';

// import type { TileInView } from './index.js';
// import type { BBox, Face, VectorPoint } from 'gis-tools/index.js';
use crate::ui::{FaceZXY, Mat4, TileInView};
use alloc::{collections::btree_set::BTreeSet, string::String, vec, vec::Vec};
use gistools::geometry::CellId;
use libm::floor;
use s2json::Face;

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
    radius: Option<f64>, // = 1,
) -> Vec<TileInView> {
    let radius = radius.unwrap_or(1.);
    if zoom < 1. {
        return ZERO_TILES.iter().map(Into::into).collect();
    }
    let mut tiles: Vec<TileInView> = vec![];
    let mut check_list: Vec<FaceZXY> = vec![];
    let mut checked_tiles = BTreeSet::<String>::new();
    let zoom = floor(zoom) as u8; // move to whole number
    //   let stBbox: BBox,
    //     tLProj: VectorPoint,
    //     tRProj: VectorPoint,
    //     bLProj: VectorPoint,
    //     bRProj: VectorPoint;

    //   // grab the first tile and prep neighbors for checks
    //   const [face, i, j] = pointToIJ(pointFromLonLat({ x: lon, y: lat }), zoom);
    //   tiles.push({ id: idFromIJ(face, i, j, zoom), face, zoom, x: i, y: j });
    //   checked_tiles.add(`${String(face)}-${String(i)}-${String(j)}`);
    //   add_neighbors(face, zoom, i, j, checked_tiles, check_list);
    //   const zero = project(matrix, { x: 0, y: 0, z: 0 }).z!;

    //   while (check_list.length > 0) {
    //     // grab a tile to check and get its face and bounds
    //     const check = check_list.pop();
    //     if (check === undefined) break;
    //     const [face, i, j] = check;
    //     stBbox = bboxST(i, j, zoom);
    //     // grab the four points from the bbox and project them
    //     tLProj = project(
    //       matrix,
    //       pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[0], stBbox[3])), radius),
    //     );
    //     tRProj = project(
    //       matrix,
    //       pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[2], stBbox[3])), radius),
    //     );
    //     bLProj = project(
    //       matrix,
    //       pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[0], stBbox[1])), radius),
    //     );
    //     bRProj = project(
    //       matrix,
    //       pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[2], stBbox[1])), radius),
    //     );
    //     // check if any of the 4 edge points or lines interact with a -1 to 1 x and y projection plane
    //     // if tile is part of the view, we add to tiles and tileSet and add all surounding tiles
    //     if (
    //       less_than_zero(zero, bLProj.z!, bRProj.z!, tLProj.z!, tRProj.z!) &&
    //       (pointBoundaries(bLProj, bRProj, tLProj, tRProj) ||
    //         boxIntersects(bLProj, bRProj, tLProj, tRProj))
    //     ) {
    //       const id = idFromIJ(face as Face, i, j, zoom);
    //       tiles.push({ id, face, zoom, x: i, y: j });
    //       add_neighbors(face as Face, zoom, i, j, checked_tiles, check_list);
    //     }
    //   }

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
    let neighbors = CellId::neighbors_ij(current.face.into(), current.x, current.y, current.zoom);
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

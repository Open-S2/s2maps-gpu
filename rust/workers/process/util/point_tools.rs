use crate::workers::{LineLengthRes, Path, PathData, line_length};
use alloc::{vec, vec::Vec};
use gistools::geometry::ToLines;
use libm::{atan2, cos, floor, sin};
use s2json::{GetXY, Interpolate, Point, VectorGeometry, VectorMultiPoint, VectorPoint};

/**
 * Get the center points of the geometry
 * @param geometry - vector geometry
 * @param type - geometry type
 * @returns vector points at the center of the geometry
 */
pub fn get_center_points<M: Default + Clone + Interpolate>(
    geometry: &VectorGeometry<M>,
) -> VectorMultiPoint<M> {
    find_center_points(geometry, 0.).into_iter().map(|sp| sp.point).collect()
}

/**
 * Get the spaced points of the geometry
 * @param geometry - vector geometry
 * @param type - geometry type
 * @param spacing - distance between points
 * @param extent - extent is the tile "pixel" size
 * @returns vector points spaced along the line
 */
pub fn get_spaced_points<M: Default + Clone + Interpolate>(
    geometry: &VectorGeometry<M>,
    spacing: f64,
    extent: f64,
) -> VectorMultiPoint<M> {
    find_spaced_points(geometry, spacing, extent).into_iter().map(|sp| sp.point).collect()
}

/** Collection of Points that are spaced given guidlines. Used for glyph rendering */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SpacedPoints<M: Default + Clone + Interpolate> {
    pub point: VectorPoint<M>,
    pub distance: f64,
    pub path_left: Path,
    pub path_right: Path,
}

/**
 * Find center points of the geometry
 * @param geometry - vector geometry
 * @param type - geometry type
 * @param extent - extent is the tile "pixel" size
 * @returns vector points at the centers of the geometry(s)
 */
pub fn find_center_points<M: Default + Clone + Interpolate>(
    geometry: &VectorGeometry<M>,
    extent: f64,
) -> Vec<SpacedPoints<M>> {
    let mut res: Vec<SpacedPoints<M>> = vec![];

    for line in geometry.to_lines().iter() {
        let LineLengthRes { length, dist_index } = line_length(line);
        let center = floor(length / 2.);
        let PathData { point, path_left, path_right } =
            build_point_at_distance(line, &dist_index, center, extent);
        res.push(SpacedPoints { point, distance: center, path_left, path_right });
    }

    res
}

/**
 * Find points along the line at a given distance
 * @param geometry - vector geometry
 * @param type - geometry type
 * @param spacing - distance between points
 * @param extent - extent is the tile "pixel" size
 * @returns vector points spaced along the line
 */
pub fn find_spaced_points<M: Default + Clone + Interpolate>(
    geometry: &VectorGeometry<M>,
    spacing: f64,
    extent: f64,
) -> Vec<SpacedPoints<M>> {
    let mut res: Vec<SpacedPoints<M>> = vec![];
    // safety check
    if spacing <= 50. {
        return res;
    }

    for line in geometry.to_lines().iter() {
        let LineLengthRes { length, dist_index } = line_length(line);
        // every spacing distance, add a point
        let mut distances: Vec<f64> = vec![];
        let mut distance = spacing;
        while distance < length {
            distances.push(distance);
            distance += spacing;
        }
        for d in distances {
            let PathData { point, path_left, path_right } =
                build_point_at_distance(line, &dist_index, d, extent);
            res.push(SpacedPoints { point, distance: d, path_left, path_right });
        }
    }

    res
}

/**
 * NOTE: Currently assumes the line is longer then the distance
 * @param line - the line
 * @param index - index of the line
 * @param distance - distance along the line
 * @param extent - extent is the tile "pixel" size
 * @returns path structure
 */
pub fn build_point_at_distance<M: Default + Clone + Interpolate>(
    line: &VectorMultiPoint<M>,
    index: &[f64],
    distance: f64,
    extent: f64,
) -> PathData<M> {
    let fourth_extent = extent * 0.25;
    let mut i = 0;
    while i < index.len() - 1 && index[i + 1] < distance {
        i += 1;
    }
    let p1 = &line[i];
    let p2 = &line[i + 1];
    let d1 = index[i];
    let d2 = index[i + 1];
    let t = (distance - d1) / (d2 - d1);
    let point = p1.interpolate(p2, t);
    // store either 7 points or as many as possible
    let mut path_left: Vec<Point> = vec![];
    let mut path_right: Vec<Point> = vec![];
    let mut l = i;
    let mut r = i + 1;
    let mut cur_angle = point_angle(&point, line.get(l)).unwrap_or(0.);
    while l > 0 && path_left.len() < 3 {
        path_left.push((&line[l]).into());
        l -= 1;
        cur_angle = point_angle(&line[l + 1], line.get(l)).unwrap_or(cur_angle);
    }
    // path_left len() needs to be 4; add 1 at path_angle
    while path_left.len() < 4 {
        let Point(x, y) = path_left[path_left.len() - 1];
        path_left
            .push(Point(x + fourth_extent * cos(cur_angle), y + fourth_extent * sin(cur_angle)));
    }
    cur_angle = point_angle(&point, line.get(r)).unwrap_or(0.); // ?? 0;
    while r < line.len() && path_right.len() < 3 {
        path_right.push((&line[r]).into());
        r += 1;
        cur_angle = point_angle(&line[r - 1], line.get(r)).unwrap_or(0.); // ?? cur_angle;
    }
    while path_right.len() < 4 {
        let Point(x, y) = path_right[path_right.len() - 1];
        path_right
            .push(Point(x + fourth_extent * cos(cur_angle), y + fourth_extent * sin(cur_angle)));
    }

    PathData { point, path_left: (&path_left[..]).into(), path_right: (&path_right[..]).into() }
}

/**
 * Get the angle between 2 points
 * @param a - first point
 * @param b - second point
 * @returns the angle
 */
pub fn point_angle<P1: GetXY, P2: GetXY>(a: &P1, b: Option<&P2>) -> Option<f64> {
    if b.is_none() {
        return None;
    }
    let b = b.unwrap();
    if a.x() == b.x() && a.y() == b.y() {
        return None;
    }
    Some(atan2(b.y() - a.y(), b.x() - a.x()))
}

use crate::{
    style::Cap,
    workers::{SpacedPoints, find_center_points, find_spaced_points, point_angle},
};
use alloc::{vec, vec::Vec};
use libm::{fabs, pow, sqrt};
use s2json::{GetXY, Interpolate, Point, VectorGeometry, VectorLineString, VectorPoint};

/** An output of drawLine */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct Line {
    pub prev: Vec<f32>,
    pub curr: Vec<f32>,
    pub next: Vec<f32>,
    pub length_so_far: Vec<f32>,
}

/** A path is a 4 point line */
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Path {
    /// First point along the path
    pub first: Point,
    /// Second point along the path
    pub second: Point,
    /// Third point along the path
    pub third: Point,
    /// Fourth point along the path
    pub fourth: Point,
}
impl Path {
    /// Map the path to be in pixel coordinates
    pub fn map_extend(&self, extent: f64) -> Path {
        Path {
            first: Point(self.first.0 / extent, self.first.1 / extent),
            second: Point(self.second.0 / extent, self.second.1 / extent),
            third: Point(self.third.0 / extent, self.third.1 / extent),
            fourth: Point(self.fourth.0 / extent, self.fourth.1 / extent),
        }
    }
    /// Get the points as a vector
    pub fn to_vec(&self) -> Vec<Point> {
        vec![self.first, self.second, self.third, self.fourth]
    }
}
impl From<&[Point]> for Path {
    fn from(value: &[Point]) -> Self {
        Path { first: value[0], second: value[1], third: value[2], fourth: value[3] }
    }
}

/** An output of getPointsAndPaths */
#[derive(Debug, Clone, PartialEq)]
pub struct PathData<M: Default + Clone + Interpolate> {
    /// The starting point
    pub point: VectorPoint<M>,
    /// The collection of points along the path "left" or inverse of the flow of the line
    pub path_left: Path,
    /// The collection of points along the path "right" or flow of the line
    pub path_right: Path,
}

// TODO: given the geometry, check if the line is long enough to fit the glyph otherwise return empty array
// TODO: If the path has sharp corners, simplify the path to be smoother without losing the original shape
/**
 * Get a collection of points and paths along the lines
 * @param geometry - input vector geometry
 * @param type - geometry type
 * @param spacing - distance between points
 * @param extent - extent is the tile "pixel" size
 * @returns the points and paths that are along the lines
 */
pub fn get_points_and_paths_along_lines<M: Default + Clone + Interpolate>(
    geometry: &VectorGeometry<M>,
    spacing: f64,
    extent: f64,
) -> Vec<PathData<M>> {
    let mut res: Vec<PathData<M>> = vec![];
    for SpacedPoints { point, path_left, path_right, .. } in
        find_spaced_points(geometry, spacing, extent)
    {
        // for now just slice the first 3 points
        res.push(PathData {
            point: VectorPoint {
                x: point.x / extent,
                y: point.y / extent,
                z: point.z.map(|x| x / extent),
                m: point.m.clone(),
                t: point.t.clone(),
            },
            path_left: path_left.map_extend(extent),
            path_right: path_right.map_extend(extent),
        });
    }
    res
}

/**
 * Get a collection of points and paths at the center of each line
 * @param geometry - input vector geometry
 * @param type - geometry type
 * @param extent - extent is the tile "pixel" size
 * @returns the points and paths that are at the center of each line
 */
pub fn get_points_and_paths_at_center_of_lines<M: Default + Clone + Interpolate>(
    geometry: &VectorGeometry<M>,
    extent: f64,
) -> Vec<PathData<M>> {
    let mut res: Vec<PathData<M>> = vec![];

    for SpacedPoints { point, path_left, path_right, .. } in find_center_points(geometry, extent) {
        // for now just slice the first 3 points
        res.push(PathData {
            point: VectorPoint {
                x: point.x / extent,
                y: point.y / extent,
                z: point.z.map(|x| x / extent),
                m: point.m.clone(),
                t: point.t.clone(),
            },
            path_left: path_left.map_extend(extent),
            path_right: path_right.map_extend(extent),
        });
    }

    res
}

/** An output of [`get_path_pos`] describing the path's via raw data */
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct QuadPos {
    pub s: f64,
    pub t: f64,
    pub offset_x: f64,
    pub offset_y: f64,
    pub x_pos: f64,
    pub y_pos: f64,
}
impl From<&[f32]> for QuadPos {
    fn from(value: &[f32]) -> Self {
        Self {
            s: value[0] as f64,
            t: value[1] as f64,
            offset_x: value[2] as f64,
            offset_y: value[3] as f64,
            x_pos: value[4] as f64,
            y_pos: value[5] as f64,
        }
    }
}

/**
 * Get the path position
 * @param quad_pos - quad position
 * @param path_left - left path
 * @param path_right - right path
 * @param tile_size - tile size
 * @param size - glyph size
 * @returns a vector point describing the path position
 */
pub fn get_path_pos<M: Default + Clone + Interpolate>(
    quad_pos: QuadPos,
    path_left: &Path,
    path_right: &Path,
    tile_size: f64,
    size: f64,
) -> VectorPoint<M> {
    // note: st is 0->1 ratio relative to tile size
    // note: offset is in pixels
    // note: x_pos and y_pos are 0->1 ratio relative to glyph size
    let QuadPos { mut s, mut t, offset_x, mut offset_y, mut x_pos, mut y_pos } = quad_pos;
    y_pos *= size;
    offset_y += y_pos;
    // get the path but in pixel coordinates
    s = s * tile_size + offset_x;
    t = t * tile_size + offset_y;
    x_pos = fabs(x_pos) * size;
    let path: Vec<Point> = (if x_pos >= 0. { path_right } else { path_left })
        .to_vec()
        .into_iter()
        .map(|p| Point(p.x() * tile_size + offset_x, p.y() * tile_size + offset_y))
        .collect();
    // now setup an x-y and travel x_pos distance along the path
    let mut dist = 0.;
    let mut path_index = 0;
    let mut curr_angle = 0.;
    // using the current s-t as the starting point and the distance function
    // travel x_pos distance along the path
    while dist < x_pos && path_index < path.len() - 1 {
        curr_angle = point_angle(&path[path_index], path.get(path_index + 1)).unwrap_or(curr_angle);
        let next = &path[path_index];
        let d = distance(&Point(s, t), next);
        if dist + d < x_pos {
            dist += d;
            path_index += 1;
        } else {
            let Point(x1, y1) = path[path_index];
            let Point(x2, y2) = next;
            let ratio = (x_pos - dist) / d;
            s = x1 + (x2 - x1) * ratio;
            t = y1 + (y2 - y1) * ratio;
            break;
        }
    }

    VectorPoint::new_xy(s, t, None)
}

/** The resultant length and distance index given an input linestring */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LineLengthRes {
    pub length: f64,
    pub dist_index: Vec<f64>,
}

/**
 * Get the length of a linestring
 * @param line - input linestring
 * @returns the length of the linestring
 */
pub fn line_length<M: Default + Clone + Interpolate>(line: &VectorLineString<M>) -> LineLengthRes {
    if line.is_empty() {
        return LineLengthRes { length: 0., dist_index: vec![] };
    }
    let mut length = 0.;
    let mut prev = &line[0];
    let mut dist_index = vec![0.];

    for curr in line.iter().skip(1) {
        length += distance(prev, curr);
        dist_index.push(length);
        prev = curr;
    }
    LineLengthRes { length, dist_index }
}

/**
 * Draw a line given a linestring, cap type, and max distance
 * @param points - input linestring
 * @param cap - cap type
 * @param max_distance - max distance between two points. Will reduce distance as needed to ensure
 * no two points are too far away making rendering look ugly (useful for spherical data)
 * @returns the resultant line verts and their lengths so far
 */
pub fn draw_line(
    points: &mut VectorLineString,
    cap: Option<Cap>,
    max_distance: Option<f64>,
) -> Line {
    let cap = cap.unwrap_or(Cap::Butt);
    let max_distance = max_distance.unwrap_or(0.0);
    let mut ll = points.len();
    // corner case: Theres less than 2 points in the array
    if ll < 2 {
        return Line { prev: vec![], curr: vec![], next: vec![], length_so_far: vec![] };
    }

    // check line type
    let closed: bool = points[0].x == points[ll - 1].x && points[0].y == points[ll - 1].y;

    // step pre: If max_distance is not Infinity we need to ensure no point is too far from another
    if max_distance > 0. {
        let mut prev = points[0].clone();
        for i in 1..points.len() {
            let mut curr = points[i].clone();
            while fabs(prev.x - curr.x) > max_distance || fabs(prev.y - curr.y) > max_distance {
                // set new current
                curr = VectorPoint::new_xy((prev.x + curr.x) / 2., (prev.y + curr.y) / 2., None);
                // store current
                points.insert(i, curr.clone());
            }
            prev = curr;
        }
        // update length
        ll = points.len();
    }

    let mut prev: Vec<f32> = vec![points[0].x as f32, points[0].y as f32];
    let mut curr: Vec<f32> = vec![points[0].x as f32, points[0].y as f32];
    let mut next: Vec<f32> = vec![];
    let mut length_so_far = vec![0.];
    let mut cur_length = 0.;
    let mut prev_point = &points[0];

    for i in 1..ll {
        // get the next point
        let point = &points[i];
        // move on if duplicate point
        if prev_point.x == point.x && prev_point.y == point.y {
            continue;
        }
        // store the next pair
        next.push(point.x as f32);
        next.push(point.y as f32);
        // store the point as the next "start"
        curr.push(point.x as f32);
        curr.push(point.y as f32);
        // store the previous point
        prev.push(prev_point.x as f32);
        prev.push(prev_point.y as f32);
        // build the length_so_far
        cur_length += distance(prev_point, point);
        length_so_far.push(cur_length as f32);
        // store the old point
        prev_point = point;
    }
    // here we actually just store 'next'
    let p2 = &points[ll - 1];
    next.push(p2.x as f32);
    next.push(p2.y as f32);
    // if closed, add a 'final' point for the connector piece
    if closed {
        prev.push(points[ll - 2].x as f32);
        prev.push(points[ll - 2].y as f32);
        curr.push(p2.x as f32);
        curr.push(p2.y as f32);
        next.push(points[1].x as f32);
        next.push(points[1].y as f32);
        cur_length += distance(p2, &points[1]);
        length_so_far.push(cur_length as f32);
    }

    // if not a butt cap, we add a duplicate of beginning and end
    if cap != Cap::Butt {
        // start cap
        prev.insert(0, next[1]);
        prev.insert(0, next[0]);
        curr.insert(0, curr[1]);
        curr.insert(0, curr[0]);
        next.insert(0, prev[3]);
        next.insert(0, prev[2]);
        length_so_far.insert(0, 0.);
        // end cap
        let len = curr.len() - 1;
        prev.push(next[len - 1]);
        prev.push(next[len]);
        curr.push(curr[len - 1]);
        curr.push(curr[len]);
        next.push(prev[len - 1]);
        next.push(prev[len]);
        // update length
        length_so_far.push(cur_length as f32);
    }

    Line { prev, curr, next, length_so_far }
}

/**
 * Get the distance between two points
 * @param a - first point
 * @param b - second point
 * @returns the distance
 */
pub fn distance<P1: GetXY, P2: GetXY>(a: &P1, b: &P2) -> f64 {
    sqrt(pow(a.x() - b.x(), 2.) + pow(a.y() - b.y(), 2.))
}

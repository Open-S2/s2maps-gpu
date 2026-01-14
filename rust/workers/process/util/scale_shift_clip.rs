use crate::workers::{TileLayer, TileRequest};
use alloc::{vec, vec::Vec};
use s2json::{
    Axis, VectorLineString, VectorMultiLineString, VectorMultiPoint, VectorMultiPolygon,
    VectorPoint,
};

/** The scale and shift parameters */
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct ScaleShiftParams {
    pub scale: f64,
    pub x_shift: f64,
    pub y_shift: f64,
}

/// Source data may only tilelize data to a certain max zoom, but we may request a tile at a higher zoom
/// Therefore we scale, shift, and clip the geometry as needed for that specific higher zoomed tile.
///
/// 1) scale up by distance between tiles (if parent is 2 zooms above, you double size twice)
/// 2) shift x and y by position of current tile
/// 3) clip the geometry by 0->extent (include buffer if not points)
/// @param extent - the extent of the current tile
/// @param tile - the tile request
/// @returns the scale, shift, and clip parameters
pub fn scale_shift_params(extent: f64, tile: &TileRequest) -> Option<ScaleShiftParams> {
    let TileLayer { mut i, mut j, mut zoom, .. } = tile.layer;
    if tile.parent.is_none() {
        return None;
    }
    let parent_zoom = tile.parent.as_ref().unwrap().zoom;
    // get the scale
    let scale = (1 << (zoom - parent_zoom)) as f64;
    // get x and y shift
    let mut x_shift = 0.;
    let mut y_shift = 0.;
    while zoom > parent_zoom {
        let div = (1 << (zoom - parent_zoom)) as f64;
        if i % 2 != 0 {
            x_shift += extent / div;
        }
        if j % 2 != 0 {
            y_shift += extent / div;
        }
        // decrement
        i = i >> 1;
        j = j >> 1;
        zoom -= 1;
    }

    Some(ScaleShiftParams { scale, x_shift, y_shift })
}

/**
 * Scale, shift, and clip polygons according to the tile request and extent
 * @param geometry - input multi polygon
 * @param extent - extent is the tile "pixel" size
 * @param tile - the tile request
 * @returns the scaled, shifted, and clipped polygons
 */
pub fn scale_shift_clip<M: Clone + Default>(
    mut geometry: VectorMultiPoint<M>,
    extent: f64,
    tile: &TileRequest,
) -> VectorMultiPoint<M> {
    if let Some(ScaleShiftParams { scale, x_shift, y_shift }) = scale_shift_params(extent, tile) {
        _scale_shift_clip_points(&mut geometry, extent, x_shift, y_shift, scale);
    }
    geometry
}

/**
 * Scale, shift, and clip polygons according to the tile request and extent
 * @param geometry - input multi polygon
 * @param extent - extent is the tile "pixel" size
 * @param tile - the tile request
 * @returns the scaled, shifted, and clipped polygons
 */
pub fn scale_shift_clip_lines<M: Clone + Default>(
    geometry: VectorMultiLineString<M>,
    extent: f64,
    tile: &TileRequest,
) -> VectorMultiLineString<M> {
    if let Some(ScaleShiftParams { scale, x_shift, y_shift }) = scale_shift_params(extent, tile) {
        _scale_shift_clip_lines(geometry, extent, x_shift, y_shift, scale)
    } else {
        geometry
    }
}

/**
 * Scale, shift, and clip polygons according to the tile request and extent
 * @param geometry - input multi polygon
 * @param extent - extent is the tile "pixel" size
 * @param tile - the tile request
 * @returns the scaled, shifted, and clipped polygons
 */
pub fn scale_shift_clip_polys<M: Clone + Default>(
    geometry: VectorMultiPolygon<M>,
    extent: f64,
    tile: &TileRequest,
) -> VectorMultiPolygon<M> {
    if let Some(ScaleShiftParams { scale, x_shift, y_shift }) = scale_shift_params(extent, tile) {
        _scale_shift_clip_polys(geometry, extent, x_shift, y_shift, scale)
    } else {
        geometry
    }
}

/**
 * scale, shift, and clip lines from linestrings or polygons
 * @param geometry - input vector geometry
 * @param extent - extent is the tile "pixel" size
 * @param x_shift - x-coordinate shift
 * @param y_shift - y-coordinate shift
 * @param scale - scale factor
 * @returns resultant vector geometry post scale, shift, and clip
 */
fn _scale_shift_clip_polys<M: Clone + Default>(
    mut geometry: VectorMultiPolygon<M>,
    extent: f64,
    x_shift: f64,
    y_shift: f64,
    scale: f64,
) -> VectorMultiPolygon<M> {
    // shift & scale
    for poly in geometry.iter_mut() {
        for line in poly {
            shift_scale(line, x_shift, y_shift, scale);
        }
    }
    // clip
    let mut new_geometry: VectorMultiPolygon<M> = vec![];
    let mut new_geo: VectorMultiPolygon<M> = vec![];
    for poly in geometry {
        let mut new_poly: VectorMultiLineString<M> = vec![];
        for line in &poly {
            new_poly.extend(clip_line(line, extent, true, None));
        }
        if new_poly.len() > 0 {
            new_geo.push(new_poly);
        }
    }
    new_geometry = new_geo;

    new_geometry
}

/**
 * scale, shift, and clip lines from linestrings or polygons
 * @param geometry - input vector geometry
 * @param extent - extent is the tile "pixel" size
 * @param x_shift - x-coordinate shift
 * @param y_shift - y-coordinate shift
 * @param scale - scale factor
 * @returns resultant vector geometry post scale, shift, and clip
 */
fn _scale_shift_clip_lines<M: Clone + Default>(
    mut geometry: VectorMultiLineString<M>,
    extent: f64,
    x_shift: f64,
    y_shift: f64,
    scale: f64,
) -> VectorMultiLineString<M> {
    // shift & scale
    for line in geometry.iter_mut() {
        shift_scale(line, x_shift, y_shift, scale);
    }
    // clip
    let mut new_geo: VectorMultiLineString<M> = vec![];
    for line in geometry.iter() {
        new_geo.extend(clip_line(line, extent, false, None));
    }

    new_geo
}

/**
 * scale, shift, and clip points
 * @param geometry - input points
 * @param extent - extent is the tile "pixel" size
 * @param x_shift - x-coordinate shift
 * @param y_shift - y-coordinate shift
 * @param scale - scale factor
 * @returns resultant vector points post scale, shift, and clip
 */
fn _scale_shift_clip_points<M: Clone + Default>(
    geometry: &mut VectorMultiPoint<M>,
    extent: f64,
    x_shift: f64,
    y_shift: f64,
    scale: f64,
) {
    // shift & scale
    shift_scale(geometry, x_shift, y_shift, scale);
    // clip
    let mut i = 0;
    while i < geometry.len() {
        let point = &geometry[i];
        if point.x < 0.0 || point.x > extent || point.y < 0.0 || point.y > extent {
            geometry.remove(i);
            i -= 1;
        }
        i += 1;
    }
}

/**
 * Shift and scale adjustment to a collection of points
 * @param points - collection of input points
 * @param x_shift - x-coordinate shift
 * @param y_shift - y-coordinate shift
 * @param scale - scale factor
 */
fn shift_scale<M: Clone + Default>(
    points: &mut VectorMultiPoint<M>,
    x_shift: f64,
    y_shift: f64,
    scale: f64,
) {
    for point in points {
        point.x = (point.x - x_shift) * scale;
        point.y = (point.y - y_shift) * scale;
    }
}

/**
 * Clip a collection of lines
 * @param lines - collection of input lines
 * @param extent - extent is the tile "pixel" size
 * @param is_polygon - true if the geometry is a polygon
 * @param buffer - buffer size
 * @returns collection of clipped lines
 */
pub fn clip_lines(
    lines: VectorMultiLineString,
    extent: f64,
    is_polygon: bool,
    buffer: Option<f64>,
) -> VectorMultiLineString {
    let mut res: VectorMultiLineString = vec![];
    for line in &lines {
        res.extend(clip_line(line, extent, is_polygon, buffer));
    }
    res
}

/**
 * uses a buffer of 80 as default
 * @param line - input line
 * @param extent - extent is the tile "pixel" size
 * @param is_polygon - true if the geometry is a polygon
 * @param buffer - buffer size (default of 80)
 * @returns collection of clipped lines
 */
fn clip_line<M: Clone + Default>(
    line: &VectorLineString<M>,
    extent: f64,
    is_polygon: bool,
    buffer: Option<f64>,
) -> VectorMultiLineString<M> {
    let buffer = buffer.unwrap_or(80.0);
    let mut res: VectorMultiLineString<M> = vec![];
    let mut vertical: VectorMultiLineString<M> = vec![];

    // slice vertically
    _clip_line(line, &mut vertical, -buffer, extent + buffer, Axis::Y, is_polygon);
    // slice horizontally
    for vert_line in vertical.iter() {
        _clip_line(vert_line, &mut res, -buffer, extent + buffer, Axis::X, is_polygon);
    }

    res
}

/**
 * Clip a line
 * @param line - input line
 * @param new_geom - collection of clipped lines to store the result to
 * @param k1 - lower bound
 * @param k2 - upper bound
 * @param axis - axis (0 for x or 1 for y)
 * @param is_polygon - true if the geometry is a polygon otherwise it's a linestring
 */
fn _clip_line<M: Clone + Default>(
    line: &VectorLineString<M>,
    new_geom: &mut VectorMultiLineString<M>,
    k1: f64,
    k2: f64,
    axis: Axis,
    is_polygon: bool,
) {
    let mut slice: Vec<VectorPoint<M>> = vec![];
    let intersect = if axis == Axis::X { intersect_x } else { intersect_y };
    let mut last = line.len() - 1;

    let mut i = 0;
    while i < last {
        let VectorPoint::<M> { x: ax, y: ay, t: az, m: am, .. } = &line[i];
        let VectorPoint::<M> { x: bx, y: by, m: bm, .. } = &line[i + 1];
        let a: f64 = if axis == Axis::X { *ax } else { *ay };
        let b: f64 = if axis == Axis::X { *bx } else { *by };
        let mut exited = false;

        // ENTER OR CONTINUE CASES
        if a < k1 {
            // ---|-->  | (line enters the clip region from the left)
            if b > k1 {
                slice.push(intersect(*ax, *ay, *bx, *by, k1, bm));
            }
        } else if a > k2 {
            // |  <--|--- (line enters the clip region from the right)
            if b < k2 {
                slice.push(intersect(*ax, *ay, *bx, *by, k2, bm));
            }
        } else {
            slice.push(VectorPoint { x: *ax, y: *ay, z: None, m: am.clone(), t: *az });
        }

        // EXIT CASES
        if b < k1 && a >= k1 {
            // <--|---  | or <--|-----|--- (line exits the clip region on the left)
            slice.push(intersect(*ax, *ay, *bx, *by, k1, if bm.is_some() { bm } else { am }));
            exited = true;
        }
        if b > k2 && a <= k2 {
            // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
            slice.push(intersect(*ax, *ay, *bx, *by, k2, if bm.is_some() { bm } else { am }));
            exited = true;
        }

        if !is_polygon && exited {
            new_geom.push(slice);
            slice = vec![];
        }

        i += 1;
    }

    // add the last point if inside the clip
    let last_point = &line[last];
    let a = if axis == Axis::X { last_point.x } else { last_point.y };
    if a >= k1 && a <= k2 {
        slice.push(last_point.clone());
    }

    // close the polygon if its endpoints are not the same after clipping
    if !slice.is_empty() && is_polygon {
        last = slice.len() - 1;
        let first_p = &slice[0];
        if last >= 1 && (slice[last].x != first_p.x || slice[last].y != first_p.y) {
            slice.push(first_p.clone());
        }
    }

    // add the final slice
    if slice.len() > 0 {
        new_geom.push(slice);
    }
}

/// Find the intersection of two points on the X axis
fn intersect_x<M: Clone + Default>(
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    x: f64,
    m: &Option<M>,
) -> VectorPoint<M> {
    let t = (x - ax) / (bx - ax);
    VectorPoint::<M> { x, y: ay + (by - ay) * t, z: None, m: m.clone(), t: Some(1.) }
}

/// Find the intersection of two points on the Y axis
fn intersect_y<M: Clone + Default>(
    ax: f64,
    ay: f64,
    bx: f64,
    by: f64,
    y: f64,
    m: &Option<M>,
) -> VectorPoint<M> {
    let t = (y - ay) / (by - ay);
    VectorPoint::<M> { x: ax + (bx - ax) * t, y, z: None, m: m.clone(), t: Some(1.) }
}

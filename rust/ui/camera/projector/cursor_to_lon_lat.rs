use core::f64::consts::PI;
use gistools::geometry::{MAXLAT, ll_to_px, px_to_ll};
use libm::{asin, atan2, cos, fabs, sin, sqrt};
use s2json::Point;

// https://github.com/proj4js/proj4js/blob/master/lib/projections/ortho.js
const EPSLN: f64 = 1.0e-10;
const D2R: f64 = 0.017453292519943295;
const R2D: f64 = 57.29577951308232;

/// Get the longitude and latitude of the cursor position in the S2 Geometry Projection.
/// center_lon and centerlat is where the center of the sphere is currently located
/// x is the distance from center
///
/// ## Parameters
/// - `center_lon`: center longitude
/// - `center_lat`: center latitude
/// - `x_offset`: distance from center
/// - `y_offset`: distance from center
/// - `radius`: the radius of the sphere
///
/// ## Returns
/// longitude and latitude
pub fn cursor_to_lon_lat_s2(
    mut center_lon: f64,
    mut center_lat: f64,
    x_offset: f64,
    y_offset: f64,
    radius: f64,
) -> Option<Point> {
    // pre adjust to radians
    center_lon *= D2R;
    center_lat *= D2R;
    // prep
    let rh = sqrt(x_offset * x_offset + y_offset * y_offset);
    // corner case, the x+y is too far
    if rh > radius {
        return None;
    }
    let z = asinz(rh / radius);
    let sin_p14 = sin(center_lat);
    let cos_p14 = cos(center_lat);
    let sinz = sin(z);
    let cosz = cos(z);
    let mut lon = center_lon;
    let mut lat = center_lat;
    let con = fabs(center_lat) - PI / 2.;
    // corner case: basically on the dot center
    if fabs(rh) <= EPSLN {
        return Some(Point(lon * R2D, lat * R2D));
    }
    // build lat
    lat = asinz(cosz * sin_p14 + (y_offset * sinz * cos_p14) / rh);
    // negative angles
    if fabs(con) <= EPSLN {
        if center_lat >= 0. {
            lon = adjust_lon(center_lon + atan2(x_offset, -y_offset));
        } else {
            lon = adjust_lon(center_lon - atan2(-x_offset, y_offset));
        }
    } else {
        // positive angles
        lon = adjust_lon(
            center_lon + atan2(x_offset * sinz, rh * cos_p14 * cosz - y_offset * sin_p14 * sinz),
        );
    }

    Some(Point(lon * R2D, lat * R2D))
}

/// Get the longitude and latitude of the cursor position in the web mercator projection.
///
/// ## Parameters
/// - `lon`: center longitude
/// - `lat`: center latitude
/// - `x_offset`: x offset
/// - `y_offset`: y offset
/// - `zoom`: zoom
/// - `tile_size`: tile size
///
/// ## Returns
/// longitude and latitude
pub fn cursor_to_lon_lat_wm(
    lon: f64,
    lat: f64,
    x_offset: f64,
    y_offset: f64,
    zoom: f64,
    tile_size: u64,
) -> Option<Point> {
    // grab the px position of lon lat
    let mut px = ll_to_px(&Point(lon, lat), zoom, Some(false), Some(tile_size));
    // if px + offset is outside of min and max, return None
    // adjust by the offset
    px.0 += x_offset;
    px.1 -= y_offset;
    // convert back to lon lat
    let ll = px_to_ll(&px, zoom, Some(tile_size));
    if ll.0 > 180. || ll.0 < -180. || ll.1 > MAXLAT || ll.1 < -MAXLAT { None } else { Some(ll) }
}

/**
 * Arcsine
 * @param x - input
 * @returns the arcsine(x)
 */
fn asinz(mut x: f64) -> f64 {
    if fabs(x) > 1. {
        x = if x > 1. { 1. } else { -1. };
    }
    asin(x)
}

/**
 * Adjust longitude to be between -180 and 180
 * @param x - longitude
 * @returns adjusted longitude
 */
fn adjust_lon(x: f64) -> f64 {
    if fabs(x) <= 3.14159265359 { x } else { x - sign(x) * PI * 2. }
}

/**
 * Get the sign of a number
 * @param x - input
 * @returns the sign(x)
 */
fn sign(x: f64) -> f64 {
    if x < 0. { -1. } else { 1. }
}

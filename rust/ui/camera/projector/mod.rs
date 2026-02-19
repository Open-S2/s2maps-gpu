/// Cursor To Longitude and Latitude
pub mod cursor_to_lon_lat;
/// Tiles in View of the Projection
pub mod get_tiles;
/// Matrix math
pub mod mat4;

use crate::{
    style::{Projection, StyleDefinition},
    ui::{Camera, MapOptions},
    util::MsgSender,
    workers::MapGLToSourceMessages,
};
use alloc::{rc::Rc, vec::Vec};
use bytemuck::{Pod, Zeroable};
use core::{cell::RefCell, f64::consts::PI};
pub use cursor_to_lon_lat::*;
pub use get_tiles::*;
use gistools::{
    geometry::{S2Point, mercator_lat_scale, px_to_ll},
    space::{EARTH_RADIUS, EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR},
};
use libm::{cos, fabs, floor, fmax, fmin, log2, pow, sin};
pub use mat4::*;
use s2json::{Point, Point3D};
use serde::{Deserialize, Serialize};

/// # Optional View
///
/// The view of the map, but any or all of the properties can be omitted
///
/// ### Properties
/// - `lon`: the longitude of the map
/// - `lat`: the latitude of the map
/// - `zoom`: the zoom level of the map
/// - `bearing`: the bearing/compass of the map camera
/// - `pitch`: the pitch/vertical-angle of the map camera
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct View {
    /// the longitude of the map
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lon: Option<f64>,
    /// the latitude of the map
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lat: Option<f64>,
    /// zoom level of the map
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zoom: Option<f64>,
    /// bearing/compass of the map camera
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bearing: Option<f64>,
    /// pitch/vertical-angle of the map camera
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch: Option<f64>,
}
/// # View
///
/// The view of the map
///
/// ### Properties
/// - `lon`: the longitude of the map
/// - `lat`: the latitude of the map
/// - `zoom`: the zoom level of the map
/// - `bearing`: the bearing/compass of the map camera
/// - `pitch`: the pitch/vertical-angle of the map camera
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct RequiredView {
    /// the longitude of the map
    pub lon: f64,
    /// the latitude of the map
    pub lat: f64,
    /// zoom level of the map
    pub zoom: f64,
    /// bearing/compass of the map camera
    pub bearing: f64,
    /// pitch/vertical-angle of the map camera
    pub pitch: f64,
}
impl From<RequiredView> for View {
    fn from(view: RequiredView) -> Self {
        Self {
            lon: Some(view.lon),
            lat: Some(view.lat),
            zoom: Some(view.zoom),
            bearing: Some(view.bearing),
            pitch: Some(view.pitch),
        }
    }
}

/// The current state of the map's view that is passed to the GPU
#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct ProjectorView {
    pub zoom: f32,
    pub lon: f32,
    pub lat: f32,
    pub bearing: f32,
    pub pitch: f32,
    pub time: f32,
    pub aspect_x: f32,
    pub aspect_y: f32,
    pub mouse_x: f32,
    pub mouse_y: f32,
    pub delta_mouse_x: f32,
    pub delta_mouse_y: f32,
    pub feature_state: f32,
    pub curr_feature: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum MatrixType {
    Meters,
    Kilometers,
}

/// The current state of the map's matrices that is passed to the GPU
///
/// (meters, kilometers)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Matrices(pub Option<Mat4>, pub Option<Mat4>);
impl Matrices {
    /// Create a new set of matrices
    pub fn new() -> Matrices {
        Matrices(None, None)
    }
    /// Get with matrix type
    pub fn get(&self, matrix_type: MatrixType) -> Option<&Mat4> {
        match matrix_type {
            MatrixType::Meters => self.0.as_ref(),
            MatrixType::Kilometers => self.1.as_ref(),
        }
    }
    /// Set with matrix type
    pub fn set(&mut self, matrix_type: MatrixType, matrix: Mat4) {
        match matrix_type {
            MatrixType::Meters => self.0 = Some(matrix),
            MatrixType::Kilometers => self.1 = Some(matrix),
        }
    }
    /// Get the meters matrix
    pub fn meters(&self) -> Option<&Mat4> {
        self.0.as_ref()
    }
    /// Get the kilometers matrix
    pub fn kilometers(&self) -> Option<&Mat4> {
        self.1.as_ref()
    }
}

/// # Projector
///
/// Maintain state of the camera, view, zoom, and other parameters that control how we see the map.
/// Also used as a tool to find the tiles that are currently visible.
///
/// See [`Camera`]
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct Projector {
    pub camera: Rc<RefCell<Camera>>,
    pub projection: Projection,
    pub worker: Option<MsgSender<MapGLToSourceMessages>>,
    pub no_clamp: bool,
    // radius is the radius of the earth in kilometers
    pub radius: f64,
    // radii is the radius of the earth in meters for each axis
    pub radii: Vec4,
    pub z_translate_start: f64,
    pub z_translate_end: f64,
    pub zoom_end: f64,
    pub positional_zoom: bool,
    // [zoom, lon, lat, bearing, pitch, time, aspect_x, aspect_y, mouse_x, mouse_y, delta_mouse_x, delta_mouse_y, feature_state, curr_feature]
    pub view: ProjectorView,
    pub aspect: Vec4, // default canvas width x height
    pub matrices: Matrices,
    pub eye: Vec4, // [x, y, z] only z should change for visual effects
    pub constrain_zoom_to_fill: bool,
    pub duplicate_horizontally: bool,
    pub min_lat_position: f64, // deg
    pub max_lat_position: f64, // deg
    pub prev_zoom: f64,
    pub zoom: f64,
    pub minzoom: f64,
    pub maxzoom: f64,
    pub zoom_offset: f64,
    pub lon: f64, // deg
    pub lat: f64, // deg
    pub bearing: f64,
    pub pitch: f64,
    pub z_near: f64, // static; just for draw calls
    pub z_far: f64,  // static; just for draw calls
    pub tile_size: u64,
    pub multiplier: f64,
    pub dirty: bool,
}
impl From<&Projector> for RequiredView {
    fn from(proj: &Projector) -> RequiredView {
        RequiredView {
            lon: proj.lon,
            lat: proj.lat,
            zoom: proj.zoom,
            bearing: proj.bearing,
            pitch: proj.pitch,
        }
    }
}
impl Projector {
    /**
     * @param config - Map Options
     * @param camera - Camera
     */
    pub fn new(config: &MapOptions, camera: Rc<RefCell<Camera>>) -> Self {
        let projection = config.style.projection();
        let worker = camera.borrow().worker.clone();
        // setup deltaMouse positions to middle of 0 and 2^32
        let mut view = ProjectorView::default();
        view.delta_mouse_x = pow(2., 11.) as f32;
        view.delta_mouse_y = pow(2., 11.) as f32;
        Self {
            camera,
            projection: projection.unwrap_or(Projection::S2),
            worker,
            no_clamp: config.no_clamp.unwrap_or(false),
            radius: EARTH_RADIUS / 1_000.,
            radii: Vec4([
                EARTH_RADIUS_EQUATORIAL as f32,
                EARTH_RADIUS_POLAR as f32,
                EARTH_RADIUS_EQUATORIAL as f32,
                0.,
            ]),
            z_translate_start: 5.,
            z_translate_end: 1.001,
            zoom_end: 5.,
            positional_zoom: config.positional_zoom.unwrap_or(true),
            view,
            aspect: Vec4([400., 300., 0., 0.]),
            matrices: Matrices::new(),
            eye: Vec4([0., 0., 0., 0.]),
            constrain_zoom_to_fill: true,
            duplicate_horizontally: true,
            min_lat_position: 70.,
            max_lat_position: 89.99999, // deg
            prev_zoom: 0.,
            zoom: -1.,
            minzoom: 0.,
            maxzoom: 20.,
            zoom_offset: 0.,
            lon: -1.,
            lat: -1.,
            bearing: 0.,
            pitch: 0.,
            z_near: 0.5,         // static; just for draw calls
            z_far: 100_000_000., // static; just for draw calls
            tile_size: 768,
            multiplier: config.canvas_multiplier.unwrap_or(1.),
            dirty: true,
        }
    }

    // API

    /** Reset the projector. This forces a re-calculation of it's internal data like matrices before rendering */
    pub fn reset(&mut self) {
        if !self.dirty {
            self.dirty = true;
            self.matrices = Matrices::new();
        }
    }

    /**
     * Set the mouse position on the canvas for potential interactions
     * Input is the pixel position (0->width, 0->height). Convert to -1->1 for the GPU
     * @param x - x mouse position
     * @param y - y mouse position
     */
    pub fn set_mouse_position(&mut self, x: f32, y: f32) {
        let width = self.aspect.x();
        let height = self.aspect.y();
        self.view.mouse_x = (x / width) * 2. - 1.;
        self.view.mouse_y = (y / height) * -2. + 1.;
    }

    /**
     * Set the state of the current feature
     * @param state - 0: none, 1: hover, 2: click
     */
    pub fn set_feature_state(&mut self, state: f32) {
        self.view.feature_state = state;
        self.dirty = true;
    }

    /**
     * Set the current feature that's under the mouse
     * @param id - the id of the feature
     */
    pub fn set_current_feature(&mut self, id: f32) {
        self.view.curr_feature = id;
        self.dirty = true;
    }

    /**
     * Set the style parameters
     * @param style - user defined style params
     * @param ignore_position - if set, do not update the view
     */
    pub fn set_style_parameters(&mut self, style: &StyleDefinition, ignore_position: bool) {
        let StyleDefinition {
            constrain_zoom_to_fill,
            duplicate_horizontally,
            no_clamp,
            min_lat_position,
            max_lat_position,
            zoom_offset,
            z_near,
            z_far,
            view,
            ..
        } = style;
        let maxzoom = style.maxzoom.unwrap_or(self.maxzoom);
        let minzoom = style.minzoom.unwrap_or(self.minzoom);
        // setup wm properties if needed
        if let Some(constrain_zoom_to_fill) = constrain_zoom_to_fill {
            self.constrain_zoom_to_fill = *constrain_zoom_to_fill;
        }
        if let Some(duplicate_horizontally) = duplicate_horizontally {
            self.duplicate_horizontally = *duplicate_horizontally;
        }
        if !self.constrain_zoom_to_fill && self.duplicate_horizontally {
            // panic!(
            //     "duplicate_horizontally may only be used if constrain_zoom_to_fill is true. Setting duplicate_horizontally to false.",
            // );
            self.duplicate_horizontally = false;
        }
        // clamp values and ensure minzoom is less than maxzoom
        self.minzoom = if minzoom < -2. {
            -2.
        } else {
            if minzoom > maxzoom { maxzoom - 1. } else { if minzoom > 19. { 19. } else { minzoom } }
        };
        self.maxzoom = if maxzoom > 20. {
            20.
        } else {
            if maxzoom < self.minzoom { self.minzoom + 1. } else { maxzoom }
        };
        if let Some(zoom_offset) = zoom_offset {
            self.zoom_offset = *zoom_offset;
        }
        if let Some(max_lat_position) = max_lat_position {
            self.max_lat_position = fmin(*max_lat_position, self.max_lat_position)
        }
        if let Some(min_lat_position) = min_lat_position {
            self.min_lat_position = fmax(*min_lat_position, self.min_lat_position);
        }
        if let Some(no_clamp) = no_clamp
            && *no_clamp
        {
            self.no_clamp = true;
        }
        if let Some(z_near) = z_near {
            self.z_near = *z_near;
        }
        if let Some(z_far) = z_far {
            self.z_far = *z_far;
        }
        // set position
        if !ignore_position {
            self.set_view(view.unwrap_or_default());
        }
    }

    /**
     * Update the view
     * @param view - the new view
     */
    pub fn set_view(&mut self, view: View) {
        let View { zoom, lon, lat, bearing, pitch } = view;
        self._set_view(&mut RequiredView {
            zoom: zoom.unwrap_or(self.zoom),
            lon: lon.unwrap_or(self.lon),
            lat: lat.unwrap_or(self.lat),
            bearing: bearing.unwrap_or(self.bearing),
            pitch: pitch.unwrap_or(self.pitch),
        });
    }

    /** @returns the amount the zoom has changed since the last update */
    pub fn zoom_change(&self) -> f64 {
        let Self { zoom, prev_zoom, .. } = self;
        floor(*zoom) - floor(*prev_zoom)
    }

    /**
     * Get a zoom scale, if no zoom is provided, use the current zoom
     * @param zoom - the zoom level
     * @returns the zoom scale
     */
    pub fn zoom_scale(&self, zoom: Option<f64>) -> f64 {
        let zoom = zoom.unwrap_or(self.zoom);
        pow(2., zoom)
    }

    /**
     * Resize the canvas. So we need to update our view's aspect
     * @param width - new width
     * @param height - new height
     */
    pub fn resize(&mut self, width: f64, height: f64) {
        let width_f32 = width as f32;
        let height_f32 = height as f32;
        self.aspect.set_x(width_f32);
        self.aspect.set_y(height_f32);
        self.view.aspect_x = width_f32;
        self.view.aspect_y = height_f32;
        // update view
        self.set_view(View::default());
        // cleanup
        self.reset();
    }

    /**
     * The user has scrolled or two finger pinched
     * @param zoom_input - the amount the user scrolled
     * @param canvas_x - the x position on the canvas
     * @param canvas_y - the y position on the canvas
     */
    pub fn on_zoom(&mut self, zoom_input: f64, canvas_x: f64, canvas_y: f64) {
        let Self { positional_zoom, multiplier, aspect, .. } = *self;
        // set zoom
        self.set_view(View { zoom: Some(self.zoom - 0.003 * zoom_input), ..View::default() });
        if self.prev_zoom == self.zoom {
            return;
        }
        // if positional_zoom, we adjust the lon and lat according to the mouse position.
        // consider the distance between the lon-lat of our current "center" position and
        // the lon-lat of the cursor position PRE-zoom adjustment. After zooming, we
        // want to readjust our lon-lat position to compensate for that delta.
        if positional_zoom {
            // STEP 1: Get the distance from the center in pixels (up is +y, right is +x)
            // self value is considered our "previous" distance metric.
            let width = aspect.x() as f64;
            let height = aspect.y() as f64;
            let pos_x = canvas_x - width / multiplier / 2.;
            let pos_y = height / multiplier / 2. - canvas_y;
            // STEP 2: find the distance POST-zoom adjustment. In other words,
            // multiply the previous position by the scale change
            let zoom_adjust = 1. + (self.zoom - self.prev_zoom);
            let pos_delta_x = pos_x * zoom_adjust - pos_x;
            let pos_delta_y = pos_y * zoom_adjust - pos_y;
            // STEP 3: The deltas need to be converted to deg change
            if self.projection == Projection::S2 {
                self.on_move(Some(-pos_delta_x), Some(pos_delta_y), Some(3072.), Some(1536.));
            } else {
                self.on_move(Some(-pos_delta_x), Some(pos_delta_y), Some(1.), Some(1.));
            }
        }
    }

    /**
     * User mouse/touch input (or swipe animation)
     * @param movement_x - the change in x position
     * @param movement_y - the change in y position
     * @param multiplier_x - the multiplier for the x axis
     * @param multiplier_y - the multiplier for the y axis
     */
    pub fn on_move(
        &mut self,
        movement_x: Option<f64>,
        movement_y: Option<f64>,
        multiplier_x: Option<f64>,
        multiplier_y: Option<f64>,
    ) {
        let mut movement_x = movement_x.unwrap_or(0.0);
        let mut movement_y = movement_y.unwrap_or(0.0);
        self._set_move(movement_x as f32, movement_y as f32);
        let Self { lon, lat, tile_size, projection, multiplier, mut bearing, .. } = *self;
        let z_scale = fmax(self.zoom_scale(None), 1.);
        let tile_scale = (tile_size / 512) as f64;
        let is_s2 = projection == Projection::S2;
        // setup multipliers
        let mut multiplier_x =
            multiplier_x.unwrap_or(multiplier * (if is_s2 { 6.5 * 360. } else { 0.75 }));
        let mut multiplier_y =
            multiplier_y.unwrap_or(multiplier * (if is_s2 { 6.5 * 180. } else { 0.75 }));
        if !is_s2 {
            multiplier_x *= tile_scale;
            multiplier_y *= tile_scale;
        }
        // adjust movement vector if bearing
        if bearing != 0. {
            bearing = bearing.to_radians(); // adjust to radians
            let tmp_y = movement_x * sin(bearing) + movement_y * cos(bearing);
            movement_x = movement_x * cos(bearing) - movement_y * sin(bearing);
            movement_y = tmp_y;
        }

        // set the new lon-lat
        if is_s2 {
            // https://math.stackexchange.com/questions/377445/given-a-latitude-how-many-miles-is-the-corresponding-longitude
            let lon_multiplier = fmin(30., 1. / cos((fabs(lat) * PI) / 180.));
            self.set_view(View {
                lon: Some(lon - (movement_x / (multiplier_x * z_scale)) * 360. * lon_multiplier),
                lat: Some(lat + (movement_y / (multiplier_y * z_scale)) * 180.),
                ..Default::default()
            });
        } else {
            self.set_view(View {
                lon: Some(lon - movement_x / (multiplier_x * z_scale)),
                lat: Some(lat + movement_y / (multiplier_y * z_scale * mercator_lat_scale(lat))),
                ..Default::default()
            });
        }
    }

    /**
     * Get the lon-lat based on the mouse position
     * x and y are the distances from the center of the screen
     * @param x_offset - x offset
     * @param y_offset - y offset
     * @returns longitude and latitude at the mouse position
     */
    pub fn cursor_to_lon_lat(&self, x_offset: f64, y_offset: f64) -> Option<Point> {
        let Self { projection, lon, lat, zoom, tile_size, multiplier, .. } = *self;
        if projection == Projection::S2 {
            let radius = ((tile_size as f64) * pow(2., zoom)) / 2.;
            cursor_to_lon_lat_s2(lon, lat, x_offset, y_offset, radius)
        } else {
            let tile_size = ((tile_size as f64) / multiplier) as u64;
            cursor_to_lon_lat_wm(lon, lat, x_offset, y_offset, zoom, tile_size)
        }
    }

    /**
     * Get the matrix for either a global state (S2) or a specific tile (WM)
     * - S2 -> type of meters or kilometers
     * - WM -> scale and offset
     * @param type_or_scale - type or scale
     * @param offset - offset in pixels
     * @returns the matrix
     */
    pub fn get_matrix_wm(&mut self, scale: f64, offset: Option<Point>) -> Mat4 {
        let offset = offset.unwrap_or(Point(0., 0.));
        self._get_matrix_wm(scale, offset, None, None)
    }

    /**
     * Get the matrix for either a global state (S2) or a specific tile (WM)
     * - S2 -> type of meters or kilometers
     * - WM -> scale and offset
     * @param type_or_scale - type or scale
     * @param offset - offset in pixels
     * @returns the matrix
     */
    pub fn get_matrix(&mut self, type_or_scale: MatrixType) -> Mat4 {
        let matrix = self.matrices.get(type_or_scale);
        if let Some(matrix) = matrix {
            return matrix.clone();
        }
        // updated matrix
        let matrix = self._get_matrix_s2(type_or_scale, None, View::default());
        self.matrices.set(type_or_scale, matrix);

        matrix
    }

    /** @returns the tiles in this projector's current view */
    pub fn get_tiles_in_view(&mut self) -> Vec<TileInView> {
        let Self { projection, radius, zoom, zoom_offset, lon, lat, .. } = *self;
        if projection == Projection::S2 {
            let matrix = self.get_matrix(MatrixType::Meters);
            get_tiles_in_view_s2(zoom + zoom_offset, lon, lat, &matrix, Some(radius))
        } else {
            get_tiles_in_view_wm(zoom + zoom_offset, lon, lat, self)
        }
    }

    /**
     * Get the tiles at a specific position
     * @param lon - longitude
     * @param lat - latitude
     * @param zoom - zoom
     * @param bearing - bearing
     * @param pitch - pitch
     * @returns the tiles in view
     */
    pub fn get_tiles_at_position(&mut self, view: View) -> Vec<TileInView> {
        let Self { projection, radius, zoom_offset, .. } = *self;
        let zoom = view.zoom.unwrap_or(self.zoom);
        let lon = view.lon.unwrap_or(self.lon);
        let lat = view.lat.unwrap_or(self.lat);
        if projection == Projection::S2 {
            let matrix = self._get_matrix_s2(MatrixType::Meters, Some(false), view);
            get_tiles_in_view_s2(zoom + zoom_offset, lon, lat, &matrix, Some(radius))
        } else {
            // TODO: bearing and pitch without editing the projection?
            get_tiles_in_view_wm(zoom + zoom_offset, lon, lat, self)
        }
    }

    // INTERNAL FUNCTIONS //

    /**
     * Handles moving the camera. Update state for the GPU
     * @param movement_x - the change in x position
     * @param movement_y - the change in y position
     */
    fn _set_move(&mut self, movement_x: f32, movement_y: f32) {
        let Self { view, aspect, .. } = self;
        let max_value = pow(2., 11.) as f32;
        let mid_value = pow(2., 10.) as f32;
        view.delta_mouse_x -= movement_x / aspect.x();
        view.delta_mouse_y += movement_y / aspect.y();
        // if we ever hit the min-max values, we reset to the middle
        if view.delta_mouse_x < 0. || view.delta_mouse_x > max_value {
            view.delta_mouse_x = mid_value;
        }
        if view.delta_mouse_y < 0. || view.delta_mouse_y > max_value {
            view.delta_mouse_y = mid_value;
        }
    }

    /**
     * Update the view
     * @param view - the new view
     */
    fn _set_view(&mut self, view: &mut RequiredView) {
        // clamp the view based upon the current settings
        self._clamp_view(view);
        // update if any changes found:
        let RequiredView { zoom, lon, lat, bearing, pitch } = *view;
        let bearing_pitch_change = self.bearing != bearing || self.pitch != pitch;
        if
        // zoom change?
        self.zoom != zoom ||
          self.prev_zoom != zoom ||
          // lon-lat change?
          self.lon != lon ||
          self.lat != lat ||
          // bearing or pitch change?
          bearing_pitch_change
        {
            // keep track of the old zoom and adjust the zoom
            self.prev_zoom = self.zoom;
            self.zoom = zoom;
            // adjust the lon-lat
            self.lon = lon;
            self.lat = lat;
            // adjust the bearing and pitch
            self.bearing = bearing;
            self.pitch = pitch;
            // update view
            self.view.zoom = self.zoom as f32;
            self.view.lon = self.lon as f32;
            self.view.lat = self.lat as f32;
            self.view.bearing = self.bearing as f32;
            self.view.pitch = self.pitch as f32;
            // if bearing or pitch change we let the map know
            if bearing_pitch_change {
                self.camera.borrow_mut()._update_compass(self.bearing, self.pitch);
            }
            // cleanup for next render
            self.reset();
        }
    }

    /**
     * Clamp the view
     * @param view - the new view
     */
    fn _clamp_view(&self, view: &mut RequiredView) {
        let Self { no_clamp, constrain_zoom_to_fill, projection, .. } = self;
        // adjust zoom
        self._clamp_zoom(view);
        // adjust lon-lat
        if !no_clamp {
            view.lon = Projector::_clamp_deg(view.lon);
            self._clamp_lat(view);
        }
        // adjust bearing
        view.bearing = Projector::_clamp_deg(view.bearing);
        // adjust view if constrained to fill
        if *projection == Projection::WM && *constrain_zoom_to_fill {
            self._clamp_constraint(view);
        }
    }

    /**
     * Clamp the zoom
     * @param view - the new view
     */
    fn _clamp_zoom(&self, view: &mut RequiredView) {
        view.zoom = fmax(fmin(view.zoom, self.maxzoom), self.minzoom);
    }

    /**
     * Clamp the latitude
     * @param view - the new view
     */
    fn _clamp_lat(&self, view: &mut RequiredView) {
        let Self { max_lat_position, min_lat_position, zoom, .. } = self;
        // prep current boundaries
        let lat_pos_diff = max_lat_position - min_lat_position;
        let cur_max_lat = fmin(
            min_lat_position + fmin(lat_pos_diff, (lat_pos_diff / 3.) * zoom),
            *max_lat_position,
        );
        // clamp
        view.lat = fmax(fmin(cur_max_lat, view.lat), -cur_max_lat);
    }

    /**
     * Clamp the view by the constraints provided by the projection and/or user style settings
     * @param view - the new view
     */
    fn _clamp_constraint(&self, view: &mut RequiredView) {
        let Self { aspect, tile_size, .. } = self;
        // if tile_size relative to zoom is smaller than aspect, we adjust zoom
        let tile_size_f = *tile_size as f64;
        let aspect_y = aspect.y() as f64;
        if tile_size_f * pow(2., view.zoom) < aspect_y {
            view.zoom = log2(aspect_y / tile_size_f);
        }
        // now that we have the min zoom, we can adjust the latitude to ensure the view is within bounds
        let world_size = tile_size_f * pow(2., view.zoom);
        let center = world_size / 2.;
        let world_minus_aspect_halfed = (world_size - aspect_y) / 2.;
        let (_, max_lat) =
            px_to_ll(&(0., center - world_minus_aspect_halfed), view.zoom, Some(*tile_size));
        let (_, min_lat) =
            px_to_ll(&(0., center - world_minus_aspect_halfed), view.zoom, Some(*tile_size));
        view.lat = fmin(max_lat, fmax(min_lat, view.lat));
    }

    /**
     * Clamp longitude and bearing between [-180,180]
     * @param input - the longitude
     * @returns clamped longitude
     */
    fn _clamp_deg(mut input: f64) -> f64 {
        while input >= 180. {
            input -= 360.;
        }
        while input < -180. {
            input += 360.;
        }
        input
    }

    // S2 //

    /**
     * Get the matrix for the S2 projection
     * @param type - the matrix type (meters or kilometers)
     * @param update_eye - whether to update the eye
     * @param lon - longitude
     * @param lat - latitude
     * @param zoom - zoom
     * @param bearing - bearing
     * @param _pitch - pitch
     * @returns S2 matrix
     */
    fn _get_matrix_s2(&mut self, r#type: MatrixType, update_eye: Option<bool>, view: View) -> Mat4 {
        let update_eye = update_eye.unwrap_or(true);
        let lon = view.lon.unwrap_or(self.lon);
        let lat = view.lat.unwrap_or(self.lat);
        let zoom = view.zoom.unwrap_or(self.zoom);
        let bearing = view.bearing.unwrap_or(self.bearing);
        // update eye
        let eye = self._update_eye_s2(lon, lat, zoom, Some(update_eye));
        // get projection matrix
        let mut matrix = self._get_projection_matrix_s2(r#type, Some(zoom));
        // create view matrix
        let mut view = Mat4::look_at(
            &eye,
            &Vec4([0., if lat > 90. || lat < -90. { -1. } else { 1. }, 0., 0.]),
        );
        // adjust by bearing
        if bearing != 0. {
            matrix.rotate_z(bearing.to_radians() as f32);
        }
        // if km we "remove" the eye
        if r#type == MatrixType::Kilometers {
            view.0[12] = 0.;
            view.0[13] = 0.;
            view.0[14] = 0.;
        }
        // multiply projection matrix by view matrix
        matrix.multiply(&view);

        matrix
    }

    /**
     * Update the eye position given a longitude, latitude and zoom
     * @param lon - longitude
     * @param lat - latitude
     * @param zoom - zoom
     * @param update - whether to update the eye. If false, we only needed the resultant eye for other computations
     * @returns new eye
     */
    fn _update_eye_s2(&mut self, lon: f64, lat: f64, zoom: f64, update: Option<bool>) -> Vec4 {
        let update = update.unwrap_or(true);
        let Self { radius, z_translate_end, z_translate_start, zoom_end, .. } = self;
        // find radial distance from core of ellipsoid
        let radial_multiplier = fmax(
            ((*z_translate_end - *z_translate_start) / *zoom_end) * zoom + *z_translate_start,
            *z_translate_end,
        ) * (*radius);
        // create xyz point for eye
        let mut eye_point: S2Point = S2Point::from_lon_lat_gl(&Point3D(lon, lat, 0.));
        eye_point.normalize();
        eye_point *= radial_multiplier;
        let eye = (&eye_point).into();
        if update {
            self.eye = eye;
        }

        eye
    }

    /**
     * Get the S2 projection matrix
     * @param type - the matrix type (meters or kilometers)
     * @param zoom - zoom
     * @returns S2 projection matrix
     */
    fn _get_projection_matrix_s2(&self, r#type: MatrixType, zoom: Option<f64>) -> Mat4 {
        let zoom = zoom.unwrap_or(self.zoom);
        let Self { aspect, tile_size, multiplier, .. } = self;
        let mut radius = self.radius;

        // BLEND LOOKS A BIT DIFF const multpl = -radius / multiplier / (tile_size * scale * radius * 5)
        if r#type == MatrixType::Kilometers {
            radius *= 1000.;
        }
        let multpl = (radius / multiplier / ((*tile_size as f64) * pow(2., zoom))) as f32;

        // create projection
        Mat4::ortho(aspect.x() * multpl, aspect.y() * multpl, 100_000.)
    }

    // WM //

    /**
     * Get the matrix for the WM projection
     * @param scale - scale shift
     * @param offset - offset
     * @param bearing - bearing
     * @param _pitch - pitch
     * @returns WM matrix
     */
    fn _get_matrix_wm(
        &self,
        scale: f64,
        offset: Point,
        bearing: Option<f64>,
        _pitch: Option<f64>,
    ) -> Mat4 {
        let bearing = bearing.unwrap_or(self.bearing);
        let Point(offset_x, offset_y) = offset;
        // get projection matrix
        let mut matrix = self._get_projection_matrix_wm(scale);
        // create view matrix
        let view = Mat4::look_at(&Vec4([0., 0., -1., 0.]), &Vec4([0., -1., 0., 0.]));
        // adjust by bearing
        if bearing != 0. {
            matrix.rotate_z(bearing.to_radians() as f32);
        }
        // multiply projection matrix by view matrix
        matrix.multiply(&view);
        // adjust by position
        matrix.translate(&Vec4([-(offset_x as f32), -(offset_y as f32), 0., 0.]));

        matrix
    }

    /**
     * Get the WM projection matrix
     * @param scale - scale shift
     * @returns WM projection matrix
     */
    fn _get_projection_matrix_wm(&self, scale: f64) -> Mat4 {
        let Self { aspect, tile_size, multiplier, .. } = self;
        // adjust aspect ratio by zoom
        let multpl = (1. / multiplier / ((*tile_size as f64) * scale)) as f32;
        // create projection
        Mat4::ortho(aspect.x() * multpl, aspect.y() * multpl, 1_000.)
    }
}

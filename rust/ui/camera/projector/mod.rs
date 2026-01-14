/// Cursor To Longitude and Latitude
pub mod cursor_to_lon_lat;
/// Tiles in View of the Projection
pub mod get_tiles;
/// Matrix math
pub mod mat4;

use crate::{style::Projection, ui::Camera};
use alloc::{rc::Rc, vec::Vec};
use bytemuck::{Pod, Zeroable};
use core::cell::RefCell;
pub use cursor_to_lon_lat::*;
pub use get_tiles::*;
use libm::pow;
pub use mat4::*;
use serde::{Deserialize, Serialize};

// import {
//   EARTH_RADIUS,
//   EARTH_RADIUS_EQUATORIAL,
//   EARTH_RADIUS_POLAR,
//   degToRad,
//   mercatorLatScale,
//   pointFromLonLatGL,
//   pointMulScalar,
//   pointNormalize,
//   pxToLL,
// } from 'gis-tools/index.js';
// import { getTilesInViewS2, getTilesInViewWM } from './getTiles/index.js';

// import type Camera from '../index.js';
// import type { MapOptions } from 'ui/s2mapUI.js';
// import type { TileInView } from './getTiles/index.js';
// import type { Point3D, VectorPoint } from 'gis-tools/index.js';
// import type { Projection, StyleDefinition } from 'style/style.spec.js';

// export * from './getTiles/index.js';

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
pub struct OptionalView {
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
pub struct View {
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
impl From<View> for OptionalView {
    fn from(view: View) -> Self {
        Self {
            lon: Some(view.lon),
            lat: Some(view.lat),
            zoom: Some(view.zoom),
            bearing: Some(view.bearing),
            pitch: Some(view.pitch),
        }
    }
}

/** The type of matrix. Either `m` (meters) or `km` (kilometers) */
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub enum MatrixType {
    Meters,
    Kilometers,
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

/// The current state of the map's matrices that is passed to the GPU
///
/// (meters, kilometers)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Matrices(pub Mat4, pub Mat4);
impl Matrices {
    /// Create a new set of matrices
    pub fn new() -> Matrices {
        Matrices(Mat4::new(), Mat4::new())
    }
    /// Get the matrix for the given type
    pub fn get_mut(&mut self, matrix_type: MatrixType) -> &mut Mat4 {
        match matrix_type {
            MatrixType::Meters => &mut self.0,
            MatrixType::Kilometers => &mut self.1,
        }
    }
}

/// # Projector
///
/// Maintain state of the camera, view, zoom, and other parameters that control how we see the map.
/// Also used as a tool to find the tiles that are currently visible.
/// @see {@link Camera}
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct Projector {
    pub camera: Rc<RefCell<Camera>>,
    pub projection: Projection, // = 'S2';
    pub webworker: bool,        // = false;
    pub no_clamp: bool,         // = false;
    // radius is the radius of the earth in kilometers
    pub radius: f64, // = EARTH_RADIUS / 1_000;
    // radii is the radius of the earth in meters for each axis
    pub radii: Vec4, // = [EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR, EARTH_RADIUS_EQUATORIAL];
    pub z_translate_start: f64, // = 5;
    pub z_translate_end: f64, // = 1.001;
    pub zoom_end: f64, // = 5;
    pub positional_zoom: bool, // = true;
    // [zoom, lon, lat, bearing, pitch, time, aspect_x, aspect_y, mouse_x, mouse_y, delta_mouse_x, delta_mouse_y, feature_state, curr_feature]
    pub view: ProjectorView,
    pub aspect: Vec4,       // = { x: 400, y: 300 }; // default canvas width x height
    pub matrices: Matrices, // { [key in MatrixType]?: Float32Array } = {};
    pub eye: Vec4, // VectorPoint = { x: 0, y: 0, z: 0 }; // [x, y, z] only z should change for visual effects
    pub constrain_zoom_to_fill: bool, // = true;
    pub duplicate_horizontally: bool, // = true;
    pub min_lat_position: f64, // = 70;
    pub max_lat_position: f64, // = 89.99999; // deg
    pub prev_zoom: f64, // = 0;
    pub zoom: f64, // = -1;
    pub minzoom: f64, // = 0;
    pub maxzoom: f64, // = 20;
    pub zoom_offset: f64, // = 0;
    pub lon: f64,  // = -1;
    pub lat: f64,  // = -1;
    pub bearing: f64, // = 0;
    pub pitch: f64, // = 0;
    pub z_near: f64, // = 0.5; // static; just for draw calls
    pub z_far: f64, // = 100_000_000; // static; just for draw calls
    pub tile_size: f64, // = 768;
    pub multiplier: f64, // = 1;
    pub dirty: bool, // = true;
}
impl From<&Projector> for View {
    fn from(proj: &Projector) -> View {
        View {
            lon: proj.lon,
            lat: proj.lat,
            zoom: proj.zoom,
            bearing: proj.bearing,
            pitch: proj.pitch,
        }
    }
}
impl Projector {
    //   /**
    //    * @param config - Map Options
    //    * @param camera - Camera
    //    */
    //   constructor(config: MapOptions, camera: Camera) {
    //     const { canvasMultiplier, positional_zoom, no_clamp, style } = config;
    //     if (typeof style === 'object' && style.projection === 'WM') this.projection = 'WM';
    //     if (canvasMultiplier !== undefined) this.multiplier = canvasMultiplier;
    //     if (positional_zoom === false) this.positional_zoom = false;
    //     this.webworker = camera.webworker;
    //     if (no_clamp === true) this.no_clamp = true;
    //     this.camera = camera;
    //     // setup deltaMouse positions to middle of 0 and 2^32
    //     this.view[10] = 2 ** 11;
    //     this.view[11] = 2 ** 11;
    //   }

    // API

    /** Reset the projector. This forces a re-calculation of it's internal data like matrices before rendering */
    pub fn reset(&mut self) {
        if !self.dirty {
            self.dirty = true;
            self.matrices = Matrices::new();
        }
    }

    //   /**
    //    * Set the mouse position on the canvas for potential interactions
    //    * Input is the pixel position (0->width, 0->height). Convert to -1->1 for the GPU
    //    * @param x - x mouse position
    //    * @param y - y mouse position
    //    */
    //   setMousePosition(x: number, y: number): void {
    //     const { x: width, y: height } = this.aspect;
    //     this.view[8] = (x / width) * 2 - 1;
    //     this.view[9] = (y / height) * -2 + 1;
    //   }

    //   /**
    //    * Set the state of the current feature
    //    * @param state - 0: none, 1: hover, 2: click
    //    */
    //   setFeatureState(state: 0 | 1 | 2): void {
    //     this.view[12] = state;
    //     this.dirty = true;
    //   }

    //   /**
    //    * Set the current feature that's under the mouse
    //    * @param id - the id of the feature
    //    */
    //   setCurrentFeature(id: number): void {
    //     this.view[13] = id;
    //     this.dirty = true;
    //   }

    //   /**
    //    * Set the style parameters
    //    * @param style - user defined style params
    //    * @param ignorePosition - if set, do not update the view
    //    */
    //   setStyleParameters(style: StyleDefinition, ignorePosition: boolean): void {
    //     const { min, max } = Math;
    //     const {
    //       constrain_zoom_to_fill,
    //       duplicate_horizontally,
    //       no_clamp,
    //       min_lat_position,
    //       max_lat_position,
    //       zoom_offset,
    //       z_near,
    //       z_far,
    //       view,
    //     } = style;
    //     const { lon, lat, zoom, bearing, pitch } = view ?? {};
    //     const maxzoom = style.maxzoom ?? this.maxzoom;
    //     const minzoom = style.minzoom ?? this.minzoom;
    //     // setup wm properties if needed
    //     if (constrain_zoom_to_fill !== undefined) this.constrain_zoom_to_fill = constrain_zoom_to_fill;
    //     if (duplicate_horizontally !== undefined) this.duplicate_horizontally = duplicate_horizontally;
    //     if (!this.constrain_zoom_to_fill && this.duplicate_horizontally) {
    //       console.warn(
    //         'duplicate_horizontally may only be used if constrain_zoom_to_fill is true. Setting duplicate_horizontally to false.',
    //       );
    //       this.duplicate_horizontally = false;
    //     }
    //     // clamp values and ensure minzoom is less than maxzoom
    //     this.minzoom =
    //       minzoom < -2 ? -2 : minzoom > maxzoom ? maxzoom - 1 : minzoom > 19 ? 19 : minzoom;
    //     this.maxzoom = maxzoom > 20 ? 20 : maxzoom < this.minzoom ? this.minzoom + 1 : maxzoom;
    //     if (zoom_offset !== undefined) this.zoom_offset = zoom_offset;
    //     if (max_lat_position !== undefined)
    //       this.max_lat_position = min(max_lat_position, this.max_lat_position);
    //     if (min_lat_position !== undefined)
    //       this.min_lat_position = max(min_lat_position, this.min_lat_position);
    //     if (no_clamp === true) this.no_clamp = true;
    //     if (z_near !== undefined) this.z_near = z_near;
    //     if (z_far !== undefined) this.z_far = z_far;
    //     // set position
    //     if (!ignorePosition) this.set_view({ lon, lat, zoom, bearing, pitch });
    //   }

    /**
     * Update the view
     * @param view - the new view
     */
    pub fn set_view(&mut self, view: OptionalView) {
        // const { zoom, lon, lat, bearing, pitch } = view;
        // this.#set_view({
        //   zoom: zoom ?? this.zoom,
        //   lon: lon ?? this.lon,
        //   lat: lat ?? this.lat,
        //   bearing: bearing ?? this.bearing,
        //   pitch: pitch ?? this.pitch,
        // });
        todo!()
    }

    //   /** @returns the amount the zoom has changed since the last update */
    //   zoomChange(): number {
    //     const { zoom, prev_zoom } = this;
    //     const { floor } = Math;
    //     return floor(zoom) - floor(prev_zoom);
    //   }

    /**
     * Get a zoom scale, if no zoom is provided, use the current zoom
     * @param zoom - the zoom level
     * @returns the zoom scale
     */
    pub fn zoom_scale(&self, zoom: Option<f64>) -> f64 {
        let zoom = zoom.unwrap_or(self.zoom);
        pow(2., zoom)
    }

    //   /**
    //    * Resize the canvas. So we need to update our view's aspect
    //    * @param width - new width
    //    * @param height - new height
    //    */
    //   resize(width: number, height: number): void {
    //     this.view[6] = this.aspect.x = width;
    //     this.view[7] = this.aspect.y = height;
    //     // update view
    //     this.set_view({});
    //     // cleanup
    //     this.reset();
    //   }

    //   /**
    //    * The user has scrolled or two finger pinched
    //    * @param zoomInput - the amount the user scrolled
    //    * @param canvasX - the x position on the canvas
    //    * @param canvasY - the y position on the canvas
    //    */
    //   onZoom(zoomInput: number, canvasX: number, canvasY: number): void {
    //     const { positional_zoom, multiplier, aspect } = this;
    //     // set zoom
    //     this.set_view({ zoom: this.zoom - 0.003 * zoomInput });
    //     if (this.prev_zoom === this.zoom) return;
    //     // if positional_zoom, we adjust the lon and lat according to the mouse position.
    //     // consider the distance between the lon-lat of our current "center" position and
    //     // the lon-lat of the cursor position PRE-zoom adjustment. After zooming, we
    //     // want to readjust our lon-lat position to compensate for that delta.
    //     if (positional_zoom) {
    //       // STEP 1: Get the distance from the center in pixels (up is +y, right is +x)
    //       // this value is considered our "previous" distance metric.
    //       const { x: width, y: height } = aspect;
    //       const posX = canvasX - width / multiplier / 2;
    //       const posY = height / multiplier / 2 - canvasY;
    //       // STEP 2: find the distance POST-zoom adjustment. In other words,
    //       // multiply the previous position by the scale change
    //       const zoomAdjust = 1 + (this.zoom - this.prev_zoom);
    //       const posDeltaX = posX * zoomAdjust - posX;
    //       const posDeltaY = posY * zoomAdjust - posY;
    //       // STEP 3: The deltas need to be converted to deg change
    //       if (this.projection === 'S2') this.on_move(-posDeltaX, posDeltaY, 3072, 1536);
    //       else this.on_move(-posDeltaX, posDeltaY, 1, 1);
    //     }
    //   }

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
        let movement_x = movement_x.unwrap_or(0.0);
        let movement_y = movement_y.unwrap_or(0.0);
        //     this.#setMove(movement_x, movement_y);
        //     const { lon, lat, tile_size, projection, multiplier } = this;
        //     let { bearing } = this;
        //     const { abs, max, min, PI, sin, cos } = Math;
        //     const zScale = max(this.zoom_scale(), 1);
        //     const tileScale = tile_size / 512;
        //     const isS2 = projection === 'S2';
        //     // setup multipliers
        //     if (multiplier_x === undefined) multiplier_x = multiplier * (isS2 ? 6.5 * 360 : 0.75);
        //     if (multiplier_y === undefined) multiplier_y = multiplier * (isS2 ? 6.5 * 180 : 0.75);
        //     if (!isS2) {
        //       multiplier_x *= tileScale;
        //       multiplier_y *= tileScale;
        //     }
        //     // adjust movement vector if bearing
        //     if (bearing !== 0) {
        //       bearing = degToRad(bearing); // adjust to radians
        //       const tmpY = movement_x * sin(bearing) + movement_y * cos(bearing);
        //       movement_x = movement_x * cos(bearing) - movement_y * sin(bearing);
        //       movement_y = tmpY;
        //     }

        //     // set the new lon-lat
        //     if (isS2) {
        //       // https://math.stackexchange.com/questions/377445/given-a-latitude-how-many-miles-is-the-corresponding-longitude
        //       const lonMultiplier = min(30, 1 / cos((abs(lat) * PI) / 180));
        //       this.set_view({
        //         lon: lon - (movement_x / (multiplier_x * zScale)) * 360 * lonMultiplier,
        //         lat: lat + (movement_y / (multiplier_y * zScale)) * 180,
        //       });
        //     } else {
        //       this.set_view({
        //         lon: lon - movement_x / (multiplier_x * zScale),
        //         lat: lat + movement_y / (multiplier_y * zScale * mercatorLatScale(lat)),
        //       });
        //     }
        todo!()
    }

    //   /**
    //    * Get the lon-lat based on the mouse position
    //    * x and y are the distances from the center of the screen
    //    * @param xOffset - x offset
    //    * @param yOffset - y offset
    //    * @returns longitude and latitude at the mouse position
    //    */
    //   cursorToLonLat(xOffset: number, yOffset: number): undefined | VectorPoint {
    //     const { projection, lon, lat, zoom, tile_size, multiplier } = this;
    //     if (projection === 'S2')
    //       return cursorToLonLatS2(lon, lat, xOffset, yOffset, (tile_size * Math.pow(2, zoom)) / 2);
    //     return cursorToLonLatWM(lon, lat, xOffset, yOffset, zoom, tile_size / multiplier);
    //   }

    //   /**
    //    * Get the matrix for either a global state (S2) or a specific tile (WM)
    //    * - S2 -> type of meters or kilometers
    //    * - WM -> scale and offset
    //    * @param typeOrScale - type or scale
    //    * @param offset - offset in pixels
    //    * @returns the matrix
    //    */
    //   getMatrix(typeOrScale: number | MatrixType, offset: VectorPoint = { x: 0, y: 0 }): Float32Array {
    //     if (typeof typeOrScale === 'number') {
    //       // WM case
    //       const matrix = this.#getMatrixWM(typeOrScale, offset);
    //       return mat4.clone(matrix);
    //     }
    //     // S2
    //     let matrix = this.matrices[typeOrScale];
    //     if (matrix !== undefined) return mat4.clone(matrix);
    //     // updated matrix
    //     matrix = this.matrices[typeOrScale] = this.#getMatrixS2(typeOrScale);

    //     return mat4.clone(matrix);
    //   }

    //   /** @returns the tiles in this projector's current view */
    //   getTilesInView(): TileInView[] {
    //     const { projection, radius, zoom, zoom_offset, lon, lat } = this;
    //     if (projection === 'S2') {
    //       const matrix = this.getMatrix('m');
    //       return getTilesInViewS2(zoom + zoom_offset, lon, lat, matrix, radius);
    //     }
    //     return getTilesInViewWM(zoom + zoom_offset, lon, lat, this);
    //   }

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
        // const { projection, radius, zoom_offset } = this;
        // if (projection === 'S2') {
        //   const matrix = this.#getMatrixS2('m', false, lon, lat, zoom, bearing, pitch);
        //   return getTilesInViewS2(zoom + zoom_offset, lon, lat, matrix, radius);
        // }
        // // TODO: bearing and pitch without editing the projection?
        // return getTilesInViewWM(zoom + zoom_offset, lon, lat, this);
        todo!()
    }

    //   /* INTERNAL FUNCTIONS */
    //   /**
    //    * Handles moving the camera. Update state for the GPU
    //    * @param movement_x - the change in x position
    //    * @param movement_y - the change in y position
    //    */
    //   #setMove(movement_x: number, movement_y: number): void {
    //     const { view, aspect } = this;
    //     const maxValue = 2 ** 11;
    //     const midValue = 2 ** 10;
    //     view[10] -= movement_x / aspect.x;
    //     view[11] += movement_y / aspect.y;
    //     // if we ever hit the min-max values, we reset to the middle
    //     if (view[10] < 0 || view[10] > maxValue) view[10] = midValue;
    //     if (view[11] < 0 || view[11] > maxValue) view[11] = midValue;
    //   }

    //   /**
    //    * Update the view
    //    * @param view - the new view
    //    */
    //   #set_view(view: Required<View>): void {
    //     // clamp the view based upon the current settings
    //     this.#clampView(view);
    //     // update if any changes found:
    //     const { zoom, lon, lat, bearing, pitch } = view;
    //     const bearingPitchChange = this.bearing !== bearing || this.pitch !== pitch;
    //     if (
    //       // zoom change?
    //       this.zoom !== zoom ||
    //       this.prev_zoom !== zoom ||
    //       // lon-lat change?
    //       this.lon !== lon ||
    //       this.lat !== lat ||
    //       // bearing or pitch change?
    //       bearingPitchChange
    //     ) {
    //       // keep track of the old zoom and adjust the zoom
    //       this.prev_zoom = this.zoom;
    //       this.zoom = zoom;
    //       // adjust the lon-lat
    //       this.lon = lon;
    //       this.lat = lat;
    //       // adjust the bearing and pitch
    //       this.bearing = bearing;
    //       this.pitch = pitch;
    //       // update view
    //       this.view[0] = this.zoom;
    //       this.view[1] = this.lon;
    //       this.view[2] = this.lat;
    //       this.view[3] = this.bearing;
    //       this.view[4] = this.pitch;
    //       // if bearing or pitch change we let the map know
    //       if (bearingPitchChange) this.camera._updateCompass(this.bearing, this.pitch);
    //       // cleanup for next render
    //       this.reset();
    //     }
    //   }

    //   /**
    //    * Clamp the view
    //    * @param view - the new view
    //    */
    //   #clampView(view: Required<View>): void {
    //     const { no_clamp, constrain_zoom_to_fill, projection } = this;
    //     // adjust zoom
    //     this.#clampZoom(view);
    //     // adjust lon-lat
    //     if (!no_clamp) {
    //       view.lon = this.#clampDeg(view.lon);
    //       this.#clampLat(view);
    //     }
    //     // adjust bearing
    //     view.bearing = this.#clampDeg(view.bearing);
    //     // adjust view if constrained to fill
    //     if (projection === 'WM' && constrain_zoom_to_fill) this.#clampConstraint(view);
    //   }

    //   /**
    //    * Clamp the zoom
    //    * @param view - the new view
    //    */
    //   #clampZoom(view: Required<View>): void {
    //     const { minzoom, maxzoom } = this;
    //     view.zoom = Math.max(Math.min(view.zoom, maxzoom), minzoom);
    //   }

    //   /**
    //    * Clamp the latitude
    //    * @param view - the new view
    //    */
    //   #clampLat(view: Required<View>): void {
    //     const { max_lat_position, min_lat_position, zoom } = this;
    //     const { min, max } = Math;
    //     // prep current boundaries
    //     const latPosDiff = max_lat_position - min_lat_position;
    //     const curMaxLat = min(
    //       min_lat_position + min(latPosDiff, (latPosDiff / 3) * zoom),
    //       max_lat_position,
    //     );
    //     // clamp
    //     view.lat = max(min(curMaxLat, view.lat), -curMaxLat);
    //   }

    //   /**
    //    * Clamp the view by the constraints provided by the projection and/or user style settings
    //    * @param view - the new view
    //    */
    //   #clampConstraint(view: Required<View>): void {
    //     const { aspect, tile_size } = this;
    //     // if tile_size relative to zoom is smaller than aspect, we adjust zoom
    //     if (tile_size * Math.pow(2, view.zoom) < aspect.y) view.zoom = Math.log2(aspect.y / tile_size);
    //     // now that we have the min zoom, we can adjust the latitude to ensure the view is within bounds
    //     const worldSize = tile_size * Math.pow(2, view.zoom);
    //     const center = worldSize / 2;
    //     const worldMinusAspectHalfed = (worldSize - aspect.y) / 2;
    //     const { y: maxLat } = pxToLL({ x: 0, y: center - worldMinusAspectHalfed }, view.zoom, tile_size);
    //     const { y: minLat } = pxToLL({ x: 0, y: center + worldMinusAspectHalfed }, view.zoom, tile_size);
    //     view.lat = Math.min(maxLat, Math.max(minLat, view.lat));
    //   }

    //   /**
    //    * Clamp longitude and bearing between [-180,180]
    //    * @param input - the longitude
    //    * @returns clamped longitude
    //    */
    //   #clampDeg(input: number): number {
    //     while (input >= 180) input -= 360;
    //     while (input < -180) input += 360;
    //     return input;
    //   }

    //   /* S2 */
    //   /**
    //    * Get the matrix for the S2 projection
    //    * @param type - the matrix type (meters or kilometers)
    //    * @param updateEye - whether to update the eye
    //    * @param lon - longitude
    //    * @param lat - latitude
    //    * @param zoom - zoom
    //    * @param bearing - bearing
    //    * @param _pitch - pitch
    //    * @returns S2 matrix
    //    */
    //   #getMatrixS2(
    //     type: MatrixType,
    //     updateEye = true,
    //     lon: number = this.lon,
    //     lat: number = this.lat,
    //     zoom: number = this.zoom,
    //     bearing: number = this.bearing,
    //     _pitch: number = this.pitch,
    //   ): Float32Array {
    //     // update eye
    //     const eye = this.#updateEyeS2(lon, lat, zoom, updateEye);
    //     // get projection matrix
    //     let matrix = this.#getProjectionMatrixS2(type, zoom);
    //     // create view matrix
    //     const view = mat4.lookAt(eye, { x: 0, y: lat > 90 || lat < -90 ? -1 : 1, z: 0 });
    //     // adjust by bearing
    //     if (bearing !== 0) mat4.rotateZ(matrix, degToRad(bearing));
    //     // if km we "remove" the eye
    //     if (type === 'km') {
    //       view[12] = 0;
    //       view[13] = 0;
    //       view[14] = 0;
    //     }
    //     // multiply projection matrix by view matrix
    //     matrix = mat4.multiply(matrix, view);

    //     return matrix;
    //   }

    //   /**
    //    * Update the eye position given a longitude, latitude and zoom
    //    * @param lon - longitude
    //    * @param lat - latitude
    //    * @param zoom - zoom
    //    * @param update - whether to update the eye. If false, we only needed the resultant eye for other computations
    //    * @returns new eye
    //    */
    //   #updateEyeS2(lon: number, lat: number, zoom: number, update = true): VectorPoint {
    //     const { radius, z_translate_end, z_translate_start, zoom_end } = this;
    //     // find radial distance from core of ellipsoid
    //     const radialMultiplier =
    //       Math.max(
    //         ((z_translate_end - z_translate_start) / zoom_end) * zoom + z_translate_start,
    //         z_translate_end,
    //       ) * radius;
    //     // create xyz point for eye
    //     const eye = pointMulScalar(
    //       pointNormalize(pointFromLonLatGL({ x: lon, y: lat })),
    //       radialMultiplier,
    //     );
    //     if (update) this.eye = eye;

    //     return eye;
    //   }

    //   /**
    //    * Get the S2 projection matrix
    //    * @param type - the matrix type (meters or kilometers)
    //    * @param zoom - zoom
    //    * @returns S2 projection matrix
    //    */
    //   #getProjectionMatrixS2(type: MatrixType, zoom: number = this.zoom): Float32Array {
    //     const { aspect, tile_size, multiplier } = this;
    //     let radius = this.radius;
    //     // prep a matrix
    //     const matrix = mat4.create();

    //     // BLEND LOOKS A BIT DIFF const multpl = -radius / multiplier / (tile_size * scale * radius * 5)
    //     if (type === 'km') radius *= 1000;
    //     const multpl = radius / multiplier / (tile_size * Math.pow(2, zoom));

    //     // create projection
    //     mat4.ortho(matrix, aspect.x * multpl, aspect.y * multpl, 100_000);

    //     return matrix;
    //   }

    //   /* WM */
    //   /**
    //    * Get the matrix for the WM projection
    //    * @param scale - scale shift
    //    * @param offset - offset
    //    * @param bearing - bearing
    //    * @param _pitch - pitch
    //    * @returns WM matrix
    //    */
    //   #getMatrixWM(
    //     scale: number,
    //     offset: VectorPoint,
    //     bearing: number = this.bearing,
    //     _pitch: number = this.pitch,
    //   ): Float32Array {
    //     const { x: offsetX, y: offsetY } = offset;
    //     // get projection matrix
    //     let matrix = this.#getProjectionMatrixWM(scale);
    //     // create view matrix
    //     const view = mat4.lookAt({ x: 0, y: 0, z: -1 }, { x: 0, y: -1, z: 0 });
    //     // adjust by bearing
    //     if (bearing !== 0) mat4.rotateZ(matrix, degToRad(bearing));
    //     // multiply projection matrix by view matrix
    //     matrix = mat4.multiply(matrix, view);

    //     // adjust by position
    //     mat4.translate(matrix, [-offsetX, -offsetY, 0]);

    //     return matrix;
    //   }

    //   /**
    //    * Get the WM projection matrix
    //    * @param scale - scale shift
    //    * @returns WM projection matrix
    //    */
    //   #getProjectionMatrixWM(scale: number): Float32Array {
    //     const { aspect, tile_size, multiplier } = this;
    //     // prep a matrix
    //     const matrix = mat4.create();
    //     // adjust aspect ratio by zoom
    //     const multpl = 1 / multiplier / (tile_size * scale);
    //     // create projection
    //     mat4.ortho(matrix, aspect.x * multpl, aspect.y * multpl, 1_000);

    //     return matrix;
    //   }
}

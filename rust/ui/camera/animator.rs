use crate::ui::{Camera, Projector, RequiredView, TileID, TileInView, Vec4};
use alloc::{
    collections::{btree_map::BTreeMap, btree_set::BTreeSet, vec_deque::VecDeque},
    vec,
    vec::Vec,
};
use core::f64::consts::LN_2;
use gistools::tools::Orthodrome;
use libm::{cosh, exp, fabs, fmax, log, pow, round, sinh, sqrt, tanh};
use s2json::Point;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TileBatch {
    pub low: f64,
    pub high: f64,
    pub pos: f64,
    pub tiles: Vec<TileInView>,
}

/// Easing function
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AnimationEase {
    /// Linear
    #[serde(rename = "linear")]
    #[default]
    Linear,
    /// Ease In
    #[serde(rename = "ease-in")]
    EaseIn,
    /// Ease Out
    #[serde(rename = "ease-out")]
    EaseOut,
    /// Ease In Out
    #[serde(rename = "ease-in-out")]
    EaseInOut,
}
impl From<AnimationEase> for fn(time: f64, start: f64, delta: f64, duration: f64) -> f64 {
    fn from(ease: AnimationEase) -> fn(time: f64, start: f64, delta: f64, duration: f64) -> f64 {
        match ease {
            AnimationEase::Linear => ease_linear,
            AnimationEase::EaseIn => ease_in_expo,
            AnimationEase::EaseOut => ease_out_expo,
            AnimationEase::EaseInOut => ease_in_out_expo,
        }
    }
}
/// Animation directions object
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct AnimationDirections {
    /// Longitude
    pub lon: Option<f64>,
    /// Latitude
    pub lat: Option<f64>,
    /// Zoom
    pub zoom: Option<f64>,
    /// bearing
    pub bearing: Option<f64>,
    /// Pitch
    pub pitch: Option<f64>,
    /// Iteration speed in ms
    pub speed: Option<f64>,
    /// Animation duration
    pub duration: Option<f64>,
    /// Easing function
    pub easing: Option<AnimationEase>,
}
/// Animation type
#[derive(Debug, Default, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AnimationType {
    /// Ease into the desired location
    #[serde(rename = "easeTo")]
    #[default]
    EaseTo,
    /// Fly to the desired location
    #[serde(rename = "flyTo")]
    FlyTo,
}
/// Increment State Response
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct IncrementResponse {
    pub finished: bool,
    pub position: RequiredView,
}

/// Animation Increment tool
pub trait AnimationIncrementor {
    /// Handles animation increment given the animator store and current time
    fn increment(&self, time: f64, animator: &Animator, camera: &mut Camera) -> IncrementResponse;
}

#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum AnimationContainer {
    ZoomTo(ZoomTo),
    EaseTo(EaseTo),
    CompassTo(CompassTo),
    SwipeTo(SwipeTo),
    FlyTo(FlyTo),
}
impl AnimationIncrementor for AnimationContainer {
    fn increment(&self, time: f64, animator: &Animator, camera: &mut Camera) -> IncrementResponse {
        match self {
            AnimationContainer::ZoomTo(zoom) => zoom.increment(time, animator, camera),
            AnimationContainer::EaseTo(ease) => ease.increment(time, animator, camera),
            AnimationContainer::CompassTo(compass) => compass.increment(time, animator, camera),
            AnimationContainer::SwipeTo(swipe) => swipe.increment(time, animator, camera),
            AnimationContainer::FlyTo(fly) => fly.increment(time, animator, camera),
        }
    }
}

/// Animator class handles user defined animations of the camera.
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct Animator {
    pub start_time: Option<f64>,
    pub start_lon: f64,
    pub start_lat: f64,
    pub start_zoom: f64,
    pub start_bearing: f64,
    pub start_pitch: f64,
    pub end_lon: f64,
    pub end_lat: f64,
    pub end_zoom: f64,
    pub end_bearing: f64,
    pub end_pitch: f64,
    pub delta_lon: f64,
    pub delta_lat: f64,
    pub delta_zoom: f64,
    pub delta_bearing: f64,
    pub delta_pitch: f64,
    pub speed: f64,
    pub duration: f64,
    pub future_offset: u64,
    pub future_tiles: BTreeMap<u64, Vec<TileInView>>, // { timeKey: [tileID] }
    pub future_keys: VecDeque<u64>,
    pub easing: AnimationEase,
    animator: Option<AnimationContainer>,
}
impl Animator {
    /**
     * @param projector - projection state
     * @param directions - Animation directions guide
     */
    pub fn new(projector: &Projector, directions: Option<AnimationDirections>) -> Self {
        let directions = directions.unwrap_or_default();
        // pull in variables
        let lon = directions.lon.unwrap_or(projector.lon);
        let lat = directions.lat.unwrap_or(projector.lat);
        let zoom = directions.zoom.unwrap_or(projector.zoom);
        let bearing = directions.bearing.unwrap_or(projector.bearing);
        let pitch = directions.pitch.unwrap_or(projector.pitch);

        Self {
            start_time: None,
            start_lon: projector.lon,
            start_lat: projector.lat,
            start_zoom: projector.zoom,
            start_bearing: projector.bearing,
            start_pitch: projector.pitch,
            end_lon: lon,
            end_lat: lat,
            end_zoom: zoom,
            end_bearing: bearing,
            end_pitch: pitch,
            delta_lon: lon - projector.lon,
            delta_lat: lat - projector.lat,
            delta_zoom: zoom - projector.zoom,
            delta_bearing: bearing - projector.bearing,
            delta_pitch: pitch - projector.pitch,
            easing: directions.easing.unwrap_or_default(),
            duration: directions.duration.unwrap_or(2.5),
            speed: directions.speed.unwrap_or(0.0),
            future_offset: 0,
            future_tiles: BTreeMap::new(),
            future_keys: VecDeque::new(),
            animator: None,
        }
    }

    /// Updates the position based upon time. returns whether complete or not.
    ///
    /// ## Parameters
    /// - `time`: current time
    ///
    /// ## Returns
    /// true if the animation was built successfully
    pub fn increment(&mut self, time: f64, camera: &mut Camera) -> bool {
        // corner case: increment was never setup
        if self.animator.is_none() {
            return true;
        }
        // if current time is greater than or equal to the latest future_keys, send off a request to preload tiles
        if (self.future_keys[0] - self.future_offset) as f64 <= time {
            self.request_future_tiles(camera);
        }
        // build the new lon, lat, zoom, bearing, pitch
        let IncrementResponse { finished, position } = self._increment(time, camera);
        // update the projector
        camera.projector.set_view(position.into());
        // return if time has passed or we are finished
        finished || time - self.start_time.unwrap() >= self.duration
    }

    /// Internal incrementer; Gets the response itself
    fn _increment(&mut self, time: f64, camera: &mut Camera) -> IncrementResponse {
        // corner case: increment was never setup
        if self.animator.is_none() {
            return IncrementResponse { finished: true, position: (&camera.projector).into() };
        }
        // setup time should it not exist yet
        if self.start_time.is_none() {
            self.start_time = Some(time);
        }
        let start_time = self.start_time.unwrap();
        // build the new lon, lat, zoom, bearing, pitch
        let func = self.animator.as_ref().unwrap();
        func.increment(time - start_time, self, camera)
    }

    /// Handles zoom animations.
    pub fn zoom_to(&mut self, camera: &mut Camera) {
        self.animator = Some(AnimationContainer::ZoomTo(ZoomTo {}));
        self.build_future_tile_list(camera);
    }

    /// Handles rotation animations.
    pub fn compass_to(&mut self, camera: &mut Camera) {
        self.animator = Some(AnimationContainer::CompassTo(CompassTo {}));
        self.build_future_tile_list(camera);
    }

    /// Handles swiping animations.
    ///
    /// - `movement_x`: swipe change in the x direction
    /// - `movement_y`: swipe change in the y direction
    pub fn swipe_to(&mut self, movement_x: f64, movement_y: f64, camera: &mut Camera) {
        self.animator = Some(AnimationContainer::SwipeTo(SwipeTo::new(movement_x, movement_y)));
        self.build_future_tile_list(camera);
    }

    /// Handles easing mechanic
    ///
    /// ## Returns
    /// true if the animation was built successfully
    pub fn ease_to(&mut self, camera: &mut Camera) -> bool {
        if self.start_lat == self.end_lat
            && self.start_lon == self.end_lon
            && self.start_zoom == self.end_zoom
            && self.start_bearing == self.end_bearing
            && self.start_pitch == self.end_pitch
        {
            return false;
        }
        self.animator = Some(AnimationContainer::EaseTo(EaseTo::new(self)));
        self.build_future_tile_list(camera);

        true
    }

    /// Handles flying animation with both panning and zooming combined.
    /// Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
    /// ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
    ///
    /// ## Returns
    /// true if a fly_to animation is built successfully
    pub fn fly_to(&mut self, camera: &mut Camera) -> bool {
        if self.start_lat == self.end_lat
            && self.start_lon == self.end_lon
            && self.start_zoom == self.end_zoom
            && self.start_bearing == self.end_bearing
            && self.start_pitch == self.end_pitch
        {
            return false;
        }
        self.animator = Some(AnimationContainer::FlyTo(FlyTo::new(self, &camera.projector)));
        self.build_future_tile_list(camera);

        true
    }

    /// Internal function to early request tiles we know we will need
    fn build_future_tile_list(&mut self, camera: &mut Camera) {
        let Self { end_lon, end_lat, end_zoom, end_bearing, end_pitch, duration, .. } = *self;
        let mut tile_set: BTreeSet<TileID> =
            camera.get_tiles().iter().map(|tile| tile.id).collect();
        let mut new_tiles = BTreeMap::new();
        let mut tiles_found;
        // [low: number, high: number, pos: number, tiles: TileInView[]]
        let mid_pos = self._increment(duration / 2., camera).position;
        let mut batch: VecDeque<TileBatch> = VecDeque::from([
            TileBatch {
                low: 0.,
                high: duration,
                pos: duration,
                tiles: camera.projector.get_tiles_at_position(
                    (RequiredView {
                        lon: end_lon,
                        lat: end_lat,
                        zoom: end_zoom,
                        bearing: end_bearing,
                        pitch: end_pitch,
                    })
                    .into(),
                ),
            },
            TileBatch {
                low: 0.,
                high: duration,
                pos: duration / 2.,
                tiles: camera.projector.get_tiles_at_position(mid_pos.into()),
            },
        ]);
        // keep diving / spliting while tested tiles are not equal to
        while let Some(tile_batch) = batch.pop_front() {
            // reset checker
            tiles_found = false;
            // pull in a batch check
            let TileBatch { low, high, pos, tiles } = tile_batch;
            // store any new tiles and track if any of them new
            for tile in tiles {
                if !tile_set.contains(&tile.id) {
                    tile_set.insert(tile.id);
                    let pos_u64 = round(pos) as u64;
                    if !new_tiles.contains_key(&pos_u64) {
                        new_tiles.insert(pos_u64, vec![tile]);
                    }
                    tiles_found = true;
                }
            }
            // if "tiles_found" than test midpoint positions
            if tiles_found && pos != duration {
                let low_pos_half = (low + pos) / 2.;
                let pos_high_half = (pos + high) / 2.;
                let low_pos = self._increment(low_pos_half, camera).position;
                let pos_high = self._increment(pos_high_half, camera).position;
                batch.push_back(TileBatch {
                    low,
                    high: pos,
                    pos: low_pos_half,
                    tiles: camera.projector.get_tiles_at_position(low_pos.into()),
                });
                batch.push_back(TileBatch {
                    low: pos,
                    high,
                    pos: pos_high_half,
                    tiles: camera.projector.get_tiles_at_position(pos_high.into()),
                });
            }
        }
        // store keys
        let mut tiles: Vec<u64> = new_tiles.keys().cloned().collect();
        tiles.sort();
        self.future_keys = VecDeque::from(tiles);
        self.future_offset = self.future_keys[0];
        // store tiles
        self.future_tiles = new_tiles;
        // pre-request the first three tile sets
        for _ in 0..3 {
            self.request_future_tiles(camera);
        }
        todo!()
    }

    /// Request future tiles
    fn request_future_tiles(&mut self, camera: &mut Camera) {
        if self.future_keys.len() == 0 || self.future_keys.is_empty() {
            return;
        }
        // get a key && pull in the tiles
        if let Some(key) = self.future_keys.pop_front()
            && let Some(tiles) = self.future_tiles.get(&key)
        {
            // make a request
            camera.create_future_tiles(tiles);
            // cleanup now uneaded tile reference
            self.future_tiles.remove(&key);
        }
    }
}

/// Zoom To Animation mechanics
#[derive(Debug, Clone)]
pub struct ZoomTo {}
impl AnimationIncrementor for ZoomTo {
    fn increment(&self, time: f64, animator: &Animator, _camera: &mut Camera) -> IncrementResponse {
        let Animator {
            start_lon,
            start_lat,
            start_zoom,
            delta_lon,
            delta_lat,
            delta_zoom,
            end_lon,
            end_lat,
            end_zoom,
            end_bearing,
            end_pitch,
            duration,
            ..
        } = *animator;
        if time >= duration {
            IncrementResponse {
                finished: true,
                position: RequiredView {
                    lon: end_lon,
                    lat: end_lat,
                    zoom: end_zoom,
                    bearing: end_bearing,
                    pitch: end_pitch,
                },
            }
        } else {
            IncrementResponse {
                finished: false,
                position: RequiredView {
                    lon: ease_out_expo(time, start_lon, delta_lon, duration),
                    lat: ease_out_expo(time, start_lat, delta_lat, duration),
                    zoom: ease_out_expo(time, start_zoom, delta_zoom, duration),
                    bearing: end_bearing,
                    pitch: end_pitch,
                },
            }
        }
    }
}

/// Ease To Animation mechanics
#[derive(Debug, Clone)]
pub struct EaseTo {
    orthodrome: Orthodrome,
    ease: fn(time: f64, start: f64, delta: f64, duration: f64) -> f64,
}
impl EaseTo {
    /// Create a new ease animator
    pub fn new(animator: &Animator) -> Self {
        let Animator { start_lon, start_lat, end_lon, end_lat, .. } = *animator;
        let orthodrome = Orthodrome::new(start_lon, start_lat, end_lon, end_lat);

        Self { orthodrome, ease: animator.easing.into() }
    }
}
impl AnimationIncrementor for EaseTo {
    fn increment(&self, time: f64, animator: &Animator, _camera: &mut Camera) -> IncrementResponse {
        let Animator {
            start_zoom,
            start_bearing,
            start_pitch,
            delta_zoom,
            delta_bearing,
            delta_pitch,
            end_lon,
            end_lat,
            end_zoom,
            end_bearing,
            end_pitch,
            duration,
            ..
        } = *animator;
        if time >= duration {
            IncrementResponse {
                finished: true,
                position: RequiredView {
                    lon: end_lon,
                    lat: end_lat,
                    zoom: end_zoom,
                    bearing: end_bearing,
                    pitch: end_pitch,
                },
            }
        } else {
            let Point(lon, lat) =
                self.orthodrome.intermediate_point((self.ease)(time, 0., 1., duration));
            IncrementResponse {
                finished: false,
                position: RequiredView {
                    lon,
                    lat,
                    zoom: (self.ease)(time, start_zoom, delta_zoom, duration),
                    bearing: (self.ease)(time, start_bearing, delta_bearing, duration),
                    pitch: (self.ease)(time, start_pitch, delta_pitch, duration),
                },
            }
        }
    }
}

/// Zoom To Animation mechanics
#[derive(Debug, Clone)]
pub struct CompassTo {}
impl AnimationIncrementor for CompassTo {
    fn increment(&self, time: f64, animator: &Animator, _camera: &mut Camera) -> IncrementResponse {
        let Animator {
            start_bearing,
            start_pitch,
            delta_bearing,
            delta_pitch,
            end_lon,
            end_lat,
            end_zoom,
            end_bearing,
            end_pitch,
            duration,
            ..
        } = *animator;
        if time >= duration {
            IncrementResponse {
                finished: true,
                position: RequiredView {
                    lon: end_lon,
                    lat: end_lat,
                    zoom: end_zoom,
                    bearing: end_bearing,
                    pitch: end_pitch,
                },
            }
        } else {
            IncrementResponse {
                finished: false,
                position: RequiredView {
                    lon: end_lon,
                    lat: end_lat,
                    zoom: end_zoom,
                    bearing: ease_out_expo(time, start_bearing, delta_bearing, duration),
                    pitch: ease_out_expo(time, start_pitch, delta_pitch, duration),
                },
            }
        }
    }
}

/// Swipe To Animation mechanics
#[derive(Debug, Clone)]
pub struct SwipeTo {
    movement_x: f64,
    movement_y: f64,
}
impl SwipeTo {
    /// Create a new ease animator
    pub fn new(movement_x: f64, movement_y: f64) -> Self {
        Self { movement_x, movement_y }
    }
}
impl AnimationIncrementor for SwipeTo {
    fn increment(&self, time: f64, animator: &Animator, camera: &mut Camera) -> IncrementResponse {
        let Animator { duration, .. } = *animator;
        let new_movement_x = ease_in_expo(duration - time, 0., self.movement_x, duration);
        let new_movement_y = ease_in_expo(duration - time, 0., self.movement_y, duration);
        if fabs(new_movement_x) <= 0.5 && fabs(new_movement_y) <= 0.5 {
            IncrementResponse { finished: true, position: (&camera.projector).into() }
        } else {
            camera.projector.on_move(Some(new_movement_x), Some(new_movement_y), None, None);
            IncrementResponse { finished: false, position: (&camera.projector).into() }
        }
    }
}

const RHO: f64 = 1.42; // curve
const RHO_2: f64 = RHO * RHO; // ρ²

/// Fly To Animation mechanics
#[derive(Debug, Clone)]
pub struct FlyTo {
    orthodrome: Orthodrome,
    ease: fn(time: f64, start: f64, delta: f64, duration: f64) -> f64,
    w0: f64,
    w1: f64,
    u1: f64,
    k: f64,
    // post creation computes
    eq_u: bool,
    r0: f64,
    _s: f64,
}
impl FlyTo {
    /// Create a new ease animator
    pub fn new(animator: &mut Animator, projector: &Projector) -> Self {
        let Animator {
            start_lon, start_lat, end_lon, end_lat, easing, end_zoom, start_zoom, ..
        } = *animator;
        // setup variables
        let orthodrome = Orthodrome::new(start_lon, start_lat, end_lon, end_lat);
        let scale = projector.zoom_scale(Some(end_zoom - start_zoom));

        // w₀: Initial visible span, measured in pixels at the initial scale.
        let Vec4([width, height, _, _]) = projector.aspect;
        let w0 = fmax(width as f64, height as f64);
        // w₁: Final visible span, measured in pixels with respect to the initial scale.
        let w1 = w0 / scale;
        // Length of the flight path as projected onto the ground plane, measured in pixels from
        // the world image origin at the initial scale.
        // degToRad(45) * projector.radius * 1000
        // 360deg = 2_048 (512 * 4) pixels at 0 zoom = 40_030_228.88407185 (2 * Math.PI * 6_371_008.8) (circumference) meters
        // so 40_030_228.88407185 / 2_048 = 19_546.010197300708meters/pixel
        let distance_meters = projector.radius * 1_000. * orthodrome.distance_to();
        let u1 = (distance_meters / 19_546.010197300708) * projector.zoom_scale(Some(start_zoom));
        let ease = easing.into();
        let k = if w1 < w0 { -1. } else { 1. };
        let mut this = Self { orthodrome, ease, w0, w1, u1, r0: 0., _s: 0., k, eq_u: false };

        // post creation computes

        // r₀: Zoom-out factor during ascent.
        this.r0 = this.r(0.);
        // S: Total length of the flight path, measured in ρ-screenfuls.
        this._s = (this.r(1.) - this.r0) / RHO;
        // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
        if fabs(u1) < 0.000001 || !this._s.is_finite() {
            this.eq_u = true;
            // TODO: Perform a more or less instantaneous transition if the path is too short.
            //   if (abs(w0 - w1) < 0.000001) {
            //     return this.easeTo();
            //   }
            // otherwise adjust S, u & w
            this._s = fabs(log(w1 / w0)) / RHO;
        }
        // adjust duration if speed is provided
        if animator.speed != 0. {
            animator.duration = this._s / animator.speed;
        }

        this
    }
}
impl AnimationIncrementor for FlyTo {
    fn increment(&self, time: f64, animator: &Animator, _camera: &mut Camera) -> IncrementResponse {
        let Animator {
            start_zoom,
            start_bearing,
            start_pitch,
            delta_bearing,
            delta_pitch,
            end_lon,
            end_lat,
            end_zoom,
            end_bearing,
            end_pitch,
            duration,
            ..
        } = *animator;
        if time >= duration {
            IncrementResponse {
                finished: true,
                position: RequiredView {
                    lon: end_lon,
                    lat: end_lat,
                    zoom: end_zoom,
                    bearing: end_bearing,
                    pitch: end_pitch,
                },
            }
        } else {
            let s = (time / duration) * self._s;
            let u_s = self.u(s);
            let cur_scale = 1. / self.w(s);
            let Point(lon, lat) = self.orthodrome.intermediate_point(u_s);
            IncrementResponse {
                finished: false,
                position: RequiredView {
                    lon,
                    lat,
                    zoom: start_zoom + log(cur_scale) / LN_2,
                    bearing: (self.ease)(time, start_bearing, delta_bearing, duration),
                    pitch: (self.ease)(time, start_pitch, delta_pitch, duration),
                },
            }
        }
    }
}
impl FlyTo {
    /**
     * rᵢ: Returns the zoom-out factor at one end of the animation.
     * i 0 for the ascent or 1 for the descent.
     * @param i - input ascent
     * @returns r(i)
     */
    pub fn r(&self, i: f64) -> f64 {
        let Self { w0, w1, u1, .. } = *self;
        let b = (w1 * w1 - w0 * w0 + (if i != 0. { -1. } else { 1. }) * RHO_2 * RHO_2 * u1 * u1)
            / (2. * (if i != 0. { w1 } else { w0 }) * RHO_2 * u1);
        log(sqrt(b * b + 1.) - b)
    }

    /**
     * w(s): Returns the visible span on the ground, measured in pixels with respect to the
     * initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
     * @param s - input scale
     * @returns w(s)
     */
    pub fn w(&self, s: f64) -> f64 {
        if self.eq_u { exp(self.k * RHO * s) } else { cosh(self.r0) / cosh(self.r0 + RHO * s) }
    }
    /**
     * u(s): Returns the distance along the flight path as projected onto the ground plane,
     * measured in pixels from the world image origin at the initial scale.
     * @param s - input scale
     * @returns u(s)
     */
    pub fn u(&self, s: f64) -> f64 {
        if self.eq_u {
            0.
        } else {
            (self.w0 * ((cosh(self.r0) * tanh(self.r0 + RHO * s) - sinh(self.r0)) / RHO_2))
                / self.u1
        }
    }
}

// https://spicyyoghurt.com/tools/easing-functions

/// Linear Ease function
///
/// ## Parameters
/// - `time`: current time
/// - `start`: start time
/// - `delta`: change in time
/// - `duration`: duration
///
/// ## Returns
/// interpolated position
fn ease_linear(time: f64, start: f64, delta: f64, duration: f64) -> f64 {
    (delta * time) / duration + start
}

/// Exponential Ease function
///
/// ## Parameters
/// - `time`: current time
/// - `start`: start time
/// - `delta`: change in time
/// - `duration`: duration
///
/// ## Returns
/// interpolated position
fn ease_in_expo(time: f64, start: f64, delta: f64, duration: f64) -> f64 {
    if time == 0. { start } else { delta * pow(2., 10. * (time / duration - 1.)) + start }
}

/// Ease Out function
///
/// ## Parameters
/// - `time`: current time
/// - `start`: start time
/// - `delta`: change in time
/// - `duration`: duration
///
/// ## Returns
/// interpolated position
fn ease_out_expo(time: f64, start: f64, delta: f64, duration: f64) -> f64 {
    delta * (-pow(2., (-10. * time) / duration) + 1.) + start
}

/// Ease In Out function
///
/// ## Parameters
/// - `time`: current time
/// - `start`: start time
/// - `delta`: change in time
/// - `duration`: duration
///
/// ## Returns
/// interpolated position
fn ease_in_out_expo(time: f64, start: f64, delta: f64, duration: f64) -> f64 {
    if time == 0.0 {
        return start;
    }
    let mut t = time / (duration / 2.0);
    if t < 1.0 {
        return (delta / 2.0) * f64::powf(2.0, 10.0 * (t - 1.0)) + start;
    }
    t -= 1.0;
    (delta / 2.0) * (-f64::powf(2.0, -10.0 * t) + 2.0) + start
}

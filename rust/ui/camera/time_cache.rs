use crate::{
    render::SensorSource,
    style::TimeSeriesStyle,
    ui::{Cache, Camera},
    util::MsgSender,
    workers::MapGLMessage,
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use gistools::{geometry::S2CellId, util::Date};
use libm::floor;

/// Tracker for time sources
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct TimeSource {
    pub step: f64,
    pub interval: f64,
}
/**
 * Animation states
 * play -> animation based upon start_time -> end_time using cursor
 * pause -> running through pause duration
 * stop -> do nothing
 */
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum TimeLayerState {
    Play,
    Pause,
    Stop,
}
impl From<&str> for TimeLayerState {
    fn from(s: &str) -> Self {
        match s {
            "play" => TimeLayerState::Play,
            "pause" => TimeLayerState::Pause,
            _ => TimeLayerState::Stop,
        }
    }
}
/** Time Series object */
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct TimeSeries {
    pub start_time: f64,
    pub end_time: f64,
    /// seconds traveled per second
    pub speed: f64,
    pub pause_duration: f64, // in seconds
    pub auto_play: bool,
    pub r#loop: bool,
    pub cursor: f64,
    pub state: TimeLayerState,
}
impl From<&TimeSeriesStyle> for TimeSeries {
    fn from(time_series: &TimeSeriesStyle) -> Self {
        let TimeSeriesStyle { start_date, end_date, speed, pause_duration, r#loop, auto_play } =
            time_series;
        // setup date to beginning of current day
        let date = Date::new(0, 0, 0);
        // date.set
        let date_num = date.get_time();
        // tell the map about the time series
        let start_time = parse_date(start_date.unwrap_or(date_num)) as f64;
        TimeSeries {
            start_time,
            end_time: parse_date(end_date.unwrap_or(date_num + 162000) as i64) as f64, // 45 hour sequence (basically 2 tiles per face)
            speed: speed.unwrap_or(1.), // 1 hour per second (0 -> no animation)
            pause_duration: pause_duration.unwrap_or(0.),
            r#loop: r#loop.unwrap_or(false),       // ?? false,
            auto_play: auto_play.unwrap_or(false), // ?? false,
            state: TimeLayerState::Stop,           // 'stop',
            cursor: start_time,
        }
    }
}
/** An input texture to a specific time stamp that also points to the next texture if it exists */
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SensorTextureDefinition {
    pub time: Option<f64>,
    pub texture: Option<wgpu::Texture>,
    pub texture_next: Option<wgpu::Texture>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub struct SourceKey {
    pub id: S2CellId,
    pub time: i64,
    pub source_name: String,
}

/// # Time Cache
///
/// Stores and manages time source raster data.
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct TimeCache {
    pub cache: Cache<SourceKey, SensorSource>,
    pub camera: Rc<RefCell<Camera>>,
    pub sources: BTreeMap<String, TimeSource>, // [source_name]: { interval: number }
    pub last_frame: Option<f64>,
    pub webworker: Option<MsgSender<MapGLMessage>>,
    pub time_series: TimeSeries,
}
impl TimeCache {
    /// Create a new TimeCache
    ///
    /// ## Parameters
    /// - `camera`: parent camera
    /// - `webworker`: true if running in a webworker
    /// - `time_series`: user defined time series style object
    pub fn new(
        camera: Rc<RefCell<Camera>>,
        webworker: Option<MsgSender<MapGLMessage>>,
        time_series: &TimeSeriesStyle,
    ) -> Self {
        Self {
            cache: Cache::new(None),
            camera,
            sources: BTreeMap::new(),
            last_frame: None,
            webworker,
            time_series: TimeSeries::from(time_series),
        }
    }

    ///  Add a time source
    ///
    /// ## Parameters
    /// - `source_name`: the name of the source
    /// - `interval`: the interval of the source relative to the starting point of the source
    pub fn add_source(&mut self, source_name: String, interval: f64) {
        let step = interval / 4.;
        self.sources.insert(source_name.clone(), TimeSource { interval, step });
        // grab timeseries variables
        let TimeSeries { start_time, auto_play, state, .. } = self.time_series;
        // source data is always added at the beginning of the animation. The first source added triggers the animation
        if auto_play && state == TimeLayerState::Stop {
            self.time_series.state = TimeLayerState::Play;
        }
        // build a request for the first frame
        let source_time = start_time - (start_time % interval);
        self._request_tiles(source_time, source_name.clone(), source_name, None);
    }

    /// Add source data to the cache and update the time series
    ///
    /// ## Parameters
    /// - `id`: the id of the tile
    /// - `time`: the time of the source
    /// - `source_name`: the name of the source
    /// - `source`: the source to add the data to
    pub fn add_source_data(
        &mut self,
        id: S2CellId,
        time: i64,
        source_name: String,
        source: SensorSource,
    ) {
        self.cache.set(SourceKey { id, time, source_name }, source);
    }

    /// Get source data
    ///
    /// ## Parameters
    /// - `id`: the id of the tile
    /// - `source_name`: the name of the source
    ///
    /// ## Returns
    /// The source texture information and data
    pub fn get_textures(&mut self, id: S2CellId, source_name: String) -> SensorTextureDefinition {
        // const short_name = source_name.split(':')[0];
        let short_name: String = source_name.split(':').next().unwrap_or_default().into();
        let TimeSeries { cursor, end_time, .. } = self.time_series;
        let Some(time_source) = self.sources.get(&short_name) else {
            return SensorTextureDefinition::default();
        };
        let TimeSource { step, interval, .. } = *time_source;
        // build keys
        let cur_time = cursor - (cursor % interval);
        let next_time = cur_time + interval;
        // find source data
        let cur_source = self
            .cache
            .get(&SourceKey { id, time: floor(cur_time) as i64, source_name: source_name.clone() })
            .map(|s| s.texture.clone())
            .unwrap();
        let next_source = self
            .cache
            .get(&SourceKey { id, time: floor(next_time) as i64, source_name: source_name.clone() })
            .map(|s| s.texture.clone())
            .unwrap();
        // if next_source is not found, request it
        if cur_source.is_none() {
            self._request_tiles(cur_time, short_name.clone(), source_name.clone(), Some(id));
        }
        if next_source.is_none() && next_time <= end_time {
            self._request_tiles(next_time, short_name, source_name, Some(id));
        }

        // build time. Range of 0->4 : 0->1 red; 1->2 green; 2->3 blue; 3->4 alpha
        // time increments of source interval
        let time = (cursor - cur_time) / step;
        SensorTextureDefinition { time: Some(time), texture: cur_source, texture_next: next_source }
    }

    /// update layer positions.
    /// play state: increment cursor by speed * deltaTime. If cursor >= end_time, set cursor to pause state or start_time.
    /// pause state: increment cursor by deltaTime. If cursor > pause_duration, set state to play
    ///
    /// ## Parameters
    /// - `now`: current time
    /// - `render`: render function to call after animation state is updated
    pub fn animate(&mut self, now: f64, render: fn()) {
        let Self { time_series, .. } = self;
        if time_series.state == TimeLayerState::Stop {
            return;
        }
        // if no last frame, set last frame to begin animation and return
        if self.last_frame.is_none() {
            self.last_frame = Some(now);
        }
        // find delta
        let delta = (now - self.last_frame.unwrap_or_default()) / 1000.; // convert to seconds
        self.last_frame = Some(now);
        // grab time series variables
        let TimeSeries { start_time, end_time, speed, r#loop, .. } = *time_series;
        // if cursor is exactly end_time, if pause_duration is set, set to pause, otherwise set to start_time if loop
        if time_series.cursor == end_time {
            if r#loop {
                time_series.cursor = start_time;
            } else {
                time_series.state = TimeLayerState::Stop;
            }
        } else {
            // increment cursor
            time_series.cursor += delta * speed;
            // if cursor is past end_time, set to end_time to finish animation
            if time_series.cursor > end_time {
                time_series.cursor = end_time;
            }
        }
        // send off a render
        render();
    }

    /// rather than animate, the user can specify a time, and this will update to current time
    ///
    /// ## Parameters
    /// - `time`: the time to set
    pub fn set_time(&mut self, time: f64) {
        self.time_series.cursor = time;
    }

    /**
     * Request source data
     * @param time - the time of the source
     * @param short_name - the short name of the source
     * @param source_name - the name of the source
     * @param id - the id of the tile
     */
    fn _request_tiles(
        &mut self,
        time: f64,
        short_name: String,
        source_name: String,
        id: Option<S2CellId>,
    ) {
        //     const { webworker, camera } = this;
        //     let tiles: Tile[] = vec![];
        //     if (id !== undefined) {
        //       const tile = camera.getTile(id);
        //       if (tile !== undefined) tiles = [tile];
        //       else tiles = [];
        //     } else {
        //       tiles = camera.get_tiles();
        //     }
        //     let tile_requests: Vec<TileRequest> = vec![];
        //     // build tile requests
        //     for tile in &tiles {
        //       // build time id
        //       let timeID = `${tile.id}#${time}#${source_name}`;
        //       // if source data is already in cache, return
        //       if (this.has(timeID)) continue;
        //       // place a temporary source in the cache
        //       // this will be replaced by the source data when it arrives
        //       this.set(timeID, {});
        //       let { id, face, i, j, zoom, bbox, type, division } = tile;
        //       tile_requests.push({ id, face, i, j, zoom, bbox, type, division, time });
        //     }
        //     // get list of current tiles in view
        //     if (tile_requests.len() > 0) {
        //       if (webworker) {
        //         postMessage({
        //           mapID: camera.id,
        //           type: 'timerequest',
        //           tiles: tile_requests,
        //           source_names: [short_name],
        //         });
        //       } else {
        //         window.S2WorkerPool.timeRequest(camera.id, tile_requests, [short_name]);
        //       }
        //     }
        todo!()
    }
}

/**
 * convert a date to a unix timestamp
 * @param d - date string or number
 * @returns unix timestamp
 */
fn parse_date(d: i64) -> i64 {
    let date = Date::from_time(d);
    date.get_time() / 1_000
}

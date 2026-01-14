// import Cache from './cache.js';

// import type Camera from './index.js';
// import type { S2CellId } from 's2/gis-tools/index.js';
// import type { SensorSource } from 'gl/workflows/workflow.spec.js';
// import type { TileShared as Tile } from 'source/tile.spec.js';
// import type { TileRequest } from 'workers/worker.spec.js';
// import type { TimeSeriesStyle } from 'style/style.spec.js';
use crate::{
    style::TimeSeriesStyle,
    ui::{Cache, Camera},
};
use alloc::{collections::BTreeMap, rc::Rc};
use core::cell::RefCell;
use gistools::util::Date;

/// Tracker for time sources
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct TimeSource {
    pub step: f32,
    pub interval: f32,
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
    pub start_time: i64,
    pub end_time: i64,
    /// seconds traveled per second
    pub speed: f64,
    pub pause_duration: f64, // in seconds
    pub auto_play: bool,
    pub r#loop: bool,
    pub cursor: i64,
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
        let start_time = parse_date(start_date.unwrap_or(date_num));
        TimeSeries {
            start_time,
            end_time: parse_date(end_date.unwrap_or(date_num + 162000)), // 45 hour sequence (basically 2 tiles per face)
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
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SensorTextureDefinition {
    pub time: Option<f64>,
    pub texture: Option<wgpu::Texture>,
    pub texture_next: Option<wgpu::Texture>,
}

/// # Time Cache
///
/// Stores and manages time source raster data.
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct TimeCache {
    // TODO: Bring back
    // cache: Cache<String, SensorSource>,
    camera: Rc<RefCell<Camera>>,
    sources: BTreeMap<String, TimeSource>, // [sourceName]: { interval: number }
    last_frame: Option<f64>,
    webworker: bool,
    time_series: TimeSeries,
}
impl TimeCache {
    /**
     * @param camera - parent camera
     * @param webworker - true if running in a webworker
     * @param time_series - user defined time series style object
     */
    pub fn new(
        camera: Rc<RefCell<Camera>>,
        webworker: bool,
        time_series: &TimeSeriesStyle,
    ) -> Self {
        Self {
            camera,
            sources: BTreeMap::new(),
            last_frame: None,
            webworker,
            time_series: TimeSeries::from(time_series),
        }
    }

    //   /**
    //    * Add a time source
    //    * @param sourceName - the name of the source
    //    * @param interval - the interval of the source relative to the starting point of the source
    //    */
    //   add_source(sourceName: string, interval: number): void {
    //     const step = interval / 4;
    //     this.sources[sourceName] = { interval, step };
    //     // grab timeseries variables
    //     const { start_time, auto_play, state } = this.time_series;
    //     // source data is always added at the beginning of the animation. The first source added triggers the animation
    //     if (auto_play && state === 'stop') this.time_series.state = 'play';
    //     // build a request for the first frame
    //     const sourceTime = start_time - (start_time % interval);
    //     this.#requestTiles(sourceTime, sourceName, sourceName);
    //   }

    //   /**
    //    * Add source data to the cache and update the time series
    //    * @param id - the id of the tile
    //    * @param time - the time of the source
    //    * @param sourceName - the name of the source
    //    * @param source - the source to add the data to
    //    */
    //   add_source_data(id: S2CellId, time: number, sourceName: string, source: SensorSource): void {
    //     this.set(`${id}#${time}#${sourceName}`, source);
    //   }

    //   /**
    //    * Get source data
    //    * @param id - the id of the tile
    //    * @param sourceName - the name of the source
    //    * @returns the source texture information and data
    //    */
    //   get_textures(id: S2CellId, sourceName: string): SensorTextureDefinition {
    //     const shortName = sourceName.split(':')[0];
    //     const { cursor, end_time } = this.time_series;
    //     const timeSource = this.sources[shortName];
    //     if (timeSource === undefined) return {};
    //     const { step, interval } = timeSource;
    //     // build keys
    //     const curTime = cursor - (cursor % interval);
    //     const nextTime = curTime + interval;
    //     // find source data
    //     const curSource = this.get(`${id}#${curTime}#${sourceName}`);
    //     const nextSource = this.get(`${id}#${nextTime}#${sourceName}`);
    //     // if nextSource is not found, request it
    //     if (curSource === undefined) this.#requestTiles(curTime, shortName, sourceName, id);
    //     if (nextSource === undefined && nextTime <= end_time)
    //       this.#requestTiles(nextTime, shortName, sourceName, id);
    //     // grab data (if raster its a texture, if vector its a pointer to buffer)
    //     // if no source data, return
    //     const { texture } = curSource ?? {};
    //     if (texture === undefined) return {};
    //     const { texture: texture_next } = nextSource ?? {};

    //     // build time. Range of 0->4 : 0->1 red; 1->2 green; 2->3 blue; 3->4 alpha
    //     // time increments of source interval
    //     const time = (cursor - curTime) / step;
    //     return { time, texture, texture_next };
    //   }

    //   /**
    //    * update layer positions.
    //    * play state: increment cursor by speed * deltaTime. If cursor >= end_time, set cursor to pause state or start_time.
    //    * pause state: increment cursor by deltaTime. If cursor > pause_duration, set state to play
    //    * @param now - current time
    //    * @param render - render function to call after animation state is updated
    //    */
    //   animate(now: number, render: () => void): void {
    //     const { time_series } = this;
    //     if (time_series.state === 'stop') return;
    //     // if no last frame, set last frame to begin animation and return
    //     if (this.last_frame === undefined) this.last_frame = now;
    //     // find delta
    //     const delta = (now - this.last_frame) / 1000; // convert to seconds
    //     this.last_frame = now;
    //     // grab time series variables
    //     const { start_time, end_time, speed, loop } = time_series;
    //     // if cursor is exactly end_time, if pause_duration is set, set to pause, otherwise set to start_time if loop
    //     if (time_series.cursor === end_time) {
    //       if (loop) time_series.cursor = start_time;
    //       else time_series.state = 'stop';
    //     } else {
    //       // increment cursor
    //       time_series.cursor += delta * speed;
    //       // if cursor is past end_time, set to end_time to finish animation
    //       if (time_series.cursor > end_time) time_series.cursor = end_time;
    //     }
    //     // send off a render
    //     render();
    //   }

    /**
     * rather than animate, the user can specify a time, and this will update to current time
     * @param time - the time to set
     */
    pub fn set_time(&mut self, time: i64) {
        self.time_series.cursor = time;
    }

    //   /**
    //    * Request source data
    //    * @param time - the time of the source
    //    * @param shortName - the short name of the source
    //    * @param sourceName - the name of the source
    //    * @param id - the id of the tile
    //    */
    //   #requestTiles(time: number, shortName: string, sourceName: string, id?: S2CellId): void {
    //     const { webworker, camera } = this;
    //     let tiles: Tile[] = [];
    //     if (id !== undefined) {
    //       const tile = camera.getTile(id);
    //       if (tile !== undefined) tiles = [tile];
    //       else tiles = [];
    //     } else {
    //       tiles = camera.getTiles();
    //     }
    //     const tileRequests: TileRequest[] = [];
    //     // build tile requests
    //     for (const tile of tiles) {
    //       // build time id
    //       const timeID = `${tile.id}#${time}#${sourceName}`;
    //       // if source data is already in cache, return
    //       if (this.has(timeID)) continue;
    //       // place a temporary source in the cache
    //       // this will be replaced by the source data when it arrives
    //       this.set(timeID, {});
    //       const { id, face, i, j, zoom, bbox, type, division } = tile;
    //       tileRequests.push({ id, face, i, j, zoom, bbox, type, division, time });
    //     }
    //     // get list of current tiles in view
    //     if (tileRequests.length > 0) {
    //       if (webworker) {
    //         postMessage({
    //           mapID: camera.id,
    //           type: 'timerequest',
    //           tiles: tileRequests,
    //           sourceNames: [shortName],
    //         });
    //       } else {
    //         window.S2WorkerPool.timeRequest(camera.id, tileRequests, [shortName]);
    //       }
    //     }
    //   }
}

/**
 * convert a date to a unix timestamp
 * @param d - date string or number
 * @returns unix timestamp
 */
fn parse_date(d: i64) -> i64 {
    let date = Date::from_time(d);
    date.get_time() / 1000
}

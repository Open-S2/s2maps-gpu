use crate::{
    style::{Cap, ColorArray, InteractiveWorkerLayer},
    workers::{FillWorker, GlyphObject, ImageWorker, LineWorker, MapID, TileRequest},
};
use alloc::rc::Rc;
use core::cell::RefCell;
use gistools::geometry::S2CellId;
use s2json::Properties;

/// 32bit: 4,294,967,295 --- 24bit: 16,777,216 --- 22bit: 4,194,304 --- 16bit: 65,535 --- 7bit: 128
pub const ID_MAX_SIZE: usize = 1 << 22;

/** Id Generator to ensure features don't overlap. Used by vector workers. */
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct IDGen {
    pub worker_id: usize,
    pub num: usize,
    pub start_num: usize,
    pub incr_size: usize,
}
impl IDGen {
    /**
     * @param id - the thread id
     * @param total_workers - the total number of threads
     */
    pub fn new(&mut self, id: usize, total_workers: usize) {
        self.worker_id = id;
        self.num = id + 1;
        self.start_num = id + 1;
        self.incr_size = total_workers;
    }

    /** @returns the next id */
    pub fn get_num(&mut self) -> usize {
        let res = self.num;
        self.num += self.incr_size;
        if self.num >= ID_MAX_SIZE {
            self.num = self.start_num;
        }
        res
    }
}

/** FEATURES */
/** All features share these properties */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FeatureBase {
    pub layer_index: usize,
    pub code: Vec<f32>,
    pub gl2_code: Vec<f32>,
}
/** All interactive features share these properties */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct InteractiveFeatureBase {
    pub layer_index: usize,
    pub code: Vec<f32>,
    pub gl2_code: Vec<f32>,
    pub id_rgb: ColorArray,
}

/** A glyph feature used in a Tile Worker */
pub type GlyphFeature = GlyphObject;

/** The output of a Fill Feature from TileWorker->MapRenderer */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FillFeature {
    pub base: InteractiveFeatureBase,
    pub vertices: Vec<f32>,
    pub indices: Vec<u32>,
    pub pattern: Option<String>,
    pub pattern_family: String,
    pub pattern_movement: bool,
    pub missing: bool,
}

/** The output of a Line Feature from TileWorker->MapRenderer */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LineFeature {
    pub base: InteractiveFeatureBase,
    pub vertices: Vec<f32>,
    pub length_so_far: Vec<f32>,
    pub cap: Cap,
}

/** The output of a Point Feature from TileWorker->MapRenderer */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct PointFeature {
    pub base: InteractiveFeatureBase,
    pub vertices: Vec<f32>,
}

/** The output of a Heatmap Feature from TileWorker->MapRenderer */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HeatmapFeature {
    pub base: FeatureBase,
    pub vertices: Vec<f32>,
    pub weights: Vec<f32>,
}

/** Grouping of all Features that are shipped to the Renderer */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum Feature {
    Fill(FillFeature),
    Glyph(GlyphFeature),
    Line(LineFeature),
    Point(PointFeature),
    Heatmap(HeatmapFeature),
}
impl From<FillFeature> for Feature {
    fn from(fill: FillFeature) -> Self {
        Feature::Fill(fill)
    }
}
impl From<GlyphFeature> for Feature {
    fn from(glyph: GlyphFeature) -> Self {
        Feature::Glyph(glyph)
    }
}
impl From<LineFeature> for Feature {
    fn from(line: LineFeature) -> Self {
        Feature::Line(line)
    }
}
impl From<PointFeature> for Feature {
    fn from(point: PointFeature) -> Self {
        Feature::Point(point)
    }
}
impl From<HeatmapFeature> for Feature {
    fn from(heatmap: HeatmapFeature) -> Self {
        Feature::Heatmap(heatmap)
    }
}
impl Feature {
    /// Get the layer index
    pub fn layer_index(&self) -> usize {
        match self {
            Feature::Fill(fill) => fill.base.layer_index,
            Feature::Glyph(glyph) => glyph.layer_index(),
            Feature::Line(line) => line.base.layer_index,
            Feature::Point(point) => point.base.layer_index,
            Feature::Heatmap(heatmap) => heatmap.base.layer_index,
        }
    }
    /// Get the GL2 code
    pub fn gl2_code(&self) -> &Vec<f32> {
        match self {
            Feature::Fill(fill) => &fill.base.gl2_code,
            Feature::Glyph(glyph) => glyph.gl2_code(),
            Feature::Line(line) => &line.base.gl2_code,
            Feature::Point(point) => &point.base.gl2_code,
            Feature::Heatmap(heatmap) => &heatmap.base.gl2_code,
        }
    }
}

/** List of workers the TileWorker handles */
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub enum Workers {
    Fill(FillWorker),
    Line(LineWorker),
    // Point(PointWorker),
    // Heatmap(HeatmapWorker),
    // Glyph(GlyphWorker),
    /// Raster, Sensor, and Hillshade
    Image(ImageWorker),
}

/** A Trait like Wrapper for Vector Workers */
pub trait VectorWork {
    /// Access the id generator
    fn id_gen(&self) -> Rc<RefCell<IDGen>>;
    /// Add an interactive feature
    fn _add_interactive_feature(
        &mut self,
        id: usize,
        properties: Properties,
        worker_layer: InteractiveWorkerLayer,
    );
    /// Flush out the feature store
    fn flush(
        &mut self,
        map_id: MapID,
        tile: TileRequest,
        source_name: String,
        // wait: Promise<void>,
    ) -> impl Future<Output = ()>;
    /// Post an interactive feature
    fn post_interactive(&mut self, map_id: MapID, source_name: String, tile_id: S2CellId);
}

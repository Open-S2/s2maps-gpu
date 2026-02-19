use crate::{
    s2map::ColorMode,
    source::Tile,
    style::{LayerDefinition, Projection, S2MapsAnalytics, Source, StyleDefinition, StylePackage},
    ui::{AnimationDirections, MapOptions, UserTouchEvent, View},
    util::{ImageBitmap, UrlMap},
    workers::{Glyph, GlyphImages, GlyphMetadata, ImageSourceMetadata, MarkerDefinition},
};
use alloc::{
    boxed::Box,
    collections::{BTreeMap, btree_set::BTreeSet},
    string::String,
    vec::Vec,
};
use bytemuck::{Pod, Zeroable};
use core::sync::atomic::{AtomicU64, Ordering};
use gistools::geometry::S2CellId;
use s2json::{Attributions, BBox, Face, MValue, Properties};
use serde::{Deserialize, Serialize};

static SEED_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Returns a monotonically increasing u64.
/// Safe on any platform with atomic support.
pub fn next_seed() -> u64 {
    SEED_COUNTER.fetch_add(1, Ordering::Relaxed)
}

/// TODO: Temporary Input Format until each type has it's own data
#[repr(C)]
#[derive(Debug, Default, Clone, Copy, PartialEq, Pod, Zeroable)]
pub struct ArrayBuffer(u8);

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum NameIndex {
    Name(String),
    Index(usize),
}
impl From<String> for NameIndex {
    fn from(name: String) -> Self {
        NameIndex::Name(name)
    }
}
impl From<usize> for NameIndex {
    fn from(index: usize) -> Self {
        NameIndex::Index(index)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[allow(missing_docs)]
pub struct SourceName {
    pub name: String,
    pub href: Option<String>,
}
impl SourceName {
    /// Create a new SourceName
    pub fn new(name: String, href: Option<String>) -> Self {
        SourceName { name, href }
    }
}

// GENERIC WORKER TYPES //

/// S2CellIDs of tiles e.g. ['204n', '1003n', '1245n', ...]
pub type CancelTileRequest = Vec<S2CellId>;

/// Tracks the map who made the request
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct MapID([char; 32]);
impl MapID {
    /// Creates a new MapID
    pub fn new() -> Self {
        const CHARSET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
        let mut out = ['\0'; 32];
        let mut seed = next_seed();

        // simple LCG (well-known constants, pure integer math)
        for i in 0..32 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let idx = ((seed >> 32) as usize) % CHARSET.len();
            out[i] = CHARSET[idx] as char;
        }

        MapID(out)
    }
}
impl ToString for MapID {
    fn to_string(&self) -> String {
        self.0.iter().collect()
    }
}

/// Parent Layer Information. Layer indexes effected by this parent tile
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TileLayer {
    pub face: Face,
    pub zoom: u8,
    pub i: u32,
    pub j: u32,
    pub id: S2CellId,
    pub layer_indexes: Vec<u32>,
    pub time: Option<f64>,
}

/// Parent Layer Information. Layer indexes effected by this parent tile
pub type ParentLayers = BTreeMap<usize, TileLayer>;

/// Tile Request
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TileRequest {
    pub layer: TileLayer,
    pub r#type: Projection,
    pub bbox: BBox,
    pub division: f64,
    pub parent: Option<TileLayer>,
}
impl From<&Tile> for TileRequest {
    fn from(tile: &Tile) -> Self {
        TileRequest {
            r#type: tile.r#type,
            bbox: tile.bbox,
            division: tile.division as f64,
            layer: TileLayer {
                face: tile.face.into(),
                zoom: tile.zoom,
                i: tile.i as u32,
                j: tile.j as u32,
                id: tile.id.id,
                layer_indexes: vec![],
                time: None,
            },
            parent: None,
        }
    }
}

/// Interactive Object sub properties
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct InteractiveObject {
    pub properties: Properties,
    pub __id: u64,
    pub __cursor: String,
    pub __name: String,
    pub __source: String,
    pub __layer: String,
}

// FRONT END TO MAP WORKER MESSAGES

/// Canvas message shipping the canvas element from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct CanvasMessage {
    pub options: MapOptions,
    // TODO: Add canvas
    //   pub canvas: HTMLCanvasElement;
}

/// Resize message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct ResizeMessage {
    pub width: u32,
    pub height: u32,
}

/// Scroll message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct ScrollMessage {
    pub delta_y: f64,
    pub client_x: f64,
    pub client_y: f64,
    // rect
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

/// Mouse up message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct MouseupMessage {
    pub client_x: f64,
    pub client_y: f64,
    // rect
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

/// Mouse move message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct MousemoveMessage {
    pub movement_x: f64,
    pub movement_y: f64,
}

/// Canvas mouse move message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct CanvasMousemoveMessage {
    pub x: f64,
    pub y: f64,
}

/// Touch start message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TouchstartMessage {
    pub touch_event: UserTouchEvent,
}

/// Touch end message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TouchendMessage {
    pub touch_event: UserTouchEvent,
}

/// Touch move message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TouchmoveMessage {
    pub touch_event: UserTouchEvent,
}

/// Navigation control
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum NavControl {
    #[default]
    ZoomIn,
    ZoomOut,
}

/// Navigation message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct NavMessage {
    pub ctrl: NavControl,
    pub lon: Option<f64>,
    pub lat: Option<f64>,
}

/// Color mode message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct ColorModeMessage {
    pub mode: ColorMode,
}

/// Set style message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SetStyleMessage {
    pub style: StyleDefinition,
    pub ignore_position: bool,
}

/// Update style message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct UpdateStyleMessage {
    pub style: StyleDefinition,
}

/// Jump to message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct JumpToMessage {
    pub view: View,
}

/// Ease to message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct EaseToMessage {
    pub directions: Option<AnimationDirections>,
}

/// Fly to message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct FlyToMessage {
    pub directions: Option<AnimationDirections>,
}

/// Move state message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct MoveStateMessage {
    pub state: bool,
}

/// Zoom state message sent from the front end to the map worker
#[derive(Debug, Default, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct ZoomStateMessage {
    pub state: bool,
}

/// Reset source message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ResetSourceMessage {
    pub source_names: Vec<SourceName>,
    pub keep_cache: bool,
    pub await_replace: bool,
}

/// Clear source message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ClearSourceMessage {
    pub source_names: Vec<String>,
}

/// Add layer message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct AddLayerMessage {
    pub layer: LayerDefinition,
    pub name_index: Option<NameIndex>,
}

/// Update layer message sent from the front end to the map worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct UpdateLayerMessage {
    pub layer: LayerDefinition,
    pub name_index: NameIndex,
    pub full_update: bool,
}

/// Delete layer message sent from the front end to the map worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct DeleteLayerMessage {
    pub name_index: NameIndex,
}

/// Reorder layers message sent from the front end to the map worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ReorderLayersMessage {
    pub layer_changes: BTreeMap<usize, usize>,
}

/// Update compass message sent from the map worker to the front end
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct UpdateCompassMessage {
    pub bearing: f64,
    pub pitch: f64,
}

/// Message sent from the front end to the map worker
#[derive(Debug, Clone, PartialEq)]
pub enum S2MapMessage {
    /// Canvas message shipping the canvas element from the front end to the map worker
    Canvas(CanvasMessage),
    /// Resize message sent from the front end to the map worker
    Resize(ResizeMessage),
    /// Scroll message sent from the front end to the map worker
    Scroll(ScrollMessage),
    /// Mouse down message sent from the front end to the map worker
    Mousedown,
    /// Mouse up message sent from the front end to the map worker
    Mouseup(MouseupMessage),
    /// Mouse move message sent from the front end to the map worker
    Mousemove(MousemoveMessage),
    /// Canvas mouse move message sent from the front end to the map worker
    CanvasMousemove(CanvasMousemoveMessage),
    /// Touch start message sent from the front end to the map worker
    Touchstart(TouchstartMessage),
    /// Touch end message sent from the front end to the map worker
    Touchend(TouchendMessage),
    /// Touch move message sent from the front end to the map worker
    Touchmove(TouchmoveMessage),
    /// Navigation message sent from the front end to the map worker
    Nav(NavMessage),
    /// Update compass message sent from the map worker to the front end
    UpdateCompass(UpdateCompassMessage),
    /// Mouse up compass message sent from the front end to the map worker
    MouseupCompass,
    /// Reset compass message sent from the front end to the map worker
    ResetCompass,
    /// Color mode message sent from the front end to the map worker
    ColorMode(ColorModeMessage),
    /// Set style message sent from the front end to the map worker
    SetStyle(SetStyleMessage),
    /// Update style message sent from the front end to the map worker
    UpdateStyle(UpdateStyleMessage),
    /// Jump to message sent from the front end to the map worker
    JumpTo(JumpToMessage),
    /// Ease to message sent from the front end to the map worker
    EaseTo(EaseToMessage),
    /// Fly to message sent from the front end to the map worker
    FlyTo(FlyToMessage),
    /// Move state message sent from the front end to the map worker
    MoveState(MoveStateMessage),
    /// Zoom state message sent from the front end to the map worker
    ZoomState(ZoomStateMessage),
    /// Screenshot request message sent from the front end to the map worker
    Screenshot,
    /// Await rendered message sent from the front end to the map worker
    AwaitRendered,
    /// Reset source message sent from the front end to the map worker
    ResetSource(ResetSourceMessage),
    /// Clear source message sent from the front end to the map worker
    ClearSource(ClearSourceMessage),
    /// Add layer message sent from the front end to the map worker
    AddLayer(AddLayerMessage),
    /// Update layer message sent from the front end to the map worker
    UpdateLayer(UpdateLayerMessage),
    /// Delete layer message sent from the front end to the map worker
    DeleteLayer(DeleteLayerMessage),
    /// Reorder layers message sent from the front end to the map worker
    ReorderLayers(ReorderLayersMessage),
    /// Delete message sent from the front end to the map worker
    Delete,
}

// FRONT END TO SOURCE WORKER MESSAGES //

/// Add markers message sent from the front end to the source worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct AddMarkersMessage {
    pub markers: Vec<MarkerDefinition>,
    pub source_name: String,
}

/// Delete markers message sent from the front end to the source worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct DeleteMarkersMessage {
    pub ids: usize,
    pub source_name: String,
}

/// Add source message sent from the front end to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct AddSourceMessage<M = (), P: Clone + Default = Properties, D: Clone + Default = MValue> {
    pub source_name: String,
    pub source: Source<M, P, D>,
    pub tile_request: Vec<TileRequest>,
}

/// Delete source message sent from the front end to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct DeleteSourceMessage {
    pub source_names: Vec<String>,
}

/// Messages sent from the front end to the source worker
#[derive(Debug, Clone, PartialEq)]
pub enum S2MapToSourceMessage {
    /// Add markers message sent from the front end to the source worker
    AddMarkers(Box<AddMarkersMessage>),
    /// Delete markers message sent from the front end to the source worker
    DeleteMarkers(Box<DeleteMarkersMessage>),
    /// Delete source message sent from the front end to the source worker
    DeleteSource(Box<DeleteSourceMessage>),
}

// UI GL REQUESTS -> S2Map or Worker Pool //

/// Tile request message sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TileRequestMessage {
    pub tiles: Vec<TileRequest>,
    pub sources: Vec<SourceName>,
}

/// Time request message sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TimeRequestMessage {
    pub tiles: Vec<TileRequest>,
    pub source_names: Vec<String>,
}

/// Messages sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
pub struct MouseEnterMessage {
    /// The map id
    /// The features that the mouse just "entered" into
    pub features: Vec<InteractiveObject>,
    /// All features including features "entered" in previous frames
    pub current_features: Vec<InteractiveObject>,
}

/// Messages sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct MouseLeaveMessage {
    /// The features that the mouse just "left"
    pub features: Vec<InteractiveObject>,
    /// All features including features "left" in previous frames
    pub current_features: Vec<InteractiveObject>,
}

/// Messages sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct MouseClickMessage {
    pub features: Vec<InteractiveObject>,
    pub lon: f64,
    pub lat: f64,
}

/// View message sent from the map worker to the front end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ViewMessage {
    pub view: View,
}

/// Requesting a style from the map worker to the source worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct RequestStyleMessage {
    pub style: String, // url
    pub analytics: S2MapsAnalytics,
    pub api_key: Option<String>,
    pub url_map: Option<UrlMap>,
}

/// Style request message sent from the map worker to the front end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct StyleMessage {
    pub style: StylePackage,
}

/// Add layer message sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct AddLayerMessageGL {
    pub layer: LayerDefinition,
    pub index: Option<usize>,
    pub tile_request: Vec<TileRequest>,
}

/// Delete layer message sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct DeleteLayerMessageGL {
    pub index: usize,
}

/// Reorder layers message sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ReorderLayersMessageGL {
    pub layer_changes: BTreeMap<usize, usize>,
}

/// Screenshot message sent from the map worker to the front end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct ScreenshotMessageGL {
    pub screen: ArrayBuffer,
}

/// Collection of messages that can be sent from the map worker to the front end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum MapGLMessage {
    TileRequest(TileRequestMessage),
    TimeRequest(TimeRequestMessage),
    MouseEnter(MouseEnterMessage),
    MouseLeave(MouseLeaveMessage),
    MouseClick(MouseClickMessage),
    View(ViewMessage),
    RequestStyle(RequestStyleMessage),
    Style(StyleMessage),
    UpdateCompass(UpdateCompassMessage),
    AddLayerGL(AddLayerMessageGL),
    DeleteLayerGL(DeleteLayerMessageGL),
    ReorderLayersGL(ReorderLayersMessageGL),
    ScreenshotGL(ScreenshotMessageGL),
    /// Rendered message sent from the map worker to the front end
    RenderedMessageGL,
    /// Ready message sent from the map worker to the front end
    ReadyMessageGL,
}

/// Collection of messages that can be sent from the map worker to the source worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum MapGLToSourceMessage {
    RequestStyle(RequestStyleMessage),
    Style(StyleMessage),
    TileRequest(TileRequestMessage),
    TimeRequest(TimeRequestMessage),
    AddLayerGL(AddLayerMessageGL),
    DeleteLayerGL(DeleteLayerMessageGL),
    ReorderLayersGL(ReorderLayersMessageGL),
}

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct MapGLToSourceMessages {
    pub map_id: MapID,
    pub message: MapGLToSourceMessage,
}

// SOURCE WORKER MESSAGES //

/// Attribution message sent from the source worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct AttributionsMessage {
    pub attributions: Attributions,
}

/// Style message sent from the source worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SourceSetStyleMessage {
    pub style: StyleDefinition,
    pub ignore_position: bool,
}

/// Sprite image message sent from the source worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SpriteImageMessage {
    pub name: String,
    pub offset_x: u32,
    pub offset_y: u32,
    pub width: u32,
    pub height: u32,
    pub max_height: u32,
    pub image: ImageBitmap,
}

/// Flush message sent from the source worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SourceFlushMessage {
    pub tile_id: S2CellId,
    pub layers_to_be_loaded: BTreeSet<u32>,
}

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TimeSourceMessage {
    pub source_name: String,
    pub interval: i64,
}

/// Collection of messages that can be sent from the source worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum SourceWorkerMessage {
    Attributions(AttributionsMessage),
    SourceSetStyle(SourceSetStyleMessage),
    SpriteImage(SpriteImageMessage),
    SourceFlush(SourceFlushMessage),
    TimeSource(TimeSourceMessage),
}

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SourceWorkerMessageOutput {
    pub map_id: MapID,
    pub message: SourceWorkerMessage,
}

// TILE WORKER MESSAGES //

/// Worker message base. Used in most messages from the tile worker to the source worker or front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct WorkerMessageBase {
    pub tile_id: S2CellId,
    pub source_name: String,
}

/// Fill render data from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FillData {
    pub base: WorkerMessageBase,
    pub vertex_buffer: Vec<f32>,
    pub index_buffer: Vec<u32>,
    pub id_buffer: Vec<u32>,
    pub code_type_buffer: Vec<u32>,
    pub feature_guide_buffer: Vec<f32>,
}

/// Line render data from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct LineData {
    pub base: WorkerMessageBase,
    pub vertex_buffer: ArrayBuffer,
    pub length_so_far_buffer: ArrayBuffer,
    pub feature_guide_buffer: ArrayBuffer,
}

/// Glyph render data from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphData {
    pub base: WorkerMessageBase,
    pub glyph_filter_buffer: ArrayBuffer,
    pub glyph_filter_idbuffer: ArrayBuffer,
    pub glyph_quad_buffer: ArrayBuffer,
    pub glyph_quad_idbuffer: ArrayBuffer,
    pub glyph_color_buffer: ArrayBuffer,
    pub feature_guide_buffer: ArrayBuffer,
}

/// Glyph image data from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphImageData {
    pub max_height: f32,
    pub images: GlyphImages,
}

/// Raster data guide shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct RasterDataGuide {
    pub code: Vec<u8>,
    pub layer_index: usize,
}

/// Raster data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct RasterData {
    pub base: WorkerMessageBase,
    pub image: Vec<u8>,
    pub size: u32,
    pub feature_guides: Vec<RasterDataGuide>,
}

/// Hillshade data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HillshadeData {
    pub base: WorkerMessageBase,
    pub image: Vec<u8>,
    pub size: u32,
    pub feature_guides: Vec<RasterDataGuide>,
}

/// Sensor data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct SensorData {
    pub base: WorkerMessageBase,
    pub image: Vec<u8>,
    pub size: u32,
    pub feature_guides: Vec<RasterDataGuide>,
    pub time: f64,
}

/// Point data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct PointData {
    pub base: WorkerMessageBase,
    pub vertex_buffer: ArrayBuffer,
    pub id_buffer: ArrayBuffer,
    pub feature_guide_buffer: ArrayBuffer,
}

/// Heatmap data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct HeatmapData {
    pub base: WorkerMessageBase,
    pub vertex_buffer: ArrayBuffer,
    pub weight_buffer: ArrayBuffer,
    pub id_buffer: ArrayBuffer,
    pub feature_guide_buffer: ArrayBuffer,
}

/// Interactive data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct InteractiveData {
    pub base: WorkerMessageBase,
    pub interactive_guide_buffer: ArrayBuffer,
    pub interactive_data_buffer: ArrayBuffer,
}

/// Tile Flush message shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TileFlushMessage {
    pub tile_id: S2CellId,
    pub source_name: String,
    pub dead_layers: Vec<u32>,
}

/// Temporal source data shipped from the Tile Worker to the front-end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TimeSourceData {
    pub base: WorkerMessageBase,
    pub interval: f64,
}

/// All rendering type data grouped
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum PainterData {
    Raster(RasterData),
    Hillshade(HillshadeData),
    Sensor(SensorData),
    Fill(FillData),
    Line(LineData),
    Point(PointData),
    Heatmap(HeatmapData),
    Glyph(GlyphData),
}

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum FlushMessage {
    Tile(TileFlushMessage),
    Source(SourceFlushMessage),
}
impl From<TileFlushMessage> for FlushMessage {
    fn from(msg: TileFlushMessage) -> FlushMessage {
        FlushMessage::Tile(msg)
    }
}
impl From<SourceFlushMessage> for FlushMessage {
    fn from(msg: SourceFlushMessage) -> FlushMessage {
        FlushMessage::Source(msg)
    }
}

/// Tile worker messages that are shipped from a Tile Worker to the front end
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum TileWorkerMessageOutput {
    Fill(FillData),
    Line(LineData),
    Glyph(GlyphData),
    GlyphImage(GlyphImageData),
    SpriteImage(SpriteImageMessage),
    Raster(RasterData),
    Hillshade(HillshadeData),
    Sensor(SensorData),
    Point(PointData),
    Heatmap(HeatmapData),
    Interactive(InteractiveData),
    TileFlush(TileFlushMessage),
    TimeSource(TimeSourceData),
}

/// TILE WORKER TO SOURCE WORKER MESSAGES

/// Glyph Request asked by the Tile Worker to the Source Worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphRequestMessage {
    pub worker_id: usize,
    pub req_id: String,
    pub glyph_list: BTreeMap<String, Vec<String>>,
}

/// Messages the Tile Worker's ship to the Source Worker
pub type TileWorkerToSourceWorkerMessage = GlyphRequestMessage;

// SOURCE WORKER TO TILE WORKER MESSAGES //

/// Add layer message sent from the Source Worker to the Tile Worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct AddLayerMessageTileWorker {
    pub layer: LayerDefinition,
    pub index: usize,
}
/// Vector tile message sent from the Source Worker to the Tile Worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct VectorMessage {
    pub tile: TileRequest,
    pub source_name: String,
    pub data: Vec<u8>,
}

/// Raster tile message sent from the Source Worker to the Tile Worker
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct RasterMessage {
    pub tile: TileRequest,
    pub source_name: String,
    pub data: Vec<u8>,
    pub size: u32,
}

/// JSON data message sent from the Source Worker to the Tile Worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct JSONDataMessage {
    pub tile: TileRequest,
    pub source_name: String,
    pub vector_tile: gistools::data_structures::Tile,
}

/// Glyph metadata message sent from the Source Worker to the Tile Worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphMetadataMessage {
    pub glyph_metadata: Vec<GlyphMetadata>,
    pub image_metadata: Vec<ImageSourceMetadata>,
}

/// Glyph response message sent from the Source Worker to the Tile Worker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphResponseMessage {
    pub req_id: String,
    pub glyph_metadata: Vec<Glyph>,
    pub family_name: String,
}

// WORKER POOL MESSAGE //

/// Message from the worker pool to the tile workers so they can track their own id and total tile worker count
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct WorkerPoolPortMessage {
    pub id: u64,
    pub total_workers: usize,
}

// LISTED MESSAGES //

/// List of messages that are sent from the WorkerPool
pub type WorkerPoolMessage = WorkerPoolPortMessage;

/// List of messages that are sent from the SourceWorker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum SourceWorkerMessages {
    TileWorkerToSourceWorker(Box<TileWorkerToSourceWorkerMessage>),
    S2MapToSource(Box<S2MapToSourceMessage>),
    WorkerPool(Box<WorkerPoolMessage>),
    MapGLToSource(Box<MapGLToSourceMessage>),
}

/// List of messages that are sent to the TileWorker
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub enum TileWorkerMessages {
    WorkerPool(Box<WorkerPoolMessage>),
    Style(Box<StyleMessage>),
    Vector(Box<VectorMessage>),
    Raster(Box<RasterMessage>),
    JSONData(Box<JSONDataMessage>),
    GlyphResponse(Box<GlyphResponseMessage>),
    GlyphMetadata(Box<GlyphMetadataMessage>),
    AddLayerTileWorker(Box<AddLayerMessageTileWorker>),
    DeleteLayerGL(Box<DeleteLayerMessageGL>),
    ReorderLayersGL(Box<ReorderLayersMessageGL>),
}
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct TileWorkerMessage {
    pub map_id: MapID,
    pub message: TileWorkerMessages,
}

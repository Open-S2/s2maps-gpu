use crate::{
    render::{FeatureSpec, Features, RenderContext, TileMaskSource},
    style::{LayerDefinition, Projection},
    ui::{Mat4, MatrixType, Projector, TileID, TileInView, Vec4},
    workers::{FlushMessage, InteractiveObject, SourceFlushMessage, TileFlushMessage},
};
use alloc::{
    collections::{BTreeMap, BTreeSet},
    rc::Rc,
};
use bytemuck::{Pod, Zeroable};
use core::cell::RefCell;
use gistools::geometry::{S2CellId, S2Point, ll_to_tile_px};
use libm::pow;
use s2json::{BBox, Point};

/// A tile's 4 corners.
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct Corners {
    pub top_left: Vec4,
    pub top_right: Vec4,
    pub bottom_left: Vec4,
    pub bottom_right: Vec4,
}
impl Corners {
    /// create a new set of corners
    pub fn new(face: u8, bbox: &BBox) -> Self {
        let BBox { left, top, right, bottom } = *bbox;
        let mut tl_point = S2Point::from_face_st_gl(face, left, top);
        tl_point.normalize();
        tl_point *= 6371008.8;
        let mut tr_point = S2Point::from_face_st_gl(face, right, top);
        tr_point.normalize();
        tr_point *= 6371008.8;
        let mut bl_point = S2Point::from_face_st_gl(face, left, bottom);
        bl_point.normalize();
        bl_point *= 6371008.8;
        let mut br_point = S2Point::from_face_st_gl(face, right, bottom);
        br_point.normalize();
        br_point *= 6371008.8;
        Self {
            top_left: (&tl_point).into(),
            top_right: (&tr_point).into(),
            bottom_left: (&bl_point).into(),
            bottom_right: (&br_point).into(),
        }
    }
}

/// A FaceST that will be encoded into the GPU
#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct FaceST {
    pub face: f64,
    pub zoom: f64,
    pub s_low: f64,
    pub delta_s: f64,
    pub t_low: f64,
    pub delta_t: f64,
}
impl FaceST {
    /// Create a new FaceST
    pub fn new(face: u8, zoom: u8, bbox: BBox) -> Self {
        Self {
            face: face as f64,
            zoom: zoom as f64,
            s_low: bbox.left,
            delta_s: bbox.right - bbox.left,
            t_low: bbox.bottom,
            delta_t: bbox.top - bbox.bottom,
        }
    }
}

#[derive(Debug, Default, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[allow(missing_docs)]
pub enum TileState {
    #[default]
    Loading,
    Loaded,
    Deleted,
}

#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct TileUniforms {
    pub is_s2: f32,
    pub face: f32,
    pub zoom: f32,
    pub s_low: f32,
    pub t_low: f32,
    pub delta_s: f32,
    pub delta_t: f32,
}
impl TileUniforms {
    /// Create a new tile uniforms
    pub fn new(projection: Projection, face_st: &FaceST) -> Self {
        if projection == Projection::S2 {
            Self {
                is_s2: 1.0,
                face: face_st.face as f32,
                zoom: face_st.zoom as f32,
                s_low: face_st.s_low as f32,
                t_low: face_st.t_low as f32,
                delta_s: face_st.delta_s as f32,
                delta_t: face_st.delta_t as f32,
            }
        } else {
            Self {
                is_s2: 0.0,
                face: 0.0,
                zoom: face_st.zoom as f32,
                s_low: 0.0,
                t_low: 0.0,
                delta_s: 1.0,
                delta_t: 1.0,
            }
        }
    }
}

#[repr(C)]
#[derive(Debug, Default, Copy, Clone, PartialEq, Pod, Zeroable)]
#[allow(missing_docs)]
pub struct TileBounds {
    pub bot_left_x: f32,
    pub bot_left_y: f32,
    pub bot_right_x: f32,
    pub bot_right_y: f32,
    pub top_left_x: f32,
    pub top_left_y: f32,
    pub top_right_x: f32,
    pub top_right_y: f32,
}

/// Base Tile Class that all Tiles inherit from.
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct Tile {
    pub id: TileID,
    pub face: u8,
    pub i: i64,
    pub j: i64,
    pub zoom: u8,
    pub division: u32,
    pub tmp_mask_id: u32,
    pub mask: Rc<TileMaskSource>,
    pub bbox: BBox,
    pub feature_guides: Vec<Rc<RefCell<Features>>>,
    pub interactive_guide: BTreeMap<u32, InteractiveObject>,
    pub uniforms: TileUniforms,
    pub bottom_top: TileBounds,
    pub state: TileState,
    pub r#type: Projection,
    pub face_st: FaceST,
    pub matrix: Mat4,
    pub layers_loaded: BTreeSet<u32>,
    pub layers_to_be_loaded: BTreeSet<u32>,
    // WM only feature: if the tile is "out of bounds", it references a real world tile
    // by copying the parents feature_guides.
    pub wrapped_id: Option<S2CellId>,
    pub dependents: Vec<Rc<RefCell<Tile>>>,
    pub corners: Option<Corners>,
}
impl Tile {
    /// Create a new Tile
    pub fn new(r#type: Projection, context: &mut RenderContext, tile_info: TileInView) -> Self {
        let division = if r#type == Projection::S2 {
            16 / (1 << u32::max(u32::min((tile_info.zoom as u32).div_ceil(2), 4), 0))
        } else {
            1
        };
        let bbox = BBox::from_st_zoom(tile_info.x as f64, tile_info.y as f64, tile_info.zoom);
        let face_st = FaceST::new(tile_info.face, tile_info.zoom, bbox);
        let uniforms = TileUniforms::new(r#type, &face_st);
        let bottom_top = TileBounds::default();
        let mask = TileMaskSource::new(division, context, &uniforms, &bottom_top);
        let corners =
            if tile_info.zoom >= 12 { Some(Corners::new(tile_info.face, &bbox)) } else { None };
        Self {
            id: tile_info.id,
            face: tile_info.face,
            i: tile_info.x,
            j: tile_info.y,
            zoom: tile_info.zoom,
            division,
            tmp_mask_id: 0,
            mask: Rc::new(mask),
            bbox,
            feature_guides: vec![],
            interactive_guide: BTreeMap::new(),
            uniforms,
            bottom_top,
            state: TileState::Loading,
            r#type,
            face_st: FaceST::new(tile_info.face, tile_info.zoom, bbox),
            matrix: Mat4::new(),
            layers_loaded: BTreeSet::default(),
            layers_to_be_loaded: BTreeSet::default(),
            wrapped_id: tile_info.wrapped_id,
            dependents: vec![],
            corners,
        }
    }

    /**
     * inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
     * a parents' parent or deeper, so we need to reflect that in the tile property.
     * @param parent - parent tile to inject
     * @param layers - the effected layers to modify
     */
    pub fn inject_parent_tile(
        this: Rc<RefCell<Tile>>,
        parent: Rc<RefCell<Tile>>,
        layers: &[LayerDefinition],
    ) {
        for feature in &parent.borrow().feature_guides {
            let feature = &feature.borrow();
            // ignore mask features
            if feature.mask_layer() {
                continue;
            }
            let maxzoom = layers[feature.layer_index() as usize].base().maxzoom;
            let actual_parent = feature.parent().clone().unwrap_or(parent.clone());
            if this.borrow().zoom <= maxzoom {
                let bounds = this.borrow()._build_bounds(&actual_parent.borrow());
                let new_feature = feature.duplicate(this.clone(), Some(actual_parent), bounds);
                this.borrow_mut().feature_guides.push(Rc::new(RefCell::new(new_feature)));
            }
        }
        for (id, interactive) in &parent.borrow().interactive_guide {
            this.borrow_mut().interactive_guide.insert(*id, interactive.clone());
        }
    }

    /**
     * inject references to featureGuide from a wrapped tile
     * @param wrapped - the wrapped tile
     */
    pub fn inject_wrapped_tile(this: Rc<RefCell<Tile>>, wrapped: Rc<RefCell<Tile>>) {
        // add existing features to the wrapped tile
        Tile::_add_features_to_dependents(this.clone(), &wrapped.borrow().feature_guides);
        // let the wrapped tile know that it has a dependent
        wrapped.borrow_mut().dependents.push(this.clone());
    }

    /**
     * set the screen positions of the mask
     * @param _ - the projector (not needed here)
     */
    pub fn set_screen_positions(&mut self, proj: &mut Projector, context: &RenderContext) {
        if self.r#type != Projection::S2 {
            self._set_screen_positions_s2(proj);
        } else {
            self._set_screen_positions_wm(proj);
        }
        // if WebGPU mask, we need to update the position buffer
        self.mask.update_screen_positions(context, &self.bottom_top);
    }

    /**
     * get an interactive feature's properties if it exists
     * @param id - the id of the feature
     * @returns the interactive object
     */
    pub fn get_interactive_feature(&self, id: u32) -> Option<&InteractiveObject> {
        self.interactive_guide.get(&id)
    }

    /**
     * add features to the tile
     * @param features - the features to add
     */
    pub fn add_features(&mut self, features: &[Rc<RefCell<Features>>]) {
        // filter parent tiles that were added
        let mut layer_indexes: BTreeSet<u32> =
            features.iter().map(|f| f.borrow().layer_index()).collect();
        self.feature_guides = self
            .feature_guides
            .iter()
            .filter(|f| {
                let feature = f.borrow();
                !feature.parent().is_some() && !layer_indexes.contains(&feature.layer_index())
            })
            .cloned()
            .collect();
        // add features
        self.feature_guides.extend_from_slice(features);
        // clear from sourceCheck then check if all sources are loaded
        self.layers_loaded.append(&mut layer_indexes);

        // if this tile has dependents, we need to also add these features to those tiles
        for dependent in &self.dependents {
            Tile::_add_features_to_dependents(dependent.clone(), features);
        }

        self._check_state();
    }

    /**
     * Flush message that was sent from the Source or Tile Workers letting this tile know the source and layer's state
     * @param msg - input flush messge
     */
    pub fn flush(&mut self, msg: FlushMessage) {
        for dependent in &self.dependents {
            let dependent = &mut dependent.borrow_mut();
            dependent.flush(msg.clone());
        }
        match msg {
            FlushMessage::Source(m) => self._source_flush(&m),
            FlushMessage::Tile(m) => self._tile_flush(m),
        }
        self._check_state();
    }

    /// cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
    pub fn delete(&mut self) {
        self.state = TileState::Deleted;
        self.feature_guides = vec![];
    }

    // STYLE CHANGES //

    /**
     * Delete a layer
     * @param index - the index of the layer
     */
    pub fn delete_layer(&mut self, index: u32) {
        // remove any references to layer_index
        self.feature_guides = self
            .feature_guides
            .iter()
            .filter(|f| f.borrow().layer_index() != index)
            .cloned()
            .collect();
        // all layer_indexes greater than index should be decremented once
        for feature in &mut self.feature_guides {
            let feature = &mut feature.borrow_mut();
            let index = feature.layer_index();
            if index > index {
                feature.set_layer_index(index - 1);
            }
        }
        // remove layer from dependents
        for dependent in &self.dependents {
            let dependent = &mut dependent.borrow_mut();
            dependent.delete_layer(index);
        }
    }

    /**
     * Reorder layers
     * @param layer_changes - a map of layer_index to new layer_index
     */
    pub fn reorder_layers(&mut self, layer_changes: BTreeMap<u32, u32>) {
        for feature in &mut self.feature_guides {
            let feature = &mut feature.borrow_mut();
            let change = layer_changes.get(&feature.layer_index());
            if let Some(change) = change {
                feature.set_layer_index(*change);
            }
        }
        for dependent in &self.dependents {
            let dependent = &mut dependent.borrow_mut();
            dependent.reorder_layers(layer_changes.clone());
        }
    }

    /**
     * remove all sources that match the input source_names
     * @param source_names - the names of the sources
     */
    pub fn delete_sources(&mut self, source_names: &[String]) {
        self.feature_guides = self
            .feature_guides
            .iter()
            .filter(|f| {
                let feature = f.borrow();
                !source_names.contains(&feature.source_name())
            })
            .cloned()
            .collect();
        for dependent in &self.dependents {
            let dependent = &mut dependent.borrow_mut();
            dependent.delete_sources(source_names);
        }
    }

    // DATA //

    /**
     * Inject interactive data. we don't parse the interactive_data immediately to save time
     * @param interactive_guide - the interactive guide
     * @param interactive_data - the interactive data
     */
    pub fn inject_interactive_data(
        &mut self,
        interactive_guide: &[u32],
        interactive_data: Vec<InteractiveObject>,
    ) {
        // TODO: TS code has `interactive_guide` with a step size of 3 including a start-end to parse interactive_data
        // but we need to simplify on the worker side to make this simpler Rust method to work
        for i in 0..interactive_guide.len() {
            let id = interactive_guide[i];
            self.interactive_guide.insert(id, interactive_data[i].clone());
        }
    }

    // INTERNAL //

    /**
     * currently this is for glyphs, points, and heatmaps. By sharing glyph data with children,
     * the glyphs will be rendered 4 or even more times. To alleviate this, we can set boundaries
     * of what points will be considered
     * @param parent - the parent tile
     * @returns the bounds
     */
    fn _build_bounds(&self, parent: &Tile) -> BBox {
        let mut i = self.i;
        let mut j = self.j;
        let mut zoom = self.zoom;
        let parent_zoom = parent.zoom;
        // get the scale
        let scale = (1 << (zoom - parent_zoom) as u64) as f64;
        // get i and j shift
        let mut i_shift = 0.;
        let mut j_shift = 0.;
        while zoom > parent_zoom {
            let div = (1 << (zoom - parent_zoom) as u64) as f64;
            if i % 2 != 0 {
                i_shift += 1. / div;
            }
            if j % 2 != 0 {
                j_shift += 1. / div;
            }
            // decrement
            i = i >> 1;
            j = j >> 1;
            zoom -= 1;
        }

        // build the bounds bbox
        BBox::new(i_shift, j_shift, 1. / scale + i_shift, 1. / scale + j_shift)
    }

    /**
     * given a matrix, compute the corners screen positions
     * @param projector - the camera's current view
     */
    fn _set_screen_positions_s2(&mut self, projector: &mut Projector) {
        if let Some(corners) = self.corners {
            let eye = projector.eye;
            let eye_km = eye * 1000.0;
            let matrix = &projector.get_matrix(MatrixType::Kilometers);
            // pull out the S2Points
            let Corners { bottom_left, bottom_right, top_left, top_right } = corners;
            // project points and grab their x-y positions
            let Vec4([bl_x, bl_y, _, _]) = matrix.project(&(bottom_left - eye_km));
            let Vec4([br_x, br_y, _, _]) = matrix.project(&(bottom_right - eye_km));
            let Vec4([tl_x, tl_y, _, _]) = matrix.project(&(top_left - eye_km));
            let Vec4([tr_x, tr_y, _, _]) = matrix.project(&(top_right - eye_km));
            // store for eventual uniform "upload"
            self.bottom_top.bot_left_x = bl_x;
            self.bottom_top.bot_left_y = bl_y;
            self.bottom_top.bot_right_x = br_x;
            self.bottom_top.bot_right_y = br_y;
            self.bottom_top.top_left_x = tl_x;
            self.bottom_top.top_left_y = tl_y;
            self.bottom_top.top_right_x = tr_x;
            self.bottom_top.top_right_y = tr_y;
        }
    }

    /**
     * given a basic ortho matrix, adjust by the tile's offset and scale
     * @param projector - the camera's current view
     */
    fn _set_screen_positions_wm(&mut self, projector: &mut Projector) {
        let scale = pow(2., projector.zoom - self.zoom as f64);
        let offset = ll_to_tile_px(
            &Point(projector.lon, projector.lat),
            (self.zoom, self.i, self.j),
            Some(1),
        );

        self.matrix = projector.get_matrix_wm(scale, Some(offset));

        // build bottom_top
        let bl = self.matrix.project(&Vec4([0., 0., 0., 0.]));
        let br = self.matrix.project(&Vec4([1., 0., 0., 0.]));
        let tl = self.matrix.project(&Vec4([0., 1., 0., 0.]));
        let tr = self.matrix.project(&Vec4([1., 1., 0., 0.]));
        // store for eventual uniform "upload"
        self.bottom_top.bot_left_x = bl.x();
        self.bottom_top.bot_left_y = bl.y();
        self.bottom_top.bot_right_x = br.x();
        self.bottom_top.bot_right_y = br.y();
        self.bottom_top.top_left_x = tl.x();
        self.bottom_top.top_left_y = tl.y();
        self.bottom_top.top_right_x = tr.x();
        self.bottom_top.top_right_y = tr.y();
    }

    /// Checks the state of the layers. Updates the tiles state if all layers are loaded
    fn _check_state(&mut self) {
        if self.state == TileState::Deleted {
            return;
        }
        // if all layers are loaded, set state to loaded
        if self.layers_loaded.is_superset(&self.layers_to_be_loaded) {
            self.state = TileState::Loaded;
        }
    }

    /**
     * Add features to list of dependents we need to update
     * @param dependent - the dependent
     * @param features - the features to add
     */
    fn _add_features_to_dependents(
        dependent: Rc<RefCell<Tile>>,
        features: &[Rc<RefCell<Features>>],
    ) {
        let d_features: Vec<Rc<RefCell<Features>>> = features
            .iter()
            .filter(|f| f.borrow().parent().is_none())
            .map(|f| {
                let dup_f = f.borrow().duplicate(
                    dependent.clone(),
                    f.borrow().parent().clone(),
                    f.borrow().bounds(),
                );
                Rc::new(RefCell::new(dup_f))
            })
            .collect();
        dependent.borrow_mut().add_features(&d_features);
    }

    /**
     * Flush the source data
     * @param msg - the message
     */
    fn _source_flush(&mut self, msg: &SourceFlushMessage) {
        self.layers_to_be_loaded = msg.layers_to_be_loaded.clone();
        for dependent in self.dependents.iter_mut() {
            dependent.borrow_mut()._source_flush(msg);
        }
        self._check_state();
    }

    /**
     * Flush the tile data
     * @param msg - the message
     */
    fn _tile_flush(&mut self, msg: TileFlushMessage) {
        self.feature_guides = self
            .feature_guides
            .iter()
            .filter(|f| {
                let feature = f.borrow();
                let is_dead = msg.dead_layers.contains(&feature.layer_index());
                let has_parent = feature.parent().is_some();
                // corner-case: empty data/missing tile -> flushes ALL layers,
                // but that layer MAY BE inverted so we don't kill it.
                let is_inverted = feature.inverted();
                !(is_dead && has_parent && !is_inverted)
            })
            .cloned()
            .collect();
        // remove dead layers from layers_to_be_loaded
        for dead_layer in &msg.dead_layers {
            self.layers_loaded.remove(dead_layer);
        }
    }
}
// https://www.youtube.com/shorts/mWf6bWi-MjA

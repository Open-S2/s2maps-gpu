use crate::{
    style::{Alignment, Anchor},
    workers::{
        Glyph, GlyphBase, GlyphPath, GlyphPoint, GlyphPointFilter, GlyphType, MapGlyphSource, Path,
        RoundNode, get_path_pos,
    },
};
use libm::fmax;
use s2json::{GetXY, Point, VectorPoint};

/// Quads
/// - BOX: [s, t, x_offset, y_offset, x_pos, y_pos, width, height, tex_x, tex_y, tex_width, tex_height]
/// - CIRCLE: [s, t, x_offset, y_offset, path1X, path1Y, path2X, path2Y, path3X, path3Y, path4X, path4Y, distance, tex_x, tex_y, tex_width, tex_height]
///
/// the x_pos and y_pos are for the 0->1 ratio placement. This is computed internally with size
/// meanwhile x_offset and y_offset are where to start from the s, t position (the pixel based offset)
pub type Quad = Vec<f32>;

/// BOX: [s, t, anchor_offset_x, anchor_offset_y, offset_x, offset_y, padding_x, padding_y, max_width, max_height, index, id]
/// CIRCLE: [s, t, anchor_offset_x, anchor_offset_y, offset_x, offset_y, padding_x, padding_y, max_width, max_height, index, id]
pub type Filter = Vec<f32>;

/** Row: [row_count, row_width, row_height] */
#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub struct Row {
    pub row_count: u32,
    pub row_width: u32,
    pub row_height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
#[allow(missing_docs)]
pub enum GlyphDrawType {
    Text,
    Path,
}

/// Size of each quad for text type
pub const QUAD_SIZE_TEXT: usize = 12;
/// Size of each quad for path type
pub const QUAD_SIZE_PATH: usize = 20;

/// This step exclusively creates quad data, E.G. How to draw each glyph on the screen,
/// given the anchor point as a basis for drawing. This step is seperate to preprocessing
/// as we are avoiding doing too much work prior to potentially filtering the object (rtree).
///
/// NOTE: EVERY GLYPH is currently "normalized", with a 0->1 scale so it can later be
/// multiplied by "size"
///
/// NOTE: Just put the glyph offsets + word-wrap-y offset provided at first,
/// add in the excess anchor offset AFTER we know the bbox size
///
/// TODO: https://blog.mapbox.com/beautifying-map-labels-with-better-line-breaking-2a6ce3ed432
///
/// ## Parameters
/// - `feature`: input glyph point feature
/// - `glyph_source`: glyph source to pull glyph metadata from
/// - `tile_size`: tile size/extent
pub fn build_glyph_point_quads(
    feature: &mut GlyphPoint,
    glyph_source: &MapGlyphSource,
    tile_size: f64,
) {
    let GlyphBase {
        size,
        offset,
        padding,
        family,
        anchor,
        field_codes,
        word_wrap,
        align,
        kerning,
        line_height,
        r#type,
        quads,
        ..
    } = &mut feature.base;
    let GlyphPoint { s, t, .. } = *feature;
    let Point(offset_x, offset_y) = *offset;
    let Point(padding_x, padding_y) = *padding;
    // setup variable
    let mut rows: Vec<Row> = vec![]; // a row: [glyph_count, row_max_width, row_max_height]
    let mut row_count: u32 = 0;
    let mut row_width = 0.;
    let mut row_height = 0.;
    let mut cursor_x = 0.;
    // run through string using the glyphSet as a guide to build the quads
    for unicode in field_codes {
        // word-wrap if line break or length exceeds max allowed.
        if *r#type == GlyphType::Text && // is text
              (unicode == "10" ||
                unicode == "13" ||
                (unicode == "32" && *word_wrap != 0. && cursor_x >= *word_wrap))
        {
            cursor_x = 0.;
            let height_adjust = if row_count > 0 { row_height + *line_height } else { 0. };
            update_glyph_pos(quads, 0., height_adjust, None); // we move all previous content up a row
            rows.push(Row {
                row_count: row_count as u32,
                row_width: row_width as u32,
                row_height: height_adjust as u32,
            });
            row_count = 0;
            row_width = 0.;
            row_height = 0.;
            continue;
        }
        // grab the unicode information
        let unicode_data = get_glyph(glyph_source, family, unicode.clone());
        let Glyph {
            tex_x,
            tex_y,
            tex_w,
            tex_h,
            x_offset,
            y_offset,
            width,
            height,
            advance_width,
            ..
        } = unicode_data;
        // prep x-y positions
        let x_pos = cursor_x + x_offset;
        let y_pos = y_offset;
        if tex_w > 0. && tex_h > 0. {
            // store quad
            quads.extend(vec![
                // NOTE: offset_x and offset_y are the pixel based offset
                // while x_pos and y_pos are the 0->1 glyph ratio placement
                // position data
                s as f32,
                t as f32,
                offset_x as f32,
                offset_y as f32,
                x_pos,
                y_pos,
                width,
                height, // texture data
                tex_x,
                tex_y,
                tex_w,
                tex_h,
            ]);
            // update number of glyphs and draw box height
            row_count += 1;
            row_height = f32::max(row_height, height);
        }
        // always update row_width by advance_width
        row_width = f32::max(f32::max(row_width, x_pos + width), x_pos + advance_width);
        // advance cursor position
        cursor_x += advance_width + *kerning;
    }
    // store the last row
    rows.push(Row {
        row_count: row_count as u32,
        row_width: row_width as u32,
        row_height: if row_count > 0 { (row_height + *line_height) as u32 } else { 0 },
    });
    // grab max width from said
    let max_width = rows.iter().map(|r| r.row_width).sum::<u32>() as f32;
    let max_height = rows.iter().map(|r| r.row_height).sum::<u32>() as f32;
    // adjust text based upon center-align or right-align
    align_text(*align, quads, &rows, max_width, None);
    // now adjust all glyphs and max-values by the anchor and alignment
    let [anchor_offset_x, anchor_offset_y] = anchor.offset_point(max_width, max_height);
    update_glyph_pos(quads, anchor_offset_x, anchor_offset_y, None);

    // set min_x, max_x, min_y, max_y in the feature
    let size = *size as f64;
    let anchor_offset_x_f64 = anchor_offset_x as f64;
    let anchor_offset_y_f64 = anchor_offset_y as f64;
    let max_width_f64 = max_width as f64;
    let max_height_f64 = max_height as f64;
    feature.node.min_x = s * tile_size + offset_x + anchor_offset_x_f64 * size - padding_x;
    feature.node.min_y = t * tile_size + offset_y + anchor_offset_y_f64 * size - padding_y;
    feature.node.max_x = feature.node.min_x + max_width_f64 * size + padding_x * 2.;
    feature.node.max_y = feature.node.min_y + max_height_f64 * size + padding_y * 2.;
    // store the filter
    feature.filter = GlyphPointFilter {
        s: s as f32,
        t: t as f32,
        x_pos: anchor_offset_x,
        y_pos: anchor_offset_y,
        offset_x: offset_x as f32,
        offset_y: offset_y as f32,
        padding_x: padding_x as f32,
        padding_y: padding_y as f32,
        max_width,
        max_height,
    };
}

/// Build glyph path quads
/// IDEATION: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
///
/// ## Parameters
/// - `feature`: glyph lines feature
/// - `glyph_source`: glyph source to pull glyph metadata from
/// - `tile_size`: tile size/extent
pub fn build_glyph_path_quads(
    feature: &mut GlyphPath,
    glyph_source: &MapGlyphSource,
    tile_size: f64,
) {
    // NOTE: missing "size" and "padding"
    let GlyphPath { path_data, .. } = feature;
    let GlyphBase { size, offset, family, anchor, align, kerning, field_codes, padding, .. } =
        &feature.base;
    let Point(offset_x, offset_y) = *offset;
    let padding = fmax(padding.0, padding.1);
    let VectorPoint { x: s, y: t, .. } = path_data.point;
    let path_left = path_data.path_left;
    let path_right = path_data.path_right;
    // first replace all newlines with spaces
    let field_codes: Vec<String> = field_codes
        .iter()
        .map(|unicode| {
            if unicode == "10" || unicode == "13" {
                return "32".into();
            } else {
                return unicode.clone();
            }
        })
        .collect();
    // setup variable
    let mut max_width = 0.;
    let mut max_height = 0.;
    let mut cursor_x = 0.;
    // run through string using the glyphSet as a guide to build the quads
    let mut quads: Vec<f32> = vec![];
    for unicode in field_codes {
        // grab the unicode information
        let unicode_data = get_glyph(glyph_source, family, unicode);
        let Glyph {
            tex_x,
            tex_y,
            tex_w,
            tex_h,
            x_offset,
            y_offset,
            width,
            height,
            advance_width,
            ..
        } = unicode_data;
        max_height = fmax(max_height, height as f64);
        // prep x-y positions & distance
        let x_pos = cursor_x + x_offset + width / 2.;
        let y_pos = y_offset + height / 2.;
        // skip no texture data like spaces
        if tex_w > 0. && tex_h > 0. {
            // NOTE: tex_x, tex_y, tex_w, tex_h, offset_x, and offset_y are the pixel based values
            // while x_pos, y_pos, width, and height are the 0->1 ratio placement to user defined size
            // st is 0->1 ratio relative to tile size
            quads.extend(
                // position data
                vec![
                    s as f32,
                    t as f32,
                    offset_x as f32,
                    offset_y as f32,
                    x_pos,
                    y_pos,
                    width,
                    height, // texture data
                    tex_x,
                    tex_y,
                    tex_w,
                    tex_h, // tmp path data
                    0.,
                    0.,
                    0.,
                    0.,
                    0.,
                    0.,
                    0.,
                    0.,
                ],
            );
        }
        max_width = fmax(fmax(max_width, (x_pos + width) as f64), (x_pos + advance_width) as f64);
        // advance cursor position
        cursor_x += advance_width + kerning;
    }
    // adjust text based upon center-align or right-align
    align_text(
        *align,
        &mut quads,
        &vec![Row { row_count: 0, row_width: max_width as u32, row_height: 0 }],
        max_width as f32,
        Some(GlyphDrawType::Path),
    );
    // now adjust all glyphs and max-values by the anchor and alignment
    let [anchor_offset_x, anchor_offset_y] =
        anchor.offset_path(max_width as f32, max_height as f32);
    update_glyph_pos(&mut quads, anchor_offset_x, anchor_offset_y, Some(GlyphDrawType::Path));
    // set the correct path data relative to whether the glyph is traveling
    // left or right from the anchor point
    update_path_data(&mut quads, &path_left, &path_right);
    // add nodes to the feature for each quad
    build_feature_nodes(feature, &quads, &path_left, &path_right, *size as f64, padding, tile_size);
    // last step is to build the filter container paths. For each quad just
    // copy paste a slice from st to end of path, add padding, and store to filters
    store_path_feature_filters(feature, &quads, padding as f32);
    // store quads in feature
    feature.base.quads.extend(quads);
}

/// Get a glyph's metadata from the glyph source
///
/// ## Parameters
/// - `glyph_source`: glyph source
/// - `family`: glyph family
/// - `code`: glyph code
///
/// ## Returns
/// The glyph metadata
fn get_glyph(glyph_source: &MapGlyphSource, family: &[String], code: String) -> Glyph {
    for family_name in family {
        let glyph_family = glyph_source.get_family(family_name);
        if glyph_family.is_none() {
            continue;
        }
        if let Some(glyph) = glyph_family.unwrap().glyph_cache.get(&code) {
            return glyph.clone();
        }
    }
    Glyph::null()
}

/// Update the position of the glyphs
///
/// ## Parameters
/// - `quads`: glyph quads
/// - `offset_x`: x offset
/// - `offset_y`: y offset
/// - `glyph_type`: glyph type
fn update_glyph_pos(
    quads: &mut [f32],
    offset_x: f32,
    offset_y: f32,
    glyph_type: Option<GlyphDrawType>,
) {
    let glyph_type = glyph_type.unwrap_or(GlyphDrawType::Text);
    let quad_size = if glyph_type == GlyphDrawType::Text { QUAD_SIZE_TEXT } else { QUAD_SIZE_PATH };
    for i in (0..quads.len()).step_by(quad_size) {
        quads[i + 4] += offset_x;
        quads[i + 5] += offset_y;
    }
}

impl Anchor {
    /// Set an user defined anchor offset. boxes start at the bottom left as UV [0,0] to [1, 1]
    ///
    /// ## Parameters
    /// - `anchor`: anchor type
    /// - `width`: full width of all glyphs in the line or paragrpah
    /// - `height`: full height of all glyphs in the line or paragrpah
    ///
    /// ## Returns
    /// The anchor offset
    pub fn offset_point(&self, width: f32, height: f32) -> [f32; 2] {
        match self {
            Anchor::Center => [-width / 2.0, -height / 2.0],
            Anchor::Top => [-width / 2.0, -height],
            Anchor::TopRight => [-width, -height],
            Anchor::Right => [-width, -height / 2.0],
            Anchor::BottomRight => [-width, 0.0],
            Anchor::Bottom => [-width / 2.0, 0.0],
            Anchor::BottomLeft => [0.0, 0.0],
            Anchor::Left => [0.0, -height / 2.0],
            Anchor::TopLeft => [0.0, -height],
        }
    }

    /// Set a user defined anchor offset for path glyphs
    /// the path drawing takes [-0.5, -0.5] to [0.5, 0.5] quads
    ///
    /// ## Parameters
    /// - `anchor`: anchor type
    /// - `width`: full width of all glyphs in the line or paragrpah
    /// - `height`: full height of all glyphs in the line or paragrpah
    ///
    /// ## Returns
    /// The anchor offset
    pub fn offset_path(&self, width: f32, height: f32) -> [f32; 2] {
        match self {
            Anchor::Center => [-width / 2.0, 0.],
            Anchor::Top => [-width / 2.0, -height / 2.],
            Anchor::TopRight => [-width, -height / 2.],
            Anchor::Right => [-width, 0.],
            Anchor::BottomRight => [-width, height / 2.],
            Anchor::Bottom => [-width / 2.0, height / 2.],
            Anchor::BottomLeft => [0., height / 2.],
            Anchor::Left => [0., 0.],
            Anchor::TopLeft => [0., -height / 2.],
        }
    }
}

/// Align text given a user defined alignment
///
/// ## Parameters
/// - `align`: alignment
/// - `quads`: glyph quads
/// - `rows`: rows and their size,width,& height
/// - `max_width`: max width found from all rows
/// - `glyph_type`: glyph type (text or path)
fn align_text(
    align: Alignment,
    quads: &mut [f32],
    rows: &[Row],
    max_width: f32,
    glyph_type: Option<GlyphDrawType>,
) {
    let glyph_type = glyph_type.unwrap_or(GlyphDrawType::Text);
    let quad_size = if glyph_type == GlyphDrawType::Text { QUAD_SIZE_TEXT } else { QUAD_SIZE_PATH };
    if align != Alignment::Center && align != Alignment::Right {
        return;
    }
    let align_func = if align == Alignment::Center {
        // center align
        |m_w: f32, r_w: f32| -> f32 { (m_w - r_w) / 2. }
    } else {
        // right align
        |m_w: f32, r_w: f32| -> f32 { m_w - r_w }
    };

    let mut curr_pos = 0;
    // iterate rows, grab their count and width, adjust as necessary
    for Row { row_count, row_width, .. } in rows {
        let row_width = *row_width as f32;
        // if row is same size as the width of the display box, move on
        if row_width == max_width {
            curr_pos += row_count;
            continue;
        }
        // find the alignment based upon the rows width and the total draw box width
        let adjust = align_func(max_width, row_width);
        // iterate the rows, adding the x-y adjustment as appropriate
        for _ in 0..(*row_count) {
            let idx = (curr_pos as usize) * quad_size;
            quads[idx + 4] += adjust;
            curr_pos += 1;
        }
    }
}

/// Update path data's x and y
///
/// ## Parameters
/// - `quads`: glyph quads
/// - `path_left`: left path
/// - `path_right`: right path
fn update_path_data(quads: &mut Quad, path_left: &Path, path_right: &Path) {
    let mut i = 0;
    while i < quads.len() {
        let path = (if quads[i + 4] >= 0.0 { path_right } else { path_left }).to_vec();
        for j in 0..4 {
            quads[i + 12 + j * 2] = path[j].x() as f32;
            quads[i + 13 + j * 2] = path[j].y() as f32;
        }
        i += QUAD_SIZE_PATH;
    }
}

/// Build feature nodes
///
/// ## Parameters
/// - `feature`: glyph feature
/// - `quads`: glyph quads
/// - `path_left`: left path
/// - `path_right`: right path
/// - `size`: glyph size
/// - `padding`: glyph padding
/// - `tile_size`: tile size
fn build_feature_nodes(
    feature: &mut GlyphPath,
    quads: &[f32],
    path_left: &Path,
    path_right: &Path,
    size: f64,
    padding: f64,
    tile_size: f64,
) {
    let mut i = 0;
    while i < quads.len() {
        let quad_pos = &quads[i..i + 6];
        let VectorPoint { x, y, .. } =
            get_path_pos::<()>(quad_pos.into(), path_left, path_right, tile_size, size);
        feature.nodes.nodes.push(RoundNode { x, y, r: size / 2.0 + padding });
        i += QUAD_SIZE_PATH;
    }
}

/// Store path feature's filters for the GPU to filter overalapping glyphs
///
/// ## Parameters
/// - `feature`: glyph feature
/// - `quads`: glyph quads
/// - `padding`: glyph padding
fn store_path_feature_filters(feature: &mut GlyphPath, quads: &Quad, padding: f32) {
    let mut i = 0;
    while i < quads.len() {
        // st, offset_xY, xy
        feature.filters.extend(&quads[i..i + 6]);
        // paths
        feature.filters.extend(&quads[i + 12..i + 20]);
        // padding
        feature.filters.push(padding);
        i += QUAD_SIZE_PATH;
    }
}

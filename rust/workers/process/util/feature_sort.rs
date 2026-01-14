use crate::workers::{Feature, GlyphObject};
use core::cmp::Ordering;

impl PartialOrd for Feature {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // first layer index
        let mut diff = self.layer_index().cmp(&other.layer_index());
        // if diff is still 0, sort by code
        if diff == Ordering::Equal {
            diff = self.gl2_code().partial_cmp(&other.gl2_code()).unwrap_or(Ordering::Equal);
        }

        Some(diff)
    }
}
impl Eq for Feature {}
impl Ord for Feature {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap()
    }
}

impl PartialOrd for GlyphObject {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // first layer index
        let mut diff = self.layer_index().cmp(&other.layer_index());
        // sort by render type if layer index is the same
        if diff == Ordering::Equal {
            diff = self.render_type().cmp(&other.render_type());
        }
        // sort by glyph type if render type is the same
        if diff == Ordering::Equal {
            diff = self.glyph_type().cmp(&other.glyph_type());
        }
        // if diff is still 0, sort by code
        if diff == Ordering::Equal {
            diff = self.gl2_code().partial_cmp(&other.gl2_code()).unwrap_or(Ordering::Equal);
        }

        Some(diff)
    }
}
impl Eq for GlyphObject {}
impl Ord for GlyphObject {
    fn cmp(&self, other: &Self) -> Ordering {
        self.partial_cmp(other).unwrap()
    }
}

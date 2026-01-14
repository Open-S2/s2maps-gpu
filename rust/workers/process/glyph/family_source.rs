// import type { ColorArray } from 'style/color/index.js';
// import type { S2CellId } from 'gis-tools/index.js';
// import type { ImageMetadata, ImageSourceMetadata } from 'workers/source/imageSource.js';

use crate::style::ColorArray;
use alloc::{
    collections::{btree_map::BTreeMap, btree_set::BTreeSet},
    string::String,
    vec::Vec,
};
use gistools::geometry::S2CellId;

/** A Glyph Container. Tracks all the glyph's properties, shape, size, etc. */
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Glyph {
    /** code represents either the unicode value or substitution value */
    pub code: String,
    /** tex_x is the x position on the texture sheet */
    pub tex_x: f32,
    /** tex_y is the y position on the texture sheet */
    pub tex_y: f32,
    /** tex_w is the width of the glyph on the texture sheet */
    pub tex_w: f32,
    /** tex_h is the height of the glyph on the texture sheet */
    pub tex_h: f32,
    /** x_offset is the x offset for the glyph */
    pub x_offset: f32,
    /** y_offset is the y offset for the glyph */
    pub y_offset: f32,
    /** width is the width of the glyph */
    pub width: f32,
    /** height is the height of the glyph */
    pub height: f32,
    /** advance_width is how far to move the cursor */
    pub advance_width: f32,
}
impl Glyph {
    /// Create a null glyph
    pub fn null() -> Self {
        Glyph { ..Default::default() }
    }
}

/** An Icon's id/name and it's associative color */
#[derive(Debug, Clone, PartialEq)]
pub struct IconPiece {
    /** glyph_id is the glyph_id of the icon */
    pub glyph_id: String,
    /** color_id is the color_id of the icon */
    pub color: ColorArray,
}
/** List of IconPieces */
pub type Icon = Vec<IconPiece>;

/** Ligature Substitution Tree Node */
#[derive(Debug, Clone, PartialEq)]
pub struct LigatureSubstitute {
    /// The substitution value
    pub substitute: String,
    /// The unicode components
    pub components: Vec<String>,
}
/** Ligature Substitution Tree */
#[derive(Debug, Clone, PartialEq)]
pub struct LigatureTree {
    /// The unicode components
    pub tree: BTreeMap<u32, LigatureTree>,
    /** unicode substitute if it ends here */
    pub substitute: Option<String>,
}
/** Icon's name id and color id, whereas an `IconPiece`, the color is mapped */
#[derive(Debug, Clone, PartialEq)]
pub struct IconDefinition {
    /// The unicode of the icon
    pub glyph_id: String,
    /// Pointer to the color of the icon
    pub color_id: u32,
}
/** Map of icons to their collection of images that make them up */
pub type IconMap = BTreeMap<String, Vec<IconDefinition>>; // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)
/** Set of unicodes that are part of the family */
pub type GlyphSet = BTreeSet<String>;
/** Map of IDs to RGBA colors */
pub type ColorMap = BTreeMap<u32, ColorArray>;

/**
 * # Family Source
 *
 * Maintain a store of the Font/Icon family, it's glyphs, ligatures, icons, and colors associated
 * with it. Make requests to the source worker for missing glyphs.
 */
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct FamilySource {
    pub name: String,
    pub extent: f64,             // number = 0;
    pub default_advance: f64,    // number = 0;
    pub glyph_set: GlyphSet,     // = new Set(); // existing glyphs
    pub ligatures: LigatureTree, // = {};
    // cache system
    pub glyph_cache: BTreeMap<String, Glyph>, // = new Map<string, Glyph>(); // glyphs we have built already
    pub icon_cache: BTreeMap<String, Icon>,   // = new Map<string, Icon>();
    // track missing glyphs for future requests to the source worker
    pub glyph_request_list: BTreeMap<S2CellId, BTreeSet<String>>, // = new Map<S2CellId, Set<string>>();
    pub is_icon: bool,                                            // = false;
}
//   /**
//    * @param name - the name of the family
//    * @param metadata - the raw metadata to unpack
//    */
//   constructor(name: string, metadata?: ArrayBuffer) {
//     this.name = name;
//     if (metadata === undefined) return;
//     const meta = new DataView(metadata);
//     this.extent = meta.getUint16(0, true);
//     this.default_advance = meta.getUint16(8, true) / this.extent;
//     const glyphCount = meta.getUint16(10, true);
//     const iconMapSize = meta.getUint32(12, true);
//     const colorBufSize = meta.getUint16(16, true) * 4;
//     const substituteSize = meta.getUint32(18, true);
//     this.is_icon = iconMapSize > 0;

//     // store glyph_set
//     const glyphEnd = 30 + glyphCount * 2;
//     const gmdv = new DataView(metadata, 30, glyphCount * 2);
//     for (let i = 0; i < glyphCount; i++) {
//       this.glyph_set.add(String(gmdv.getUint16(i * 2, true)));
//     }
//     // build icon metadata
//     const iconMap = this.#buildIconMap(iconMapSize, new DataView(metadata, glyphEnd, iconMapSize));
//     const colors = this.#buildColorMap(
//       colorBufSize,
//       new DataView(metadata, glyphEnd + iconMapSize, colorBufSize),
//     );
//     // store the icon
//     for (const [name, pieces] of Object.entries(iconMap)) {
//       this.icon_cache.set(
//         name,
//         pieces.map((piece) => {
//           return { glyph_id: piece.glyph_id, color: colors[piece.color_id] };
//         }),
//       );
//     }
//     this.#buildSubstituteMap(
//       substituteSize,
//       new DataView(metadata, glyphEnd + iconMapSize + colorBufSize, substituteSize),
//     );

//     // store space (32)
//     if (!this.is_icon)
//       this.glyph_cache.set('32', {
//         code: '32',
//         tex_x: 0,
//         tex_y: 0,
//         tex_w: 0,
//         tex_h: 0,
//         x_offset: 0,
//         y_offset: 0,
//         width: 0,
//         height: 0,
//         advance_width: this.default_advance,
//       });
//   }

//   /**
//    * Given an image metadata input, build a FamilySource
//    * @param imageSource - the image metadata
//    * @returns a new FamilySource
//    */
//   static FromImageMetadata(imageSource: ImageSourceMetadata): FamilySource {
//     const { name, metadata } = imageSource;
//     const fs = new FamilySource(name);
//     fs.addMetadata(metadata);
//     return fs;
//   }

//   /**
//    * Check if the Family Source has an existing glyph/icon
//    * @param code - glyph code
//    * @returns true if the glyph/icon exists
//    */
//   has(code: string): boolean {
//     return this.glyph_set.has(code);
//   }

//   /**
//    * Check if this source is missing a glyph/icon
//    * @param code - the code of the glyph/icon
//    * @returns true if the glyph/icon is missing
//    */
//   missingGlyph(code: string): boolean {
//     const { is_icon, glyph_set, glyph_cache } = this;
//     if (is_icon) return !glyph_cache.has(code);
//     return glyph_set.has(code) && !glyph_cache.has(code);
//   }

//   /**
//    * Add image metadata to the source
//    * @param metadata - the image metadata
//    */
//   addMetadata(metadata: ImageMetadata): void {
//     for (const [code, glyph] of Object.entries(metadata)) {
//       this.glyph_set.add(code);
//       this.glyph_cache.set(code, glyph);
//       if (!this.icon_cache.has(code))
//         this.icon_cache.set(code, [{ glyph_id: code, color: [0, 0, 0, 0] }]);
//     }
//   }

//   /**
//    * Add a glyph request to be processed
//    * @param tileID - the id of the tile that requested the glyph
//    * @param code - the code of the glyph/icon
//    */
//   addGlyphRequest(tileID: S2CellId, code: string): void {
//     if (!this.glyph_request_list.has(tileID)) this.glyph_request_list.set(tileID, new Set());
//     const requests = this.glyph_request_list.get(tileID);
//     requests?.add(code);
//   }

//   /**
//    * Get the glyph requests for a tile
//    * @param tileID - the id of the tile that requested the glyph/icon
//    * @returns the list of glyph/icon requests
//    */
//   getRequests(tileID: S2CellId): string[] {
//     const glyphList = this.glyph_request_list.get(tileID) ?? new Set<string>();
//     // cleanup requests that we are pulling from the cache
//     this.glyph_request_list.delete(tileID);

//     return [...glyphList];
//   }

//   /**
//    * Build a collection of icons and their associated glyphs & colors
//    * @param iconMapSize - the size of the icon map
//    * @param dv - the data view to read from
//    * @returns the icon map
//    */
//   #buildIconMap(iconMapSize: number, dv: DataView): IconMap {
//     const iconMap: IconMap = {};
//     let pos = 0;
//     while (pos < iconMapSize) {
//       const nameLength = dv.getUint8(pos);
//       const mapLength = dv.getUint8(pos + 1);
//       pos += 2;
//       const id: number[] = [];
//       for (let i = 0; i < nameLength; i++) id.push(dv.getUint8(pos + i));
//       const name = id.map((n) => String.fromCharCode(n)).join('');
//       pos += nameLength;
//       const map: IconDefinition[] = [];
//       for (let i = 0; i < mapLength; i++) {
//         map.push({
//           glyph_id: String(dv.getUint16(pos, true)),
//           color_id: dv.getUint16(pos + 2, true),
//         });
//         pos += 4;
//       }
//       iconMap[name] = map;
//     }

//     return iconMap;
//   }

//   /**
//    * Build a collection of colors
//    * @param colorSize - the size of the color map
//    * @param dv - the data view to read from
//    * @returns the color map
//    */
//   #buildColorMap(colorSize: number, dv: DataView): ColorArray[] {
//     const colors: ColorArray[] = [];
//     for (let i = 0; i < colorSize; i += 4) {
//       colors.push([dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3)]);
//     }

//     return colors;
//   }

//   /**
//    * Build a collection of ligature substitutions
//    * @param substituteSize - the size of the ligature map
//    * @param dv - the data view to read from
//    */
//   #buildSubstituteMap(substituteSize: number, dv: DataView): void {
//     let pos = 0;
//     while (pos < substituteSize) {
//       const type = dv.getUint8(pos);
//       if (type === 4) {
//         // LIGATURE TYPE
//         const count = dv.getUint8(pos + 1);
//         const components: string[] = [];
//         for (let j = 0; j < count; j++) {
//           components.push(String(dv.getUint16(pos + 2 + j * 2, true)));
//         }
//         const substitute = components.join('.');
//         this.glyph_set.add(substitute);
//         let tree = this.ligatures;
//         for (const component of components) {
//           const unicode = Number(component);
//           if (tree[unicode] === undefined) tree[unicode] = {};
//           tree = tree[unicode];
//         }
//         tree.substitute = substitute;
//         pos += 2 + count * 2;
//       } else {
//         throw new Error(`Unknown substitute type: ${type}`);
//       }
//     }
//   }

//   /**
//    * Zero Width Joiner pass goes first
//    * @param strCodes - array of codes to parse
//    * @param zwjPass - true if we are in the zero width joiner pass
//    */
//   parseLigatures(strCodes: string[], zwjPass = false): void {
//     // iterate through the unicodes and follow the tree, if we find a substitute,
//     // replace the unicodes with the substitute, but don't stop diving down the tree until we don't find
//     // a substitute. This is because we want to find the longest ligature match possible.
//     for (let i = 0; i < strCodes.length; i++) {
//       let code = Number(strCodes[i]);
//       let tree = this.ligatures;
//       let j = i;
//       let zwj = false;
//       while (tree[code] !== undefined) {
//         if (code === 8205) zwj = true;
//         tree = tree[code];
//         if (tree.substitute !== undefined && (zwjPass ? zwj : true)) {
//           strCodes.splice(i, j - i + 1, tree.substitute);
//         } else {
//           j++;
//         }
//         code = Number(strCodes[j]);
//       }
//     }
//   }
// }

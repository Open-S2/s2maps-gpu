// import { zagzig } from 'open-vector-tile';
use crate::{
    util::{MsgSender, fetch_url},
    workers::{Glyph, MapID, Session, TexturePack, TileWorkerMessage},
};
use alloc::{
    collections::{BTreeMap, BTreeSet},
    rc::Rc,
    string::String,
    vec::Vec,
};
use core::cell::RefCell;
use gistools::parsers::Buffer;

/// Unparsed state of glyph metadata, letting Tile Workers know of what glyphs are available
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphMetadataUnparsed {
    pub name: String,
    pub metadata: Option<Buffer>,
}
/// Actual glyph metadata for the Tile Worker to know how to shape and prepare glyphs for rendering
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphMetadata {
    pub name: String,
    pub metadata: Buffer,
}

/// An incoming lost of icon requests. Each string is the name of an icon
pub type IconRequest = BTreeSet<String>; // [iconName, iconName, iconName, ...]
/// Glyph request promise
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphPromise {
    pub id: [char; 16],
}
/// Glyph Image shape stored for future requests from Tile Workers
#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphImage {
    pub pos_x: u32,
    pub pos_y: u32,
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}
/// Collection of Glyph Images
pub type GlyphImages = Vec<GlyphImage>;

#[derive(Debug, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphRequest {
    request: String,
    substitutes: Vec<String>,
}

/// # Glyph Source
///
/// A glyph source manager to request metadata, glyphs, and images
#[derive(Debug)]
#[allow(missing_docs)]
pub struct GlyphSource {
    pub active: bool,
    pub extent: f64,
    pub name: String,
    pub path: String,
    pub size: f64,
    pub default_advance: f64,
    pub max_height: f64,
    pub range: f64,
    pub texture_pack: Rc<TexturePack>,
    pub session: Rc<RefCell<Session>>,
    pub glyph_waitlist: BTreeMap<String, GlyphPromise>,
    pub glyph_cache: BTreeMap<String, Glyph>, // glyphs we have built already
    pub is_icon: bool,
}
impl GlyphSource {
    /// Create a new glyph source
    ///
    /// ## Parameters
    /// - `name`: the name of the source
    /// - `path`: the path to the source
    /// - `texture_pack`: the texture pack to help define where the glyphs/images are stored
    /// - `session`: the session
    pub fn new(
        name: String,
        path: String,
        texture_pack: Rc<TexturePack>,
        session: Rc<RefCell<Session>>,
    ) -> Self {
        Self {
            active: true,
            extent: 0.0,
            name,
            path,
            size: 0.0,
            default_advance: 0.0,
            max_height: 0.0,
            range: 0.0,
            texture_pack,
            session,
            glyph_waitlist: BTreeMap::new(),
            glyph_cache: BTreeMap::new(),
            is_icon: false,
        }
    }

    /// Build the source data
    ///
    /// ## Parameters
    /// - `map_id`: the id of the map
    ///
    /// ## Returns
    /// The metadata, yet to be parsed
    pub async fn build(&mut self, map_id: MapID) -> GlyphMetadataUnparsed {
        let metadata = self._fetch(format!("{:?}?type=metadata", self.path), map_id).await;

        if let Some(metadata) = metadata {
            self._build_metadata(metadata)
        } else {
            self.active = false;
            // panic!("FAILED TO extrapolate {path} metadata");
            GlyphMetadataUnparsed { name: self.name.clone(), metadata: None }
        }
    }

    /// Build metadata from a buffer
    ///
    /// ## Parameters
    /// - `metadata`: the metadata buffer
    ///
    /// ## Returns
    /// The metadata
    fn _build_metadata(&mut self, mut metadata: Buffer) -> GlyphMetadataUnparsed {
        // build the metadata
        self.extent = metadata.get_u16_at(0) as f64;
        self.size = metadata.get_u16_at(2) as f64;
        self.max_height = metadata.get_u16_at(4) as f64;
        self.range = metadata.get_u16_at(6) as f64;
        self.default_advance = metadata.get_u16_at(8) as f64 / self.extent;
        self.is_icon = metadata.get_u32_at(12) > 0;
        // return the metadata so it can be shipped to the worker threads
        GlyphMetadataUnparsed { name: self.name.clone(), metadata: Some(metadata) }
    }

    /// Given a collection of unicodes, request the glyphs from the server
    ///
    /// ## Parameters
    /// - `request`: array of unicodes
    /// - `map_id`: the id of the map we are fetching data for
    /// - `req_id`: the id of the request
    /// - `worker`: the worker port
    pub async fn glyph_request(
        &self,
        request: Vec<String>, // array of codes
        map_id: MapID,
        req_id: String,
        worker: MsgSender<TileWorkerMessage>,
    ) {
        //     const { glyph_cache, glyph_waitlist, name } = this;

        //     const promiseList: Array<Promise<void>> = [];
        //     const request_list: string[] = [];
        //     const waitlist_promise_map = new Map<string, Promise<void>>();
        //     for (const code of request) {
        //       // 1) already cached in glyph_cache; do nothing
        //       if (glyph_cache.has(code)) continue;
        //       // 2) already exists in the glyph_waitlist (downloading)
        //       if (glyph_waitlist.has(code)) {
        //         const promise = glyph_waitlist.get(code) as GlyphPromise<void>;
        //         waitlist_promise_map.set(promise.id, promise);
        //       } else {
        //         // 5) no one has it
        //         request_list.push(code);
        //       }
        //     }
        //     // create THIS glyphs missing glyphs request
        //     if (request_list.length > 0) {
        //       const promise = this._request_glyphs(request_list, map_id) as GlyphPromise<void>;
        //       promise.id = genID();
        //       promiseList.push(promise);
        //       for (const unicode of request_list) glyph_waitlist.set(unicode, promise);
        //     }
        //     // add all waitlist promises
        //     for (const [, promise] of waitlist_promise_map) promiseList.push(promise);

        //     await Promise.all(promiseList);
        //     // convert glyphList into a Float32Array of unicode data and ship it out
        //     const glyphMetadata: Glyph[] = [];
        //     for (const unicode of request) {
        //       const glyph = glyph_cache.get(unicode);
        //       if (glyph !== undefined) glyphMetadata.push(glyph);
        //     }
        //     const glyphResponseMessage: GlyphResponseMessage = {
        //       map_id,
        //       type: 'glyphresponse',
        //       req_id,
        //       glyphMetadata,
        //       familyName: name,
        //     };
        //     worker.postMessage(glyphResponseMessage);
        todo!()
    }

    /// Request glyphs
    ///
    /// ## Parameters
    /// - `list`: array of unicodes to request their data for
    /// - `map_id`: the id of the map
    async fn _request_glyphs(&self, list: Vec<String>, map_id: MapID) {
        //     const { is_icon, extent, glyph_cache, glyph_waitlist, max_height, texture_pack } = this;
        // 1) build the ranges, max 35 glyphs per request
        let requests = self._build_requests(list);
        // 2) return the request promise, THEN: store the glyphs in cache, build the images, and ship the images to the map_id
        let mut promises = vec![];
        for GlyphRequest { request, substitutes } in requests {
            promises.push(async move {
                let Some(dv) = self._fetch(request, map_id).await else { return };
                let mut images: Vec<GlyphImages> = vec![];
                //   let dv = glyphs_buf;
                let size = dv.len() - 1;
                let mut pos = 0;
                while pos < size {
                    //             // build glyph metadata
                    //             let code = String(dv.getUint16(pos, true));
                    //             if (!is_icon && code === '0') code = substitutes.shift() ?? '';
                    //             const glyph: Glyph = {
                    //               code,
                    //               width: dv.getUint16(pos + 2, true) / extent,
                    //               height: dv.getUint16(pos + 4, true) / extent,
                    //               texW: dv.getUint8(pos + 6),
                    //               texH: dv.getUint8(pos + 7),
                    //               texX: 0,
                    //               texY: 0,
                    //               xOffset: zagzig(dv.getUint16(pos + 8, true)) / extent,
                    //               yOffset: zagzig(dv.getUint16(pos + 10, true)) / extent,
                    //               advanceWidth: zagzig(dv.getUint16(pos + 12, true)) / extent,
                    //             };
                    //             pos += 14;
                    //             // store in texture_pack
                    //             const [pos_x, pos_y] = texture_pack.addGlyph(glyph.texW, max_height);
                    //             glyph.texX = pos_x;
                    //             glyph.texY = pos_y;
                    //             // store glyph in cache
                    //             glyph_cache.set(code, glyph);
                    //             // remove from waitlist cache
                    //             glyph_waitlist.delete(code);
                    //             // grab the image
                    //             const imageSize = glyph.texW * glyph.texH * 4;
                    //             const data = new Uint8ClampedArray(glyphs_buf.slice(pos, pos + imageSize)).buffer;
                    //             images.push({ pos_x, pos_y, width: glyph.texW, height: glyph.texH, data });
                    //             pos += imageSize;
                }
                //           // send off the images
                //           const imagesMaxHeight = images.reduce(
                //             (acc, cur) => Math.max(acc, cur.pos_y + cur.height),
                //             0,
                //           );
                //           const glyphImageMessage: GlyphImageData = {
                //             map_id,
                //             type: 'glyphimages',
                //             images,
                //             max_height: imagesMaxHeight,
                //           };
                //           postMessage(
                //             glyphImageMessage,
                //             images.map((i) => i.data),
                //           );
            });
        }
        for promise in promises {
            promise.await;
        }
    }

    /// Build requests from the list of requested glyphs
    ///
    /// ## Parameters
    /// @param list - list of requested glyphs
    ///
    /// ## Returns
    /// An array of requests
    fn _build_requests(&self, list: Vec<String>) -> Vec<GlyphRequest> {
        //     const { path } = this;
        //     const requests: Array<{ request: string; substitutes: string[] }> = [];
        //     const chunks: Array<Array<number | string>> = [];
        //     // sort the list by unicode order first substitions second
        //     const parsed_list = list
        //       .map((code) => {
        //         if (code.includes('.')) return code;
        //         else return Number(code);
        //       })
        //       .sort((a, b): number => {
        //         if (typeof a === 'string') return 1;
        //         if (typeof b === 'string') return -1;
        //         return a - b;
        //       });
        //     // group into batches of 150
        //     for (let i = 0; i < parsed_list.length; i += 150) chunks.push(parsed_list.slice(i, i + 150));
        //     // group unicode numbers adjacent into the same range
        //     for (const chunk of chunks) {
        //       // convert chunk to mergedRanges
        //       const merged = merge_ranges(chunk);
        //       // shape the ranges into a base36 string
        //       const merged_base36 = merged.map((code) => {
        //         if (Array.isArray(code)) return `${base36(code[0])}-${base36(code[1])}`;
        //         else if (typeof code === 'number') return `${base36(code)}`;
        //         else return code;
        //       });
        //       // merge the ranges into a single request
        //       const request = `${path}?type=glyph&codes=${merged_base36.join(',')}`;
        //       const substitutes = merged_base36.filter(
        //         (code) => typeof code === 'string' && code.includes('.'),
        //       );
        //       requests.push({ request, substitutes });
        //     }

        //     return requests;
        todo!()
    }

    /// Fetch glyph data and or metadata
    ///
    /// ## Parameters
    /// - `path`: the url to fetch the data
    /// - `map_id`: the id of the map
    ///
    /// ## Returns
    /// The raw data if found
    async fn _fetch(&self, path: String, map_id: MapID) -> Option<Buffer> {
        let mut headers: Vec<(&str, &str)> = vec![];
        let authorization: Option<String>;
        let session = &mut self.session.borrow_mut();
        if session.has_api_key(&map_id) {
            authorization = session.request_session_token(map_id).await;
            if authorization.is_none() || authorization == Some("failed".into()) {
                return None;
            }
            headers.push(("Authorization", authorization.as_ref().unwrap().as_str()));
        }
        let Ok(data) = fetch_url::<Vec<u8>>(&path, &headers, None, None).await else { return None };

        Some(Buffer::from(data))
    }
}

/// Result of merging ranges
#[derive(Debug, Clone, PartialEq, PartialOrd, Ord, Eq)]
#[allow(missing_docs)]
pub enum UnicodeMerge {
    Unicode(String),
    UnicodeID(u32),
    UnicodeRange(u32, u32),
}
impl From<u32> for UnicodeMerge {
    fn from(code: u32) -> UnicodeMerge {
        UnicodeMerge::UnicodeID(code)
    }
}
impl From<String> for UnicodeMerge {
    fn from(code: String) -> UnicodeMerge {
        UnicodeMerge::Unicode(code)
    }
}
impl From<(u32, u32)> for UnicodeMerge {
    fn from(code: (u32, u32)) -> UnicodeMerge {
        UnicodeMerge::UnicodeRange(code.0, code.1)
    }
}

/// Merge ranges of unicodes into as few ranges as possible.
///
/// ## Parameters
/// - `unicodes`: unicodes to merge
///
/// ## Returns
/// Merged ranges
pub fn merge_ranges(unicodes: Vec<UnicodeMerge>) -> Vec<UnicodeMerge> {
    unicodes.into_iter().fold(Vec::new(), |mut acc, cur| {
        match cur {
            // Merge Case
            UnicodeMerge::UnicodeID(current_id) => {
                if let Some(last) = acc.last_mut() {
                    match last {
                        // If previous was a Range, check if current extends it
                        UnicodeMerge::UnicodeRange(_, to) if current_id == *to + 1 => {
                            *to = current_id;
                            return acc;
                        }
                        // If previous was a single ID, check if we start a Range
                        UnicodeMerge::UnicodeID(last_id) if current_id == *last_id + 1 => {
                            let start = *last_id;
                            *last = UnicodeMerge::UnicodeRange(start, current_id);
                            return acc;
                        }
                        _ => {}
                    }
                }
                // If we couldn't merge (or acc was empty), push as a new ID
                acc.push(cur);
            }
            // Otherwise it's already a range or a string, just push it
            _ => {
                acc.push(cur);
            }
        }
        acc
    })
}

/// Convert a number to a base36 string
///
/// ## Parameters
/// - `num`: number
///
/// ## Returns
/// base36 string
fn base36(mut n: u64) -> String {
    if n == 0 {
        return String::from("0");
    }

    let mut result = Vec::new();
    let lookup = b"0123456789abcdefghijklmnopqrstuvwxyz";

    while n > 0 {
        result.push(lookup[(n % 36) as usize]);
        n /= 36;
    }

    // Since we pushed remainders, the string is backward
    result.reverse();
    // Safety: we know lookup only contains valid UTF-8 (ASCII)
    String::from_utf8_lossy(&result).into()
}

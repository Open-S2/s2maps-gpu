// import FamilySource from './glyph/familySource.js';
// import { NULL_GLYPH } from './glyph/buildGlyphQuads.js';

// import type { Glyph } from './glyph/familySource.js';
// import type { GlyphMetadata } from 'workers/source/glyphSource.js';
// import type { GlyphRequestMessage } from 'workers/worker.spec.js';
// import type { IDGen } from './process.spec.js';
// import type { ImageSourceMetadata } from 'workers/source/imageSource.js';
// import type { S2CellId } from 'gis-tools/index.js';

use crate::{
    util::MsgSender,
    workers::{FamilySource, IDGen, MapID, SourceWorkerMessages},
};
use alloc::{collections::BTreeMap, string::String};

/** Glyph Request Tracker */
#[derive(Debug, Default, Clone, PartialEq)]
#[allow(missing_docs)]
pub struct GlyphRequestTracker {
    pub glyph_family_count: usize,
    pub processed: usize,
    //   self: { promise?: Promise<void> },
    //   resolve: () => void;
}

/** Map of Glyph/Icon Sources, their requests and their resolves */
#[derive(Debug, Default, Clone)]
#[allow(missing_docs)]
pub struct MapGlyphSource {
    pub data: BTreeMap<String, FamilySource>,
    // track requests per tile
    pub glyph_request_tracker: BTreeMap<String, GlyphRequestTracker>, // = new Map<string, GlyphRequestTracker>();
}
// export class MapGlyphSource extends Map<string, FamilySource> {
//   /** resolve mechanic to ensure the glyph/icon source is built */
//   resolve: (value: void | PromiseLike<void>) => void = (): void => {};
//   ready = new Promise<void>((resolve) => {
//     this.resolve = resolve;
//   });
impl MapGlyphSource {
    /**
     * Get a glyph/icon family or list of glyph/icon families
     * @param family - the name(s) of the glyph/icon family
     * @returns the glyph/icon family(ies)
     */
    pub fn get_family(&self, family: &String) -> Option<&FamilySource> {
        self.data.get(family)
    }

    /**
     * Get a glyph/icon family or list of glyph/icon families
     * @param family - the name(s) of the glyph/icon family
     * @returns the glyph/icon family(ies)
     */
    pub fn get_families(&self, family: &[String]) -> Vec<&FamilySource> {
        let mut families = vec![];
        for name in family {
            if let Some(glyph_store) = self.data.get(name) {
                families.push(glyph_store);
            }
        }
        return families;
    }
}

/**
 * Image Store
 *
 * Manages the Glyph/Icon sources, Sprites, and Images (like fill pattern images)
 */
#[derive(Debug, Clone)]
#[allow(missing_docs)]
pub struct ImageStore {
    // mapId: GlyphSourceMap EX 'map1': GlyphSourceMap
    pub glyph_sources: BTreeMap<MapID, MapGlyphSource>, // = new Map<string, MapGlyphSource>();
    // worker properties
    pub id_gen: IDGen,
    pub source_worker: MsgSender<SourceWorkerMessages>,
}
impl ImageStore {
    /**
     * Setup the image store
     * @param id_gen - id generator
     * @param source_worker - the source worker to send requests to
     */
    pub fn setup(&mut self, id_gen: IDGen, source_worker: MsgSender<SourceWorkerMessages>) {
        self.id_gen = id_gen;
        self.source_worker = source_worker;
    }

    /**
     * Setup a glyph/icon source
     * @param map_id - the id of the map to setup the glyph/icon source for
     */
    pub fn setup_map(&mut self, map_id: MapID) {
        self.glyph_sources.insert(map_id, MapGlyphSource::default());
    }

    //   /**
    //    * Wait for the glyph/icon source to be ready
    //    * @param map_id - the id of the map to await the glyph/icon source for
    //    */
    //   async getReady(map_id: string): Promise<void> {
    //     const glyphSource = this.glyph_sources.get(map_id);
    //     if (glyphSource !== undefined) await glyphSource.ready;
    //   }

    //   /**
    //    * Get the glyph/icon source
    //    * @param map_id - the id of the map to get the glyph/icon source for
    //    * @returns the glyph/icon source
    //    */
    //   getGlyphSource(map_id: string): MapGlyphSource {
    //     const store = this.glyph_sources.get(map_id);
    //     if (store === undefined) throw new Error('GlyphSource not setup');
    //     return store;
    //   }

    //   /**
    //    * Get a glyph/icon family
    //    * @param map_id - the id of the map to get the glyph/icon source for
    //    * @param family - the name of the glyph/icon family
    //    * @returns the glyph/icon family
    //    */
    //   getFamilyMap(map_id: string, family: string): FamilySource {
    //     const glyphSource = this.getGlyphSource(map_id);
    //     const glyph_store = glyphSource.get(family);
    //     if (glyph_store === undefined) throw new Error('GlyphSource not setup');
    //     return glyph_store;
    //   }

    //   /**
    //    * Parse specific ligatures
    //    * @param map_id - the id of the map
    //    * @param families - the name(s) of the glyph/icon family
    //    * @param glyphs - the ligature codes
    //    */
    //   parseLigatures(map_id: string, families: string[], glyphs: string[]): void {
    //     // split the glyphs string[] into pieces everytime we see a space or line break characters
    //     const splitGlyphs: Array<{ glyphs: string[]; splitValue?: '32' | '10' | '13' }> = [];
    //     let current: string[] = [];
    //     for (const glyph of glyphs) {
    //       if (glyph === '32' || glyph === '10' || glyph === '13') {
    //         splitGlyphs.push({ glyphs: current, splitValue: glyph });
    //         current = [];
    //       } else {
    //         current.push(glyph);
    //       }
    //     }
    //     splitGlyphs.push({ glyphs: current });
    //     // next we check each "word" for ligatures; if a family source contains the codes
    //     // we move on, otherwise we might accidentally use two fonts for a single word
    //     for (const splitGlyph of splitGlyphs) {
    //       for (const family of families) {
    //         const familySource = this.getFamilyMap(map_id, family);
    //         familySource.parseLigatures(splitGlyph.glyphs, true);
    //         familySource.parseLigatures(splitGlyph.glyphs);
    //         if (familySource.has(splitGlyph.glyphs[0])) break;
    //       }
    //     }
    //     // rejoin the splitGlyphs back into the glyphs array
    //     glyphs.splice(0, glyphs.length);
    //     for (const splitGlyph of splitGlyphs) {
    //       for (const glyph of splitGlyph.glyphs) glyphs.push(glyph);
    //       if (splitGlyph.splitValue !== undefined) glyphs.push(splitGlyph.splitValue);
    //     }
    //   }

    //   /**
    //    * Add missing glyphs
    //    * @param map_id - the id of the map
    //    * @param tileID - the id of the tile
    //    * @param glyphCodes - the codes of the glyphs
    //    * @param families - the name(s) of the glyph/icon family
    //    * @returns true if there are missing glyphs
    //    */
    //   addMissingGlyph(
    //     map_id: string,
    //     tileID: S2CellId,
    //     glyphCodes: string[],
    //     families: string[],
    //   ): boolean {
    //     let missing = false;
    //     for (const code of glyphCodes) {
    //       for (const family of families) {
    //         const familySource = this.getFamilyMap(map_id, family);
    //         if (familySource.missingGlyph(code)) {
    //           familySource.addGlyphRequest(tileID, code);
    //           missing = true;
    //         }
    //       }
    //     }
    //     return missing;
    //   }

    //   /**
    //    * Process metadata for a collection of glyph/icon/sprite/image metadatas
    //    * NOTE: This function is called from the source thread ONLY ONCE per map_id before anything is processed
    //    * @param map_id - the id of the map to process the metadatas for
    //    * @param glyphMetadata - the glyph/icon metadatas
    //    * @param imageMetadata - the sprite/image metadatas
    //    */
    //   processMetadata(
    //     map_id: string,
    //     glyphMetadata: GlyphMetadata[],
    //     imageMetadata: ImageSourceMetadata[],
    //   ): void {
    //     const glyphSource = this.glyph_sources.get(map_id);
    //     if (glyphSource === undefined) return;
    //     for (const { name, metadata } of glyphMetadata) {
    //       glyphSource.set(name, new FamilySource(name, metadata));
    //     }
    //     for (const metadata of imageMetadata) {
    //       const imageSource = glyphSource.get(metadata.name);
    //       if (imageSource !== undefined) imageSource.addMetadata(metadata.metadata);
    //       else glyphSource.set(metadata.name, FamilySource.FromImageMetadata(metadata));
    //     }
    //     // let any glyph based work know the metadata is ready
    //     glyphSource.resolve();
    //   }

    //   /**
    //    * Process missing data
    //    * @param map_id - the id of the map to process the missing data for
    //    * @param tileID - the id of the tile that has missing data
    //    * @param sourceName - the name of the source that has missing data
    //    */
    //   async processMissingData(map_id: string, tileID: S2CellId, sourceName: string): Promise<void> {
    //     const { id_gen, source_worker } = this;
    //     const glyphSource = this.getGlyphSource(map_id);
    //     const { glyph_request_tracker } = glyphSource;
    //     const { workerID } = id_gen;
    //     // build glyphRequestList to ship to the source thread
    //     const glyphList: Record<string, string[]> = {};
    //     let glyph_family_count = 0;
    //     for (const [familyName, familySource] of glyphSource) {
    //       const list = familySource.getRequests(tileID);
    //       if (list.length > 0) {
    //         glyphList[familyName] = list;
    //         glyph_family_count++;
    //       }
    //     }
    //     if (glyph_family_count > 0) {
    //       // random string of numbers and letters 7 characters long
    //       const reqID = `${map_id}:${sourceName}:${Math.random().toString(36).substring(2, 9)}`;
    //       // send off and prep for response
    //       const requestMessage: GlyphRequestMessage = {
    //         type: 'glyphrequest',
    //         map_id,
    //         workerID,
    //         reqID,
    //         glyphList,
    //       };
    //       source_worker.postMessage(requestMessage);
    //       const self: { promise?: Promise<void> } = { promise: undefined };
    //       self.promise = new Promise<void>((resolve) => {
    //         glyph_request_tracker.set(reqID, { glyph_family_count, processed: 0, resolve, self });
    //       });
    //       await self.promise;
    //     } else if (glyph_request_tracker.size > 0) {
    //       // a seperate tile request for the same source may be in the process of building glyphs shared with this request. We need to wait for those to finish
    //       await Promise.all(
    //         [...glyph_request_tracker.values()].map(async ({ self }) => {
    //           await self.promise;
    //         }),
    //       );
    //     } else {
    //       await new Promise<void>((resolve) => {
    //         resolve();
    //       });
    //     }
    //   }

    //   /**
    //    * Process a response from the source thread
    //    * @param map_id - the id of the map
    //    * @param reqID - the id of the request
    //    * @param glyphMetadata - the glyph metadata
    //    * @param familyName - the name of the family
    //    */
    //   processGlyphResponse(
    //     map_id: string,
    //     reqID: string,
    //     glyphMetadata: Glyph[],
    //     familyName: string,
    //   ): void {
    //     // pull in the features and delete the reference
    //     const glyphSource = this.getGlyphSource(map_id);
    //     const { glyph_request_tracker } = glyphSource;
    //     const store = glyph_request_tracker.get(reqID);
    //     if (store === undefined) return;
    //     store.processed++;
    //     // store our response glyphs
    //     this.importGlyphs(map_id, familyName, glyphMetadata);
    //     // If we have all data, we now process the built glyphs
    //     if (store.glyph_family_count === store.processed) {
    //       glyph_request_tracker.delete(reqID);
    //       store.resolve();
    //     }
    //   }

    //   /**
    //    * a response from the sourceThread for glyph data
    //    * @param map_id - the id of the map to process the response for
    //    * @param familyName - the name of the family
    //    * @param glyphs - the glyphs to import
    //    */
    //   importGlyphs(map_id: string, familyName: string, glyphs: Glyph[]): void {
    //     const familyMap = this.getFamilyMap(map_id, familyName);
    //     for (const glyph of glyphs) {
    //       const { code } = glyph;
    //       familyMap.glyphCache.set(code, glyph);
    //     }
    //   }

    //   /**
    //    * Get an image pattern (used by fills)
    //    * @param map_id - the id of the map
    //    * @param familyName - the name of the family
    //    * @param name - the name of the pattern
    //    * @returns the pattern guide
    //    */
    //   getPattern(map_id: string, familyName: string, name?: string): Glyph {
    //     if (name === undefined) return NULL_GLYPH;
    //     const familyMap = this.getFamilyMap(map_id, familyName);
    //     const glyph = familyMap.glyphCache.get(name);
    //     return glyph ?? NULL_GLYPH;
    //   }
}

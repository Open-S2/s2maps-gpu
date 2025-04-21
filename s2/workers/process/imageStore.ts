import FamilySource from './glyph/familySource.js';
import { NULL_GLYPH } from './glyph/buildGlyphQuads.js';

import type { Glyph } from './glyph/familySource.js';
import type { GlyphMetadata } from 'workers/source/glyphSource.js';
import type { GlyphRequestMessage } from 'workers/worker.spec.js';
import type { IDGen } from './process.spec.js';
import type { ImageSourceMetadata } from 'workers/source/imageSource.js';
import type { S2CellId } from 'gis-tools/index.js';

/** Glyph Request Tracker */
export interface GlyphRequestTracker {
  glyphFamilyCount: number;
  processed: number;
  self: { promise?: Promise<void> };
  resolve: () => void;
}

/** Map of Glyph/Icon Sources, their requests and their resolves */
export class MapGlyphSource extends Map<string, FamilySource> {
  /** resolve mechanic to ensure the glyph/icon source is built */
  resolve: (value: void | PromiseLike<void>) => void = (): void => {};
  ready = new Promise<void>((resolve) => {
    this.resolve = resolve;
  });
  // track requests per tile
  glyphRequestTracker = new Map<string, GlyphRequestTracker>();

  /**
   * Get a glyph/icon family or list of glyph/icon families
   * @param family - the name(s) of the glyph/icon family
   * @returns the glyph/icon family(ies)
   */
  getFamily(family: string | string[]): undefined | FamilySource | FamilySource[] {
    if (Array.isArray(family)) {
      const families: FamilySource[] = [];
      for (const name of family) {
        const glyphStore = this.get(name);
        if (glyphStore !== undefined) families.push(glyphStore);
      }
      return families;
    }
    return this.get(family);
  }
}

/**
 * Image Store
 *
 * Manages the Glyph/Icon sources, Sprites, and Images (like fill pattern images)
 */
export default class ImageStore {
  // mapId: GlyphSourceMap EX 'map1': GlyphSourceMap
  glyphSources = new Map<string, MapGlyphSource>();
  // worker properties
  idGen!: IDGen;
  sourceWorker!: MessagePort;

  /**
   * Setup the image store
   * @param idGen - id generator
   * @param sourceWorker - the source worker to send requests to
   */
  setup(idGen: IDGen, sourceWorker: MessagePort): void {
    this.idGen = idGen;
    this.sourceWorker = sourceWorker;
  }

  /**
   * Setup a glyph/icon source
   * @param mapID - the id of the map to setup the glyph/icon source for
   */
  setupMap(mapID: string): void {
    this.glyphSources.set(mapID, new MapGlyphSource());
  }

  /**
   * Wait for the glyph/icon source to be ready
   * @param mapID - the id of the map to await the glyph/icon source for
   */
  async getReady(mapID: string): Promise<void> {
    const glyphSource = this.glyphSources.get(mapID);
    if (glyphSource !== undefined) await glyphSource.ready;
  }

  /**
   * Get the glyph/icon source
   * @param mapID - the id of the map to get the glyph/icon source for
   * @returns the glyph/icon source
   */
  getGlyphSource(mapID: string): MapGlyphSource {
    const store = this.glyphSources.get(mapID);
    if (store === undefined) throw new Error('GlyphSource not setup');
    return store;
  }

  /**
   * Get a glyph/icon family
   * @param mapID - the id of the map to get the glyph/icon source for
   * @param family - the name of the glyph/icon family
   * @returns the glyph/icon family
   */
  getFamilyMap(mapID: string, family: string): FamilySource {
    const glyphSource = this.getGlyphSource(mapID);
    const glyphStore = glyphSource.get(family);
    if (glyphStore === undefined) throw new Error('GlyphSource not setup');
    return glyphStore;
  }

  /**
   * Parse specific ligatures
   * @param mapID - the id of the map
   * @param families - the name(s) of the glyph/icon family
   * @param glyphs - the ligature codes
   */
  parseLigatures(mapID: string, families: string[], glyphs: string[]): void {
    // split the glyphs string[] into pieces everytime we see a space or line break characters
    const splitGlyphs: Array<{ glyphs: string[]; splitValue?: '32' | '10' | '13' }> = [];
    let current: string[] = [];
    for (const glyph of glyphs) {
      if (glyph === '32' || glyph === '10' || glyph === '13') {
        splitGlyphs.push({ glyphs: current, splitValue: glyph });
        current = [];
      } else {
        current.push(glyph);
      }
    }
    splitGlyphs.push({ glyphs: current });
    // next we check each "word" for ligatures; if a family source contains the codes
    // we move on, otherwise we might accidentally use two fonts for a single word
    for (const splitGlyph of splitGlyphs) {
      for (const family of families) {
        const familySource = this.getFamilyMap(mapID, family);
        familySource.parseLigatures(splitGlyph.glyphs, true);
        familySource.parseLigatures(splitGlyph.glyphs);
        if (familySource.has(splitGlyph.glyphs[0])) break;
      }
    }
    // rejoin the splitGlyphs back into the glyphs array
    glyphs.splice(0, glyphs.length);
    for (const splitGlyph of splitGlyphs) {
      for (const glyph of splitGlyph.glyphs) glyphs.push(glyph);
      if (splitGlyph.splitValue !== undefined) glyphs.push(splitGlyph.splitValue);
    }
  }

  /**
   * Add missing glyphs
   * @param mapID - the id of the map
   * @param tileID - the id of the tile
   * @param glyphCodes - the codes of the glyphs
   * @param families - the name(s) of the glyph/icon family
   * @returns true if there are missing glyphs
   */
  addMissingGlyph(
    mapID: string,
    tileID: S2CellId,
    glyphCodes: string[],
    families: string[],
  ): boolean {
    let missing = false;
    for (const code of glyphCodes) {
      for (const family of families) {
        const familySource = this.getFamilyMap(mapID, family);
        if (familySource.missingGlyph(code)) {
          familySource.addGlyphRequest(tileID, code);
          missing = true;
        }
      }
    }
    return missing;
  }

  /**
   * Process metadata for a collection of glyph/icon/sprite/image metadatas
   * NOTE: This function is called from the source thread ONLY ONCE per mapID before anything is processed
   * @param mapID - the id of the map to process the metadatas for
   * @param glyphMetadata - the glyph/icon metadatas
   * @param imageMetadata - the sprite/image metadatas
   */
  processMetadata(
    mapID: string,
    glyphMetadata: GlyphMetadata[],
    imageMetadata: ImageSourceMetadata[],
  ): void {
    const glyphSource = this.glyphSources.get(mapID);
    if (glyphSource === undefined) return;
    for (const { name, metadata } of glyphMetadata) {
      glyphSource.set(name, new FamilySource(name, metadata));
    }
    for (const metadata of imageMetadata) {
      const imageSource = glyphSource.get(metadata.name);
      if (imageSource !== undefined) imageSource.addMetadata(metadata.metadata);
      else glyphSource.set(metadata.name, FamilySource.FromImageMetadata(metadata));
    }
    // let any glyph based work know the metadata is ready
    glyphSource.resolve();
  }

  /**
   * Process missing data
   * @param mapID - the id of the map to process the missing data for
   * @param tileID - the id of the tile that has missing data
   * @param sourceName - the name of the source that has missing data
   */
  async processMissingData(mapID: string, tileID: S2CellId, sourceName: string): Promise<void> {
    const { idGen, sourceWorker } = this;
    const glyphSource = this.getGlyphSource(mapID);
    const { glyphRequestTracker } = glyphSource;
    const { workerID } = idGen;
    // build glyphRequestList to ship to the source thread
    const glyphList: Record<string, string[]> = {};
    let glyphFamilyCount = 0;
    for (const [familyName, familySource] of glyphSource) {
      const list = familySource.getRequests(tileID);
      if (list.length > 0) {
        glyphList[familyName] = list;
        glyphFamilyCount++;
      }
    }
    if (glyphFamilyCount > 0) {
      // random string of numbers and letters 7 characters long
      const reqID = `${mapID}:${sourceName}:${Math.random().toString(36).substring(2, 9)}`;
      // send off and prep for response
      const requestMessage: GlyphRequestMessage = {
        type: 'glyphrequest',
        mapID,
        workerID,
        reqID,
        glyphList,
      };
      sourceWorker.postMessage(requestMessage);
      const self: { promise?: Promise<void> } = { promise: undefined };
      self.promise = new Promise<void>((resolve) => {
        glyphRequestTracker.set(reqID, { glyphFamilyCount, processed: 0, resolve, self });
      });
      await self.promise;
    } else if (glyphRequestTracker.size > 0) {
      // a seperate tile request for the same source may be in the process of building glyphs shared with this request. We need to wait for those to finish
      await Promise.all(
        [...glyphRequestTracker.values()].map(async ({ self }) => {
          await self.promise;
        }),
      );
    } else {
      await new Promise<void>((resolve) => {
        resolve();
      });
    }
  }

  /**
   * Process a response from the source thread
   * @param mapID - the id of the map
   * @param reqID - the id of the request
   * @param glyphMetadata - the glyph metadata
   * @param familyName - the name of the family
   */
  processGlyphResponse(
    mapID: string,
    reqID: string,
    glyphMetadata: Glyph[],
    familyName: string,
  ): void {
    // pull in the features and delete the reference
    const glyphSource = this.getGlyphSource(mapID);
    const { glyphRequestTracker } = glyphSource;
    const store = glyphRequestTracker.get(reqID);
    if (store === undefined) return;
    store.processed++;
    // store our response glyphs
    this.importGlyphs(mapID, familyName, glyphMetadata);
    // If we have all data, we now process the built glyphs
    if (store.glyphFamilyCount === store.processed) {
      glyphRequestTracker.delete(reqID);
      store.resolve();
    }
  }

  /**
   * a response from the sourceThread for glyph data
   * @param mapID - the id of the map to process the response for
   * @param familyName - the name of the family
   * @param glyphs - the glyphs to import
   */
  importGlyphs(mapID: string, familyName: string, glyphs: Glyph[]): void {
    const familyMap = this.getFamilyMap(mapID, familyName);
    for (const glyph of glyphs) {
      const { code } = glyph;
      familyMap.glyphCache.set(code, glyph);
    }
  }

  /**
   * Get an image pattern (used by fills)
   * @param mapID - the id of the map
   * @param familyName - the name of the family
   * @param name - the name of the pattern
   * @returns the pattern guide
   */
  getPattern(mapID: string, familyName: string, name?: string): Glyph {
    if (name === undefined) return NULL_GLYPH;
    const familyMap = this.getFamilyMap(mapID, familyName);
    const glyph = familyMap.glyphCache.get(name);
    return glyph ?? NULL_GLYPH;
  }
}

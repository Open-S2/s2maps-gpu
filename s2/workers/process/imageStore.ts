import FamilySource from './glyph/familySource'
import { NULL_GLYPH } from './glyph/buildGlyphQuads'

import type { Glyph } from './glyph/familySource'
import type { GlyphRequestMessage } from 'workers/worker.spec'
import type { IDGen } from './process.spec'
import type { GlyphMetadata } from 'workers/source/glyphSource'
import type { ImageMetadata } from 'workers/source/imageSource'

export interface GlyphRequestTracker {
  glyphFamilyCount: number
  processed: number
  self: { promise?: Promise<void> }
  resolve: () => void
}

export class MapGlyphSource extends Map<string, FamilySource> {
  resolve: (value: void | PromiseLike<void>) => void = (): void => {}
  ready = new Promise<void>(resolve => { this.resolve = resolve })
  // track requests per tile
  glyphRequestTracker = new Map<string, GlyphRequestTracker>()

  getFamily (family: string | string[]): undefined | FamilySource | FamilySource[] {
    if (Array.isArray(family)) {
      const families: FamilySource[] = []
      for (const name of family) {
        const glyphStore = this.get(name)
        if (glyphStore !== undefined) families.push(glyphStore)
      }
      return families
    }
    return this.get(family)
  }
}

export default class ImageStore {
  // mapId: GlyphSourceMap EX 'map1': GlyphSourceMap
  glyphSources = new Map<string, MapGlyphSource>()
  // worker properties
  idGen!: IDGen
  sourceWorker!: MessagePort

  setup (idGen: IDGen, sourceWorker: MessagePort): void {
    this.idGen = idGen
    this.sourceWorker = sourceWorker
  }

  setupMap (mapID: string): void {
    this.glyphSources.set(mapID, new MapGlyphSource())
  }

  async getReady (mapID: string): Promise<void> {
    const glyphSource = this.glyphSources.get(mapID)
    if (glyphSource !== undefined) await glyphSource.ready
  }

  getGlyphSource (mapID: string): MapGlyphSource {
    const store = this.glyphSources.get(mapID)
    if (store === undefined) throw new Error('GlyphSource not setup')
    return store
  }

  getFamilyMap (mapID: string, family: string): FamilySource {
    const glyphSource = this.getGlyphSource(mapID)
    const glyphStore = glyphSource.get(family)
    if (glyphStore === undefined) throw new Error('GlyphSource not setup')
    return glyphStore
  }

  parseLigatures (
    mapID: string,
    families: string[],
    glyphs: string[]
  ): void {
    // split the glyphs string[] into pieces everytime we see a space or line break characters
    const splitGlyphs: Array<{ glyphs: string[], splitValue?: '32' | '10' | '13' }> = []
    let current: string[] = []
    for (const glyph of glyphs) {
      if (glyph === '32' || glyph === '10' || glyph === '13') {
        splitGlyphs.push({ glyphs: current, splitValue: glyph })
        current = []
      } else { current.push(glyph) }
    }
    splitGlyphs.push({ glyphs: current })
    // next we check each "word" for ligatures; if a family source contains the codes
    // we move on, otherwise we might accidentally use two fonts for a single word
    for (const splitGlyph of splitGlyphs) {
      for (const family of families) {
        const familySource = this.getFamilyMap(mapID, family)
        familySource.parseLigatures(splitGlyph.glyphs, true)
        familySource.parseLigatures(splitGlyph.glyphs)
        if (familySource.has(splitGlyph.glyphs[0])) break
      }
    }
    // rejoin the splitGlyphs back into the glyphs array
    glyphs.splice(0, glyphs.length)
    for (const splitGlyph of splitGlyphs) {
      for (const glyph of splitGlyph.glyphs) glyphs.push(glyph)
      if (splitGlyph.splitValue !== undefined) glyphs.push(splitGlyph.splitValue)
    }
  }

  addMissingGlyph (
    mapID: string,
    tileID: bigint,
    glyphCodes: string[],
    families: string[]
  ): boolean {
    let missing = false
    for (const code of glyphCodes) {
      for (const family of families) {
        const familySource = this.getFamilyMap(mapID, family)
        if (familySource.missingGlyph(code)) {
          familySource.addGlyphRequest(tileID, code)
          missing = true
        }
      }
    }
    return missing
  }

  // NOTE: This function is called from the source thread ONLY ONCE per mapID before anything is processed
  processMetadata (
    mapID: string,
    glyphMetadata: GlyphMetadata[],
    imageMetadata: ImageMetadata[]
  ): void {
    const glyphSource = this.glyphSources.get(mapID)
    if (glyphSource === undefined) return
    for (const { name, metadata } of glyphMetadata) {
      glyphSource.set(name, new FamilySource(name, metadata))
    }
    for (const metadata of imageMetadata) {
      const imageSource = glyphSource.get(metadata.name)
      if (imageSource !== undefined) imageSource.addMetadata(metadata.metadata)
      else glyphSource.set(metadata.name, FamilySource.FromImageMetadata(metadata))
    }
    // let any glyph based work know the metadata is ready
    glyphSource.resolve()
  }

  async processMissingData (
    mapID: string,
    tileID: bigint,
    sourceName: string
  ): Promise<void> {
    const { idGen, sourceWorker } = this
    const glyphSource = this.getGlyphSource(mapID)
    const { glyphRequestTracker } = glyphSource
    const { workerID } = idGen
    // build glyphRequestList to ship to the source thread
    const glyphList: Record<string, string[]> = {}
    let glyphFamilyCount = 0
    for (const [familyName, familySource] of glyphSource) {
      const list = familySource.getRequests(tileID)
      if (list.length > 0) {
        glyphList[familyName] = list
        glyphFamilyCount++
      }
    }
    if (glyphFamilyCount > 0) {
      // random string of numbers and letters 7 characters long
      const reqID = `${mapID}:${sourceName}:${Math.random().toString(36).substring(2, 9)}`
      // send off and prep for response
      const requestMessage: GlyphRequestMessage = {
        type: 'glyphrequest',
        mapID,
        workerID,
        reqID,
        glyphList
      }
      sourceWorker.postMessage(requestMessage)
      const self: { promise?: Promise<void> } = { promise: undefined }
      self.promise = new Promise<void>(resolve => {
        glyphRequestTracker.set(reqID, { glyphFamilyCount, processed: 0, resolve, self })
      })
      await self.promise
    } else if (glyphRequestTracker.size > 0) {
      // a seperate tile request for the same source may be in the process of building glyphs shared with this request. We need to wait for those to finish
      await Promise.all([...glyphRequestTracker.values()].map(async ({ self }) => { await self.promise }))
    } else {
      await new Promise<void>(resolve => { resolve() })
    }
  }

  processGlyphResponse (
    mapID: string,
    reqID: string,
    glyphMetadata: Glyph[],
    familyName: string
  ): void {
    // pull in the features and delete the reference
    const glyphSource = this.getGlyphSource(mapID)
    const { glyphRequestTracker } = glyphSource
    const store = glyphRequestTracker.get(reqID)
    if (store === undefined) return
    store.processed++
    // store our response glyphs
    this.importGlyphs(mapID, familyName, glyphMetadata)
    // If we have all data, we now process the built glyphs
    if (store.glyphFamilyCount === store.processed) {
      glyphRequestTracker.delete(reqID)
      store.resolve()
    }
  }

  // a response from the sourceThread for glyph data
  importGlyphs (mapID: string, familyName: string, glyphs: Glyph[]): void {
    const familyMap = this.getFamilyMap(mapID, familyName)
    for (const glyph of glyphs) {
      const { code } = glyph
      familyMap.glyphCache.set(code, glyph)
    }
  }

  getPattern (mapID: string, familyName: string, name?: string): Glyph {
    if (name === undefined) return NULL_GLYPH
    const familyMap = this.getFamilyMap(mapID, familyName)
    const glyph = familyMap.glyphCache.get(name)
    return glyph ?? NULL_GLYPH
  }
}

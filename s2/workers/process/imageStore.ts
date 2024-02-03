import FamilySource from './glyph/familySource'

import type { Glyph } from './glyph/familySource'
import type { GlyphRequestMessage } from 'workers/worker.spec'
import type { IDGen } from './process.spec'
import type { GlyphMetadata } from 'workers/source/glyphSource'
import type { ImageMetadata } from 'workers/source/imageSource'

export interface GlyphRequestTracker {
  glyphFamilyCount: number
  processed: number
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
    // TODO: Rethink how we parse ligatures. if the first family contains the glyphs, then the
    // next familes should not reparse the ligatures because visually will look different
    for (const family of [families[0]]) {
      const familySource = this.getFamilyMap(mapID, family)
      familySource.parseLigatures(glyphs, true)
      familySource.parseLigatures(glyphs)
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
        const { glyphSet, glyphCache } = familySource
        if (glyphSet.has(code) && !glyphCache.has(code)) {
          familySource.addGlyphRequest(tileID, code)
          missing = true
        }
      }
    }
    return missing
  }

  // NOTE: This function is called from the source thread ONLY ONCE per mapID
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
      // randome string of numbers and letters 7 characters long
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
      await new Promise<void>(resolve => {
        glyphRequestTracker.set(reqID, { glyphFamilyCount, processed: 0, resolve })
      })
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
    const nullGlyph: Glyph = { code: '0', texX: 0, texY: 0, texW: 0, texH: 0, xOffset: 0, yOffset: 0, width: 0, height: 0, advanceWidth: 0 }
    if (name === undefined) return nullGlyph
    const familyMap = this.getFamilyMap(mapID, familyName)
    const glyph = familyMap.glyphCache.get(name)
    return glyph ?? nullGlyph
  }
}

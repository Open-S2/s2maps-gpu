// @flow
import { Rtree } from './util'

type Glyph = {
  texX: number, // x position on glyph texture sheet
  texY: number, // y position on glyph texture sheet
  texW: number,
  texH: number,
  xOffset: number, // x offset for glyph
  yOffset: number, // y offset for glyph
  advanceWidth: number // how far to move the cursor
}

export default class GlyphManager {
  mainThread: Function
  sourceThread: Function
  rtree: Rtree
  glyphMap: Map<string, Glyph> = new Map()
  glyphStore: Map<string, Array<Feature>> = new Map()
  constructor (mainThread: Function, sourceThread: Function) {
    this.mainThread = mainThread
    this.sourceThread = sourceThread
    this.rtree = new Rtree()
  }

  preprocessGlyphs (mapID: string, tile: TileRequest, sourceName: string,
    features: Array<Feature>) {
    // Step 1: Preprocess the glyph
    const glyphList = preprocessGlyphs(features, this.glyphMap)
    // Step 2: Request for any glyph data we do not have information on, if non, immediately postProcess
    if (glyphList.length) {
      const { hash } = tile
      sourceThread({ type: 'glyphrequest', glyphList }, glyphList)
      this.glyphStore.set(`${mapID}_${hash}_${sourceName}`, features)
    }
    else this.postProcessGlyphs(mapID, tile, sourceName)
  }

  // a response from the sourceThread for glyph data
  importGlyphs (glyphResponse: GlyphResponse) {
    for (const [unicode, glyph] of Object.entries(glyphResponse)) this.glyphMap.set(unicode, glyph)
  }

  postProcessGlyphs (mapID: string, tile: TileRequest, sourceName: string) {
    // prepare
    const { hash } = tile
    this.rtree.clear()
    const id = `${mapID}_${hash}_${sourceName}`
    const features = this.glyphStore.get(id)
    this.glyphStore.delete(id)
    const res = []
    // process the features
    for (const feature of features) {
      // Step 1: prebuild the glyph positions and bbox
      buildGlyphQuads(feature)
      // Step 2: check the rtree if we want to pre filter
      if (!this.rtree.collides(feature)) res.push(feature)
    }
    // post process -> compile all the work and ship it out to the main thread
    postProcessGlyphs(res, , mainThread)
  }
}

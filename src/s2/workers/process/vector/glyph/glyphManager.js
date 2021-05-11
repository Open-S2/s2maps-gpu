// @flow

export default class GlyphManager {
  mainThread: Function
  sourceThread: Function
  constructor (mainThread: Function, sourceThread: Function) {
    this.mainThread = mainThread
    this.sourceThread = sourceThread
  }

  processGlyphs(mapID: string, tile: TileRequest, sourceName: string,
    features: Array<Feature>) {
    // Step 1: Preprocess the glyph

    // Step 2:
  }
}

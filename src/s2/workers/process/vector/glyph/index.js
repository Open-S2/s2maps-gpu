import featureSort from '../featureSort'
import { buildGlyphQuads, RTree } from './util'
import preprocessGlyphs from './preprocessGlyph'
import postProcessGlyphs from './postprocessGlyph'

type Glyph = {
  texX: number, // x position on glyph texture sheet
  texY: number, // y position on glyph texture sheet
  texW: number, // width of the glyph in the texture
  texH: number, // height of the glyph in the texture
  xOffset: number, // x offset for glyph
  yOffset: number, // y offset for glyph
  width: number, // width of glyph relative to 0->1
  height: number, // height of glyph relative to 0->1
  advanceWidth: number // how far to move the cursor
}

export default class GlyphManager {
  id: number
  mainThread: Function
  sourceThread: MessageChannel.port2
  rtree: RTree = new RTree()
  iconPacks: IconPacks = {}
  glyphMap: { [string]: Map<Unicode, Glyph> } = {}
  glyphStore: Map<string, Array<Feature>> = new Map()
  constructor (mainThread: Function, sourceThread: MessageChannel.port2, id: number) {
    this.mainThread = mainThread
    this.sourceThread = sourceThread
    this.id = id
  }

  loadIconsPacks (iconPacks: IconPacks) {
    for (const [name, pack] of Object.entries(iconPacks)) this.iconPacks[name] = pack
  }

  processGlyphs (mapID: string, tile: TileRequest, sourceName: string,
    features: Array<Feature>) {
    const { id, glyphMap, glyphStore, iconPacks, sourceThread } = this
    const { hash, zoom } = tile
    // prep variables
    const glyphList: { _total: number, [string]: Set<Unicode> } = { _total: 0 }
    // Step 1: Preprocess the glyph
    const builtFeatures = preprocessGlyphs(features, zoom, glyphMap, glyphList, iconPacks)
    // Step 2: Request for any glyph data we do not have information on, if not, immediately postProcess
    if (glyphList._total) {
      delete glyphList._total // remove the total so we can add a transfer array
      const reqID = `${mapID}:${hash}:${sourceName}`
      for (const glyphSource in glyphList) {
        glyphList[glyphSource] = (new Uint16Array([...glyphList[glyphSource]])).buffer
      }
      sourceThread.postMessage({ type: 'glyphrequest', mapID, id, reqID, glyphList }, Object.values(glyphList))
      glyphStore.set(reqID, builtFeatures)
    } else { this.buildGlyphs(mapID, hash, sourceName, builtFeatures) }
  }

  // the source worker completed the request, here are the unicode properties
  processGlyphResponse (reqID: string, glyphSources: GlyphResponse) {
    let [mapID, hash, sourceName] = reqID.split(':')
    hash = +hash
    // pull in the features and delete the reference
    const builtFeatures = this.glyphStore.get(reqID)
    this.glyphStore.delete(reqID)
    // store our response glyphs
    for (const [familyName, unicodes] of Object.entries(glyphSources)) this._importGlyphs(familyName, new Float32Array(unicodes))
    // now process the built glyphs
    this.buildGlyphs(mapID, hash, sourceName, builtFeatures)
  }

  // a response from the sourceThread for glyph data
  // [unicode, texX, texY, texW, texH, xOffset, yOffset, advanceWidth, ...]
  _importGlyphs (familyName: string, glyphs: Float32Array) {
    const familyMap = this.glyphMap[familyName]
    for (let i = 0, gl = glyphs.length; i < gl; i += 10) {
      const glyph = {
        texX: glyphs[i + 1],
        texY: glyphs[i + 2],
        texW: glyphs[i + 3],
        texH: glyphs[i + 4],
        xOffset: glyphs[i + 5],
        yOffset: glyphs[i + 6],
        width: glyphs[i + 7],
        height: glyphs[i + 8],
        advanceWidth: glyphs[i + 9]
      }
      familyMap.set(glyphs[i], glyph)
    }
  }

  buildGlyphs (mapID: string, hash: number, sourceName: string, features: Array<GlyphObject>) {
    // prepare
    const { rtree, mainThread, glyphMap } = this
    rtree.clear()
    const res = []
    // sort the features before running the collisions
    features = features.sort(featureSort)
    // process the features
    for (const feature of features) {
      // Step 1: prebuild the glyph positions and bbox
      buildGlyphQuads(feature, glyphMap)
      // Step 2: check the rtree if we want to pre filter
      if (feature.overdraw || !rtree.collides(feature)) res.push(feature)
    }
    // post process -> compile all the work and ship it out to the main thread
    if (res.length) postProcessGlyphs(mapID, `${sourceName}:glyph`, hash, res, mainThread)
  }
}

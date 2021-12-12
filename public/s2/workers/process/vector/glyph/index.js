// @flow
/* eslint-env worker */
import featureSort from '../featureSort'
import { buildGlyphQuads, RTree } from './util'
import preprocessGlyphs from './preprocessGlyph'
import postProcessGlyphs from './postprocessGlyph'

import type { GlyphObject } from './glyphSpec'
import type { Feature } from '../'
import type { TileRequest } from '../../../workerPool'

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

export type Unicode = number

export type Color = [number, number, number, number]

export type Colors = Array<Color>

export type IconMap = { [string]: Array<{ glyphID: Unicode, colorID: number }> }

export type ColorMap = { [number | string]: Color }

export type GlyphMap = { [string]: Map<Unicode, Glyph> } // family: Map

export type GlyphList = { _total: number, [string]: Set<Unicode> }

export type IconList = { _total: number, [string]: Set<string> }

export default class GlyphManager {
  id: number
  mainThread: Function
  sourceThread: MessageChannel.port2
  rtree: RTree = new RTree()
  glyphMap: GlyphMap = {}
  iconMap: IconMap = {}
  colorMap: { [string]: Colors } = {}
  glyphStore: Map<string, Array<Feature>> = new Map()
  constructor (mainThread: Function, sourceThread: MessageChannel.port2, id: number) {
    this.mainThread = mainThread
    this.sourceThread = sourceThread
    this.id = id
  }

  processGlyphs (mapID: string, tile: TileRequest, sourceName: string, features: Array<Feature>) {
    const { id, glyphMap, iconMap, glyphStore, sourceThread } = this
    const { zoom } = tile
    const tileID = tile.id
    // prep variables
    const glyphList: GlyphList = { _total: 0 }
    const iconList: IconList = { _total: 0 }
    // Step 1: Preprocess the glyph
    const builtFeatures = preprocessGlyphs(features, zoom, glyphMap, iconMap, glyphList, iconList)
    // Step 2: Request for any glyph data we do not have information on, if not, immediately postProcess
    if (glyphList._total || iconList._total) {
      delete glyphList._total // remove the total so we can add a transfer array
      delete iconList._total
      const reqID = `${mapID}:${tileID}:${sourceName}`
      // prep glyphList for transfer
      for (const glyphFamily in glyphList) {
        const list = [...glyphList[glyphFamily]].sort((a, b) => a - b)
        glyphList[glyphFamily] = (new Uint16Array(list)).buffer
      }
      // prep iconList for transfer
      for (const iconFamily in iconList) iconList[iconFamily] = [...iconList[iconFamily]]
      // get family count
      const glyphFamilyCount = Object.keys(glyphList).length + Object.keys(iconList).length
      // send off and prep for response
      sourceThread.postMessage({ type: 'glyphrequest', mapID, id, reqID, glyphList, iconList }, Object.values(glyphList))
      glyphStore.set(reqID, { builtFeatures, glyphFamilyCount, processed: 0 })
    } else { this.buildGlyphs(mapID, tileID, sourceName, builtFeatures) }
  }

  // the source worker completed the request, here are the unicode properties
  processGlyphResponse (reqID: string, glyphMetadata: ArrayBuffer, familyName: string,
    icons: IconMap, colors: ColorMap) {
    let [mapID, tileID, sourceName] = reqID.split(':')
    tileID = BigInt(tileID)
    // pull in the features and delete the reference
    const store = this.glyphStore.get(reqID)
    store.processed++
    // store our response glyphs
    this._importGlyphs(familyName, new Float32Array(glyphMetadata))
    // if icons, store icons
    if (icons) this._importIconMetadata(familyName, icons, colors)
    // If we have all data, we now process the built glyphs
    if (store.glyphFamilyCount === store.processed) {
      this.glyphStore.delete(reqID)
      // pull the builtFeatures and remap icons by replacing strings with iconMap's unicode guide
      const { builtFeatures } = store
      this._remapIcons(builtFeatures)
      // build
      this.buildGlyphs(mapID, tileID, sourceName, builtFeatures)
    }
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

  _importIconMetadata (familyName: String, icons: IconMap, colors: ColorMap) {
    // store icon metadata
    const iconMap = this.iconMap[familyName]
    for (const icon in icons) iconMap[icon] = icons[icon]
    // store colors
    if (!this.colorMap[familyName]) this.colorMap[familyName] = []
    const colorMap = this.colorMap[familyName]
    for (const color in colors) colorMap[+color] = colors[color]
  }

  _remapIcons (features: Array<GlyphObject>) {
    const { iconMap, colorMap } = this
    for (const feature of features) {
      if (feature.type === 1) {
        const { family, field } = feature
        const icon = iconMap[family][field]
        const colors = colorMap[family]
        if (icon && colors) {
          const color = []
          const field = []
          for (const { glyphID, colorID } of icon) {
            field.push(glyphID)
            color.push(...colors[colorID])
          }
          feature.field = field
          feature.color = color
        }
      }
    }
  }

  buildGlyphs (mapID: string, tileID: BigInt, sourceName: string, features: Array<GlyphObject>) {
    // prepare
    const { rtree, mainThread, glyphMap, iconMap } = this
    rtree.clear()
    const res = []
    // remove empty features; sort the features before running the collisions
    features = features.filter(feature => feature.field.length)
    features = features.sort(featureSort)
    for (const feature of features) {
      // Step 1: prebuild the glyph positions and bbox
      buildGlyphQuads(feature, glyphMap, iconMap)
      // Step 2: check the rtree if we want to pre filter
      if (feature.overdraw || !rtree.collides(feature)) res.push(feature)
    }
    // post process -> compile all the work and ship it out to the main thread
    if (res.length) postProcessGlyphs(mapID, `${sourceName}:glyph`, tileID, res, mainThread)
  }
}

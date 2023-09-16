/* eslint-env worker */
import UnicodeShaper from 'unicode-shaper-zig'
// @ts-expect-error - file exists
import uShaperWASM from 'unicode-shaper-zig/u-shaper.wasm'
import VectorWorker, { colorFunc, idToRGB } from '../vectorWorker'
import featureSort from '../util/featureSort'
import buildGlyphQuads, { QUAD_SIZE } from './buildGlyphQuads'
import RTree from './rtree'
import { parseFeatureFunction, scaleShiftClip } from '../util'
import coalesceField from 'style/coalesceField'
import parseFilter from 'style/parseFilter'

import type {
  ColorMap,
  Glyph,
  GlyphList,
  GlyphMap,
  GlyphObject,
  GlyphStore,
  IconList,
  IconMap,
  Unicode
} from './glyph.spec'
import type { ColorMap as ColorMapResponse, IconMap as IconMapResponse } from 'workers/source/glyphSource'
import type { GlyphData, GlyphRequestMessage, TileRequest } from 'workers/worker.spec'
import type { GlyphFeature, GlyphWorker as GlyphWorkerSpec, IDGen, VTFeature } from '../process.spec'
import type { Alignment, Anchor, GPUType, GlyphLayerDefinition, GlyphWorkerLayer } from 'style/style.spec'
import type { CodeDesign } from '../vectorWorker'
import type { S2VectorPoints } from 's2-vector-tile'

export default class GlyphWorker extends VectorWorker implements GlyphWorkerSpec {
  rtree: RTree = new RTree()
  glyphMap: GlyphMap = {}
  iconMap: IconMap = {}
  colorMap: ColorMap = {}
  iconList: IconList = {}
  glyphList: GlyphList = {}
  glyphStore = new Map<string, GlyphStore>()
  features: GlyphFeature[] = []
  sourceWorker: MessagePort
  uShaper = new UnicodeShaper(uShaperWASM)
  constructor (idGen: IDGen, gpuType: GPUType, sourceWorker: MessagePort) {
    super(idGen, gpuType)
    this.sourceWorker = sourceWorker
  }

  setupLayer (glyphLayer: GlyphLayerDefinition): GlyphWorkerLayer {
    const {
      name, layerIndex, source, layer, minzoom, maxzoom,
      filter, paint, layout, interactive, cursor, lch, overdraw
    } = glyphLayer
    const {
      textSize,
      textFill,
      textStroke,
      textStrokeWidth,
      iconSize
    } = paint
    const {
      textFamily,
      textField,
      textAnchor,
      textOffset,
      textPadding,
      textWordWrap,
      textAlign,
      textKerning,
      textLineHeight,
      iconFamily,
      iconField,
      iconAnchor,
      iconOffset,
      iconPadding
    } = layout

    // build featureCode designs
    const textDesign: CodeDesign = [
      [textSize],
      [textFill, colorFunc(lch)],
      [textStrokeWidth],
      [textStroke, colorFunc(lch)]
    ]
    const iconDesign: CodeDesign = [
      [iconSize]
    ]

    const glyphWorkerLayer: GlyphWorkerLayer = {
      type: 'glyph',
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter: parseFilter(filter),
      textGetCode: this.buildCode(textDesign),
      iconGetCode: this.buildCode(iconDesign),
      textSize: parseFeatureFunction<number>(textSize),
      iconSize: parseFeatureFunction<number>(iconSize),
      layout: {
        textFamily: parseFeatureFunction<string>(textFamily),
        textField: parseFeatureFunction<string | string[]>(textField),
        textAnchor: parseFeatureFunction<Anchor>(textAnchor),
        textOffset: parseFeatureFunction<[number, number]>(textOffset),
        textPadding: parseFeatureFunction<[number, number]>(textPadding),
        textWordWrap: parseFeatureFunction<number>(textWordWrap),
        textAlign: parseFeatureFunction<Alignment>(textAlign),
        textKerning: parseFeatureFunction<number>(textKerning),
        textLineHeight: parseFeatureFunction<number>(textLineHeight),
        iconFamily: parseFeatureFunction<string>(iconFamily),
        iconField: parseFeatureFunction<string | string[]>(iconField),
        iconAnchor: parseFeatureFunction<Anchor>(iconAnchor),
        iconOffset: parseFeatureFunction<[number, number]>(iconOffset),
        iconPadding: parseFeatureFunction<[number, number]>(iconPadding)
      },
      interactive,
      cursor,
      overdraw
    }

    return glyphWorkerLayer
  }

  buildFeature (
    tile: TileRequest,
    feature: VTFeature,
    glyphLayer: GlyphWorkerLayer
  ): boolean {
    const { gpuType } = this
    // creating both a text and icon version as applicable
    const { type, extent, properties } = feature
    if (type !== 1) return false
    const geometry = feature.loadGeometry?.()
    if (geometry === undefined) return false
    // preprocess geometry
    const clip = scaleShiftClip(geometry, type, extent, tile) as S2VectorPoints
    const { idGen } = this
    const { layerIndex, overdraw, layout, interactive } = glyphLayer
    const { zoom } = tile
    if (clip.length === 0) return false

    // build out all the individual s,t tile positions from the feature geometry
    for (const point of clip) {
      const id = idGen.getNum()
      const idRGB = idToRGB(id)
      for (const type of ['icon', 'text'] as Array<'icon' | 'text'>) { // icon FIRST incase text draws over the icon
        if (glyphLayer[`${type}Size`] === undefined) continue

        // build all layout and paint parameters
        // per tile properties
        const deadCode: number[] = []
        let field = coalesceField(layout[`${type}Field`](deadCode, properties, zoom), properties)
        // pre-process and shape the unicodes
        if (field.length === 0) continue
        field = this.uShaper.shapeString(field)
        let fieldCodes: Unicode[] = []
        const family = layout[`${type}Family`](deadCode, properties, zoom)
        // if icon, convert field to list of codes, otherwise create a unicode array
        if (type === 'icon') {
          this.#addMissingIcons(field, family)
        } else {
          fieldCodes = field.split('').map(char => char.charCodeAt(0))
          this.#addMissingChars(fieldCodes, family)
        }
        // for rtree tests
        const size = glyphLayer[`${type}Size`](deadCode, properties, zoom)

        // grab codes
        const [gl1Code, gl2Code] = glyphLayer[`${type}GetCode`](zoom, properties)

        const glyph: GlyphObject = {
          // organization parameters
          idRGB,
          type: (type === 'text') ? 0 : 1,
          overdraw,
          layerIndex,
          gl2Code,
          code: gpuType === 1 ? gl1Code : gl2Code,
          // layout
          family,
          field,
          fieldCodes,
          offset: layout[`${type}Offset`](deadCode, properties, zoom),
          padding: layout[`${type}Padding`](deadCode, properties, zoom),
          anchor: layout[`${type}Anchor`](deadCode, properties, zoom) as Anchor,
          wordWrap: (type === 'text') ? layout.textWordWrap(deadCode, properties, zoom) : 0,
          align: (type === 'text') ? layout.textAlign(deadCode, properties, zoom) : 'center',
          kerning: (type === 'text') ? layout.textKerning(deadCode, properties, zoom) : 0,
          lineHeight: (type === 'text') ? layout.textLineHeight(deadCode, properties, zoom) : 0,
          // paint
          size,
          // tile position
          s: point[0] / extent,
          t: point[1] / extent,
          // prep color, quads, and filter
          color: [],
          quads: [],
          filter: [],
          // prep for rtree test
          children: [],
          treeHeight: 1,
          leaf: true,
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity
        }
        // store
        this.features.push(glyph)
        // if interactive, store interactive properties
        if (interactive) this._addInteractiveFeature(id, properties, glyphLayer)
      }
    }
    return true
  }

  #addMissingChars (
    field: Unicode[],
    family: string
  ): void {
    const { glyphMap, glyphList } = this
    if (glyphMap[family] === undefined) glyphMap[family] = {}
    if (glyphList[family] === undefined) glyphList[family] = new Set()
    const familyList = glyphList[family]
    const familyMap = glyphMap[family]
    for (const unicode of field) {
      if (familyMap[unicode] === undefined) familyList.add(unicode)
    }
  }

  #addMissingIcons (
    field: string,
    family: string
  ): void {
    const { glyphMap, iconList, iconMap } = this
    if (glyphMap[family] === undefined) glyphMap[family] = {}
    if (iconMap[family] === undefined) iconMap[family] = {}
    if (iconList[family] === undefined) iconList[family] = new Set()
    const familyList = iconList[family]
    const familyMap = iconMap[family]
    if (familyMap[field] === undefined) familyList.add(field)
  }

  // the source worker completed the request, here are the unicode properties
  processGlyphResponse (
    reqID: string,
    glyphMetadata: ArrayBuffer,
    familyName: string,
    icons?: IconMapResponse,
    colors?: ColorMapResponse
  ): void {
    const [mapID, sourceName] = reqID.split(':')
    // pull in the features and delete the reference
    const store = this.glyphStore.get(reqID)
    if (store === undefined) return
    store.processed++
    // store our response glyphs
    this.#importGlyphs(familyName, new Float32Array(glyphMetadata))
    // if icons, store icons
    if (icons !== undefined && colors !== undefined) this.#importIconMetadata(familyName, icons, colors)
    // If we have all data, we now process the built glyphs
    if (store.glyphFamilyCount === store.processed) {
      this.glyphStore.delete(reqID)
      const { features, tile } = store
      this.features = features
      // build
      this.flush(mapID, tile, sourceName)
    }
  }

  // a response from the sourceThread for glyph data
  // [unicode, texX, texY, texW, texH, xOffset, yOffset, advanceWidth, ...]
  #importGlyphs (familyName: string, glyphs: Float32Array): void {
    const familyMap = this.glyphMap[familyName]
    for (let i = 0, gl = glyphs.length; i < gl; i += 10) {
      const code = glyphs[i]
      const glyph: Glyph = {
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
      familyMap[code] = glyph
    }
  }

  #importIconMetadata (familyName: string, icons: IconMapResponse, colors: ColorMapResponse): void {
    // store icon metadata
    const iconMap = this.iconMap[familyName]
    for (const icon in icons) iconMap[icon] = icons[icon]
    // store colors
    if (this.colorMap[familyName] === undefined) this.colorMap[familyName] = []
    const colorMap = this.colorMap[familyName]
    for (const color in colors) colorMap[parseInt(color)] = colors[color]
  }

  flush (mapID: string, tile: TileRequest, sourceName: string): number {
    const { sourceWorker, iconList, glyphList: _glyphList, glyphStore, rtree, glyphMap, idGen } = this
    const { workerID } = idGen
    let { features } = this
    const featureLength = features.length
    if (featureLength === 0) return 0
    // if iconList or glyphList is non-zero, we need to request the glyphs and wait
    const glyphFamilyCount = Object.keys(_glyphList).length + Object.keys(iconList).length
    if (glyphFamilyCount > 0) {
      // randome string of numbers and letters 7 characters long
      const reqID = `${mapID}:${sourceName}:${Math.random().toString(36).substring(2, 9)}`
      // build glyphList and iconList to ship to the source thread
      // prep glyphList for transfer
      const glyphList: Record<string, ArrayBuffer> = {}
      for (const family in _glyphList) {
        const list = [..._glyphList[family]].sort((a, b) => a - b)
        glyphList[family] = (new Uint16Array(list)).buffer
      }
      // send off and prep for response
      const requestMessage: GlyphRequestMessage = {
        type: 'glyphrequest',
        mapID,
        workerID,
        reqID,
        glyphList,
        iconList
      }
      sourceWorker.postMessage(requestMessage, Object.values(glyphList))
      glyphStore.set(reqID, { features, tile, glyphFamilyCount, processed: 0 })
    } else {
      // prepare
      rtree.clear()
      const res = []
      // remove empty features; sort the features before running the collisions
      features = features.filter(feature => feature.field.length)
      features = features.sort(featureSort)
      for (const feature of features) {
        // PRE: If icon, remap the features fieldCodes and inject color
        if (feature.type === 1) this.#mapIcon(feature)
        // Step 1: prebuild the glyph positions and bbox
        buildGlyphQuads(feature, glyphMap)
        // Step 2: check the rtree if we want to pre filter
        if (feature.overdraw || !rtree.collides(feature)) res.push(feature)
      }
      this.#flush(mapID, sourceName, tile.id)
    }
    // clear the features and lists for the next tile
    this.features = []
    this.iconList = {}
    this.glyphList = {}
    // finish the flush
    super.flush(mapID, tile, sourceName)

    return featureLength
  }

  #mapIcon (feature: GlyphObject): void {
    const { iconMap, colorMap } = this
    const { family, field } = feature
    const icon = iconMap[family][field]
    const colors = colorMap[family]
    if (icon !== undefined && colors !== undefined) {
      for (const { glyphID, colorID } of icon) {
        feature.fieldCodes.push(glyphID)
        feature.color.push(...colors[colorID])
      }
    }
  }

  #flush (mapID: string, sourceName: string, tileID: bigint): void {
    let { features } = this
    // TODO: Is this necessary? we sorted earlier
    features = features.sort(featureSort)

    // setup draw thread variables
    const glyphFilterVertices: number[] = []
    const glyphFilterIDs: number[] = []
    const glyphQuads: number[] = []
    const glyphQuadIDs: number[] = []
    const glyphColors: number[] = []
    const featureGuide: number[] = []
    // run through features and store
    let curlayerIndex = features[0].layerIndex
    let curType = features[0].type
    let encoding: number[] = features[0].code
    let codeStr: string = features[0].code.toString()
    let filterOffset = 0
    let quadOffset = 0
    let filterCount = 0
    let quadCount = 0
    let indexPos = 0
    // iterate features, store as we go
    for (const feature of features) {
      const { idRGB, type, layerIndex, code, color, quads, filter } = feature
      // if there is a change in layer index or
      if (
        (quadCount > 0 || filterCount > 0) &&
        (curlayerIndex !== layerIndex || codeStr !== code.toString() || curType !== type)
      ) {
        // store featureGuide
        featureGuide.push(
          curlayerIndex, curType, filterOffset, filterCount,
          quadOffset, quadCount, encoding.length, ...encoding
        )
        // update to new codes
        curlayerIndex = layerIndex
        codeStr = code.toString()
        curType = type
        encoding = code
        // update offests
        filterOffset += filterCount
        quadOffset += quadCount
        // reset counts
        filterCount = 0
        quadCount = 0
        indexPos = 0
      }
      // store the quads and colors
      filter[8] = indexPos++
      glyphFilterVertices.push(...filter)
      glyphFilterIDs.push(...idRGB)
      filterCount++
      glyphQuads.push(...quads)
      const qCount = quads.length / QUAD_SIZE
      quadCount += qCount
      // add the feature's id for each quad
      for (let i = 0; i < qCount; i++) glyphQuadIDs.push(...idRGB)
      // add color data
      if (color.length > 0) glyphColors.push(...feature.color)
      else for (let i = 0; i < qCount; i++) glyphColors.push(255, 255, 255, 255)
    }
    // store last set
    if (quadCount > 0 || filterCount > 0) {
      featureGuide.push(
        curlayerIndex, curType, filterOffset, filterCount,
        quadOffset, quadCount, encoding.length, ...encoding
      )
    }

    // filter data
    const glyphFilterBuffer = new Float32Array(glyphFilterVertices).buffer
    const glyphFilterIDBuffer = new Uint8ClampedArray(glyphFilterIDs).buffer
    // quad draw data
    const glyphQuadBuffer = new Float32Array(glyphQuads).buffer
    const glyphQuadIDBuffer = new Uint8ClampedArray(glyphQuadIDs).buffer
    const glyphColorBuffer = new Uint8ClampedArray(glyphColors).buffer
    const featureGuideBuffer = new Float32Array(featureGuide).buffer

    const message: GlyphData = {
      mapID,
      type: 'glyph',
      sourceName,
      tileID,
      glyphFilterBuffer,
      glyphFilterIDBuffer,
      glyphQuadBuffer,
      glyphQuadIDBuffer,
      glyphColorBuffer,
      featureGuideBuffer
    }
    // ship the data
    postMessage(
      message,
      [glyphFilterBuffer, glyphFilterIDBuffer, glyphQuadBuffer, glyphQuadIDBuffer, glyphColorBuffer, featureGuideBuffer]
    )
  }
}

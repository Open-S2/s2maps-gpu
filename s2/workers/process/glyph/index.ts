/* eslint-env worker */
import UnicodeShaper from 'unicode-shaper-zig'
// @ts-expect-error - file exists
import uShaperWASM from 'unicode-shaper-zig/u-shaper.wasm'
import VectorWorker, { colorFunc, idToRGB } from '../vectorWorker'
import featureSort from '../util/featureSort'
import buildGlyphQuads, { QUAD_SIZE } from './buildGlyphQuads'
import RTree from './rtree'
import { scaleShiftClip } from '../util'
import coalesceField from 'style/coalesceField'
import parseFilter from 'style/parseFilter'
import parseFeatureFunction from 'style/parseFeatureFunction'

import type {
  GlyphObject,
  Unicode
} from './glyph.spec'
import type { GlyphData, TileRequest } from 'workers/worker.spec'
import type { GlyphFeature, GlyphWorker as GlyphWorkerSpec, IDGen, VTFeature } from '../process.spec'
import type { Alignment, Anchor, GPUType, GlyphLayerDefinition, GlyphWorkerLayer } from 'style/style.spec'
import type { CodeDesign } from '../vectorWorker'
import type { S2VectorPoints } from 's2-vector-tile'
import type ImageStore from '../imageStore'

export default class GlyphWorker extends VectorWorker implements GlyphWorkerSpec {
  rtree: RTree = new RTree()
  imageStore: ImageStore
  featureStore = new Map<bigint, GlyphObject[]>()
  sourceWorker: MessagePort
  uShaper = new UnicodeShaper(uShaperWASM)
  constructor (idGen: IDGen, gpuType: GPUType, sourceWorker: MessagePort, imageStore: ImageStore) {
    super(idGen, gpuType)
    this.sourceWorker = sourceWorker
    this.imageStore = imageStore
  }

  setupLayer (glyphLayer: GlyphLayerDefinition): GlyphWorkerLayer {
    const {
      name, layerIndex, source, layer, minzoom, maxzoom,
      filter, interactive, cursor, lch, overdraw,
      // paint
      textSize, textFill, textStroke, textStrokeWidth, iconSize,
      // layout
      textFamily, textField, textAnchor, textOffset, textPadding, textWordWrap,
      textAlign, textKerning, textLineHeight, iconFamily, iconField, iconAnchor,
      iconOffset, iconPadding
    } = glyphLayer

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
      // paint
      textSize: parseFeatureFunction<number>(textSize),
      iconSize: parseFeatureFunction<number>(iconSize),
      // layout
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
      iconPadding: parseFeatureFunction<[number, number]>(iconPadding),
      // properties
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
    const { gpuType, imageStore, featureStore } = this
    if (!featureStore.has(tile.id)) featureStore.set(tile.id, [])
    // creating both a text and icon version as applicable
    const { type, extent, properties } = feature
    if (type !== 1) return false
    const geometry = feature.loadGeometry?.()
    if (geometry === undefined) return false
    // preprocess geometry
    const clip = scaleShiftClip(geometry, type, extent, tile) as S2VectorPoints
    const { idGen } = this
    const { layerIndex, overdraw, interactive } = glyphLayer
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
        let field = coalesceField(glyphLayer[`${type}Field`](deadCode, properties, zoom), properties)
        // pre-process and shape the unicodes
        if (field.length === 0) continue
        let fieldCodes: Unicode[] = []
        const family = glyphLayer[`${type}Family`](deadCode, properties, zoom)
        // if icon, convert field to list of codes, otherwise create a unicode array
        let missing = false
        if (type === 'text') {
          field = this.uShaper.shapeString(field)
          fieldCodes = field.split('').map(char => char.charCodeAt(0))
          missing ||= imageStore.addMissingChars(fieldCodes, family)
        } else {
          missing ||= imageStore.addMissingIcons(field, family)
        }
        // for rtree tests
        const size = glyphLayer[`${type}Size`](deadCode, properties, zoom)

        // grab codes
        const [gl1Code, gl2Code] = glyphLayer[`${type}GetCode`](zoom, properties)

        const glyph: GlyphObject = {
          // organization parameters
          id,
          idRGB,
          type,
          overdraw,
          layerIndex,
          gl2Code,
          code: gpuType === 1 ? gl1Code : gl2Code,
          // layout
          family,
          field,
          fieldCodes,
          offset: glyphLayer[`${type}Offset`](deadCode, properties, zoom),
          padding: glyphLayer[`${type}Padding`](deadCode, properties, zoom),
          anchor: glyphLayer[`${type}Anchor`](deadCode, properties, zoom) as Anchor,
          wordWrap: (type === 'text') ? glyphLayer.textWordWrap(deadCode, properties, zoom) : 0,
          align: (type === 'text') ? glyphLayer.textAlign(deadCode, properties, zoom) : 'center',
          kerning: (type === 'text') ? glyphLayer.textKerning(deadCode, properties, zoom) : 0,
          lineHeight: (type === 'text') ? glyphLayer.textLineHeight(deadCode, properties, zoom) : 0,
          // paint
          size,
          // tile position
          s: point[0] / extent,
          t: point[1] / extent,
          // prep color, quads, and filter
          color: [],
          quads: [],
          filter: [0, 0, 0, 0, 0, 0, 0, 0],
          // prep for rtree test
          children: [],
          treeHeight: 1,
          leaf: true,
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
          // track if this feature is missing char or icon data
          missing
        }
        // store
        const store = featureStore.get(tile.id) as GlyphFeature[]
        store.push(glyph)
        // if interactive, store interactive properties
        if (interactive) this._addInteractiveFeature(id, properties, glyphLayer)
      }
    }
    return true
  }

  async flush (mapID: string, tile: TileRequest, sourceName: string, wait: Promise<void>): Promise<void> {
    const features = this.featureStore.get(tile.id) ?? []
    // check if we need to wait for a response of missing data
    const missing = features.some(f => f.missing)
    if (missing) await wait
    // if no missing data just flush now
    this.#flushReadyFeatures(mapID, tile, sourceName, features)
    // finish the flush
    await super.flush(mapID, tile, sourceName, wait)
    // cleanup
    this.featureStore.delete(tile.id)
  }

  // actually flushing because the glyph response came back (if needed)
  // and all glyphs are ready to be processed
  #flushReadyFeatures (
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    features: GlyphFeature[]
  ): void {
    const { imageStore, rtree } = this
    // prepare
    rtree.clear()
    const res: GlyphObject[] = []
    // remove empty features; sort the features before running the collisions
    features = features.filter(feature => {
      if (feature.type === 'icon') return true
      // corner case: sometimes the feature field could just be a group of empty codes
      for (const code of feature.fieldCodes) if (code >= 33) return true
      return false
    })
    features = features.sort(featureSort)
    for (const feature of features) {
      // PRE: If icon, remap the features fieldCodes and inject color
      if (feature.type === 'icon') this.#mapIcon(feature)
      // Step 1: prebuild the glyph positions and bbox
      buildGlyphQuads(feature, imageStore.glyphMap)
      // Step 2: check the rtree if we want to pre filter
      if (feature.overdraw || !rtree.collides(feature)) res.push(feature)
    }
    this.#flush(mapID, sourceName, tile.id)
  }

  #mapIcon (feature: GlyphObject): void {
    const { iconMap, colorMap } = this.imageStore
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
    const features = this.featureStore.get(tileID) ?? []
    if (features.length === 0) return
    if (this.gpuType === 3) this.#flush3(mapID, sourceName, tileID, features)
    else this.#flush2(mapID, sourceName, tileID, features)
    // cleanup
    this.featureStore.delete(tileID)
  }

  #flush2 (mapID: string, sourceName: string, tileID: bigint, features: GlyphObject[]): void {
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
      // if there is a change in layer index or not the same feature set
      if (
        (quadCount > 0 || filterCount > 0) &&
        (curlayerIndex !== layerIndex || codeStr !== code.toString() || curType !== type)
      ) {
        // store featureGuide
        featureGuide.push(
          curlayerIndex, ~~(curType === 'icon'), filterOffset, filterCount,
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
      glyphFilterVertices.push(...filter, indexPos++)
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
        curlayerIndex, ~~(curType === 'icon'), filterOffset, filterCount,
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

  #flush3 (mapID: string, sourceName: string, tileID: bigint, features: GlyphObject[]): void {
    // ID => { index: resultIndex, count: how many share the same resultIndex }
    let currIndex = 0
    const resultIndexMap = new Map<number, number>()
    for (const { id } of features) {
      if (!resultIndexMap.has(id)) resultIndexMap.set(id, currIndex++)
    }

    // setup draw thread variables
    const glyphFilterVertices: number[] = []
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
    // iterate features, store as we go
    for (const feature of features) {
      const { id, type, layerIndex, code, color, quads, filter } = feature
      // if there is a change in layer index or
      if (
        (quadCount > 0 || filterCount > 0) &&
        (curlayerIndex !== layerIndex || codeStr !== code.toString() || curType !== type)
      ) {
        // store featureGuide
        featureGuide.push(
          curlayerIndex, ~~(curType === 'icon'), filterOffset, filterCount,
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
      }
      // update filters index, store it, and store the ID, hiding the count inside the id
      const resultMap = resultIndexMap.get(id) ?? 0
      glyphFilterVertices.push(...filter, storeAsFloat32(resultMap), storeAsFloat32(id))
      filterCount++
      glyphQuads.push(...quads)
      const qCount = quads.length / QUAD_SIZE
      quadCount += qCount
      // add the feature's index for each quad
      for (let i = 0; i < qCount; i++) glyphQuadIDs.push(resultMap)
      // add color data
      if (color.length > 0) glyphColors.push(...color.map(c => c / 255))
      else for (let i = 0; i < qCount; i++) glyphColors.push(1, 1, 1, 1)
    }
    // store last set
    if (quadCount > 0 || filterCount > 0) {
      featureGuide.push(
        curlayerIndex, ~~(curType === 'icon'), filterOffset, filterCount,
        quadOffset, quadCount, encoding.length, ...encoding
      )
    }

    // filter data
    const glyphFilterBuffer = new Float32Array(glyphFilterVertices).buffer
    // unused by WebGPU
    const glyphFilterIDBuffer = new Uint8ClampedArray([0]).buffer
    // quad draw data
    const glyphQuadBuffer = new Float32Array(glyphQuads).buffer
    // actually an index buffer not ID buffer
    const glyphQuadIDBuffer = new Uint32Array(glyphQuadIDs).buffer
    const glyphColorBuffer = new Float32Array(glyphColors).buffer
    const featureGuideBuffer = new Float32Array(featureGuide).buffer

    const message: GlyphData = {
      mapID,
      type: 'glyph' as const,
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

function storeAsFloat32 (u32value: number): number {
  const buffer = new ArrayBuffer(4)
  const u32View = new Uint32Array(buffer)
  const f32View = new Float32Array(buffer)

  u32View[0] = u32value
  return f32View[0]
}

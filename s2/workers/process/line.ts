/* eslint-env worker */
import VectorWorker, { type CodeDesign, colorFunc, idToRGB } from './vectorWorker'
import { drawLine, featureSort } from './util'
import scaleShiftClip from './util/scaleShiftClip'
import parseFilter from 'style/parseFilter'
import parseFeatureFunction from 'style/parseFeatureFunction'

import type {
  S2VectorLines,
  S2VectorMultiPoly,
  S2VectorPoly
} from 's2-vector-tile'
import type { LineData, TileRequest } from '../worker.spec'
import type {
  Cap,
  Join,
  LineLayerDefinition,
  LineWorkerLayer
} from 'style/style.spec'
import type {
  LineFeature,
  LineWorker as LineWorkerSpec,
  VTFeature
} from './process.spec'

export default class LineWorker extends VectorWorker implements LineWorkerSpec {
  features: LineFeature[] = []

  setupLayer (lineLayer: LineLayerDefinition): LineWorkerLayer {
    const {
      name, layerIndex, source, layer, minzoom, maxzoom, filter,
      dashed, onlyLines, interactive, cursor, lch, cap, join,
      color, opacity, width, gapwidth
    } = lineLayer

    // build feature code design
    // color -> opacity -> width -> gapwidth
    const design: CodeDesign = [
      [color, colorFunc(lch)],
      [opacity],
      [width],
      [gapwidth]
    ]

    return {
      type: 'line',
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      cap: parseFeatureFunction<Cap, Cap>(cap),
      join: parseFeatureFunction<Join, Join>(join),
      filter: parseFilter(filter),
      getCode: this.buildCode(design),
      dashed,
      onlyLines,
      interactive,
      cursor
    }
  }

  buildFeature (
    tile: TileRequest,
    feature: VTFeature,
    lineLayer: LineWorkerLayer
  ): boolean {
    const { gpuType } = this
    const { zoom, division } = tile
    const { type, extent, properties } = feature
    const { getCode, layerIndex, onlyLines } = lineLayer
    if (
      type === 1 ||
      type > 4 ||
      ((type === 3 || type === 4) && onlyLines)
    ) return false
    const geometry = feature.loadGeometry?.()
    if (geometry === undefined) return false
    const cap = lineLayer.cap([], properties, zoom)
    const vertices: number[] = []
    const lengthSoFar: number[] = []

    // create multiplier
    const multiplier = 8_192 / extent
    // find a max distance to modify lines too large (round off according to the sphere)
    const maxDistance = (division === 1) ? 0 : extent / division
    // preprocess geometry
    const clip = scaleShiftClip(geometry, type, extent, tile) as S2VectorLines | S2VectorPoly | S2VectorMultiPoly
    // if multi-polygon, join all outer rings and holes together
    let geo: S2VectorLines = []
    if (type === 4) for (const poly of clip) geo.push(...(poly as S2VectorPoly))
    else geo = clip as S2VectorLines
    // draw
    const { round } = Math
    for (const lineString of geo) {
      // build the vertex, normal, and index data
      const { prev, curr, next, lengthSoFar: _lsf } = drawLine(lineString, cap, maxDistance)
      for (let i = 0, vc = curr.length; i < vc; i += 2) {
        vertices.push(
          round(prev[i] * multiplier), round(prev[i + 1] * multiplier),
          round(curr[i] * multiplier), round(curr[i + 1] * multiplier),
          round(next[i] * multiplier), round(next[i + 1] * multiplier)
        )
      }
      for (const l of _lsf) lengthSoFar.push(l)
    }

    // skip empty geometry
    if (vertices.length === 0) return false

    const id = this.idGen.getNum()
    const [gl1Code, gl2Code] = getCode(zoom, properties)
    const lineFeature: LineFeature = {
      cap,
      vertices,
      lengthSoFar,
      layerIndex,
      code: gpuType === 1 ? gl1Code : gl2Code,
      gl2Code,
      idRGB: idToRGB(id)
    }

    this.features.push(lineFeature)
    return true
  }

  flush (mapID: string, tile: TileRequest, sourceName: string): void {
    if (this.features.length === 0) return
    this.#flush(mapID, sourceName, tile.id)
    this.features = []
  }

  #flush (mapID: string, sourceName: string, tileID: bigint): void {
    const { features } = this

    // Step 1: Sort by layerIndex, than sort by feature code.
    features.sort(featureSort)

    // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    const vertices: number[] = []
    const lengthSoFar: number[] = []
    const featureGuide: number[] = []
    let encodings: number[] = features[0].code
    let indexCount = 0
    let indexOffset = 0
    let curFeatureCode = encodings.toString()
    let curlayerIndex = features[0].layerIndex
    let curCap = 0

    for (const { layerIndex, code, cap, vertices: _vertices, lengthSoFar: _lsf } of features) {
      // on layer change or max feature code change, we have to setup a new featureGuide
      if (
        indexCount > 0 &&
        (
          curlayerIndex !== layerIndex ||
          curFeatureCode !== code.toString()
        )
      ) {
        // store the current feature
        featureGuide.push(
          curCap,
          curlayerIndex,
          indexCount,
          indexOffset,
          encodings.length,
          ...encodings
        ) // layerIndex, count, offset, encoding size, encodings
        // update indexOffset
        indexOffset += indexCount
        // reset indexCount
        indexCount = 0
        // update to new encoding set
        encodings = code
        // update what the current encoding is
        curFeatureCode = encodings.toString()
      }
      // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
      // so we just do a for loop. Store vertices and feature code for each vertex set
      const fl: number = _vertices.length
      for (let f = 0; f < fl; f++) vertices.push(_vertices[f])
      for (const l of _lsf) lengthSoFar.push(l)
      // update previous layerIndex
      curlayerIndex = layerIndex
      // store the cap type
      curCap = encodeCap(cap)
      // increment indexCount
      indexCount += fl / 6
    }
    // store the very last featureGuide batch if not yet stored
    if (indexCount > 0) {
      featureGuide.push(
        curCap,
        curlayerIndex,
        indexCount,
        indexOffset,
        encodings.length,
        ...encodings
      ) // layerIndex, count, offset, encoding size, encodings
    }

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Float32Array(vertices).buffer
    const lengthSoFarBuffer = new Float32Array(lengthSoFar).buffer
    const featureGuideBuffer = new Float32Array(featureGuide).buffer
    // ship the vector data.
    const data: LineData = {
      mapID,
      type: 'line',
      sourceName,
      tileID,
      vertexBuffer,
      lengthSoFarBuffer,
      featureGuideBuffer
    }
    postMessage(data, [vertexBuffer, featureGuideBuffer])
  }
}

function encodeCap (cap: Cap): number {
  if (cap === 'butt') return 0
  else if (cap === 'square') return 1
  else return 2 // round
}

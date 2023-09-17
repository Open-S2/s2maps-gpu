/* eslint-env worker */
import VectorWorker, { colorFunc, idToRGB } from './vectorWorker'
import { earclip } from 'earclip'
import { featureSort, scaleShiftClip } from './util'
import parseFilter from 'style/parseFilter'

import type {
  S2VectorGeometry,
  S2VectorMultiPoly,
  S2VectorPoly
} from 's2-vector-tile'
import type { TileRequest } from '../worker.spec'
import type {
  FillLayerDefinition,
  FillWorkerLayer
} from 'style/style.spec'
import type {
  FillFeature,
  FillWorker as FillWorkerSpec,
  VTFeature
} from './process.spec'
import type { CodeDesign } from './vectorWorker'

// const MAX_FEATURE_BATCH_SIZE = 1 << 7 // 128
const MAX_FEATURE_BATCH_SIZE = 1 << 6 // 64

export default class FillWorker extends VectorWorker implements FillWorkerSpec {
  features: FillFeature[] = []
  invertLayers = new Map<number, FillWorkerLayer>()

  setupLayer (fillLayer: FillLayerDefinition): FillWorkerLayer {
    const {
      name, layerIndex, source, layer, minzoom, maxzoom,
      filter, color, opacity, invert, interactive, cursor, opaque, lch
    } = fillLayer

    // build featureCode design
    // radius -> opacity
    const design: CodeDesign = [
      [color, colorFunc(lch)],
      [opacity]
    ]

    const fillWorkerLayer: FillWorkerLayer = {
      type: 'fill',
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter: parseFilter(filter),
      getCode: this.buildCode(design),
      invert,
      interactive,
      cursor,
      opaque
    }

    if (invert) this.invertLayers.set(layerIndex, fillWorkerLayer)

    return fillWorkerLayer
  }

  buildFeature (
    tile: TileRequest,
    feature: VTFeature,
    fillLayer: FillWorkerLayer
  ): boolean {
    const { gpuType } = this
    // pull data
    const { zoom, division } = tile
    const { extent, properties } = feature
    let { type } = feature
    const { getCode, interactive, layerIndex } = fillLayer
    // only accept polygons and multipolygons
    if (type !== 3 && type !== 4) return false
    const hasParent = tile.parent !== undefined
    const [geometry, indices] = !hasParent && feature.loadGeometryFlat !== undefined
      ? feature.loadGeometryFlat()
      : [feature.loadGeometry?.(), [] as number[]]
    let vertices: number[] = []

    if (geometry === undefined) return false
    if (
      type === 3 &&
      Array.isArray(geometry[0]) &&
      Array.isArray(geometry[0][0]) &&
      Array.isArray(geometry[0][0][0])
    ) type = 4

    // if not parent and indices, the polygon has already been "solved"
    if (hasParent || indices.length === 0) {
      // prep polys
      const polys: number[][][][] = []
      // preprocess geometry
      const clip = scaleShiftClip(
        geometry as S2VectorGeometry,
        type,
        extent,
        tile
      ) as S2VectorPoly | S2VectorMultiPoly
      // prep for processing
      if (type === 4) {
        for (const poly of clip as S2VectorMultiPoly) polys.push(poly)
      } else { polys.push(clip as S2VectorPoly) }
      // create multiplier
      const multiplier = 8_192 / extent
      // process
      const { round } = Math
      for (const poly of polys) {
        // create triangle mesh
        const data = earclip(poly, extent / division, vertices.length / 2)
        // store vertices
        for (let i = 0, vl = data.vertices.length; i < vl; i++) {
          vertices.push(round(data.vertices[i] * multiplier))
        }
        // store indices
        for (let i = 0, il = data.indices.length; i < il; i++) {
          indices.push(data.indices[i])
        }
      }
    } else {
      vertices = geometry as number[]
    }

    // if geometry is empty, skip
    if (vertices.length === 0 || indices.length === 0) return false

    const id = !isNaN(properties.__id as number) ? Number(properties.__id) : this.idGen.getNum()
    const [gl1Code, gl2Code] = getCode(zoom, properties)
    const fillFeature: FillFeature = {
      vertices,
      indices,
      layerIndex,
      code: gpuType === 1 ? gl1Code : gl2Code,
      gl2Code,
      idRGB: idToRGB(id)
    }

    // if interactive, store interactive properties
    if (interactive) this._addInteractiveFeature(id, properties, fillLayer)

    this.features.push(fillFeature)
    return true
  }

  flush (mapID: string, tile: TileRequest, sourceName: string): void {
    // If `invertLayers` is non-empty, we should check if `features`
    // does not have said invert layers. If it doesn't, we need to add
    // a dummy feature that is empty for said layers.
    for (const [layerIndex, fillWorkerLayer] of this.invertLayers) {
      if (fillWorkerLayer.source !== sourceName) continue
      if (!this.features.some(feature => feature.layerIndex === layerIndex)) {
        this.#buildInvertFeature(tile, fillWorkerLayer)
      }
    }

    if (this.features.length !== 0) {
      this.#flush(mapID, sourceName, tile.id)
      this.features = []
    }
    // finish the flush
    super.flush(mapID, tile, sourceName)
  }

  // NOTE: You can not build invert features that require properties data
  #buildInvertFeature (tile: TileRequest, fillWorkerLayer: FillWorkerLayer): void {
    const { gpuType } = this
    const { zoom } = tile
    const { getCode, minzoom, maxzoom, layerIndex } = fillWorkerLayer
    // respect zoom range
    if (zoom < minzoom || zoom > maxzoom) return
    // build feature
    const id = this.idGen.getNum()
    const [gl1Code, gl2Code] = getCode(zoom, {})
    const feature: FillFeature = {
      vertices: [0, 0, 8_192, 0, 8_192, 8_192, 0, 8_192],
      indices: [0, 2, 1, 2, 0, 3],
      layerIndex,
      code: gpuType === 1 ? gl1Code : gl2Code,
      gl2Code,
      idRGB: idToRGB(id)
    }

    this.features.push(feature)
  }

  #flush (mapID: string, sourceName: string, tileID: bigint): void {
    const { features } = this
    // now that we have created all triangles, let's merge into bundled buffer sets
    // for the main thread to build VAOs.

    // Step 1: Sort by layerIndex, than sort by feature code.
    features.sort(featureSort)

    // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    const vertices: number[] = []
    const indices: number[] = []
    const ids: number[] = []
    const codeType: number[] = []
    const featureGuide: number[] = []
    let encodings: number[] = []
    let indicesOffset = 0
    let vertexOffset = 0
    let encodingIndexes: Record<string, number> = { '': 0 }
    let encodingIndex = 0
    let curlayerIndex = features[0].layerIndex

    for (const { code, layerIndex, vertices: _vertices, indices: _indices, idRGB } of features) {
      // on layer change or max encoding size, we have to setup a new featureGuide, encodings, and encodingIndexes
      if (
        curlayerIndex !== layerIndex ||
        (encodings.length + code.length > MAX_FEATURE_BATCH_SIZE)
      ) {
        // only store if count is actually greater than 0
        featureGuide.push(
          curlayerIndex,
          indices.length - indicesOffset,
          indicesOffset,
          encodings.length,
          ...encodings
        ) // layerIndex, count, offset, encoding size, encodings
        // update variables for reset
        indicesOffset = indices.length
        encodings = []
        encodingIndexes = { '': 0 }
      }
      // setup encodings data. If we didn't have current feature's encodings already, create and set index
      const feKey = code.toString()
      encodingIndex = encodingIndexes[feKey]
      if (encodingIndex === undefined) {
        encodingIndex = encodingIndexes[feKey] = this.gpuType === 1 ? encodings.length / 5 : encodings.length
        encodings.push(...code)
      }
      // store
      vertexOffset = vertices.length / 2
      // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
      // so we just do a for loop
      for (let f = 0, fl = _vertices.length; f < fl; f++) {
        vertices.push(_vertices[f])
      }
      for (let f = 0, fl = _indices.length; f < fl; f++) {
        const index = _indices[f] + vertexOffset
        indices.push(index)
        codeType[index] = encodingIndex
        // store id RGB value
        const idRGBIndex = index * 3
        ids[idRGBIndex] = idRGB[0]
        ids[idRGBIndex + 1] = idRGB[1]
        ids[idRGBIndex + 2] = idRGB[2]
      }
      // update previous layerIndex
      curlayerIndex = layerIndex
    }
    // store the very last featureGuide batch
    if (indices.length - indicesOffset > 0) {
      featureGuide.push(
        curlayerIndex,
        indices.length - indicesOffset,
        indicesOffset,
        encodings.length,
        ...encodings
      ) // layerIndex, count, offset, encoding size, encodings
    }

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Int16Array(vertices).buffer
    const indexBuffer = new Uint32Array(indices).buffer
    const fillIDBuffer = new Uint8Array(ids).buffer // pre-store each id as an rgb value
    const codeTypeBuffer = new Uint8Array(codeType).buffer
    const featureGuideBuffer = new Float32Array(featureGuide).buffer
    // ship the vector data.
    postMessage({
      mapID,
      type: 'fill',
      sourceName,
      tileID,
      vertexBuffer,
      indexBuffer,
      fillIDBuffer,
      codeTypeBuffer,
      featureGuideBuffer
    }, [vertexBuffer, indexBuffer, fillIDBuffer, codeTypeBuffer, featureGuideBuffer])
  }
}

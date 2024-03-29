import VectorWorker, { colorFunc, idToRGB } from './vectorWorker'
import { featureSort, flattenGeometryToPoints, scaleShiftClip } from './util'
import parseFilter from 'style/parseFilter'
import parseFeatureFunction from 'style/parseFeatureFunction'

import type { HeatmapData, PointData, TileRequest } from '../worker.spec'
import type { S2VectorPoints } from 's2-vector-tile'
import type {
  HeatmapDefinition,
  HeatmapWorkerLayer,
  PointDefinition,
  PointWorkerLayer
} from 'style/style.spec'
import type {
  HeatmapFeature,
  PointFeature,
  PointWorker as PointWorkerSpec,
  VTFeature
} from './process.spec'
import type { CodeDesign } from './vectorWorker'

export interface Features {
  point: PointFeature[]
  heatmap: HeatmapFeature[]
}

export default class PointWorker extends VectorWorker implements PointWorkerSpec {
  featureStore = new Map<string, Features>() // tileID -> features

  setupLayer (
    layerDefinition: PointDefinition | HeatmapDefinition
  ): PointWorkerLayer | HeatmapWorkerLayer {
    const {
      type, name, layerIndex, source, layer, minzoom, maxzoom,
      filter, geoFilter, radius, opacity, lch
    } = layerDefinition

    // build featureCode design
    // heatmap: radius -> opacity -> intensity
    // point:  radius -> opacity -> color -> stroke -> strokeWidth
    const design: CodeDesign = [
      [radius],
      [opacity]
    ]
    if (type === 'point') {
      const { color, stroke, strokeWidth } = layerDefinition
      design.push(
        [color, colorFunc(lch)],
        [stroke, colorFunc(lch)],
        [strokeWidth]
      )
    } else {
      const { intensity } = layerDefinition
      design.push([intensity])
    }

    const base = {
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter: parseFilter(filter),
      getCode: this.buildCode(design)
    }

    if (type === 'point') {
      const { interactive, cursor } = layerDefinition
      return { type, geoFilter, interactive, cursor, ...base }
    } else {
      const weight = parseFeatureFunction<number>(layerDefinition.weight)
      return { type, geoFilter, weight, ...base }
    }
  }

  buildFeature (
    tile: TileRequest,
    feature: VTFeature,
    layer: PointWorkerLayer | HeatmapWorkerLayer,
    mapID: string,
    sourceName: string
  ): boolean {
    const { gpuType } = this
    const { zoom } = tile
    const { extent, properties, type: featureType } = feature
    const { type, getCode, layerIndex, geoFilter } = layer
    if (
      geoFilter.includes('poly') &&
      (featureType === 3 || featureType === 4)
    ) return false
    if (geoFilter.includes('line') && featureType === 2) return false
    if (geoFilter.includes('point') && featureType === 1) return false
    // load geometry
    const geometry = feature.loadGeometry?.() as S2VectorPoints
    if (geometry === undefined) return false
    // preprocess geometry
    const points = flattenGeometryToPoints(geometry, featureType)
    const clip = scaleShiftClip(points, 1, extent, tile) as S2VectorPoints
    if (clip === undefined) return false
    const vertices: number[] = []
    const weights: number[] = []
    const isHeatmap = type === 'heatmap'

    const weight = isHeatmap ? layer.weight([], properties, zoom) : 0
    // create multiplier
    const multiplier = 1 / extent
    // if weight, then it is a heatmap and we add weight data
    for (const point of clip) {
      vertices.push(point[0] * multiplier, point[1] * multiplier)
      if (isHeatmap) weights.push(weight)
    }

    // skip empty geometry
    if (vertices.length === 0) return false

    const codeLoBoth = getCode(zoom, properties)
    const codeLo = codeLoBoth[gpuType === 1 ? 0 : 1]
    const gl2Code = codeLoBoth[1]
    const codeHi = getCode(zoom + 1, properties)[gpuType === 1 ? 0 : 1]
    const typeFeature = {
      vertices,
      layerIndex,
      code: type === 'point'
        ? codeLo
        : [...codeLo, ...codeHi],
      gl2Code
    }

    const storeID: string = `${mapID}:${tile.id}:${sourceName}`
    if (!this.featureStore.has(storeID)) this.featureStore.set(storeID, { point: [], heatmap: [] })
    const store = this.featureStore.get(storeID)
    if (type === 'point') {
      const id = this.idGen.getNum()
      store?.point.push({
        type: 'point',
        idRGB: idToRGB(id),
        ...typeFeature
      })
      // if interactive, store interactive properties
      if (layer.interactive) this._addInteractiveFeature(id, properties, layer)
    } else {
      store?.heatmap.push({
        type: 'heatmap',
        weights,
        ...typeFeature
      })
    }
    return true
  }

  async flush (mapID: string, tile: TileRequest, sourceName: string, wait: Promise<void>): Promise<void> {
    this.#flush(mapID, sourceName, tile.id, 'point')
    this.#flush(mapID, sourceName, tile.id, 'heatmap')
    this.featureStore.delete(`${mapID}:${tile.id}:${sourceName}`)
    await super.flush(mapID, tile, sourceName, wait)
  }

  #flush (mapID: string, sourceName: string, tileID: bigint, type: 'point' | 'heatmap'): void {
    const features = (this.featureStore.get(`${mapID}:${tileID}:${sourceName}`) ?? { point: [], heatmap: [] })[type]
    if (features.length === 0) return

    // Step 1: Sort by layerIndex, than sort by feature code.
    features.sort(featureSort)

    // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    const vertices: number[] = []
    const weights: number[] = []
    const featureGuide: number[] = []
    const ids: number[] = []
    let encodings: number[] = features[0].code
    let indexCount = 0
    let indexOffset = 0
    let curFeatureCode = encodings.toString()
    let curlayerIndex = features[0].layerIndex

    for (const feature of features) {
      const { type: featureType, layerIndex, code, vertices: _vertices } = feature
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
      for (let f = 0; f < fl; f++) {
        vertices.push(_vertices[f])
        if (featureType === 'point' && f % 2 === 0) ids.push(...feature.idRGB)
      }
      // build weights if heatmap
      if (featureType === 'heatmap') {
        const { weights: _weights } = feature
        const wl: number = _weights.length
        for (let f = 0; f < wl; f++) weights.push(_weights[f])
      }
      // store
      // update previous layerIndex
      curlayerIndex = layerIndex
      // increment indexCount
      indexCount += fl / 2
    }
    // store the very last featureGuide batch if not yet stored
    if (indexCount > 0) {
      featureGuide.push(
        curlayerIndex,
        indexCount,
        indexOffset,
        encodings.length,
        ...encodings
      ) // layerIndex, count, offset, encoding size, encodings
    }

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Float32Array(vertices).buffer as ArrayBuffer
    const weightBuffer = new Float32Array(weights).buffer as ArrayBuffer
    const idBuffer = new Uint8ClampedArray(ids).buffer as ArrayBuffer // pre-store each id as an rgb value
    const featureGuideBuffer = new Float32Array(featureGuide).buffer as ArrayBuffer
    // ship the vector data.
    if (type === 'point') {
      const data: PointData = {
        mapID,
        type,
        sourceName,
        tileID,
        vertexBuffer,
        idBuffer,
        featureGuideBuffer
      }
      postMessage(data, [vertexBuffer, idBuffer, featureGuideBuffer])
    } else {
      const data: HeatmapData = {
        mapID,
        type,
        sourceName,
        tileID,
        vertexBuffer,
        weightBuffer,
        idBuffer,
        featureGuideBuffer
      }
      postMessage(data, [vertexBuffer, weightBuffer, idBuffer, featureGuideBuffer])
    }
  }
}

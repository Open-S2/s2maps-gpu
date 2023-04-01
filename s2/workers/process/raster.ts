/* eslint-env worker */
import { isSafari } from '../../util/polyfill'
import { parseFeatureFunction } from './util'

import type { RasterData, RasterDataGuide, SensorData, SensorDataGuide, TileRequest } from '../worker.spec'
import type {
  BuildCodeFunctionZoom,
  GPUType,
  LayerWorkerFunction,
  RasterLayerDefinition,
  RasterWorkerLayer,
  SensorLayerDefinition,
  SensorWorkerLayer
} from '../../style/style.spec'
import type {
  RasterWorker as RasterWorkerSpec
} from './process.spec'
import type { CodeDesign } from './vectorWorker'

export default class RasterWorker implements RasterWorkerSpec {
  gpuType: GPUType
  constructor (gpuType: GPUType) {
    this.gpuType = gpuType
  }

  setupLayer (layerDefinition: SensorLayerDefinition | RasterLayerDefinition): RasterWorkerLayer | SensorWorkerLayer {
    const {
      type, name, layerIndex, source,
      layer, minzoom, maxzoom, paint
    } = layerDefinition
    const { opacity } = paint

    // build feature code design
    // opacity->saturation->contrast
    const design: CodeDesign = [
      [opacity]
    ]
    if (type === 'raster') {
      const { saturation, contrast } = paint
      design.push(
        [saturation],
        [contrast]
      )
    }

    return {
      type,
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      getCode: this.buildCode(design)
    }
  }

  buildCode (design: CodeDesign): BuildCodeFunctionZoom {
    const { gpuType } = this

    const featureFunctions: Array<LayerWorkerFunction<number | [number, number, number, number]>> = []
    for (const [input, output] of design) {
      featureFunctions.push(parseFeatureFunction<number | [number, number, number, number]>(input, output))
    }

    return (zoom: number) => {
      // prep codes
      const code: number[] = []
      const properties = {}
      const webgl1Code: number[] = featureFunctions.map(func => func(code, properties, zoom)).flat()

      return gpuType === 1 ? webgl1Code : code
    }
  }

  async buildTile (
    mapID: string,
    sourceName: string,
    layers: Array<RasterWorkerLayer | SensorWorkerLayer>,
    tile: TileRequest,
    data: ArrayBuffer,
    size: number
  ): Promise<void> {
    // prep variables
    const { zoom, id, time } = tile
    // prebuild feature code if webgl1
    const rasterFeatureGuides: RasterDataGuide[] = []
    const sensorFeatureGuides: SensorDataGuide[] = []
    for (const { type, getCode, layerIndex } of layers) {
      const guide = type === 'raster' ? rasterFeatureGuides : sensorFeatureGuides
      guide.push({
        code: getCode(zoom),
        layerIndex
      })
    }

    // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594 - saved for posterity
    let built = false
    let image: ArrayBuffer | ImageBitmap = data
    if (typeof createImageBitmap === 'function' && !isSafari) {
      image = await createImageBitmap(new Blob([data]), { premultiplyAlpha: 'none' })
      built = true
    }

    // ship the raster data.
    if (rasterFeatureGuides.length > 0) {
      const rasterData: RasterData = {
        mapID,
        type: 'raster',
        tileID: id,
        built,
        size,
        sourceName,
        featureGuides: rasterFeatureGuides,
        image
      }

      postMessage(rasterData, [image])
    }
    if (sensorFeatureGuides.length > 0 && time !== undefined) {
      const sensorData: SensorData = {
        mapID,
        type: 'sensor',
        tileID: id,
        built,
        size,
        sourceName,
        featureGuides: sensorFeatureGuides,
        image,
        time
      }

      postMessage(sensorData, [image])
    }
  }
}

/* eslint-env worker */
// import { isSafari } util/polyfill'
import { colorFunc } from './vectorWorker'
import parseFeatureFunction from 'style/parseFeatureFunction'

import type { HillshadeData, RasterData, RasterDataGuide, SensorData, TileRequest } from '../worker.spec'
import type {
  BuildCodeFunctionZoom,
  GPUType,
  HillshadeLayerDefinition,
  HillshadeWorkerLayer,
  LayerWorkerFunction,
  RasterLayerDefinition,
  RasterWorkerLayer,
  SensorLayerDefinition,
  SensorWorkerLayer
} from 'style/style.spec'
import type {
  RasterWorker as RasterWorkerSpec
} from './process.spec'
import type { CodeDesign } from './vectorWorker'

export default class RasterWorker implements RasterWorkerSpec {
  gpuType: GPUType
  constructor (gpuType: GPUType) {
    this.gpuType = gpuType
  }

  setupLayer (
    layerDefinition: SensorLayerDefinition | RasterLayerDefinition | HillshadeLayerDefinition
  ): RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer {
    const {
      type, name, layerIndex, source,
      layer, minzoom, maxzoom, opacity
    } = layerDefinition

    // build feature code design
    // opacity->saturation->contrast
    const design: CodeDesign = [
      [opacity]
    ]
    if (type === 'raster') {
      const { saturation, contrast } = layerDefinition
      design.push(
        [saturation],
        [contrast]
      )
    } else if (type === 'hillshade') {
      const { shadowColor, accentColor, highlightColor, azimuth, altitude, lch } = layerDefinition
      design.push(
        [shadowColor, colorFunc(lch)],
        [accentColor, colorFunc(lch)],
        [highlightColor, colorFunc(lch)],
        [azimuth],
        [altitude]
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

  buildCode (design: CodeDesign<number>): BuildCodeFunctionZoom {
    const { gpuType } = this

    const featureFunctions: Array<LayerWorkerFunction<number | [number, number, number, number]>> = []
    for (const [input, cb] of design) {
      featureFunctions.push(parseFeatureFunction<number, [number, number, number, number]>(input, cb))
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
    layers: Array<RasterWorkerLayer | SensorWorkerLayer | HillshadeWorkerLayer>,
    tile: TileRequest,
    data: ArrayBuffer,
    size: number
  ): Promise<void> {
    // prep variables
    const { zoom, id, time } = tile
    // prebuild feature code if webgl1
    const rasterFeatureGuides: RasterDataGuide[] = []
    const sensorFeatureGuides: RasterDataGuide[] = []
    const HillshadeFeatureGuides: RasterDataGuide[] = []
    for (const { type, getCode, layerIndex } of layers) {
      const guide = type === 'raster'
        ? rasterFeatureGuides
        : (type === 'sensor')
            ? sensorFeatureGuides
            : HillshadeFeatureGuides
      guide.push({
        code: getCode(zoom),
        layerIndex
      })
    }

    // https://bugzilla.mozilla.org/show_bug.cgi?id=1335594 - saved for posterity
    let built = false
    let image: ArrayBuffer | ImageBitmap = data
    // TODO: Had to remove !isSafari, so even though premultiplyAlpha is not supported in Safari
    // TODO: We will just have to let sensor data be wrong for now. no idea why this doesn't work anymore
    if (typeof createImageBitmap === 'function') {
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
    if (HillshadeFeatureGuides.length > 0) {
      const hillshadeData: HillshadeData = {
        mapID,
        type: 'hillshade',
        tileID: id,
        built,
        size: built ? (image as ImageBitmap).width : size,
        sourceName,
        featureGuides: HillshadeFeatureGuides,
        image
      }

      postMessage(hillshadeData, [image])
    }
  }

  async flush (mapID: string, tile: TileRequest, sourceName: string): Promise<void> {}
}

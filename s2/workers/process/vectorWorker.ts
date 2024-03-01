/* eslint-env worker */
import Color from 'style/color'
import { type Properties } from 'geometry'
import parseFeatureFunction from 'style/parseFeatureFunction'

import type { BuildCodeFunction, GPUType, InteractiveWorkerLayer, LayerWorkerFunction, NotNullOrObject, Property, ValueType } from 'style/style.spec'
import type { InteractiveObject, TileRequest } from '../worker.spec'
import type { IDGen } from './process.spec'
import type { Callback } from 'style/parseFeatureFunction'
import type { ColorArray } from 'style/color'

export type CodeDesignInput<T extends NotNullOrObject> = [
  T | Property<T>,
  Callback<T, ColorArray>
] | [T | Property<T>]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CodeDesign<T = any> = Array<CodeDesignInput<ValueType<T>>>

export const colorFunc = (lch: boolean): Callback<string, ColorArray> => {
  return (i: string): ColorArray => {
    const color = new Color(i)
    return lch ? color.getLCH() : color.getRGB()
  }
}
export const clamp: Callback<number, number> = (i: number): number => Math.max(-1, Math.min(1, i))

export default class VectorWorker {
  idGen: IDGen
  gpuType: GPUType
  interactiveMap = new Map<number, InteractiveObject>()
  constructor (idGen: IDGen, gpuType: GPUType) {
    this.idGen = idGen
    this.gpuType = gpuType
  }

  _addInteractiveFeature (
    id: number,
    properties: Properties,
    workerLayer: InteractiveWorkerLayer
  ): void {
    const { cursor, name, source, layer } = workerLayer

    this.interactiveMap.set(id, {
      __id: id,
      __cursor: cursor,
      __name: name,
      __source: source,
      __layer: layer,
      ...properties
    })
  }

  async flush (mapID: string, tile: TileRequest, sourceName: string, _wait: Promise<void>): Promise<void> {
    this.postInteractive(mapID, sourceName, tile.id)
  }

  buildCode (design: CodeDesign<NotNullOrObject>): BuildCodeFunction {
    const featureFunctions: Array<LayerWorkerFunction<number | ColorArray>> = []
    for (const [input, cb] of design) {
      featureFunctions.push(parseFeatureFunction<NotNullOrObject, ColorArray>(input, cb))
    }

    return (zoom: number, properties: Properties): [number[], number[]] => {
      // prep codes
      const webgl2Code: number[] = []
      const webgl1Code: number[] = featureFunctions.flatMap(func => func(webgl2Code, properties, zoom))

      return [webgl1Code, webgl2Code]
    }
  }

  postInteractive (
    mapID: string,
    sourceName: string,
    tileID: bigint
  ): void {
    if (this.interactiveMap.size === 0) return
    const interactiveGuide = []
    const interactiveData = []

    const textEncoder = new TextEncoder()

    let offset = 0
    for (const [id, properties] of this.interactiveMap) {
      const uint8Array = textEncoder.encode(JSON.stringify(properties))
      const length = uint8Array.length
      interactiveGuide.push(id, offset, offset + length)
      for (const byte of uint8Array) interactiveData.push(byte)
      offset += length
    }
    this.interactiveMap.clear()

    // Upon building the batches, convert to buffers and ship.
    const interactiveGuideBuffer = new Uint32Array(interactiveGuide).buffer as ArrayBuffer
    const interactiveDataBuffer = new Uint8ClampedArray(interactiveData).buffer as ArrayBuffer
    // ship the vector data.
    postMessage({
      mapID,
      type: 'interactive',
      sourceName,
      tileID,
      interactiveGuideBuffer,
      interactiveDataBuffer
    }, [interactiveGuideBuffer, interactiveDataBuffer])
  }
}

export function idToRGB (id: number): ColorArray {
  return [id & 255, (id >> 8) & 255, (id >> 16) & 255, 0]
}

/* eslint-env worker */
import Color from 's2/style/color'
import { Properties } from 's2/projections'
import { parseFeatureFunction } from './util'

import type { BuildCodeFunction, GPUType, InteractiveWorkerLayer, LayerWorkerFunction } from 's2/style/style.spec'
import type { InteractiveObject, TileRequest } from '../worker.spec'
import type { IDGen } from './process.spec'
import type { Callback } from './util'

export type CodeDesignInput = [
  any,
  Callback<number | [number, number, number, number]>
] | [any]

export type CodeDesign = CodeDesignInput[]

export const colorFunc = (lch: boolean): Callback<[number, number, number, number]> => {
  return (i: string): [number, number, number, number] => {
    const color = new Color(i)
    return lch ? color.getLCH() : color.getRGB()
  }
}
export const clamp: Callback<number> = (i: number): number => Math.max(-1, Math.min(1, i))

export default class VectorWorker {
  idGen: IDGen
  gpuType: GPUType
  interactiveMap: Map<number, InteractiveObject> = new Map()
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

  flush (mapID: string, tile: TileRequest, sourceName: string): void {
    this.postInteractive(mapID, sourceName, tile.id)
  }

  buildCode (design: CodeDesign): BuildCodeFunction {
    const featureFunctions: Array<LayerWorkerFunction<number | [number, number, number, number]>> = []
    for (const [input, output] of design) {
      featureFunctions.push(parseFeatureFunction<number | [number, number, number, number]>(input, output))
    }

    return (zoom: number, properties: Properties): [number[], number[]] => {
      // prep codes
      const webgl2Code: number[] = []
      const webgl1Code: number[] = featureFunctions.map(func => func(webgl2Code, properties, zoom)).flat()

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
    const interactiveGuideBuffer = new Uint32Array(interactiveGuide).buffer
    const interactiveDataBuffer = new Uint8Array(interactiveData).buffer
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

export function idToRGB (id: number): [number, number, number] {
  return [id & 255, (id >> 8) & 255, (id >> 16) & 255]
}

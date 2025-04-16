import Color from 'style/color/index.js';
import parseFeatureFunction from 'style/parseFeatureFunction.js';

import type { Callback } from 'style/parseFeatureFunction.js';
import type { ColorArray } from 'style/color/index.js';
import type { IDGen } from './process.spec.js';
import type { Properties } from 'gis-tools/index.js';
import type {
  BuildCodeFunction,
  GPUType,
  InteractiveWorkerLayer,
  LayerWorkerFunction,
  NotNullOrObject,
  Property,
  ValueType,
} from 'style/style.spec.js';
import type { InteractiveObject, TileRequest } from '../worker.spec.js';

/** Code design input wrapper */
export type CodeDesignInput<T extends NotNullOrObject> =
  | [T | Property<T>, Callback<T, ColorArray>]
  | [T | Property<T>];

/** Code design wrapper */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CodeDesign<T = any> = Array<CodeDesignInput<ValueType<T>>>;

/**
 * Color function to convert a color to either RBG or LCH
 * @param lch - flag to use lch if true
 * @returns a color parsing function
 */
export const colorFunc = (lch: boolean): Callback<string, ColorArray> => {
  return (i: string): ColorArray => {
    const color = new Color(i);
    return lch ? color.getLCH() : color.getRGB();
  };
};
/**
 * Clamp tool to ensure the number is between -1 and 1
 * @param i - input number
 * @returns clamped number
 */
export const clamp: Callback<number, number> = (i: number): number => Math.max(-1, Math.min(1, i));

/**
 * # Vector Worker
 *
 * Base class for all vector workers.
 * Ensurses that all vector workers can reuse things like prepping and shipping interactive features,
 * flusing, id-generation, etc.
 */
export default class VectorWorker {
  idGen: IDGen;
  gpuType: GPUType;
  interactiveMap = new Map<number, InteractiveObject>();
  /**
   * @param idGen - id generator to ensure features don't overlap
   * @param gpuType - the GPU context of the map renderer (WebGL(1|2) | WebGPU)
   */
  constructor(idGen: IDGen, gpuType: GPUType) {
    this.idGen = idGen;
    this.gpuType = gpuType;
  }

  /**
   * Add an interactive feature
   * @param id - feature id
   * @param properties - feature properties
   * @param workerLayer - worker layer to pull the interactive-properties from
   */
  _addInteractiveFeature(
    id: number,
    properties: Properties,
    workerLayer: InteractiveWorkerLayer,
  ): void {
    const { cursor, name, source, layer } = workerLayer;

    this.interactiveMap.set(id, {
      __id: id,
      __cursor: cursor,
      __name: name,
      __source: source,
      __layer: layer,
      ...properties,
    });
  }

  /**
   * Flush a tile-request to the render thread
   * @param mapID - id of the map to ship the data back to
   * @param tile - tile request
   * @param sourceName - name of the source the data belongs to
   * @param _wait - wait function. Not needed at this flush level.
   */
  async flush(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    _wait: Promise<void>,
  ): Promise<void> {
    await this.postInteractive(mapID, sourceName, tile.id);
  }

  /**
   * Build code for a vector layer
   * @param design - the design to modify
   * @returns the build function
   */
  buildCode(design: CodeDesign<NotNullOrObject>): BuildCodeFunction {
    const featureFunctions: Array<LayerWorkerFunction<number | ColorArray>> = [];
    for (const [input, cb] of design) {
      featureFunctions.push(parseFeatureFunction<NotNullOrObject, ColorArray>(input, cb));
    }

    return (zoom: number, properties: Properties): [number[], number[]] => {
      // prep codes
      const webgl2Code: number[] = [];
      const webgl1Code: number[] = featureFunctions.flatMap((func) =>
        func(webgl2Code, properties, zoom),
      );

      return [webgl1Code, webgl2Code];
    };
  }

  /**
   * Post an interactive feature set to the render thread
   * @param mapID - id of the map to ship the data back to
   * @param sourceName - name of the source the data belongs to
   * @param tileID - tile id the features belong to
   */
  postInteractive(mapID: string, sourceName: string, tileID: bigint): void {
    if (this.interactiveMap.size === 0) return;
    const interactiveGuide: number[] = [];
    const interactiveData: number[] = [];

    const textEncoder = new TextEncoder();

    let offset = 0;
    for (const [id, properties] of this.interactiveMap) {
      const uint8Array = textEncoder.encode(JSON.stringify(properties));
      const length = uint8Array.length;
      interactiveGuide.push(id, offset, offset + length);
      for (const byte of uint8Array) interactiveData.push(byte);
      offset += length;
    }
    this.interactiveMap.clear();

    // Upon building the batches, convert to buffers and ship.
    const interactiveGuideBuffer = new Uint32Array(interactiveGuide).buffer as ArrayBuffer;
    const interactiveDataBuffer = new Uint8ClampedArray(interactiveData).buffer as ArrayBuffer;
    // ship the vector data.
    postMessage(
      {
        mapID,
        type: 'interactive',
        sourceName,
        tileID,
        interactiveGuideBuffer,
        interactiveDataBuffer,
      },
      [interactiveGuideBuffer, interactiveDataBuffer],
    );
  }
}

/**
 * A convenience function to convert an ID to an RGBA encoded color
 * @param id - the id to convert
 * @returns an RGBA encoded color
 */
export function idToRGB(id: number): ColorArray {
  return [id & 255, (id >> 8) & 255, (id >> 16) & 255, 0];
}

import { earclip } from 'earclip';
import parseFeature from 's2/style/parseFeature.js';
import parseFilter from 'style/parseFilter.js';
import VectorWorker, { colorFunc, idToRGB } from './vectorWorker.js';
import { featureSort, scaleShiftClip } from './util/index.js';

import type { CodeDesign } from './vectorWorker.js';
import type ImageStore from './imageStore.js';
import type { FillData, TileRequest } from '../worker.spec.js';
import type { FillDefinition, FillWorkerLayer, GPUType } from 'style/style.spec.js';
import type {
  FillFeature,
  FillWorker as FillWorkerSpec,
  IDGen,
  VTFeature,
} from './process.spec.js';

import type { S2CellId, VectorMultiPolygon } from 'gis-tools/index.js';

const MAX_FEATURE_BATCH_SIZE = 1 << 6; // 64

/** Worker for processing fill data */
export default class FillWorker extends VectorWorker implements FillWorkerSpec {
  featureStore = new Map<string, FillFeature[]>(); // tileID -> features
  invertLayers = new Map<number, FillWorkerLayer>();
  imageStore: ImageStore;
  /**
   * @param idGen - id generator to ensure features don't overlap
   * @param gpuType - the GPU context of the map renderer (WebGL(1|2) | WebGPU)
   * @param imageStore - the image store to pull/request the needed pattern images
   */
  constructor(idGen: IDGen, gpuType: GPUType, imageStore: ImageStore) {
    super(idGen, gpuType);
    this.imageStore = imageStore;
  }

  /**
   * Setup a fill layer for processing
   * @param fillLayer - the fill layer
   * @returns the worker layer to process future fill data
   */
  setupLayer(fillLayer: FillDefinition): FillWorkerLayer {
    const {
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      pattern,
      patternFamily,
      patternMovement,
      filter,
      color,
      opacity,
      invert,
      interactive,
      cursor,
      opaque,
      lch,
    } = fillLayer;

    // build featureCode design
    // radius -> opacity
    const design: CodeDesign = [[color, colorFunc(lch)], [opacity]];

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
      pattern: pattern !== undefined ? parseFeature<string, string>(pattern) : undefined,
      patternFamily: parseFeature<string, string>(patternFamily),
      patternMovement: parseFeature<boolean>(patternMovement),
      invert,
      interactive,
      cursor,
      opaque,
    };

    if (invert) this.invertLayers.set(layerIndex, fillWorkerLayer);

    return fillWorkerLayer;
  }

  /**
   * Build a fill feature from input vector features
   * @param tile - the tile request
   * @param extent - the tile extent
   * @param feature - the vector tile feature
   * @param fillLayer - the fill worker layer
   * @param mapID - the map id to ship the data back to
   * @param sourceName - the source name the data to belongs to
   * @returns true if the feature was built
   */
  async buildFeature(
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    fillLayer: FillWorkerLayer,
    mapID: string,
    sourceName: string,
  ): Promise<boolean> {
    const { gpuType, imageStore } = this;
    // pull data
    const { zoom, division } = tile;
    const { properties } = feature;
    const { getCode, interactive, layerIndex } = fillLayer;
    const type = feature.geoType();
    // only accept polygons and multipolygons
    if (type !== 'Polygon' && type !== 'MultiPolygon') return false;
    // get pattern
    const pattern = fillLayer.pattern?.([], properties, zoom);
    const patternFamily = fillLayer.patternFamily([], properties, zoom);
    const patternMovement = fillLayer.patternMovement([], properties, zoom);
    let missing = false;
    if (pattern !== undefined) {
      await imageStore.getReady(mapID);
      missing = imageStore.addMissingGlyph(mapID, tile.id, [pattern], [patternFamily]);
    }
    const hasParent = tile.parent !== undefined;
    const [geometry, indices] =
      !hasParent && 'loadGeometryFlat' in feature ? feature.loadGeometryFlat!() : [[], []];
    let vertices: number[] = [];
    if (geometry === undefined) return false;

    // if not parent and indices, the polygon has already been "solved"
    if (hasParent || indices.length === 0) {
      const [geometry] = feature.loadPolys() ?? [];
      if (geometry === undefined) return false;
      // preprocess geometry
      const clip = scaleShiftClip(
        geometry as VectorMultiPolygon,
        4,
        extent,
        tile,
      ) as VectorMultiPolygon;
      // create multiplier
      const multiplier = 1 / extent;
      // process
      for (const poly of clip) {
        // create triangle mesh
        const data = earclip(poly, extent / division, vertices.length / 2);
        // store vertices
        for (let i = 0, vl = data.vertices.length; i < vl; i++) {
          vertices.push(data.vertices[i] * multiplier);
        }
        // store indices
        for (let i = 0, il = data.indices.length; i < il; i++) {
          indices.push(data.indices[i]);
        }
      }
    } else {
      vertices = geometry as number[];
    }

    // if geometry is empty, skip
    if (vertices.length === 0 || indices.length === 0) return false;

    const id = !isNaN(properties.__id as number) ? Number(properties.__id) : this.idGen.getNum();
    const [gl1Code, gl2Code] = getCode(zoom, properties);
    const fillFeature: FillFeature = {
      vertices,
      indices,
      layerIndex,
      code: gpuType === 1 ? gl1Code : gl2Code,
      gl2Code,
      pattern,
      patternFamily,
      patternMovement,
      idRGB: idToRGB(id),
      missing,
    };

    // if interactive, store interactive properties
    if (interactive) this._addInteractiveFeature(id, properties, fillLayer);

    const storeID: string = `${mapID}:${tile.id}:${sourceName}`;
    if (!this.featureStore.has(storeID)) this.featureStore.set(storeID, [] as FillFeature[]);
    const features = this.featureStore.get(storeID);
    features?.push(fillFeature);
    return true;
  }

  /**
   * Flush the fill feature data to be shipped out
   * @param mapID - id of the map to ship the data back to
   * @param tile - tile request
   * @param sourceName - source name the data to belongs to
   * @param wait - this promise must be resloved before flushing. Ensures pattern data is ready
   */
  override async flush(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    wait: Promise<void>,
  ): Promise<void> {
    const storeID: string = `${mapID}:${tile.id}:${sourceName}`;
    const features = this.featureStore.get(storeID) ?? [];
    // If `invertLayers` is non-empty, we should check if `features`
    // does not have said invert layers. If it doesn't, we need to add
    // a dummy feature that is empty for said layers.
    for (const [layerIndex, fillWorkerLayer] of this.invertLayers) {
      if (fillWorkerLayer.source !== sourceName) continue;
      if (!features.some((feature) => feature.layerIndex === layerIndex)) {
        const feature = await this.#buildInvertFeature(tile, fillWorkerLayer, mapID, sourceName);
        if (feature !== undefined) features.push(feature);
      }
    }

    if (features.length !== 0) {
      // check if we need to wait for a response of missing data
      const missing = features.some((feature) => feature.missing);
      if (missing) await wait;
      this.#flush(mapID, sourceName, tile.id);
    }
    // finish the flush
    await super.flush(mapID, tile, sourceName, wait);
    this.featureStore.delete(storeID);
  }

  /**
   * Build inverted features if necessary
   * NOTE: You can not build invert features that require properties data
   * @param tile - tile request
   * @param fillWorkerLayer - the fill worker layer that guides the feature processing
   * @param mapID - the map id that the feature belongs to
   * @param sourceName - the source name that the feature belongs to
   * @returns the inverted fill data to be rendered if it exists
   */
  async #buildInvertFeature(
    tile: TileRequest,
    fillWorkerLayer: FillWorkerLayer,
    mapID: string,
    sourceName: string,
  ): Promise<undefined | FillFeature> {
    const { gpuType, imageStore } = this;
    const { zoom } = tile;
    const { getCode, minzoom, maxzoom, layerIndex } = fillWorkerLayer;
    // respect zoom range
    if (zoom < minzoom || zoom > maxzoom) return;
    // get pattern
    const pattern = fillWorkerLayer.pattern?.([], {}, zoom);
    const patternFamily = fillWorkerLayer.patternFamily([], {}, zoom);
    const patternMovement = fillWorkerLayer.patternMovement([], {}, zoom);
    // get if missing
    let missing = false;
    if (pattern !== undefined) {
      await imageStore.getReady(mapID);
      missing = imageStore.addMissingGlyph(mapID, tile.id, [pattern], [patternFamily]);
    }
    // build feature
    const id = this.idGen.getNum();
    const [gl1Code, gl2Code] = getCode(zoom, {});
    const feature: FillFeature = {
      vertices: [-0.1, -0.1, 1.1, -0.1, 1.1, 1.1, -0.1, 1.1],
      indices: [0, 2, 1, 2, 0, 3],
      layerIndex,
      code: gpuType === 1 ? gl1Code : gl2Code,
      gl2Code,
      pattern,
      patternFamily,
      patternMovement,
      idRGB: idToRGB(id),
      missing,
    };

    const storeID: string = `${mapID}:${tile.id}:${sourceName}`;
    if (!this.featureStore.has(storeID)) this.featureStore.set(storeID, [] as FillFeature[]);
    const features = this.featureStore.get(storeID);
    features?.push(feature);
    return feature;
  }

  /**
   * Flush the fill data to the main thread
   * @param mapID - map id to ship the data back to
   * @param sourceName - source name the data to belongs to
   * @param tileID - tile id the data to belongs to
   */
  #flush(mapID: string, sourceName: string, tileID: S2CellId): void {
    const storeID: string = `${mapID}:${tileID}:${sourceName}`;
    const features = this.featureStore.get(storeID) ?? [];
    if (features.length === 0) return;
    // now that we have created all triangles, let's merge into bundled buffer sets
    // for the main thread to build VAOs.

    // Step 1: Sort by layerIndex, than sort by feature code.
    features.sort(featureSort);

    // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    const vertices: number[] = [];
    const indices: number[] = [];
    const ids: number[] = [];
    const codeType: number[] = [];
    const featureGuide: number[] = [];
    let encodings: number[] = [];
    let indicesOffset = 0;
    let vertexOffset = 0;
    let encodingIndexes: Record<string, number> = { '': 0 };
    let encodingIndex = 0;
    let curlayerIndex = features[0].layerIndex;
    let curPattern = features[0].pattern;
    let curPatternFamily = features[0].patternFamily;
    let curPatternMovement = features[0].patternMovement;

    for (const {
      code,
      layerIndex,
      vertices: _vertices,
      indices: _indices,
      idRGB,
      pattern,
      patternFamily,
      patternMovement,
    } of features) {
      // on layer change or max encoding size, we have to setup a new featureGuide, encodings, and encodingIndexes
      if (curlayerIndex !== layerIndex || encodings.length + code.length > MAX_FEATURE_BATCH_SIZE) {
        const indexSize = indices.length - indicesOffset;
        if (indexSize === 0) continue; // skip if no indices
        // only store if count is actually greater than 0
        featureGuide.push(curlayerIndex, indexSize, indicesOffset, encodings.length, ...encodings); // layerIndex, count, offset, encoding size, encodings
        // describe pattern
        const { texX, texY, texW, texH } = this.imageStore.getPattern(
          mapID,
          patternFamily,
          pattern,
        );
        featureGuide.push(texX, texY, texW, texH, patternMovement ? 1 : 0);
        // update variables for reset
        indicesOffset = indices.length;
        encodings = [];
        encodingIndexes = { '': 0 };
      }
      // setup encodings data. If we didn't have current feature's encodings already, create and set index
      const feKey = code.toString();
      encodingIndex = encodingIndexes[feKey];
      if (encodingIndex === undefined) {
        encodingIndex = encodingIndexes[feKey] =
          this.gpuType === 1 ? encodings.length / 5 : encodings.length;
        encodings.push(...code);
      }
      // store
      vertexOffset = vertices.length / 2;
      // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
      // so we just do a for loop
      for (let f = 0, fl = _vertices.length; f < fl; f++) {
        vertices.push(_vertices[f]);
      }
      for (let f = 0, fl = _indices.length; f < fl; f++) {
        const index = _indices[f] + vertexOffset;
        indices.push(index);
        codeType[index] = encodingIndex;
        // store id RGB value
        const idRGBIndex = index * 4;
        ids[idRGBIndex] = idRGB[0];
        ids[idRGBIndex + 1] = idRGB[1];
        ids[idRGBIndex + 2] = idRGB[2];
        ids[idRGBIndex + 3] = 0;
      }
      // update previous layerIndex and pattern
      curlayerIndex = layerIndex;
      curPattern = pattern;
      curPatternFamily = patternFamily;
      curPatternMovement = patternMovement;
    }
    // store the very last featureGuide batch
    if (indices.length - indicesOffset > 0) {
      featureGuide.push(
        curlayerIndex,
        indices.length - indicesOffset,
        indicesOffset,
        encodings.length,
        ...encodings,
      ); // layerIndex, count, offset, encoding size, encodings
      // describe pattern
      const { texX, texY, texW, texH } = this.imageStore.getPattern(
        mapID,
        curPatternFamily,
        curPattern,
      );
      featureGuide.push(texX, texY, texW, texH, curPatternMovement ? 1 : 0);
    }

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Float32Array(vertices).buffer;
    const indexBuffer = new Uint32Array(indices).buffer;
    const idBuffer = new Uint8ClampedArray(ids).buffer; // pre-store each id as an rgb value
    const codeTypeBuffer =
      this.gpuType === 3 ? new Uint32Array(codeType).buffer : new Uint8Array(codeType).buffer;
    const featureGuideBuffer = new Float32Array(featureGuide).buffer;
    // ship the vector data.
    const message: FillData = {
      mapID,
      type: 'fill',
      sourceName,
      tileID,
      vertexBuffer,
      indexBuffer,
      idBuffer,
      codeTypeBuffer,
      featureGuideBuffer,
    };
    postMessage(message, [vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer, featureGuideBuffer]);
  }
}

import parseFeatureFunction from 'style/parseFeatureFunction';
import parseFilter from 'style/parseFilter';
import VectorWorker, { colorFunc, idToRGB } from './vectorWorker';
import { drawLine, featureSort, scaleShiftClip } from './util';

import type { CodeDesign } from './vectorWorker';
import type { Cap, Join, LineDefinition, LineWorkerLayer } from 'style/style.spec';
import type { LineData, TileRequest } from '../worker.spec';
import type { LineFeature, LineWorker as LineWorkerSpec, VTFeature } from './process.spec';
import type { VectorLines, VectorMultiPoly, VectorPoly } from 'open-vector-tile';

/**
 *
 */
export default class LineWorker extends VectorWorker implements LineWorkerSpec {
  featureStore = new Map<string, LineFeature[]>(); // tileID -> features

  /**
   * @param lineLayer
   */
  setupLayer(lineLayer: LineDefinition): LineWorkerLayer {
    const {
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter,
      dashed,
      geoFilter,
      interactive,
      cursor,
      lch,
      cap,
      join,
      color,
      opacity,
      width,
      gapwidth,
    } = lineLayer;

    // build feature code design
    // color -> opacity -> width -> gapwidth
    const design: CodeDesign = [[color, colorFunc(lch)], [opacity], [width], [gapwidth]];

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
      geoFilter,
      interactive,
      cursor,
    };
  }

  /**
   * @param tile
   * @param feature
   * @param lineLayer
   * @param mapID
   * @param sourceName
   */
  buildFeature(
    tile: TileRequest,
    feature: VTFeature,
    lineLayer: LineWorkerLayer,
    mapID: string,
    sourceName: string,
  ): boolean {
    const { gpuType } = this;
    const { zoom, division } = tile;
    const { extent, properties } = feature;
    let { type } = feature;
    const { getCode, layerIndex, geoFilter } = lineLayer;
    if (type === 1) return false;
    if (geoFilter.includes('line') && type === 2) return false;
    if (geoFilter.includes('poly') && (type === 3 || type === 4)) return false;
    // load geometry
    const geometry = feature.loadGeometry?.();
    if (geometry === undefined) return false;
    if (type === 3) type = 4;
    const cap = lineLayer.cap([], properties, zoom);
    const vertices: number[] = [];
    const lengthSoFar: number[] = [];

    // create multiplier
    const multiplier = 1 / extent;
    // find a max distance to modify lines too large (round off according to the sphere)
    const maxDistance = division === 1 ? 0 : extent / division;
    // preprocess geometry
    const clip = scaleShiftClip(geometry, type, extent, tile) as
      | VectorLines
      | VectorPoly
      | VectorMultiPoly;
    // if multi-polygon, join all outer rings and holes together
    let geo: VectorLines = [];
    if (type === 4) for (const poly of clip) geo.push(...(poly as VectorPoly));
    else geo = clip as VectorLines;
    // draw
    for (const lineString of geo) {
      // build the vertex, normal, and index data
      const { prev, curr, next, lengthSoFar: _lsf } = drawLine(lineString, cap, maxDistance);
      for (let i = 0, vc = curr.length; i < vc; i += 2) {
        vertices.push(
          prev[i] * multiplier,
          prev[i + 1] * multiplier,
          curr[i] * multiplier,
          curr[i + 1] * multiplier,
          next[i] * multiplier,
          next[i + 1] * multiplier,
        );
      }
      for (const l of _lsf) lengthSoFar.push(l * multiplier);
    }

    // skip empty geometry
    if (vertices.length === 0) return false;

    const id = this.idGen.getNum();
    const [gl1Code, gl2Code] = getCode(zoom, properties);
    const lineFeature: LineFeature = {
      cap,
      vertices,
      lengthSoFar,
      layerIndex,
      code: gpuType === 1 ? gl1Code : gl2Code,
      gl2Code,
      idRGB: idToRGB(id),
    };

    const storeID: string = `${mapID}:${tile.id}:${sourceName}`;
    if (!this.featureStore.has(storeID)) this.featureStore.set(storeID, [] as LineFeature[]);
    const store = this.featureStore.get(storeID);
    store?.push(lineFeature);
    return true;
  }

  /**
   * @param mapID
   * @param tile
   * @param sourceName
   */
  async flush(mapID: string, tile: TileRequest, sourceName: string): Promise<void> {
    const storeID: string = `${mapID}:${tile.id}:${sourceName}`;
    const features = this.featureStore.get(storeID) ?? [];
    if (features.length === 0) return;
    this.#flush(mapID, sourceName, tile.id, features);
    this.featureStore.delete(storeID);
  }

  /**
   * @param mapID
   * @param sourceName
   * @param tileID
   * @param features
   */
  #flush(mapID: string, sourceName: string, tileID: bigint, features: LineFeature[]): void {
    // Step 1: Sort by layerIndex, than sort by feature code.
    features.sort(featureSort);

    // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    const vertices: number[] = [];
    const lengthSoFar: number[] = [];
    const featureGuide: number[] = [];
    let encodings: number[] = features[0].code;
    let indexCount = 0;
    let indexOffset = 0;
    let curFeatureCode = encodings.toString();
    let curlayerIndex = features[0].layerIndex;
    let curCap = 0;

    for (const { layerIndex, code, cap, vertices: _vertices, lengthSoFar: _lsf } of features) {
      // on layer change or max feature code change, we have to setup a new featureGuide
      if (indexCount > 0 && (curlayerIndex !== layerIndex || curFeatureCode !== code.toString())) {
        // store the current feature
        featureGuide.push(
          curCap,
          curlayerIndex,
          indexCount,
          indexOffset,
          encodings.length,
          ...encodings,
        ); // layerIndex, count, offset, encoding size, encodings
        // update indexOffset
        indexOffset += indexCount;
        // reset indexCount
        indexCount = 0;
        // update to new encoding set
        encodings = code;
        // update what the current encoding is
        curFeatureCode = encodings.toString();
      }
      // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
      // so we just do a for loop. Store vertices and feature code for each vertex set
      const fl: number = _vertices.length;
      for (let f = 0; f < fl; f++) vertices.push(_vertices[f]);
      for (const l of _lsf) lengthSoFar.push(l);
      // update previous layerIndex
      curlayerIndex = layerIndex;
      // store the cap type
      curCap = encodeCap(cap);
      // increment indexCount
      indexCount += fl / 6;
    }
    // store the very last featureGuide batch if not yet stored
    if (indexCount > 0) {
      featureGuide.push(
        curCap,
        curlayerIndex,
        indexCount,
        indexOffset,
        encodings.length,
        ...encodings,
      ); // layerIndex, count, offset, encoding size, encodings
    }

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Float32Array(vertices).buffer as ArrayBuffer;
    const lengthSoFarBuffer = new Float32Array(lengthSoFar).buffer as ArrayBuffer;
    const featureGuideBuffer = new Float32Array(featureGuide).buffer as ArrayBuffer;
    // ship the vector data.
    const data: LineData = {
      mapID,
      type: 'line',
      sourceName,
      tileID,
      vertexBuffer,
      lengthSoFarBuffer,
      featureGuideBuffer,
    };
    postMessage(data, [vertexBuffer, featureGuideBuffer]);
  }
}

/**
 * @param cap
 */
function encodeCap(cap: Cap): number {
  if (cap === 'butt') return 0;
  else if (cap === 'square') return 1;
  else return 2; // round
}

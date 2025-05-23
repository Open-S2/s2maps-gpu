import parseFeature from 's2/style/parseFeature.js';
import parseFilter from 'style/parseFilter.js';
import VectorWorker, { colorFunc, idToRGB } from './vectorWorker.js';
import { featureSort, scaleShiftClipPoints } from './util/index.js';

import type { CodeDesign } from './vectorWorker.js';
import type { HeatmapData, PointData, TileRequest } from '../worker.spec.js';
import type {
  HeatmapDefinition,
  HeatmapWorkerLayer,
  PointDefinition,
  PointWorkerLayer,
} from 'style/style.spec.js';
import type {
  HeatmapFeature,
  PointFeature,
  PointWorker as PointWorkerSpec,
  VTFeature,
} from './process.spec.js';
import type { S2CellId, VectorGeometryType } from 'gis-tools/index.js';

/** Internal organization to hold specific point features */
export interface Features {
  point: PointFeature[];
  heatmap: HeatmapFeature[];
}

/** Worker for processing point data */
export default class PointWorker extends VectorWorker implements PointWorkerSpec {
  featureStore = new Map<string, Features>(); // tileID -> features

  /**
   * Setup a layer for future data processing
   * @param layerDefinition - layer definition
   * @returns the pre-processed layer
   */
  setupLayer(
    layerDefinition: PointDefinition | HeatmapDefinition,
  ): PointWorkerLayer | HeatmapWorkerLayer {
    const {
      type,
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter,
      geoFilter,
      radius,
      opacity,
      lch,
    } = layerDefinition;

    // build featureCode design
    // heatmap: radius -> opacity -> intensity
    // point:  radius -> opacity -> color -> stroke -> strokeWidth
    const design: CodeDesign = [[radius], [opacity]];
    if (type === 'point') {
      const { color, stroke, strokeWidth } = layerDefinition;
      design.push([color, colorFunc(lch)], [stroke, colorFunc(lch)], [strokeWidth]);
    } else {
      const { intensity } = layerDefinition;
      design.push([intensity]);
    }

    const base = {
      name,
      layerIndex,
      source,
      layer,
      minzoom,
      maxzoom,
      filter: parseFilter(filter),
      getCode: this.buildCode(design),
    };

    if (type === 'point') {
      const { interactive, cursor } = layerDefinition;
      return { type, geoFilter, interactive, cursor, ...base };
    } else {
      const weight = parseFeature<number>(layerDefinition.weight);
      return { type, geoFilter, weight, ...base };
    }
  }

  /**
   * Build a point feature
   * @param tile - the tile request
   * @param extent - the tile extent
   * @param feature - the vector tile feature
   * @param layer - the layer definition
   * @param mapID - the map id to ship the data back to
   * @param sourceName - the source name for the data to belong to
   * @returns true if the feature was built
   */
  buildFeature(
    tile: TileRequest,
    extent: number,
    feature: VTFeature,
    layer: PointWorkerLayer | HeatmapWorkerLayer,
    mapID: string,
    sourceName: string,
  ): boolean {
    const { gpuType } = this;
    const { zoom } = tile;
    const { properties } = feature;
    const { type, getCode, layerIndex, geoFilter } = layer;
    const featureType: VectorGeometryType = feature.geoType();
    if (geoFilter.includes('poly') && (featureType === 'Polygon' || featureType === 'MultiPolygon'))
      return false;
    if (
      geoFilter.includes('line') &&
      (featureType === 'LineString' || featureType === 'MultiLineString')
    )
      return false;
    if (geoFilter.includes('point') && (featureType === 'Point' || featureType === 'MultiPoint'))
      return false;
    // load geometry
    const points = feature.loadPoints();
    if (points === undefined) return false;
    // preprocess geometry
    const clip = scaleShiftClipPoints(points, extent, tile);
    if (clip === undefined) return false;
    const vertices: number[] = [];
    const weights: number[] = [];
    const isHeatmap = type === 'heatmap';

    const weight = isHeatmap ? layer.weight([], properties, zoom) : 0;
    // create multiplier
    const multiplier = 1 / extent;
    // if weight, then it is a heatmap and we add weight data
    for (const point of clip) {
      vertices.push(point.x * multiplier, point.y * multiplier);
      if (isHeatmap) weights.push(weight);
    }

    // skip empty geometry
    if (vertices.length === 0) return false;

    const codeLoBoth = getCode(zoom, properties);
    const codeLo = codeLoBoth[gpuType === 1 ? 0 : 1];
    const gl2Code = codeLoBoth[1];
    const codeHi = getCode(zoom + 1, properties)[gpuType === 1 ? 0 : 1];
    const typeFeature = {
      vertices,
      layerIndex,
      code: type === 'point' ? codeLo : [...codeLo, ...codeHi],
      gl2Code,
    };

    const storeID: string = `${mapID}:${tile.id}:${sourceName}`;
    if (!this.featureStore.has(storeID)) this.featureStore.set(storeID, { point: [], heatmap: [] });
    const store = this.featureStore.get(storeID);
    if (type === 'point') {
      const id = this.idGen.getNum();
      store?.point.push({
        type: 'point',
        idRGB: idToRGB(id),
        ...typeFeature,
      });
      // if interactive, store interactive properties
      if (layer.interactive) this._addInteractiveFeature(id, properties, layer);
    } else {
      store?.heatmap.push({
        type: 'heatmap',
        weights,
        ...typeFeature,
      });
    }
    return true;
  }

  /**
   * Flush the feature store (all processed data is sent back to the main thread)
   * @param mapID - the map id to ship the data back to
   * @param tile - the tile request
   * @param sourceName - the source name the data to belongs to
   * @param wait - this promise must be resloved before flushing.
   */
  override async flush(
    mapID: string,
    tile: TileRequest,
    sourceName: string,
    wait: Promise<void>,
  ): Promise<void> {
    this.#flush(mapID, sourceName, tile.id, 'point');
    this.#flush(mapID, sourceName, tile.id, 'heatmap');
    this.featureStore.delete(`${mapID}:${tile.id}:${sourceName}`);
    await super.flush(mapID, tile, sourceName, wait);
  }

  /**
   * Internal flush function
   * @param mapID - the map id to ship the data back to
   * @param sourceName - the source name the data to belongs to
   * @param tileID - the tile id
   * @param type - the feature type (point or heatmap)
   */
  #flush(mapID: string, sourceName: string, tileID: S2CellId, type: 'point' | 'heatmap'): void {
    const features = (this.featureStore.get(`${mapID}:${tileID}:${sourceName}`) ?? {
      point: [],
      heatmap: [],
    })[type];
    if (features.length === 0) return;

    // Step 1: Sort by layerIndex, than sort by feature code.
    features.sort(featureSort);

    // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
    // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
    // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
    const vertices: number[] = [];
    const weights: number[] = [];
    const featureGuide: number[] = [];
    const ids: number[] = [];
    let encodings: number[] = features[0].code;
    let indexCount = 0;
    let indexOffset = 0;
    let curFeatureCode = encodings.toString();
    let curlayerIndex = features[0].layerIndex;

    for (const feature of features) {
      const { type: featureType, layerIndex, code, vertices: _vertices } = feature;
      // on layer change or max feature code change, we have to setup a new featureGuide
      if (indexCount > 0 && (curlayerIndex !== layerIndex || curFeatureCode !== code.toString())) {
        // store the current feature
        featureGuide.push(curlayerIndex, indexCount, indexOffset, encodings.length, ...encodings); // layerIndex, count, offset, encoding size, encodings
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
      for (let f = 0; f < fl; f++) {
        vertices.push(_vertices[f]);
        if (featureType === 'point' && f % 2 === 0) ids.push(...feature.idRGB);
      }
      // build weights if heatmap
      if (featureType === 'heatmap') {
        const { weights: _weights } = feature;
        const wl: number = _weights.length;
        for (let f = 0; f < wl; f++) weights.push(_weights[f]);
      }
      // store
      // update previous layerIndex
      curlayerIndex = layerIndex;
      // increment indexCount
      indexCount += fl / 2;
    }
    // store the very last featureGuide batch if not yet stored
    if (indexCount > 0) {
      featureGuide.push(curlayerIndex, indexCount, indexOffset, encodings.length, ...encodings); // layerIndex, count, offset, encoding size, encodings
    }

    // Upon building the batches, convert to buffers and ship.
    const vertexBuffer = new Float32Array(vertices).buffer;
    const weightBuffer = new Float32Array(weights).buffer;
    const idBuffer = new Uint8ClampedArray(ids).buffer; // pre-store each id as an rgb value
    const featureGuideBuffer = new Float32Array(featureGuide).buffer;
    // ship the vector data.
    if (type === 'point') {
      const data: PointData = {
        mapID,
        type,
        sourceName,
        tileID,
        vertexBuffer,
        idBuffer,
        featureGuideBuffer,
      };
      postMessage(data, [vertexBuffer, idBuffer, featureGuideBuffer]);
    } else {
      const data: HeatmapData = {
        mapID,
        type,
        sourceName,
        tileID,
        vertexBuffer,
        weightBuffer,
        idBuffer,
        featureGuideBuffer,
      };
      postMessage(data, [vertexBuffer, weightBuffer, idBuffer, featureGuideBuffer]);
    }
  }
}

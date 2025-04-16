import { toWM } from '../s2/index.js';
import { toS2, toUnitScale, toVector } from '../wm/index.js';

import type {
  Feature,
  JSONCollection,
  MValue,
  Projection,
  Properties,
  S2Feature,
  VectorFeature,
  VectorFeatures,
  VectorGeometry,
} from '../index.js';

/**
 * Convert a GeoJSON Feature to a GeoJSON Vector Feature in either a WebMercator or S2 projection
 * @param projection - output either S2 or WM
 * @param data - the data to convert
 * @param buildBBox - optional - build a bbox for the feature if desired
 * @param toUnitScale - optional - convert to unit scale. Assumed to be true if not specified
 * @returns - the converted data
 */
export function convert<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  projection: Projection,
  data: JSONCollection<M, D, P>,
  buildBBox?: boolean,
  toUnitScale = false,
): VectorFeatures<M, D, P, VectorGeometry<D>>[] {
  const res: VectorFeatures<M, D, P, VectorGeometry<D>>[] = [];

  if (data.type === 'Feature') {
    const vfs = convertFeature(projection, data, toUnitScale, buildBBox);
    for (const vf of vfs) res.push(vf);
  } else if (data.type === 'VectorFeature') {
    const vfs = convertVectorFeature(projection, data, toUnitScale, buildBBox);
    for (const vf of vfs) res.push(vf);
  } else if (data.type === 'FeatureCollection') {
    for (const feature of data.features) {
      if (feature.type === 'Feature') {
        const vfs = convertFeature(projection, feature, toUnitScale, buildBBox);
        for (const vf of vfs) res.push(vf);
      } else {
        const vfs = convertVectorFeature(projection, feature, toUnitScale, buildBBox);
        for (const vf of vfs) res.push(vf);
      }
    }
  } else if (data.type === 'S2Feature') {
    res.push(convertS2Feature(projection, data, toUnitScale));
  } else if (data.type === 'S2FeatureCollection') {
    for (const feature of data.features) {
      res.push(convertS2Feature(projection, feature, toUnitScale));
    }
  }

  return res;
}

/**
 * Convert a GeoJSON Feature to a GeoJSON Vector Feature in either a WebMercator or S2 projection
 * @param projection - either S2 or WM is the end goal feature
 * @param data - input feature data
 * @param toUS - convert to unit scale if true
 * @param buildBBox - optional - build a bbox for the feature if desired
 * @returns - converted feature
 */
function convertFeature<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  projection: Projection,
  data: Feature<M, D, P>,
  toUS: boolean,
  buildBBox?: boolean,
): VectorFeatures<M, D, P, VectorGeometry<D>>[] {
  const vf = toVector(data, buildBBox);
  return convertVectorFeature(projection, vf, toUS, buildBBox);
}

/**
 * Convert a GeoJSON Vector Feature to the appropriate projection and adjust to a unit scale if desired.
 * @param projection - either S2 or WM is the end goal feature
 * @param data - input feature data
 * @param toUS - convert to unit scale if true
 * @param buildBBox - optional - build a bbox for the feature if desired
 * @returns - converted feature(s)
 */
function convertVectorFeature<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  projection: Projection,
  data: VectorFeature<M, D, P>,
  toUS: boolean,
  buildBBox?: boolean,
): VectorFeatures<M, D, P, VectorGeometry<D>>[] {
  if (projection === 'WG') {
    if (toUS) toUnitScale(data);
    return [data];
  } else {
    return toS2(data, buildBBox);
  }
}

/**
 * Convert a GeoJSON S2 Feature to the appropriate projection and adjust to a unit scale if desired.
 * @param projection - either S2 or WM is the end goal feature
 * @param data - input feature data
 * @param toUS - convert to unit scale if true
 * @returns - converted feature
 */
function convertS2Feature<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(projection: Projection, data: S2Feature<M, D, P>, toUS: boolean): VectorFeatures<M, D, P> {
  if (projection === 'WG') {
    const vf = toWM(data);
    if (toUS) toUnitScale(vf);
    return vf;
  } else {
    return data;
  }
}

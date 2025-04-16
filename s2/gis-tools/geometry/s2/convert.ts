import { pointFromST as fromST, pointToLonLat as toLonLat } from './point.js';

import type {
  Face,
  MValue,
  Properties,
  S2Feature,
  VectorFeature,
  VectorGeometry,
  VectorPoint,
} from '../index.js';

/**
 * Convert an S2Feature to a GeoJSON Feature
 * @param data - S2Feature
 * @returns - GeoJSON Feature
 */
export function toWM<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
  G extends VectorGeometry<D> = VectorGeometry<D>,
>(data: S2Feature<M, D, P, G>): VectorFeature<M, D, P, G> {
  const { id, face, properties, metadata, geometry } = data;
  convertGeometry<D>(face, geometry);
  return {
    id,
    type: 'VectorFeature',
    properties,
    metadata,
    geometry,
  };
}

/**
 * Underlying conversion mechanic to move S2Geometry to GeoJSON Geometry
 * @param face - Face
 * @param geometry - S2 Geometry
 */
function convertGeometry<M extends MValue = Properties>(
  face: Face,
  geometry: VectorGeometry<M>,
): void {
  const { type, coordinates } = geometry;
  if (type === 'Point') convertGeometryPoint(face, coordinates);
  else if (type === 'MultiPoint') coordinates.forEach((point) => convertGeometryPoint(face, point));
  else if (type === 'LineString') coordinates.forEach((point) => convertGeometryPoint(face, point));
  else if (type === 'MultiLineString')
    coordinates.forEach((line) => line.forEach((point) => convertGeometryPoint(face, point)));
  else if (type === 'Polygon')
    coordinates.forEach((line) => line.forEach((point) => convertGeometryPoint(face, point)));
  else if (type === 'MultiPolygon')
    coordinates.forEach((polygon) =>
      polygon.forEach((line) => line.forEach((point) => convertGeometryPoint(face, point))),
    );
  else {
    throw new Error('Invalid S2Geometry type');
  }
}

/**
 * Mutate an S2 Point to a GeoJSON Point
 * @param face - Face
 * @param point - S2 Point
 */
function convertGeometryPoint<M extends MValue = Properties>(
  face: Face,
  point: VectorPoint<M>,
): void {
  const { x: s, y: t } = point;
  const { x: lon, y: lat } = toLonLat(fromST(face, s, t));
  point.x = lon;
  point.y = lat;
}

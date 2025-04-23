import type {
  MValue,
  Properties,
  VectorFeature,
  VectorLineString,
  VectorLineStringGeometry,
} from '../../../index.js';

/**
 * Find the area of a linestring. No projection is assumed
 * @param input - the linestring as either a VectorFeature, VectorLineStringGeometry, or raw VectorLineString
 * @returns - the area of the linestring. Positive if the linestring is counter-clockwise, negative otherwise
 */
export function lineArea<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  input:
    | VectorLineString<D>
    | VectorLineStringGeometry<D>
    | VectorFeature<M, D, P, VectorLineStringGeometry<D>>,
): number {
  const vectorLines: VectorLineString<D> =
    'geometry' in input
      ? input.geometry.coordinates
      : 'coordinates' in input
        ? input.coordinates
        : input;

  let area = 0;
  const numPoints = vectorLines.length;
  let j = numPoints - 1;

  for (let i = 0; i < numPoints; i++) {
    area += (vectorLines[j].x + vectorLines[i].x) * (vectorLines[j].y - vectorLines[i].y);
    j = i;
  }

  return area / 2;
}

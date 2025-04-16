import {
  VectorGeometry,
  VectorLineString,
  VectorMultiLineString,
  VectorMultiPolygon,
  VectorPolygon,
} from '../index.js';

import type { MValue, Properties } from '../../index.js';

/**
 * Builds squared distances for the vector geometry using the Douglas-Peucker algorithm.
 * @param geometry - input vector geometry
 * @param tolerance - simplification tolerance
 * @param maxzoom - max zoom level to simplify
 */
export function buildSqDists<M extends MValue = Properties>(
  geometry: VectorGeometry<M>,
  tolerance: number,
  maxzoom = 16,
): void {
  const tol = Math.pow(tolerance / (1 << maxzoom), 2);
  const { type, coordinates: coords } = geometry;
  if (type === 'LineString') buildSqDist(coords, 0, coords.length - 1, tol);
  else if (type === 'MultiLineString')
    coords.forEach((line) => buildSqDist(line, 0, line.length - 1, tol));
  else if (type === 'Polygon') coords.forEach((line) => buildSqDist(line, 0, line.length - 1, tol));
  else if (type === 'MultiPolygon')
    coords.forEach((polygon) =>
      polygon.forEach((line) => buildSqDist(line, 0, line.length - 1, tol)),
    );
}

/**
 * calculate simplification of line vector data using
 * optimized Douglas-Peucker algorithm
 * @param coords - input coordinates
 * @param first - first point index
 * @param last - last points index
 * @param sqTolerance - simplification tolerance (higher means simpler)
 */
export function buildSqDist<M extends MValue = Properties>(
  coords: VectorLineString<M>,
  first: number,
  last: number,
  sqTolerance: number,
): void {
  coords[first].t = 1;
  _buildSqDist(coords, first, last, sqTolerance);
  coords[last].t = 1;
}

/**
 * calculate simplification of line vector data using
 * optimized Douglas-Peucker algorithm
 * @param coords - input coordinates
 * @param first - first point index
 * @param last - last points index
 * @param sqTolerance - simplification tolerance (higher means simpler)
 */
function _buildSqDist<M extends MValue = Properties>(
  coords: VectorLineString<M>,
  first: number,
  last: number,
  sqTolerance: number,
): void {
  let maxSqDist = sqTolerance;
  const mid = (last - first) >> 1;
  let minPosToMid = last - first;
  let index: undefined | number;

  const { x: as, y: at } = coords[first];
  const { x: bs, y: bt } = coords[last];

  for (let i = first; i < last; i++) {
    const { x, y } = coords[i];
    const d = getSqSegDist(x, y, as, at, bs, bt);

    if (d > maxSqDist) {
      index = i;
      maxSqDist = d;
    } else if (d === maxSqDist) {
      // a workaround to ensure we choose a pivot close to the middle of the list,
      // reducing recursion depth, for certain degenerate inputs
      const posToMid = Math.abs(i - mid);
      if (posToMid < minPosToMid) {
        index = i;
        minPosToMid = posToMid;
      }
    }
  }

  if (index !== undefined && maxSqDist > sqTolerance) {
    if (index - first > 1) _buildSqDist(coords, first, index, sqTolerance);
    coords[index].t = maxSqDist;
    if (last - index > 1) _buildSqDist(coords, index, last, sqTolerance);
  }
}

/**
 * square distance from a point to a segment
 * @param ps - the reference point x
 * @param pt - the reference point y
 * @param s - the first point x in the segment
 * @param t - the first point y in the segment
 * @param bs - the last point x in the segment
 * @param bt - the last point y in the segment
 * @returns - the square distance
 */
function getSqSegDist(
  ps: number,
  pt: number,
  s: number,
  t: number,
  bs: number,
  bt: number,
): number {
  let ds = bs - s;
  let dt = bt - t;

  if (ds !== 0 || dt !== 0) {
    const m = ((ps - s) * ds + (pt - t) * dt) / (ds * ds + dt * dt);

    if (m > 1) {
      s = bs;
      t = bt;
    } else if (m > 0) {
      s += ds * m;
      t += dt * m;
    }
  }

  ds = ps - s;
  dt = pt - t;

  return ds * ds + dt * dt;
}

/**
 * Simplifies the vector geometry based on zoom level and tolerance.
 * If the geometry is simplified past it being valid, set the coordinates to an empty array.
 * @param geometry - input vector geometry
 * @param tolerance - simplification tolerance
 * @param zoom - curent zoom
 * @param maxzoom - max zoom level
 */
export function simplify<M extends MValue = Properties>(
  geometry: VectorGeometry<M>,
  tolerance: number,
  zoom: number,
  maxzoom = 16,
): void {
  if (geometry.type === 'Point' || geometry.type === 'MultiPoint') return;
  const zoomTol = zoom >= maxzoom ? 0 : tolerance / (1 << zoom);
  const { type, coordinates: coords } = geometry;
  if (type === 'LineString') {
    geometry.coordinates = simplifyLine(coords as VectorLineString<M>, zoomTol, false, false);
  } else if (type === 'MultiLineString') {
    geometry.coordinates = (coords as VectorMultiLineString<M>)
      .map((line) => simplifyLine(line, zoomTol, false, false))
      .filter((line) => line.length !== 0);
  } else if (type === 'Polygon') {
    geometry.coordinates = (coords as VectorPolygon<M>).map((line, i) =>
      simplifyLine(line, zoomTol, true, i === 0),
    );
    // if the outer ring is empty, remove the polygon; otherwise cleanup the inner rings
    if (geometry.coordinates[0].length === 0) geometry.coordinates = [];
    else geometry.coordinates = geometry.coordinates.filter((line) => line.length !== 0);
  } else if (type === 'MultiPolygon') {
    geometry.coordinates = (coords as VectorMultiPolygon<M>).map((polygon) => {
      let cleanPoly = polygon.map((line, i) => simplifyLine(line, zoomTol, true, i === 0));
      if (cleanPoly[0].length === 0) cleanPoly = [];
      else cleanPoly = cleanPoly.filter((line) => line.length !== 0);
      return cleanPoly;
    });
    geometry.coordinates = geometry.coordinates.filter((polygon) => polygon.length !== 0);
  }
}

/**
 * @param line - input vector line
 * @param tolerance - simplification tolerance
 * @param isPolygon - whether the line is a polygon
 * @param isOuter - whether the line is an outer ring or inner ring (for polygons)
 * @returns - simplified line
 */
function simplifyLine<M extends MValue = Properties>(
  line: VectorLineString<M>,
  tolerance: number,
  isPolygon: boolean,
  isOuter: boolean,
): VectorLineString<M> {
  const sqTolerance = tolerance * tolerance;
  if (tolerance > 0 && line.length < (isPolygon ? sqTolerance : tolerance)) return line;

  const ring: VectorLineString<M> = [];
  for (const point of line) {
    if (tolerance === 0 || (point.t ?? 0) > sqTolerance) ring.push({ ...point });
  }
  if (isPolygon) rewind(ring, isOuter);

  // handle degenerate cases
  if (!isPolygon && ring.length < 2) return [];
  else if (isPolygon && ring.length < 4) return [];

  return ring;
}

/**
 * In place adjust the ring if necessary
 * @param ring - the ring to rewind
 * @param clockwise - whether the ring needs to be clockwise
 */
export function rewind<M extends MValue = Properties>(
  ring: VectorLineString<M>,
  clockwise: boolean,
): void {
  if (ring.length < 4) return;
  let area = 0;
  for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
    area += (ring[i].x - ring[j].x) * (ring[i].y + ring[j].y);
  }
  if (area > 0 === clockwise) {
    for (let i = 0, len = ring.length; i < len / 2; i++) {
      [ring[i], ring[len - i - 1]] = [ring[len - i - 1], ring[i]];
    }
  }
}

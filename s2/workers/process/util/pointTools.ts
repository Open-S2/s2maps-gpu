import { flattenGeometryToLines, lineLength } from './lineTools';

import type {
  MValue,
  VectorCoordinates,
  VectorGeometryType,
  VectorMultiPoint,
  VectorPoint,
} from 'gis-tools';
import type { Path, PathData } from './lineTools';

/**
 * Flatten all geometry types to points
 * @param geometry - vector geometry
 * @param type - geometry type
 * @returns vector points
 */
export function flattenGeometryToPoints<M extends MValue>(
  geometry: VectorCoordinates<M>,
  type: VectorGeometryType,
): VectorMultiPoint<M> {
  if (type === 'Point') return [geometry as VectorPoint<M>];
  if (type === 'MultiPoint') return geometry as VectorMultiPoint<M>;
  const res: VectorMultiPoint<M> = [];

  const lines = flattenGeometryToLines(geometry, type);
  for (const line of lines) {
    for (const point of line) res.push(point);
  }

  return res;
}

/**
 * Get the center points of the geometry
 * @param geometry - vector geometry
 * @param type - geometry type
 * @returns vector points at the center of the geometry
 */
export function getCenterPoints<M extends MValue>(
  geometry: VectorCoordinates<M>,
  type: VectorGeometryType,
): VectorMultiPoint {
  if (type === 'Point') return [geometry as VectorPoint<M>];
  if (type === 'MultiPoint') return geometry as VectorMultiPoint<M>;
  return findCenterPoints(geometry, type, 0).map((sp) => sp.point);
}

/**
 * Get the spaced points of the geometry
 * @param geometry - vector geometry
 * @param type - geometry type
 * @param spacing - distance between points
 * @param extent - extent is the tile "pixel" size
 * @returns vector points spaced along the line
 */
export function getSpacedPoints<M extends MValue>(
  geometry: VectorCoordinates,
  type: VectorGeometryType,
  spacing: number,
  extent: number,
): VectorMultiPoint {
  if (type === 'Point') return [geometry as VectorPoint<M>];
  if (type === 'MultiPoint') return geometry as VectorMultiPoint<M>;
  return findSpacedPoints(geometry, type, spacing, extent).map((sp) => sp.point);
}

/** Collection of Points that are spaced given guidlines. Used for glyph rendering */
export interface SpacedPoints {
  point: VectorPoint;
  distance: number;
  pathLeft: Path;
  pathRight: Path;
}

/**
 * Find center points of the geometry
 * @param geometry - vector geometry
 * @param type - geometry type
 * @param extent - extent is the tile "pixel" size
 * @returns vector points at the centers of the geometry(s)
 */
export function findCenterPoints<M extends MValue>(
  geometry: VectorCoordinates<M>,
  type: VectorGeometryType,
  extent: number,
): SpacedPoints[] {
  const res: SpacedPoints[] = [];
  if (type === 'Point' || type === 'MultiPoint') return res;

  const lines = flattenGeometryToLines<M>(geometry, type);
  for (const line of lines) {
    const { length, distIndex } = lineLength(line);
    const center = Math.floor(length / 2);
    const { point, pathLeft, pathRight } = buildPointAtDistance(line, distIndex, center, extent);
    res.push({
      point,
      distance: center,
      pathLeft,
      pathRight,
    });
  }

  return res;
}

/**
 * Find points along the line at a given distance
 * @param geometry - vector geometry
 * @param type - geometry type
 * @param spacing - distance between points
 * @param extent - extent is the tile "pixel" size
 * @returns vector points spaced along the line
 */
export function findSpacedPoints(
  geometry: VectorCoordinates,
  type: VectorGeometryType,
  spacing: number,
  extent: number,
): SpacedPoints[] {
  const res: SpacedPoints[] = [];
  if (type === 'Point' || type === 'MultiPoint') return res;
  // safety check
  if (spacing <= 50) return res;

  const lines = flattenGeometryToLines(geometry, type);
  for (const line of lines) {
    const { length, distIndex } = lineLength(line);
    // every spacing distance, add a point
    const distances: number[] = [];
    let distance = spacing;
    while (distance < length) {
      distances.push(distance);
      distance += spacing;
    }
    for (const d of distances) {
      const { point, pathLeft, pathRight } = buildPointAtDistance(line, distIndex, d, extent);
      res.push({
        point,
        distance: d,
        pathLeft,
        pathRight,
      });
    }
  }

  return res;
}

/**
 * NOTE: Currently assumes the line is longer then the distance
 * @param line - the line
 * @param index - index of the line
 * @param distance - distance along the line
 * @param extent - extent is the tile "pixel" size
 * @returns path structure
 */
function buildPointAtDistance(
  line: VectorMultiPoint,
  index: number[],
  distance: number,
  extent: number,
): PathData {
  const fourthExtent = extent * 0.25;
  let i = 0;
  while (i < index.length - 1 && index[i + 1] < distance) i++;
  const p1 = line[i];
  const p2 = line[i + 1];
  const d1 = index[i];
  const d2 = index[i + 1];
  const t = (distance - d1) / (d2 - d1);
  const point: VectorPoint = {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
  // store either 7 points or as many as possible
  const pathLeft: VectorPoint[] = [];
  const pathRight: VectorPoint[] = [];
  let l = i;
  let r = i + 1;
  let curAngle: number = pointAngle(point, line[l]) ?? 0;
  while (l >= 0 && pathLeft.length < 3) {
    pathLeft.push(duplicatePoint(line[l]));
    l--;
    curAngle = pointAngle(line[l + 1], line[l]) ?? curAngle;
  }
  // pathLeft length needs to be 4; add 1 at pathAngle
  while (pathLeft.length < 4) {
    const { x, y } = pathLeft[pathLeft.length - 1];
    pathLeft.push({
      x: x + fourthExtent * Math.cos(curAngle),
      y: y + fourthExtent * Math.sin(curAngle),
    });
  }
  curAngle = pointAngle(point, line[r]) ?? 0;
  while (r < line.length && pathRight.length < 3) {
    pathRight.push(duplicatePoint(line[r]));
    r++;
    curAngle = pointAngle(line[r - 1], line[r]) ?? curAngle;
  }
  while (pathRight.length < 4) {
    const { x, y } = pathRight[pathRight.length - 1];
    pathRight.push({
      x: x + fourthExtent * Math.cos(curAngle),
      y: y + fourthExtent * Math.sin(curAngle),
    });
  }

  return {
    point,
    pathLeft: pathLeft as Path,
    pathRight: pathRight as Path,
  };
}

/**
 * Duplicate a point
 * @param point - the point to duplicate
 * @returns the duplicated point
 */
export function duplicatePoint(point: VectorPoint): VectorPoint {
  return { x: point.x, y: point.y, m: point.m, t: point.t };
}

/**
 * Get the angle between 2 points
 * @param a - first point
 * @param b - second point
 * @returns the angle
 */
export function pointAngle(a: VectorPoint, b?: VectorPoint): number | undefined {
  if (b === undefined || (a.x === b.x && a.y === b.y)) return undefined;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

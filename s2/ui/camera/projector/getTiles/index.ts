import type { TmpWMID } from './WM.js';
import type { Face, S2CellId, VectorPoint } from 'gis-tools/index.js';

export * from './S2.js';
export * from './WM.js';

/** Found tile's allow easy access to it's shape and support out of bounds for WM */
export interface TileInView {
  id: S2CellId | TmpWMID;
  face: Face;
  zoom: number;
  x: number;
  y: number;
  // If the tile is out of bounds, this will point to the "wrapped"/legal ID
  wrappedID?: S2CellId;
}

/**
 * check 3D point boundries of a rectangle are within the range of [-1,1]
 * @param bl - bottom left point
 * @param br - bottom right point
 * @param tl - top left point
 * @param tr - top right point
 * @returns true if any point is within the range of [-1,1]
 */
export function pointBoundaries(
  bl: VectorPoint,
  br: VectorPoint,
  tl: VectorPoint,
  tr: VectorPoint,
): boolean {
  return (
    (tl.x <= 1 && tl.x >= -1 && tl.y <= 1 && tl.y >= -1) ||
    (tr.x <= 1 && tr.x >= -1 && tr.y <= 1 && tr.y >= -1) ||
    (bl.x <= 1 && bl.x >= -1 && bl.y <= 1 && bl.y >= -1) ||
    (br.x <= 1 && br.x >= -1 && br.y <= 1 && br.y >= -1)
  );
}

/**
 * test boxIntersect against the 4 lines of a rectangle
 * @param bl - bottom left
 * @param br - bottom right
 * @param tl - top left
 * @param tr - top right
 * @returns true if any line intersects
 */
export function boxIntersects(
  bl: VectorPoint,
  br: VectorPoint,
  tl: VectorPoint,
  tr: VectorPoint,
): boolean {
  return (
    boxIntersect(tl, bl) || // leftLine
    boxIntersect(br, tr) || // rightLine
    boxIntersect(bl, br) || // bottomLine
    boxIntersect(tr, tl)
  ); // topLine
}

/**
 * check line intersections of p1 and p2 against a [[-1, -1], [1, 1]] box.
 * @param p1 - the first point
 * @param p2 - the second point
 * @returns true if any line intersects with the box
 */
export function boxIntersect(p1: VectorPoint, p2: VectorPoint): boolean {
  if (
    lineIntersect(p1.x, p1.y, p2.x, p2.y, -1, -1, -1, 1) || // leftLineBox
    lineIntersect(p1.x, p1.y, p2.x, p2.y, 1, -1, 1, 1) || // rightLineBox
    lineIntersect(p1.x, p1.y, p2.x, p2.y, -1, -1, 1, -1) || // bottomLineBox
    lineIntersect(p1.x, p1.y, p2.x, p2.y, -1, 1, 1, 1) // topLineBox
  )
    return true;
  return false;
}

/**
 * check if two lines intersect
 * @param x1 - the x-coordinate of the first point
 * @param y1 - the y-coordinate of the first point
 * @param x2 - the x-coordinate of the second point
 * @param y2 - the y-coordinate of the second point
 * @param x3 - the x-coordinate of the third point
 * @param y3 - the y-coordinate of the third point
 * @param x4 - the x-coordinate of the fourth point
 * @param y4 - the y-coordinate of the fourth point
 * @returns true if the lines intersect
 */
export function lineIntersect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;
  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom;
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom;
  return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1;
}

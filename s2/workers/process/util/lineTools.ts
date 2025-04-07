import { findCenterPoints, findSpacedPoints, pointAngle } from './pointTools';

import type { Cap } from 'style/style.spec';
import type { VectorPoint } from 'gis-tools';
import type {
  VectorFeatureType,
  VectorGeometry,
  VectorLine,
  VectorLines,
  VectorMultiPoly,
} from 'open-vector-tile';

/**
 *
 */
export interface Line {
  prev: number[];
  curr: number[];
  next: number[];
  lengthSoFar: number[];
}

// if line, return, if poly or multipoly, flatten to lines
/**
 * @param geometry
 * @param type
 */
export function flattenGeometryToLines(
  geometry: VectorGeometry,
  type: VectorFeatureType,
): VectorLines {
  if (type === 2 || type === 3) return geometry as VectorLines;
  else if (type === 4) {
    // manage poly
    const res = [] as VectorLines;
    for (const poly of geometry as VectorMultiPoly) {
      for (const line of poly) res.push(line);
    }
    return res;
  } else return [];
}

/**
 *
 */
export type Path = [VectorPoint, VectorPoint, VectorPoint, VectorPoint];

/**
 *
 */
export interface PathData {
  point: VectorPoint;
  pathLeft: Path;
  pathRight: Path;
}

// TODO: given the geometry, check if the line is long enough to fit the glyph otherwise return empty array
// TODO: If the path has sharp corners, simplify the path to be smoother without losing the original shape
/**
 * @param geometry
 * @param type
 * @param spacing
 * @param extent
 */
export function getPointsAndPathsAlongLines(
  geometry: VectorGeometry,
  type: VectorFeatureType,
  spacing: number,
  extent: number,
): PathData[] {
  const res: PathData[] = [];
  for (const { point, pathLeft, pathRight } of findSpacedPoints(geometry, type, spacing, extent)) {
    // for now just slice the first 3 points
    res.push({
      point: { x: point.x / extent, y: point.y / extent },
      pathLeft: pathLeft.map((p) => ({ x: p.x / extent, y: p.y / extent })) as Path,
      pathRight: pathRight.map((p) => ({ x: p.x / extent, y: p.y / extent })) as Path,
    });
  }
  return res;
}

/**
 * @param geometry
 * @param type
 * @param extent
 */
export function getPointsAndPathsAtCenterOfLines(
  geometry: VectorGeometry,
  type: VectorFeatureType,
  extent: number,
): PathData[] {
  const res: PathData[] = [];
  for (const { point, pathLeft, pathRight } of findCenterPoints(geometry, type, extent)) {
    // for now just slice the first 3 points
    res.push({
      point: { x: point.x / extent, y: point.y / extent },
      pathLeft: pathLeft.map((p) => ({ x: p.x / extent, y: p.y / extent })) as Path,
      pathRight: pathRight.map((p) => ({ x: p.x / extent, y: p.y / extent })) as Path,
    });
  }
  return res;
}

/**
 *
 */
export type QuadPos = [
  s: number,
  t: number,
  offsetX: number,
  offsetY: number,
  xPos: number,
  yPos: number,
];

/**
 * @param quadPos
 * @param pathLeft
 * @param pathRight
 * @param tileSize
 * @param size
 */
export function getPathPos(
  quadPos: QuadPos,
  pathLeft: Path,
  pathRight: Path,
  tileSize: number,
  size: number,
): VectorPoint {
  // note: st is 0->1 ratio relative to tile size
  // note: offset is in pixels
  // note: xPos and yPos are 0->1 ratio relative to glyph size
  let [s, t, offsetX, offsetY, xPos, yPos] = quadPos;
  yPos *= size;
  offsetY += yPos;
  // get the path but in pixel coordinates
  s = s * tileSize + offsetX;
  t = t * tileSize + offsetY;
  xPos = Math.abs(xPos) * size;
  const path: VectorPoint[] = (xPos >= 0 ? pathRight : pathLeft).map((p) => ({
    x: p.x * tileSize + offsetX,
    y: p.y * tileSize + offsetY,
  }));
  // now setup an x-y and travel xPos distance along the path
  let dist = 0;
  let pathIndex = 0;
  let currAngle = 0;
  // using the current s-t as the starting point and the distance function
  // travel xPos distance along the path
  while (dist < xPos && pathIndex < path.length - 1) {
    currAngle = pointAngle(path[pathIndex], path[pathIndex + 1]) ?? currAngle;
    const next = path[pathIndex];
    const d = distance({ x: s, y: t }, next);
    if (dist + d < xPos) {
      dist += d;
      pathIndex++;
    } else {
      const { x: x1, y: y1 } = path[pathIndex];
      const { x: x2, y: y2 } = next;
      const ratio = (xPos - dist) / d;
      s = x1 + (x2 - x1) * ratio;
      t = y1 + (y2 - y1) * ratio;
      break;
    }
  }

  return { x: s, y: t };
}

/**
 *
 */
export interface LineLengthRes {
  length: number;
  distIndex: number[];
}

/**
 * @param line
 */
export function lineLength(line: VectorLine): LineLengthRes {
  let length = 0;
  let prev = line[0];
  const distIndex: number[] = [0];
  for (let i = 1, ll = line.length; i < ll; i++) {
    const curr = line[i];
    length += distance(prev, curr);
    distIndex.push(length);
    prev = curr;
  }
  return { length, distIndex };
}

/**
 * @param points
 * @param cap
 * @param maxDistance
 */
export function drawLine(points: VectorLine, cap: Cap = 'butt', maxDistance = 0): Line {
  let ll = points.length;
  // corner case: Theres less than 2 points in the array
  if (ll < 2) return { prev: [], curr: [], next: [], lengthSoFar: [] };

  // check line type
  const closed: boolean = points[0].x === points[ll - 1].x && points[0].y === points[ll - 1].y;

  // step pre: If maxDistance is not Infinity we need to ensure no point is too far from another
  if (maxDistance > 0) {
    let prev: VectorPoint, curr: VectorPoint;
    prev = points[0];
    for (let i = 1; i < points.length; i++) {
      curr = points[i];
      while (Math.abs(prev.x - curr.x) > maxDistance || Math.abs(prev.y - curr.y) > maxDistance) {
        curr = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 }; // set new current
        points.splice(i, 0, curr); // store current
      }
      prev = curr;
    }
    // update length
    ll = points.length;
  }

  const prev: number[] = [points[0].x, points[0].y];
  const curr: number[] = [points[0].x, points[0].y];
  const next: number[] = [];
  const lengthSoFar = [0];
  let curLength = 0;
  let prevPoint = points[0];

  for (let i = 1; i < ll; i++) {
    // get the next point
    const point = points[i];
    // move on if duplicate point
    if (prevPoint.x === point.x && prevPoint.y === point.y) continue;
    // store the next pair
    next.push(point.x, point.y);
    // store the point as the next "start"
    curr.push(point.x, point.y);
    // store the previous point
    prev.push(prevPoint.x, prevPoint.y);
    // build the lengthSoFar
    curLength += distance(prevPoint, point);
    lengthSoFar.push(curLength);
    // store the old point
    prevPoint = point;
  }
  // here we actually just store 'next'
  const p2 = points[ll - 1];
  next.push(p2.x, p2.y);
  // if closed, add a 'final' point for the connector piece
  if (closed) {
    prev.push(points[ll - 2].x, points[ll - 2].y);
    curr.push(p2.x, p2.y);
    next.push(points[1].x, points[1].y);
    curLength += distance(p2, points[1]);
    lengthSoFar.push(curLength);
  }

  // if not a butt cap, we add a duplicate of beginning and end
  if (cap !== 'butt') {
    // start cap
    prev.unshift(next[0], next[1]);
    curr.unshift(curr[0], curr[1]);
    next.unshift(prev[2], prev[3]);
    lengthSoFar.unshift(0);
    // end cap
    const len = curr.length - 1;
    prev.push(next[len - 1], next[len]);
    curr.push(curr[len - 1], curr[len]);
    next.push(prev[len - 1], prev[len]);
    // update length
    lengthSoFar.push(curLength);
  }

  return { prev, curr, next, lengthSoFar };
}

/**
 * @param a
 * @param b
 */
function distance(a: VectorPoint, b: VectorPoint): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

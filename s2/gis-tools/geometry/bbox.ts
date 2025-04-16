import type {
  BBOX,
  BBox,
  BBox3D,
  VectorLineString,
  VectorMultiLineString,
  VectorMultiPolygon,
  VectorPoint,
  VectorPolygon,
} from './index.js';

/**
 * Creates a bounding box from a point
 * @param point - input vector point
 * @returns - BBox of the point
 */
export function fromPoint(point: VectorPoint): BBOX {
  const { x, y, z } = point;
  if (z !== undefined) return [x, y, x, y, z, z] as BBox3D;
  return [x, y, x, y] as BBox;
}

/**
 * Creates a bounding box from a linestring
 * @param line - input vector line
 * @returns - BBox of the line
 */
export function fromLineString(line: VectorLineString): BBOX {
  let bbox: BBOX = [Infinity, Infinity, -Infinity, -Infinity];
  for (const point of line) {
    bbox = extendBBox(bbox, point);
  }
  return bbox;
}

/**
 * Creates a bounding box from a multilinestring
 * @param multiLines - input vector multilinestring
 * @returns - BBox of the multilinestring
 */
export function fromMultiLineString(multiLines: VectorMultiLineString): BBOX {
  let bbox: BBOX = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of multiLines) {
    for (const point of line) bbox = extendBBox(bbox, point);
  }
  return bbox;
}

/**
 * Creates a bounding box from a polygon
 * @param polygon - input vector polygon
 * @returns - BBox of the polygon
 */
export function fromPolygon(polygon: VectorPolygon): BBOX {
  return fromMultiLineString(polygon);
}

/**
 * Creates a bounding box from a multipolygon
 * @param multiPolygon - input vector multipolygon
 * @returns - BBox of the multipolygon
 */
export function fromMultiPolygon(multiPolygon: VectorMultiPolygon): BBOX {
  let bbox: BBOX = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of multiPolygon) {
    for (const line of poly) {
      for (const point of line) bbox = extendBBox(bbox, point);
    }
  }
  return bbox;
}

/**
 * Checks if a point is within a bounding box
 * @param bbox - the bounding box to test
 * @param point - point to test if it exists within the bbox
 * @returns - true if the point is within the bbox, false otherwise
 */
export function pointOverlap(bbox: BBOX, point: VectorPoint): boolean {
  const [left, bottom, right, top] = bbox;
  return point.x >= left && point.x <= right && point.y >= bottom && point.y <= top;
}

/**
 * Checks if two bounding boxes overlap. If they don't overlap, returns undefined.
 * If they do, return the overlap
 * @param b1 - first bounding box
 * @param b2 - second bounding box
 * @returns - undefined if no overlap, or a bbox of the overlap
 */
export function bboxOverlap(b1: BBOX, b2: BBOX): undefined | BBOX {
  // check if the bboxes overlap at all
  if (b2[2] < b1[0] || b1[2] < b2[0] || b2[3] < b1[1] || b1[3] < b2[1]) return;
  // find the middle two X values
  const left = b1[0] < b2[0] ? b2[0] : b1[0];
  const right = b1[2] < b2[2] ? b1[2] : b2[2];
  // find the middle two Y values
  const bottom = b1[1] < b2[1] ? b2[1] : b1[1];
  const top = b1[3] < b2[3] ? b1[3] : b2[3];
  // TODO: handle z if there is one
  // if (b1.length > 4) {
  //   const minZ = b1[4] < b2[4] ? b1[4] : b2[4];
  //   const maxZ = b1[5] < b2[5] ? b2[5] : b1[5];
  //   return [left, bottom, right, top, minZ, maxZ];
  // }

  return [left, bottom, right, top];
}

/**
 * Extends a bounding box to include a point
 * @param bbox - the bounding box to extend, if it doesn't exist it will be created otherwise just modified
 * @param point - the point to add to the bbox
 * @returns - the extended bbox
 */
export function extendBBox(bbox: BBOX | undefined, point: VectorPoint): BBOX {
  bbox = bbox ?? fromPoint(point);
  bbox = mergeBBoxes(bbox, fromPoint(point));
  return bbox;
}

/**
 * Merges two bounding boxes into the first and returns the result
 * @param b1 - the first bounding box
 * @param b2 - the second bounding box
 * @returns - the merged bounding box
 */
export function mergeBBoxes(b1: BBOX | undefined, b2: BBOX): BBOX {
  const { min, max } = Math;
  if (b1 === undefined) b1 = [...b2];
  b1[0] = min(b1[0] ?? b2[0], b2[0]);
  b1[1] = min(b1[1] ?? b2[1], b2[1]);
  b1[2] = max(b1[2] ?? b2[2], b2[2]);
  b1[3] = max(b1[3] ?? b2[3], b2[3]);
  if (b1.length > 4 || b2.length > 4) {
    b1[4] = min(b1[4] ?? 0, b2[4] ?? 0);
    b1[5] = max(b1[5] ?? 0, b2[5] ?? 0);
  }

  return b1;
}

/**
 * Create a new bounding box clipped by the axis and min-max
 * @param bb - the original bounding box
 * @param axis - 0 for x, 1 for y
 * @param k1 - the lower bound
 * @param k2 - the upper bound
 * @returns the new bounding box clipped by the axis and min-max
 */
export function clipBBox(bb: BBOX | undefined, axis: 0 | 1, k1: number, k2: number): BBOX {
  const { min, max } = Math;
  const newBox: BBOX = bb !== undefined ? [...bb] : [0, 0, 0, 0];
  if (axis === 0) {
    newBox[0] = max(newBox[0], k1);
    newBox[2] = min(newBox[2], k2);
  } else {
    newBox[1] = max(newBox[1], k1);
    newBox[3] = min(newBox[3], k2);
  }

  return newBox;
}

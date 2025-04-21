import { Tile } from '../../dataStructures/index.js';
import { idChildrenIJ } from '../id.js';
import { clipBBox, extendBBox } from '../bbox.js';

import type {
  BBOX,
  BBox,
  MValue,
  Properties,
  S2CellId,
  VectorFeatures,
  VectorGeometry,
  VectorLineString,
  VectorLineStringGeometry,
  VectorMultiLineOffset,
  VectorMultiLineStringGeometry,
  VectorMultiPointGeometry,
  VectorMultiPolygonGeometry,
  VectorMultiPolygonOffset,
  VectorPoint,
  VectorPointGeometry,
  VectorPolygon,
  VectorPolygonGeometry,
} from '../index.js';

/** The child of a tile */
export interface TileChild<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
> {
  /** The id of the child tile */
  id: S2CellId;
  /** The child tile */
  tile: Tile<M, D, P>;
}

/** Split features into the 4 children of a tile */
export type TileChildren<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
> = [
  TileChild<M, D, P>, // bottom left
  TileChild<M, D, P>, // bottom right
  TileChild<M, D, P>, // top left
  TileChild<M, D, P>, // top right
];

/**
 * @param tile - the tile to split
 * @param buffer - the buffer around the tile for lines and polygons
 * @returns - the tile's children split into 4 sub-tiles
 */
export function splitTile<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(tile: Tile<M, D, P>, buffer: number = 0.0625): TileChildren<M, D, P> {
  const { face, zoom, i, j } = tile;
  const [blID, brID, tlID, trID] = idChildrenIJ(face, zoom, i, j);
  const children: TileChildren<M, D, P> = [
    { id: blID, tile: new Tile<M, D, P>(blID) },
    { id: brID, tile: new Tile<M, D, P>(brID) },
    { id: tlID, tile: new Tile<M, D, P>(tlID) },
    { id: trID, tile: new Tile<M, D, P>(trID) },
  ];
  const scale = 1 << zoom;
  const k1 = 0;
  const k2 = 0.5;
  const k3 = 0.5;
  const k4 = 1;

  let tl: null | VectorFeatures<M, D, P>[] = null;
  let bl: null | VectorFeatures<M, D, P>[] = null;
  let tr: null | VectorFeatures<M, D, P>[] = null;
  let br: null | VectorFeatures<M, D, P>[] = null;

  for (const [name, { features }] of Object.entries(tile.layers)) {
    const left = _clip(features, scale, i - k1, i + k3, 0, buffer);
    const right = _clip(features, scale, i + k2, i + k4, 0, buffer);

    if (left !== null) {
      bl = _clip(left, scale, j - k1, j + k3, 1, buffer);
      tl = _clip(left, scale, j + k2, j + k4, 1, buffer);
      if (bl !== null) for (const d of bl) children[0].tile.addFeature(d, name);
      if (tl !== null) for (const d of tl) children[2].tile.addFeature(d, name);
    }

    if (right !== null) {
      br = _clip(right, scale, j - k1, j + k3, 1, buffer);
      tr = _clip(right, scale, j + k2, j + k4, 1, buffer);
      if (br !== null) for (const d of br) children[1].tile.addFeature(d, name);
      if (tr !== null) for (const d of tr) children[3].tile.addFeature(d, name);
    }
  }

  return children;
}

/**
 * @param features - input features to clip
 * @param scale - the tile scale
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @param axis - the axis 0 for x, 1 for y
 * @param baseBuffer - the top level buffer value
 * @returns - the clipped features
 */
function _clip<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  features: VectorFeatures<M, D, P>[],
  scale: number,
  k1: number,
  k2: number,
  axis: 0 | 1,
  baseBuffer: number,
): null | VectorFeatures<M, D, P>[] {
  // scale
  k1 /= scale;
  k2 /= scale;
  // prep buffer and result container
  const buffer = baseBuffer / scale;
  const k1b = k1 - buffer;
  const k2b = k2 + buffer;
  const clipped: VectorFeatures<M, D, P>[] = [];

  for (const feature of features) {
    const { geometry } = feature;
    const { type } = geometry;
    // build the new clipped geometry
    let newGeometry: VectorGeometry<D> | undefined = undefined;
    if (type === 'Point') newGeometry = clipPoint(geometry, axis, k1, k2);
    else if (type === 'MultiPoint') newGeometry = clipMultiPoint(geometry, axis, k1, k2);
    else if (type === 'LineString') newGeometry = clipLineString(geometry, axis, k1b, k2b);
    else if (type === 'MultiLineString')
      newGeometry = clipMultiLineString(geometry, axis, k1b, k2b);
    else if (type === 'Polygon') newGeometry = clipPolygon(geometry, axis, k1b, k2b);
    else if (type === 'MultiPolygon') newGeometry = clipMultiPolygon(geometry, axis, k1b, k2b);
    // store if the geometry was inside the range
    if (newGeometry !== undefined) {
      newGeometry.vecBBox = clipBBox(newGeometry.vecBBox, axis, k1b, k2b);
      clipped.push({ ...feature, geometry: newGeometry });
    }
  }

  return clipped.length > 0 ? clipped : null;
}

/**
 * @param geometry - input vector geometry
 * @param axis - 0 for x, 1 for y
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @returns - the clipped geometry or undefined if the geometry was not inside the range
 */
export function clipPoint<M extends MValue = Properties>(
  geometry: VectorPointGeometry<M>,
  axis: 0 | 1,
  k1: number,
  k2: number,
): VectorPointGeometry<M> | undefined {
  const { type, is3D, coordinates, bbox, vecBBox } = geometry;
  const value = axis === 0 ? coordinates.x : coordinates.y;
  if (value >= k1 && value < k2)
    return { type, is3D, coordinates: { ...coordinates }, bbox, vecBBox };
}

/**
 * @param geometry - input vector geometry
 * @param axis - 0 for x, 1 for y
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @returns - the clipped geometry or undefined if the geometry was not inside the range
 */
function clipMultiPoint<M extends MValue = Properties>(
  geometry: VectorMultiPointGeometry<M>,
  axis: 0 | 1,
  k1: number,
  k2: number,
): VectorMultiPointGeometry<M> | undefined {
  const { type, is3D, coordinates, bbox } = geometry;
  let vecBBox: BBOX | undefined = undefined;
  const points = coordinates
    .filter((point) => {
      const value = axis === 0 ? point.x : point.y;
      return value >= k1 && value < k2;
    })
    .map((p) => ({ ...p }));
  points.forEach((p) => (vecBBox = extendBBox(vecBBox, p)));

  if (points.length > 0) return { type, is3D, coordinates: points, bbox, vecBBox };
}

/**
 * @param geometry - input vector geometry
 * @param axis - 0 for x, 1 for y
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @returns - the clipped geometry or undefined if the geometry was not inside the range
 */
function clipLineString<M extends MValue = Properties>(
  geometry: VectorLineStringGeometry<M>,
  axis: 0 | 1,
  k1: number,
  k2: number,
): VectorMultiLineStringGeometry<M> | undefined {
  const { is3D, coordinates: line, bbox, vecBBox } = geometry;
  const initO = geometry.offset ?? 0;
  const newOffsets: VectorMultiLineOffset = [];
  const newLines: VectorLineString<M>[] = [];
  for (const clip of _clipLine({ line, offset: initO }, k1, k2, axis, false)) {
    newOffsets.push(clip.offset);
    newLines.push(clip.line);
  }
  if (newLines.length === 0) return undefined;
  return {
    type: 'MultiLineString',
    is3D,
    coordinates: newLines,
    bbox,
    offset: newOffsets,
    vecBBox,
  };
}

/**
 * @param geometry - input vector geometry
 * @param axis - 0 for x, 1 for y
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @param isPolygon - true if the geometry is a polygon
 * @returns - the clipped geometry or undefined if the geometry was not inside the range
 */
function clipMultiLineString<M extends MValue = Properties>(
  geometry: VectorMultiLineStringGeometry<M> | VectorPolygonGeometry<M>,
  axis: 0 | 1,
  k1: number,
  k2: number,
  isPolygon = false,
): VectorMultiLineStringGeometry<M> | VectorPolygonGeometry<M> | undefined {
  const { is3D, coordinates, bbox, vecBBox } = geometry;
  const initO = geometry.offset ?? coordinates.map((_) => 0);
  const newOffsets: VectorMultiLineOffset = [];
  const newLines: VectorLineString<M>[] = [];
  coordinates.forEach((line, i) => {
    for (const clip of _clipLine({ line, offset: initO[i] }, k1, k2, axis, isPolygon)) {
      newOffsets.push(clip.offset);
      newLines.push(clip.line);
    }
  });
  if (newLines.length === 0 || (isPolygon && newLines[0].length === 0)) return undefined;
  return {
    type: isPolygon ? 'Polygon' : 'MultiLineString',
    is3D,
    coordinates: newLines,
    bbox,
    offset: newOffsets,
    vecBBox,
  };
}

/**
 * @param geometry - input vector geometry
 * @param axis - 0 for x, 1 for y
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @returns - the clipped geometry or undefined if the geometry was not inside the range
 */
function clipPolygon<M extends MValue = Properties>(
  geometry: VectorPolygonGeometry<M>,
  axis: 0 | 1,
  k1: number,
  k2: number,
): VectorPolygonGeometry<M> | undefined {
  return clipMultiLineString(geometry, axis, k1, k2, true) as VectorPolygonGeometry<M> | undefined;
}

/**
 * @param geometry - input vector geometry
 * @param axis - 0 for x, 1 for y
 * @param k1 - minimum accepted value of the axis
 * @param k2 - maximum accepted value of the axis
 * @returns - the clipped geometry or undefined if the geometry was not inside the range
 */
function clipMultiPolygon<M extends MValue = Properties>(
  geometry: VectorMultiPolygonGeometry<M>,
  axis: 0 | 1,
  k1: number,
  k2: number,
): VectorMultiPolygonGeometry<M> | undefined {
  const { is3D, coordinates, bbox, vecBBox } = geometry;
  const initO = geometry.offset ?? coordinates.map((l) => l.map(() => 0));
  const newCoordinates: VectorPolygon<M>[] = [];
  const newOffsets: VectorMultiPolygonOffset = [];
  coordinates.forEach((polygon, p) => {
    const newPolygon = clipPolygon(
      { type: 'Polygon', is3D, coordinates: polygon, bbox, offset: initO[p] },
      axis,
      k1,
      k2,
    );
    if (newPolygon !== undefined) {
      newCoordinates.push(newPolygon.coordinates);
      if (newPolygon.offset !== undefined) newOffsets.push(newPolygon.offset);
    }
  });
  if (newCoordinates.length === 0) return undefined;
  return {
    type: 'MultiPolygon',
    is3D,
    coordinates: newCoordinates,
    bbox,
    vecBBox,
    offset: newOffsets,
  };
}

/**
 * After clipping a line, return the altered line,
 * the offset the new line starts at,
 * and if the line is ccw
 */
export interface ClipLineResult<M extends MValue = Properties> {
  line: VectorLineString<M>;
  offset: number;
  vecBBox?: BBOX;
}
/** Ensuring `vecBBox` exists */
export interface ClipLineResultWithBBox<M extends MValue = Properties> {
  line: VectorLineString<M>;
  offset: number;
  vecBBox: BBOX;
}

/**
 * Data should always be in a 0->1 coordinate system to use this clip function
 * @param geom - the original geometry line
 * @param bbox - the bounding box to clip the line to
 * @param isPolygon - true if the line comes from a polygon
 * @param offset - the starting offset the line starts at
 * @param buffer - the buffer to apply to the line (spacing outside the bounding box)
 * @returns - the clipped geometry
 */
export function clipLine<M extends MValue = Properties>(
  geom: VectorLineString<M>,
  bbox: BBox,
  isPolygon: boolean,
  offset: number = 0,
  buffer: number = 0.0625, // default for a full size tile. Assuming 1024 extent and a 64 point buffer
): ClipLineResultWithBBox<M>[] {
  const res: ClipLineResult<M>[] = [];
  const [left, bottom, right, top] = bbox;
  // clip horizontally
  const horizontalClips = _clipLine(
    { line: geom, offset, vecBBox: [0, 0, 0, 0] },
    left - buffer,
    right + buffer,
    0,
    isPolygon,
  );
  for (const clip of horizontalClips) {
    // clip vertically
    res.push(..._clipLine(clip, bottom - buffer, top + buffer, 1, isPolygon));
  }
  return res.map((clip) => {
    let vecBBox: BBOX | undefined;
    for (const p of clip.line) vecBBox = extendBBox(vecBBox, p);
    clip.vecBBox = vecBBox;
    return clip;
  }) as ClipLineResultWithBBox<M>[];
}

/**
 * @param input - the original geometry line
 * @param k1 - the lower bound
 * @param k2 - the upper bound
 * @param axis - 0 for x, 1 for y
 * @param isPolygon - true if the line comes from a polygon
 * @returns - the clipped geometry
 */
function _clipLine<M extends MValue = Properties>(
  input: ClipLineResult<M>,
  k1: number,
  k2: number,
  axis: 0 | 1,
  isPolygon: boolean,
): ClipLineResult<M>[] {
  const { line: geom, offset: startOffset } = input;
  const newGeom: ClipLineResult<M>[] = [];
  let slice: VectorLineString<M> = [];
  let last = geom.length - 1;
  const intersect = axis === 0 ? intersectX : intersectY;

  let curOffset = startOffset;
  let accOffset = startOffset;
  let prevP = geom[0];
  let firstEnter = false;

  for (let i = 0; i < last; i++) {
    const { x: ax, y: ay, z: az, t: at, m: am } = geom[i];
    const { x: bx, y: by, z: bz, m: bm } = geom[i + 1];
    const a = axis === 0 ? ax : ay;
    const b = axis === 0 ? bx : by;
    let entered = false;
    let exited = false;
    let intP: VectorPoint<M> | undefined;

    // ENTER OR CONTINUE CASES
    if (a < k1) {
      // ---|-->  | (line enters the clip region from the left)
      if (b > k1) {
        intP = intersect(ax, ay, bx, by, k1, bz, bm);
        slice.push(intP);
        entered = true;
      }
    } else if (a > k2) {
      // |  <--|--- (line enters the clip region from the right)
      if (b < k2) {
        intP = intersect(ax, ay, bx, by, k2, bz, bm);
        slice.push(intP);
        entered = true;
      }
    } else {
      intP = { x: ax, y: ay, z: az, t: at, m: am };
      slice.push(intP);
    }

    // Update the intersection point and offset if the intP exists
    if (intP !== undefined) {
      // our first enter will change the offset for the line
      if (entered && !firstEnter) {
        curOffset = accOffset + distance(prevP, intP);
        firstEnter = true;
      }
    }

    // EXIT CASES
    if (b < k1 && a >= k1) {
      // <--|---  | or <--|-----|--- (line exits the clip region on the left)
      intP = intersect(ax, ay, bx, by, k1, bz, bm ?? am);
      slice.push(intP);
      exited = true;
    }
    if (b > k2 && a <= k2) {
      // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
      intP = intersect(ax, ay, bx, by, k2, az, bm ?? am);
      slice.push(intP);
      exited = true;
    }

    // update the offset
    accOffset += distance(prevP, geom[i + 1]);
    prevP = geom[i + 1];

    // If not a polygon, we can cut it into parts, otherwise we just keep tracking the edges
    if (!isPolygon && exited) {
      newGeom.push({ line: slice, offset: curOffset });
      slice = [];
      firstEnter = false;
    }
  }

  // add the last point if inside the clip
  const lastPoint = geom[last];
  const a = axis === 0 ? lastPoint.x : lastPoint.y;
  if (a >= k1 && a <= k2) slice.push({ ...lastPoint });

  // close the polygon if its endpoints are not the same after clipping
  if (slice.length > 0 && isPolygon) {
    last = slice.length - 1;
    const firstP = slice[0];
    if (last >= 1 && (slice[last].x !== firstP.x || slice[last].y !== firstP.y)) {
      slice.push({ ...firstP });
    }
  }

  // add the final slice
  if (slice.length > 0) newGeom.push({ line: slice, offset: curOffset });

  return newGeom;
}

/**
 * @param ax - the first x
 * @param ay - the first y
 * @param bx - the second x
 * @param by - the second y
 * @param x - the x to intersect
 * @param z - the z to insert
 * @param m - the MValue
 * @returns - the intersecting point
 */
function intersectX<M extends MValue = Properties>(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  z?: number,
  m?: M,
): VectorPoint<M> {
  const t = (x - ax) / (bx - ax);
  return { x, y: ay + (by - ay) * t, m, z, t: 1 };
}

/**
 * @param ax - the first x
 * @param ay - the first y
 * @param bx - the second x
 * @param by - the second y
 * @param y - the y to intersect
 * @param z - the z to insert
 * @param m - the MValue
 * @returns - the intersecting point
 */
function intersectY<M extends MValue = Properties>(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  y: number,
  z?: number,
  m?: M,
): VectorPoint<M> {
  const t = (y - ay) / (by - ay);
  return { x: ax + (bx - ax) * t, y, z, m, t: 1 };
}

/**
 * Calculate the Euclidean distance between two points.
 * @param p1 - The first point.
 * @param p2 - The second point.
 * @returns - The distance between the points.
 */
function distance(p1: VectorPoint, p2: VectorPoint): number {
  const { sqrt, pow } = Math;
  return sqrt(pow(p2.x - p1.x, 2) + pow(p2.y - p1.y, 2));
}

import type { TileRequest } from 'workers/worker.spec.js';
import type {
  VectorCoordinates,
  VectorLineString,
  VectorMultiLineString,
  VectorMultiPoint,
  VectorMultiPolygon,
  VectorPoint,
} from 'gis-tools/index.js';

/** The scale and shift parameters */
interface ScaleShiftParams {
  scale: number;
  xShift: number;
  yShift: number;
}

/**
 * Source data may only tilelize data to a certain max zoom, but we may request a tile at a higher zoom
 * Therefore we scale, shift, and clip the geometry as needed for that specific higher zoomed tile.
 *
 * 1) scale up by distance between tiles (if parent is 2 zooms above, you double size twice)
 * 2) shift x and y by position of current tile
 * 3) clip the geometry by 0->extent (include buffer if not points)
 * @param extent - the extent of the current tile
 * @param tile - the tile request
 * @returns the scale, shift, and clip parameters
 */
export function scaleShiftParams(extent: number, tile: TileRequest): ScaleShiftParams | undefined {
  const { parent } = tile;
  if (parent === undefined) return;
  const parentZoom = parent.zoom;
  let { i, j, zoom } = tile;
  // get the scale
  const scale = 1 << (zoom - parentZoom);
  // get x and y shift
  let xShift = 0;
  let yShift = 0;
  while (zoom > parentZoom) {
    const div = 1 << (zoom - parentZoom);
    if (i % 2 !== 0) xShift += extent / div;
    if (j % 2 !== 0) yShift += extent / div;
    // decrement
    i = i >> 1;
    j = j >> 1;
    zoom--;
  }

  return { scale, xShift, yShift };
}

/**
 * Scale, shift, and clip polygons according to the tile request and extent
 * @param geometry - input multi polygon
 * @param extent - extent is the tile "pixel" size
 * @param tile - the tile request
 * @returns the scaled, shifted, and clipped polygons
 */
export function scaleShiftClipPoints(
  geometry: VectorMultiPoint,
  extent: number,
  tile: TileRequest,
): VectorMultiPoint {
  const scaleShift = scaleShiftParams(extent, tile);
  if (scaleShift === undefined) return geometry;
  const { scale, xShift, yShift } = scaleShift;
  return _scaleShiftClipPoints(geometry, extent, xShift, yShift, scale);
}

/**
 * Scale, shift, and clip polygons according to the tile request and extent
 * @param geometry - input multi polygon
 * @param extent - extent is the tile "pixel" size
 * @param tile - the tile request
 * @returns the scaled, shifted, and clipped polygons
 */
export function scaleShiftClipLines(
  geometry: VectorMultiLineString,
  extent: number,
  tile: TileRequest,
): VectorMultiLineString {
  const scaleShift = scaleShiftParams(extent, tile);
  if (scaleShift === undefined) return geometry;
  const { scale, xShift, yShift } = scaleShift;
  return _scaleShiftClipLines(geometry, extent, xShift, yShift, scale);
}

/**
 * Scale, shift, and clip polygons according to the tile request and extent
 * @param geometry - input multi polygon
 * @param extent - extent is the tile "pixel" size
 * @param tile - the tile request
 * @returns the scaled, shifted, and clipped polygons
 */
export function scaleShiftClipPolys(
  geometry: VectorMultiPolygon,
  extent: number,
  tile: TileRequest,
): VectorMultiPolygon {
  const scaleShift = scaleShiftParams(extent, tile);
  if (scaleShift === undefined) return geometry;
  const { scale, xShift, yShift } = scaleShift;
  return _scaleShiftClipPolys(geometry, extent, xShift, yShift, scale);
}

/**
 * scale, shift, and clip lines from linestrings or polygons
 * @param geometry - input vector geometry
 * @param extent - extent is the tile "pixel" size
 * @param xShift - x-coordinate shift
 * @param yShift - y-coordinate shift
 * @param scale - scale factor
 * @returns resultant vector geometry post scale, shift, and clip
 */
function _scaleShiftClipPolys(
  geometry: VectorMultiPolygon,
  extent: number,
  xShift: number,
  yShift: number,
  scale: number,
): VectorMultiPolygon {
  // shift & scale
  for (const poly of geometry) {
    for (const line of poly) shiftScale(line, xShift, yShift, scale);
  }
  // clip
  let newGeometry: VectorCoordinates = [];
  const newGeo: VectorMultiPolygon = [];
  for (const poly of geometry) {
    const newPoly: VectorMultiLineString = [];
    for (const line of poly) newPoly.push(...clipLine(line, extent, true));
    if (newPoly.length > 0) newGeo.push(newPoly);
  }
  newGeometry = newGeo;

  if (newGeometry.length > 0) return newGeometry;
  else return [];
}

/**
 * scale, shift, and clip lines from linestrings or polygons
 * @param geometry - input vector geometry
 * @param extent - extent is the tile "pixel" size
 * @param xShift - x-coordinate shift
 * @param yShift - y-coordinate shift
 * @param scale - scale factor
 * @returns resultant vector geometry post scale, shift, and clip
 */
function _scaleShiftClipLines(
  geometry: VectorMultiLineString,
  extent: number,
  xShift: number,
  yShift: number,
  scale: number,
): VectorMultiLineString {
  // shift & scale
  for (const line of geometry) shiftScale(line, xShift, yShift, scale);
  // clip
  const newGeo: VectorMultiLineString = [];
  for (const line of geometry) {
    newGeo.push(...clipLine(line, extent, false));
  }

  if (newGeo.length > 0) return newGeo;
  else return [];
}

/**
 * scale, shift, and clip points
 * @param geometry - input points
 * @param extent - extent is the tile "pixel" size
 * @param xShift - x-coordinate shift
 * @param yShift - y-coordinate shift
 * @param scale - scale factor
 * @returns resultant vector points post scale, shift, and clip
 */
function _scaleShiftClipPoints(
  geometry: VectorMultiPoint,
  extent: number,
  xShift: number,
  yShift: number,
  scale: number,
): VectorMultiPoint {
  // shift & scale
  shiftScale(geometry, xShift, yShift, scale);
  // clip
  for (let i = 0; i < geometry.length; i++) {
    const point = geometry[i];
    if (point.x < 0 || point.x > extent || point.y < 0 || point.y > extent) {
      geometry.splice(i, 1);
      i--;
    }
  }

  return geometry;
}

/**
 * Shift and scale adjustment to a collection of points
 * @param points - collection of input points
 * @param xShift - x-coordinate shift
 * @param yShift - y-coordinate shift
 * @param scale - scale factor
 */
function shiftScale(points: VectorMultiPoint, xShift: number, yShift: number, scale: number): void {
  for (const point of points) {
    point.x = (point.x - xShift) * scale;
    point.y = (point.y - yShift) * scale;
  }
}

/**
 * Clip a collection of lines
 * @param lines - collection of input lines
 * @param extent - extent is the tile "pixel" size
 * @param isPolygon - true if the geometry is a polygon
 * @param buffer - buffer size
 * @returns collection of clipped lines
 */
export function clipLines(
  lines: VectorMultiLineString,
  extent: number,
  isPolygon: boolean,
  buffer: number = 80,
): VectorMultiLineString {
  const res: VectorMultiLineString = [];
  for (const line of lines) res.push(...clipLine(line, extent, isPolygon, buffer));
  return res;
}

/**
 * uses a buffer of 80 as default
 * @param line - input line
 * @param extent - extent is the tile "pixel" size
 * @param isPolygon - true if the geometry is a polygon
 * @param buffer - buffer size (default of 80)
 * @returns collection of clipped lines
 */
function clipLine(
  line: VectorLineString,
  extent: number,
  isPolygon: boolean,
  buffer: number = 80,
): VectorMultiLineString {
  const res: VectorMultiLineString = [];
  const vertical: VectorMultiLineString = [];

  // slice vertically
  _clipLine(line, vertical, -buffer, extent + buffer, 1, isPolygon);
  // slice horizontally
  for (const vertLine of vertical) _clipLine(vertLine, res, -buffer, extent + buffer, 0, isPolygon);

  return res;
}

/**
 * Clip a line
 * @param line - input line
 * @param newGeom - collection of clipped lines to store the result to
 * @param k1 - lower bound
 * @param k2 - upper bound
 * @param axis - axis (0 for x or 1 for y)
 * @param isPolygon - true if the geometry is a polygon otherwise it's a linestring
 */
function _clipLine(
  line: VectorLineString,
  newGeom: VectorMultiLineString,
  k1: number,
  k2: number,
  axis: 0 | 1,
  isPolygon: boolean,
): void {
  let slice: VectorPoint[] = [];
  const intersect = axis === 0 ? intersectX : intersectY;
  const len = line.length - 1;

  for (let i = 0; i < len; i++) {
    const ax = line[i].x;
    const ay = line[i].y;
    const bx = line[i + 1].x;
    const by = line[i + 1].y;
    const a = axis === 0 ? ax : ay;
    const b = axis === 0 ? bx : by;
    let exited = false;

    if (a < k1) {
      // ---|-->  | (line enters the clip region from the left)
      if (b > k1) intersect(slice, ax, ay, bx, by, k1);
    } else if (a > k2) {
      // |  <--|--- (line enters the clip region from the right)
      if (b < k2) intersect(slice, ax, ay, bx, by, k2);
    } else {
      slice.push({ x: ax, y: ay });
    }
    if (b < k1 && a >= k1) {
      // <--|---  | or <--|-----|--- (line exits the clip region on the left)
      intersect(slice, ax, ay, bx, by, k1);
      exited = true;
    }
    if (b > k2 && a <= k2) {
      // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
      intersect(slice, ax, ay, bx, by, k2);
      exited = true;
    }

    if (!isPolygon && exited) {
      newGeom.push(slice);
      slice = [];
    }
  }

  // add the last point
  const ax = line[len].x;
  const ay = line[len].y;
  const a = axis === 0 ? ax : ay;
  if (a >= k1 && a <= k2) slice.push({ x: ax, y: ay });

  // close the polygon if its endpoints are not the same after clipping
  if (isPolygon && slice.length < 3) return;
  const last = slice.length - 1;
  if (isPolygon && (slice[last].x !== slice[0].x || slice[last].y !== slice[0].y)) {
    slice.push({ x: slice[0].x, y: slice[0].y });
  }

  // add the final slice
  if (slice.length > 0) newGeom.push(slice);
}

/**
 * Get the X-intersection point
 * @param out - collection of intersection points to store the result to
 * @param ax - input point A's x coordinate
 * @param ay - input point A's y coordinate
 * @param bx - input point B's x coordinate
 * @param by - input point B's y coordinate
 * @param x - intersection point's x coordinate
 */
function intersectX(
  out: VectorPoint[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
): void {
  const t = (x - ax) / (bx - ax);
  out.push({ x, y: ay + (by - ay) * t });
}

/**
 * Get the Y-intersection point
 * @param out - collection of intersection points to store the result to
 * @param ax - input point A's x coordinate
 * @param ay - input point A's y coordinate
 * @param bx - input point B's x coordinate
 * @param by - input point B's y coordinate
 * @param y - intersection point's y coordinate
 */
function intersectY(
  out: VectorPoint[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  y: number,
): void {
  const t = (y - ay) / (by - ay);
  out.push({ x: ax + (bx - ax) * t, y });
}

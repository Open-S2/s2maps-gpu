import { project } from '../mat4.js';
import { boxIntersects, pointBoundaries } from './index.js';
import { idFromIJ, llToTile, llToTilePx } from 'gis-tools/index.js';

import type { Point3D } from 'gis-tools/index.js';
import type { Projector, TileInView } from '../index.js';

/** type for temporary WMID. It handles a single quadtree supporting id's that fall outside the range of the tree */
export type TmpWMID = bigint;

/** Track the face-i-j positions */
type ZoomXY = [zoom: number, x: number, y: number];

/**
 * Given a zoom, lon, lat, and projector, get the tiles in view
 * Due to the nature of the Web Mercator design,
 * it's easiest to store an MVP matrix for each tile
 *
 * NOTE: Real World Tiles must be created/cached BEFORE creating out of bounds tiles
 * as the out of bounds tiles will need to reference the real world tiles.
 * So we sort all out of bounds tiles to the end of the list.
 * @param zoom - the zoom leve
 * @param lon - the longitude
 * @param lat - the latitude
 * @param projector - the projection object
 * @returns a list of Tile IDs in view
 */
export function getTilesInViewWM(
  zoom: number,
  lon: number,
  lat: number,
  projector: Projector,
): TileInView[] {
  const { tileSize, duplicateHorizontally } = projector;
  if (zoom < 1) zoom = 0;
  const tiles = new Map<bigint, TileInView>();
  const checkList: Point3D[] = [];
  const checkedTiles = new Set<string>();
  zoom = zoom << 0; // move to whole number
  const size = 1 << zoom;

  // let's find the current tile and store it
  const { x, y } = llToTile({ x: lon, y: lat }, zoom, tileSize);
  const id = idFromIJ(0, x, y, zoom);
  tiles.set(id, { id, face: 0, zoom, x, y });
  // add the first set of neighbors
  addNeighbors(zoom, x, y, duplicateHorizontally, checkedTiles, checkList);

  while (checkList.length > 0) {
    // grab a tile to check and get its face and bounds
    const check = checkList.pop();
    if (check === undefined) break;
    const [, xCheck, yCheck] = check;
    // get the tiles matrix
    const matrix = tileMatrix(projector, zoom, xCheck, yCheck);
    // project the four corners of the tile
    const bl = project(matrix, { x: 0, y: 0, z: 0 });
    const br = project(matrix, { x: 1, y: 0, z: 0 });
    const tl = project(matrix, { x: 0, y: 1, z: 0 });
    const tr = project(matrix, { x: 1, y: 1, z: 0 });
    // check if the tile is in view
    if (pointBoundaries(bl, br, tl, tr) || boxIntersects(bl, br, tl, tr)) {
      // ensure S2CellId uses the wrapped x-y values.
      const s2ID = idFromIJ(0, mod(xCheck, size), mod(yCheck, size), zoom);
      // if the tile is in view, add it to the list
      const wmID = toWMID(zoom, xCheck, yCheck, duplicateHorizontally);
      const id = wmID ?? s2ID;
      // IF the wmID exists, it means it's an out of bounds ID, we we need to store the "wrapped" id which is the s2CellId
      const wrappedID = wmID !== undefined ? s2ID : undefined;
      tiles.set(id, { id, face: 0, zoom: zoom, x: xCheck, y: yCheck, wrappedID });
      // add the surounding tiles we have not checked
      addNeighbors(zoom, xCheck, yCheck, duplicateHorizontally, checkedTiles, checkList);
    }
  }

  return (
    [...tiles.values()]
      // first we sort by id to avoid text filtering to awkwardly swap back and forth
      .sort((a, b) => {
        // First sort by x
        if (a.x < b.x) return -1;
        else if (a.x > b.x) return 1;
        // Then sort by y
        else if (a.y < b.y) return -1;
        else if (a.y > b.y) return 1;
        // assume equal enough
        else return 0;
      })
    // then we sort by real world tiles first and out of bounds tiles last
    // NOTE: I am commenting this out for now. I am not convinced it is necessary
    // .sort((a, b) => {
    //   if (a.wrappedID !== undefined) return 1;
    //   else if (b.wrappedID !== undefined) return -1;
    //   else return 0;
    // })
  );
}

/**
 * Add neighbors to the checkList
 * @param zoom - the zoom level
 * @param x - the x tile-coordinate
 * @param y - the y tile-coordinate
 * @param duplicateHorizontally - whether to duplicate horizontally
 * @param checkedTiles - the set of tiles we have already checked
 * @param checkList - the list of tiles to check
 */
function addNeighbors(
  zoom: number,
  x: number,
  y: number,
  duplicateHorizontally: boolean,
  checkedTiles: Set<string>,
  checkList: Point3D[],
): void {
  // add the surounding tiles we have not checked
  for (const [nZoom, nX, nY] of neighborsXY(zoom, x, y, duplicateHorizontally)) {
    const zxy = `${String(nZoom)}-${String(nX)}-${String(nY)}`;
    if (!checkedTiles.has(zxy)) {
      checkedTiles.add(zxy);
      checkList.push([nZoom, nX, nY]);
    }
  }
}

/**
 * Get the matrix for a specific tile
 * @param projector - the projection object's current state
 * @param tileZoom - the zoom level
 * @param tileX - the x tile-coordinate
 * @param tileY - the y tile-coordinate
 * @returns the matrix for the tile
 */
function tileMatrix(
  projector: Projector,
  tileZoom: number,
  tileX: number,
  tileY: number,
): Float32Array {
  const { zoom, lon, lat } = projector;
  const scale = Math.pow(2, zoom - tileZoom);
  const offset = llToTilePx({ x: lon, y: lat }, [tileZoom, tileX, tileY], 1);

  return projector.getMatrix(scale, offset);
}

/**
 * grab the tiles next to the current tiles zoom-x-y
 * only include adjacent tiles, not diagonal.
 * If includeOutOfBounds set to true, it will include out of bounds tiles
 * on the x-axis
 * @param zoom - tile's zoom
 * @param x - tile's x-coordinate
 * @param y - tile's y-coordinate
 * @param includeOutOfBounds - flag to keep out of bounds tiles if true
 * @returns neighboring tiles, including out of bounds if flag set
 */
export function neighborsXY(
  zoom: number,
  x: number,
  y: number,
  includeOutOfBounds = false,
): ZoomXY[] {
  const size = 1 << zoom;
  const neighbors: ZoomXY[] = [];
  const xOutOfBounds = x < 0 || x >= size;
  if (x - 1 >= 0 || includeOutOfBounds) neighbors.push([zoom, x - 1, y]);
  if (x + 1 < size || includeOutOfBounds) neighbors.push([zoom, x + 1, y]);
  if (!xOutOfBounds && y - 1 >= 0) neighbors.push([zoom, x, y - 1]);
  if (!xOutOfBounds && y + 1 < size) neighbors.push([zoom, x, y + 1]);
  return neighbors;
}

/**
 * Convert zoom-x-y to a singular number
 * It may resolve to itself. This is useful for maps that have
 * `duplicateHorizontally` set to true. It forces the tile to be
 * within the bounds of the quad tree.
 * @param zoom - the zoom level
 * @param x - the x tile-coordinate
 * @param y - the y tile-coordinate
 * @param duplicateHorizontally - whether to duplicate horizontally
 * @returns the singular number
 */
export function toWMID(
  zoom: number,
  x: number,
  y: number,
  duplicateHorizontally: boolean,
): bigint | undefined {
  if (!duplicateHorizontally) return undefined;
  const size = 1 << zoom;
  // skip tiles that are NOT out of bounds
  if (x >= 0 && x < size && y >= 0 && y < size) return;
  // otherwise store the out of boudns tile
  const maxX = 1 << zoom;
  const adjustedX = mod(x, maxX); // Adjust x to be within [0, maxX)
  const remainder = zigzag(x - adjustedX);
  return (
    (BigInt(1 << zoom) * BigInt(y) + BigInt(adjustedX)) * 32n +
    BigInt(zoom) +
    (BigInt(remainder) << 65n)
  );
}

/**
 * encode a number as always positive interweaving negative and postive values
 * @param n - the number
 * @returns the encoded number
 */
export function zigzag(n: number): number {
  return (n >> 31) ^ (n << 1);
}

/**
 * a modulo function that works with negative numbers
 * @param x - the number
 * @param n - the modulus
 * @returns the result
 */
export function mod(x: number, n: number): number {
  return ((x % n) + n) % n;
}

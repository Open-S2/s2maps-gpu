import { project } from '../mat4';
import { boxIntersects, pointBoundaries } from '.';
import { idFromIJ, isOutOfBoundsWM, llToTile, llToTilePx } from 'gis-tools';

import type { Point3D } from 'gis-tools';
import type Projector from '../';

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
export default function getTilesInView(
  zoom: number,
  lon: number,
  lat: number,
  projector: Projector,
): bigint[] {
  const { tileSize, duplicateHorizontally } = projector;
  if (zoom < 1) zoom = 0;
  const tiles = new Set<bigint>();
  const checkList: Point3D[] = [];
  const checkedTiles = new Set<string>();
  zoom = zoom << 0; // move to whole number

  // let's find the current tile and store it
  const { x, y } = llToTile({ x: lon, y: lat }, zoom, tileSize);
  tiles.add(idFromIJ(0, zoom, x, y));
  // add the first set of neighbors
  addNeighbors(zoom, x, y, duplicateHorizontally, checkedTiles, checkList);

  while (checkList.length > 0) {
    // grab a tile to check and get its face and bounds
    const check = checkList.pop();
    if (check === undefined) break;
    const [zCheck, xCheck, yCheck] = check;
    // get the tiles matrix
    const matrix = tileMatrix(projector, zCheck, xCheck, yCheck);
    // project the four corners of the tile
    const bl = project(matrix, { x: 0, y: 0, z: 0 });
    const br = project(matrix, { x: 1, y: 0, z: 0 });
    const tl = project(matrix, { x: 0, y: 1, z: 0 });
    const tr = project(matrix, { x: 1, y: 1, z: 0 });
    // check if the tile is in view
    if (pointBoundaries(bl, br, tl, tr) || boxIntersects(bl, br, tl, tr)) {
      // if the tile is in view, add it to the list
      tiles.add(idFromIJ(0, zCheck, xCheck, yCheck));
      // add the surounding tiles we have not checked
      addNeighbors(zCheck, xCheck, yCheck, duplicateHorizontally, checkedTiles, checkList);
    }
  }

  return (
    [...tiles]
      // first we sort by id to avoid text filtering to awkwardly swap back and forth
      .sort((a, b) => {
        if (a > b) return 1;
        else if (a < b) return -1;
        else return 0;
      })
      // then we sort by real world tiles first and out of bounds tiles last
      .sort((a, b) => {
        if (isOutOfBoundsWM(a)) return 1;
        else if (isOutOfBoundsWM(b)) return -1;
        else return 0;
      })
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
  // TODO: We find neighbors using new S2-ID system, not incrementts
  const size = 1 << zoom;
  const neighbors: ZoomXY[] = [];
  const xOutOfBounds = x < 0 || x >= size;
  if (x - 1 >= 0 || includeOutOfBounds) neighbors.push([zoom, x - 1, y]);
  if (x + 1 < size || includeOutOfBounds) neighbors.push([zoom, x + 1, y]);
  if (!xOutOfBounds && y - 1 >= 0) neighbors.push([zoom, x, y - 1]);
  if (!xOutOfBounds && y + 1 < size) neighbors.push([zoom, x, y + 1]);
  return neighbors;
}

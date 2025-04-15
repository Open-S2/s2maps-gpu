import { project } from '../mat4';
import { boxIntersects, pointBoundaries } from '.';

import {
  bboxST,
  getNeighborsIJ,
  idFromFace,
  idFromIJ,
  idParent,
  pointFromLonLat,
  pointFromSTGL,
  pointMulScalar,
  pointNormalize,
  pointToIJ,
} from 'gis-tools';

import type { BBox, Face, S2CellId, VectorPoint } from 'gis-tools';

/** Track the face-i-j positions */
type FaceIJ = [face: number, i: number, j: number];

const ZERO_TILES = [
  idFromFace(0),
  idFromFace(1),
  idFromFace(2),
  idFromFace(3),
  idFromFace(4),
  idFromFace(5),
];

/**
 * Given a camera position, get the tiles in current view
 * @param zoom - the zoom level
 * @param lon - the longitude
 * @param lat - the latitude
 * @param matrix - the projection matrix
 * @param radius - the radius of the sphere
 * @returns list of Tile IDs
 */
export default function getTilesInView(
  zoom: number,
  lon: number,
  lat: number,
  matrix: Float32Array,
  radius = 1,
): S2CellId[] {
  if (zoom < 1) return ZERO_TILES;
  const tiles: S2CellId[] = [];
  const checkList: FaceIJ[] = [];
  const checkedTiles = new Set<string>();
  zoom = zoom << 0; // move to whole number
  let stBbox: BBox,
    tLProj: VectorPoint,
    tRProj: VectorPoint,
    bLProj: VectorPoint,
    bRProj: VectorPoint;

  // grab the first tile and prep neighbors for checks
  const [face, i, j] = pointToIJ(pointFromLonLat({ x: lon, y: lat }), zoom);
  tiles.push(idParent(idFromIJ(face, i, j, zoom), zoom));
  checkedTiles.add(`${String(face)}-${String(i)}-${String(j)}`);
  addNeighbors(face, zoom, i, j, checkedTiles, checkList);
  const zero = project(matrix, { x: 0, y: 0, z: 0 }).z!;

  while (checkList.length > 0) {
    // grab a tile to check and get its face and bounds
    const check = checkList.pop();
    if (check === undefined) break;
    const [face, i, j] = check;
    stBbox = bboxST(i, j, zoom);
    // grab the four points from the bbox and project them
    tLProj = project(
      matrix,
      pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[0], stBbox[3])), radius),
    );
    tRProj = project(
      matrix,
      pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[2], stBbox[3])), radius),
    );
    bLProj = project(
      matrix,
      pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[0], stBbox[1])), radius),
    );
    bRProj = project(
      matrix,
      pointMulScalar(pointNormalize(pointFromSTGL(face as Face, stBbox[2], stBbox[1])), radius),
    );
    // check if any of the 4 edge points or lines interact with a -1 to 1 x and y projection plane
    // if tile is part of the view, we add to tiles and tileSet and add all surounding tiles
    if (
      lessThanZero(zero, bLProj.z!, bRProj.z!, tLProj.z!, tRProj.z!) &&
      (pointBoundaries(bLProj, bRProj, tLProj, tRProj) ||
        boxIntersects(bLProj, bRProj, tLProj, tRProj))
    ) {
      tiles.push(idParent(idFromIJ(face as Face, i, j, zoom), zoom));
      addNeighbors(face as Face, zoom, i, j, checkedTiles, checkList);
    }
  }

  // we sort by id to avoid text filtering to awkwardly swap back and forth
  return tiles.sort((a, b) => {
    if (a > b) return 1;
    else if (a < b) return -1;
    else return 0;
  });
}

/**
 * Add neighbors to the checkList
 * @param face - the face of the S2 sphere
 * @param zoom - the zoom level
 * @param i - the i tile-coordinate
 * @param j - the j tile-coordinate
 * @param checkedTiles - the set of tiles we have already checked
 * @param checkList - the list of tiles to check
 */
function addNeighbors(
  face: Face,
  zoom: number,
  i: number,
  j: number,
  checkedTiles: Set<string>,
  checkList: FaceIJ[],
): void {
  // add the surounding tiles we have not checked
  for (const [nFace, nI, nJ] of getNeighborsIJ(face, i, j, zoom)) {
    const fij = `${String(nFace)}-${String(nI)}-${String(nJ)}`;
    if (!checkedTiles.has(fij)) {
      checkedTiles.add(fij);
      checkList.push([nFace, nI, nJ]);
    }
  }
}

/**
 * check if any 4 points in a rectangle is less than zero
 * @param zero - the zero reference point to compare against
 * @param bl - bottom left point
 * @param br - bottom right point
 * @param tl - top left point
 * @param tr - top right point
 * @returns true if any point is less than zero
 */
export function lessThanZero(
  zero: number,
  bl: number,
  br: number,
  tl: number,
  tr: number,
): boolean {
  if (bl < zero || br < zero || tl < zero || tr < zero) return true;
  return false;
}

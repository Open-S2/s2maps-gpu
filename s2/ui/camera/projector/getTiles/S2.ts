import { project } from '../mat4'
import { bboxST, neighborsIJ } from 'geometry/s2/s2Coords'
import { fromLonLat, fromSTGL, mul, normalize, toIJ } from 'geometry/s2/s2Point'
import { fromFace, fromIJ, parent } from 'geometry/s2/s2CellID'
import { boxIntersects, lessThanZero, pointBoundaries } from 'geometry'

import type { BBox, Face, XYZ } from 'geometry'

const ZERO_TILES = [fromFace(0), fromFace(1), fromFace(2), fromFace(3), fromFace(4), fromFace(5)]

export default function getTilesInView (
  zoom: number,
  lon: number,
  lat: number,
  matrix: Float32Array,
  radius = 1
): bigint[] {
  if (zoom < 1) return ZERO_TILES
  const tiles: bigint[] = []
  const checkList: Array<[number, number, number]> = []
  const checkedTiles = new Set<string>()
  zoom = zoom << 0 // move to whole number
  let stBbox: BBox, tLProj: XYZ, tRProj: XYZ, bLProj: XYZ, bRProj: XYZ

  // grab the first tile and prep neighbors for checks
  const [face, i, j] = toIJ(fromLonLat(lon, lat), zoom)
  tiles.push(parent(fromIJ(face, i, j, zoom), zoom))
  checkedTiles.add(`${String(face)}-${String(i)}-${String(j)}`)
  addNeighbors(face, zoom, i, j, checkedTiles, checkList)
  const zero = project(matrix, [0, 0, 0])[2]

  while (checkList.length > 0) {
    // grab a tile to check and get its face and bounds
    const check = checkList.pop()
    if (check === undefined) break
    const [face, i, j] = check
    stBbox = bboxST(i, j, zoom)
    // grab the four points from the bbox and project them
    tLProj = project(matrix, mul(normalize(fromSTGL(face as Face, stBbox[0], stBbox[3])), radius))
    tRProj = project(matrix, mul(normalize(fromSTGL(face as Face, stBbox[2], stBbox[3])), radius))
    bLProj = project(matrix, mul(normalize(fromSTGL(face as Face, stBbox[0], stBbox[1])), radius))
    bRProj = project(matrix, mul(normalize(fromSTGL(face as Face, stBbox[2], stBbox[1])), radius))
    // check if any of the 4 edge points or lines interact with a -1 to 1 x and y projection plane
    // if tile is part of the view, we add to tiles and tileSet and add all surounding tiles
    if (
      lessThanZero(zero, bLProj[2], bRProj[2], tLProj[2], tRProj[2]) &&
      (
        pointBoundaries(bLProj, bRProj, tLProj, tRProj) ||
        boxIntersects(bLProj, bRProj, tLProj, tRProj)
      )
    ) {
      tiles.push(parent(fromIJ(face as Face, i, j, zoom), zoom))
      addNeighbors(face as Face, zoom, i, j, checkedTiles, checkList)
    }
  }

  // we sort by id to avoid text filtering to awkwardly swap back and forth
  return tiles.sort((a, b) => {
    if (a > b) return 1
    else if (a < b) return -1
    else return 0
  })
}

function addNeighbors (
  face: Face,
  zoom: number,
  i: number,
  j: number,
  checkedTiles: Set<string>,
  checkList: Array<[number, number, number]>
): void {
  // add the surounding tiles we have not checked
  for (const [nFace, nI, nJ] of neighborsIJ(face, i, j, zoom)) {
    const fij = `${String(nFace)}-${String(nI)}-${String(nJ)}`
    if (!checkedTiles.has(fij)) {
      checkedTiles.add(fij)
      checkList.push([nFace, nI, nJ])
    }
  }
}

import { project } from '../mat4'
import { bboxST, neighborsIJ } from 's2/geometry/s2/s2Coords'
import { fromLonLat, fromSTGL, mul, normalize, toIJ } from 's2/geometry/s2/s2Point'
import { fromFace, fromIJ, parent } from 's2/geometry/s2/s2CellID'

import type { Face, XYZ } from 's2/geometry'

const ZERO_TILES = [fromFace(0), fromFace(1), fromFace(2), fromFace(3), fromFace(4), fromFace(5)]

export default function getTilesInView (
  zoom: number,
  matrix: Float32Array,
  lon: number,
  lat: number,
  radius = 1
): bigint[] {
  if (zoom < 1) return ZERO_TILES
  const tiles: bigint[] = []
  const checkList: Array<[number, number, number]> = []
  const checkedTiles = new Set<string>()
  zoom = zoom << 0 // move to whole number
  let stBbox, tLProj, tRProj, bLProj, bRProj

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

function lessThanZero (zero: number, bl: number, br: number, tl: number, tr: number): boolean {
  if (bl < zero || br < zero || tl < zero || tr < zero) return true
  return false
}

function pointBoundaries (bl: XYZ, br: XYZ, tl: XYZ, tr: XYZ): boolean {
  return (tl[0] <= 1 && tl[0] >= -1 && tl[1] <= 1 && tl[1] >= -1) ||
    (tr[0] <= 1 && tr[0] >= -1 && tr[1] <= 1 && tr[1] >= -1) ||
    (bl[0] <= 1 && bl[0] >= -1 && bl[1] <= 1 && bl[1] >= -1) ||
    (br[0] <= 1 && br[0] >= -1 && br[1] <= 1 && br[1] >= -1)
}

function boxIntersects (bl: XYZ, br: XYZ, tl: XYZ, tr: XYZ): boolean {
  return boxIntersect(tl, bl) || // leftLine
    boxIntersect(br, tr) || // rightLine
    boxIntersect(bl, br) || // bottomLine
    boxIntersect(tr, tl) // topLine
}

function boxIntersect (p1: XYZ, p2: XYZ): boolean {
  if (
    lineIntersect(p1[0], p1[1], p2[0], p2[1], -1, -1, -1, 1) || // leftLineBox
    lineIntersect(p1[0], p1[1], p2[0], p2[1], 1, -1, 1, 1) || // rightLineBox
    lineIntersect(p1[0], p1[1], p2[0], p2[1], -1, -1, 1, -1) || // bottomLineBox
    lineIntersect(p1[0], p1[1], p2[0], p2[1], -1, 1, 1, 1) // topLineBox
  ) return true
  return false
}

function lineIntersect (x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number): boolean {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (denom === 0) return false
  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom
  return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1)
}

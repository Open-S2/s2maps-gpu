// @flow
import * as mat4 from '../../../util/mat4'
import { S2Point, tileXYFromSTZoom, bboxST, updateFace, tileHash } from 's2projection'

import type { TileDefinitions } from './projector'

export default function getTilesInView (zoom: number, matrix: Float32Array,
  lon: number, lat: number): TileDefinitions {
  if (zoom < 1) return [[0, 0, 0, 0, 2], [1, 0, 0, 0, 3], [2, 0, 0, 0, 4], [3, 0, 0, 0, 5], [4, 0, 0, 0, 6], [5, 0, 0, 0, 7]]
  // if (true) return [[4, 0, 0, 0, 6]]
  const tiles = []
  const checkList = []
  const checkedTiles = new Set()
  const zoomLevel = zoom << 0
  const tileSize = 1 << zoomLevel

  // grab the first tile while we prep
  let point = S2Point.fromLonLat(-lon, lat)
  let [face, s, t] = point.toST()
  if (s < 0 || s === 1 || t < 0 || t === 1) [face, s, t] = updateFace(face, s, t)
  let [x, y] = tileXYFromSTZoom(s, t, zoomLevel)
  let stBbox = bboxST(x, y, zoomLevel)
  let hash = tileHash(face, zoomLevel, x, y)
  checkedTiles.add(hash)
  tiles.push([face, zoomLevel, x, y, hash])
  // add the surounding tiles
  addSuroundingTiles(face, zoomLevel, x, y, tileSize, checkList, checkedTiles)

  do {
    // from current face, zoomLevel, x, y: grab the surrounding 8 tiles, refine to actual face boundaries, than adding to checked as we go
    [face, x, y, hash] = checkList.pop()
    // grab the bbox from the tile
    stBbox = bboxST(x, y, zoomLevel)
    // grab the four points from the bbox and project them
    const topLeft = S2Point.fromSTGL(face, stBbox[0], stBbox[3])
    topLeft.normalize()
    const topLeftProjected = mat4.project(matrix, [topLeft.x, topLeft.y, topLeft.z])
    const topRight = S2Point.fromSTGL(face, stBbox[2], stBbox[3])
    topRight.normalize()
    const topRightProjected = mat4.project(matrix, [topRight.x, topRight.y, topRight.z])
    const bottomLeft = S2Point.fromSTGL(face, stBbox[0], stBbox[1])
    bottomLeft.normalize()
    const bottomLeftProjected = mat4.project(matrix, [bottomLeft.x, bottomLeft.y, bottomLeft.z])
    const bottomRight = S2Point.fromSTGL(face, stBbox[2], stBbox[1])
    bottomRight.normalize()
    const bottomRightProjected = mat4.project(matrix, [bottomRight.x, bottomRight.y, bottomRight.z])
    // check if any of the 4 edge points or lines interact with a -1 to 1 x and y projection plane
    // if tile is part of the view, we add to tiles and tileSet and add all surounding tiles
    if (
      (topLeftProjected[0] <= 1 && topLeftProjected[0] >= -1 && topLeftProjected[1] <= 1 && topLeftProjected[1] >= -1) ||
      (topRightProjected[0] <= 1 && topRightProjected[0] >= -1 && topRightProjected[1] <= 1 && topRightProjected[1] >= -1) ||
      (bottomLeftProjected[0] <= 1 && bottomLeftProjected[0] >= -1 && bottomLeftProjected[1] <= 1 && bottomLeftProjected[1] >= -1) ||
      (bottomRightProjected[0] <= 1 && bottomRightProjected[0] >= -1 && bottomRightProjected[1] <= 1 && bottomRightProjected[1] >= -1) ||
      boxIntersect(topLeftProjected[0], topLeftProjected[1], bottomLeftProjected[0], bottomLeftProjected[1]) || // leftLine
      boxIntersect(bottomRightProjected[0], bottomRightProjected[1], topRightProjected[0], topRightProjected[1]) || // rightLine
      boxIntersect(bottomLeftProjected[0], bottomLeftProjected[1], bottomRightProjected[0], bottomRightProjected[1]) || // bottomLine
      boxIntersect(topRightProjected[0], topRightProjected[1], topLeftProjected[0], topLeftProjected[1]) // topLine
    ) {
      tiles.push([face, zoomLevel, x, y, hash])
      addSuroundingTiles(face, zoomLevel, x, y, tileSize, checkList, checkedTiles)
    }
  } while (checkList.length)

  // console.log('tiles', tiles)
  // console.log('zoom', zoomLevel)
  // we sort by id to avoid text filtering to awkwardly swap back and forth
  return tiles.sort((a, b) => { return a[4] - b[4] })
}

// check all 8 tiles around the current tile
function addSuroundingTiles (face, zoomLevel, x, y, tileSize, checkList, checkedTiles) {
  findTile(face, zoomLevel, x - 1, y + 1, tileSize, checkList, checkedTiles) // topLeft
  findTile(face, zoomLevel, x, y + 1, tileSize, checkList, checkedTiles) // top
  findTile(face, zoomLevel, x + 1, y + 1, tileSize, checkList, checkedTiles) // topRight
  findTile(face, zoomLevel, x + 1, y, tileSize, checkList, checkedTiles) // right
  findTile(face, zoomLevel, x + 1, y - 1, tileSize, checkList, checkedTiles) // bottomRight
  findTile(face, zoomLevel, x, y - 1, tileSize, checkList, checkedTiles) // bottom
  findTile(face, zoomLevel, x - 1, y - 1, tileSize, checkList, checkedTiles) // bottomLeft
  findTile(face, zoomLevel, x - 1, y, tileSize, checkList, checkedTiles) // left
}

// first check the face, x, y are correct.. update them if out of bounds
// if the we have not checked the tile yet, we add it to checked tiles and the checkList
function findTile (face, zoom, x, y, tileSize, checkList, checkedTiles) {
  while (x < 0 || x === tileSize || y < 0 || y === tileSize) [face, x, y] = updateFace(face, x, y, tileSize)
  const hash = tileHash(face, zoom, x, y)
  if (!checkedTiles.has(hash)) {
    checkedTiles.add(hash)
    checkList.push([face, x, y, hash])
  }
}

function boxIntersect (x1, y1, x2, y2) {
  if (
    lineIntersect(x1, y1, x2, y2, -1, -1, -1, 1) || // leftLineBox
    lineIntersect(x1, y1, x2, y2, 1, -1, 1, 1) || // rightLineBox
    lineIntersect(x1, y1, x2, y2, -1, -1, 1, -1) || // bottomLineBox
    lineIntersect(x1, y1, x2, y2, -1, 1, 1, 1) // topLineBox
  ) return true
  return false
}

function lineIntersect (x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
  if (!denom) return false
  const lambda = ((y4 - y3) * (x4 - x1) + (x3 - x4) * (y4 - y1)) / denom
  const gamma = ((y1 - y2) * (x4 - x1) + (x2 - x1) * (y4 - y1)) / denom
  return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1)
}

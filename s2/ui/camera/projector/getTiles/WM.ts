import { project } from '../mat4'
import { isOutOfBounds, llToTile, llToTilePx, neighborsXY, toID } from 'geometry/wm'
import { boxIntersects, pointBoundaries } from 'geometry'

import type Projector from '../'
import type { ZXY } from 'geometry'

// Due to the nature of the Web Mercator design,
// it's easiest to store an MVP matrix for each tile
//
// NOTE: Real World Tiles must be created/cached BEFORE creating out of bounds tiles
// as the out of bounds tiles will need to reference the real world tiles.
// So we sort all out of bounds tiles to the end of the list.
export default function getTilesInView (
  zoom: number,
  lon: number,
  lat: number,
  projector: Projector
): bigint[] {
  const { tileSize, duplicateHorizontally } = projector
  if (zoom < 1) zoom = 0
  const tiles = new Set<bigint>()
  const checkList: ZXY[] = []
  const checkedTiles = new Set<string>()
  zoom = zoom << 0 // move to whole number

  // let's find the current tile and store it
  const { x, y } = llToTile({ x: lon, y: lat }, zoom, tileSize)
  tiles.add(toID(zoom, x, y))
  // add the first set of neighbors
  addNeighbors(zoom, x, y, duplicateHorizontally, checkedTiles, checkList)

  while (checkList.length > 0) {
    // grab a tile to check and get its face and bounds
    const check = checkList.pop()
    if (check === undefined) break
    const [zCheck, xCheck, yCheck] = check
    // get the tiles matrix
    const matrix = tileMatrix(projector, zCheck, xCheck, yCheck)
    // project the four corners of the tile
    const bl = project(matrix, [0, 0, 0])
    const br = project(matrix, [1, 0, 0])
    const tl = project(matrix, [0, 1, 0])
    const tr = project(matrix, [1, 1, 0])
    // check if the tile is in view
    if (
      pointBoundaries(bl, br, tl, tr) ||
      boxIntersects(bl, br, tl, tr)
    ) {
      // if the tile is in view, add it to the list
      tiles.add(toID(zCheck, xCheck, yCheck))
      // add the surounding tiles we have not checked
      addNeighbors(zCheck, xCheck, yCheck, duplicateHorizontally, checkedTiles, checkList)
    }
  }

  return [...tiles]
    // first we sort by id to avoid text filtering to awkwardly swap back and forth
    .sort((a, b) => {
      if (a > b) return 1
      else if (a < b) return -1
      else return 0
    })
    // then we sort by real world tiles first and out of bounds tiles last
    .sort((a, b) => {
      if (isOutOfBounds(a)) return 1
      else if (isOutOfBounds(b)) return -1
      else return 0
    })
}

function addNeighbors (
  zoom: number,
  x: number,
  y: number,
  duplicateHorizontally: boolean,
  checkedTiles: Set<string>,
  checkList: ZXY[]
): void {
  // add the surounding tiles we have not checked
  for (const [nZoom, nX, nY] of neighborsXY(zoom, x, y, duplicateHorizontally)) {
    const zxy = `${String(nZoom)}-${String(nX)}-${String(nY)}`
    if (!checkedTiles.has(zxy)) {
      checkedTiles.add(zxy)
      checkList.push([nZoom, nX, nY])
    }
  }
}

function tileMatrix (
  projector: Projector,
  tileZoom: number,
  tileX: number,
  tileY: number
): Float32Array {
  const { zoom, lon, lat } = projector
  const scale = Math.pow(2, zoom - tileZoom)
  const offset = llToTilePx({ x: lon, y: lat }, [tileZoom, tileX, tileY], 1)

  return projector.getMatrix(scale, offset)
}

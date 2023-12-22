import { project } from '../mat4'
import { llToTile, llToTilePx, neighborsXY, toID } from 'geometry/webMerc'
import { boxIntersects, pointBoundaries } from 'geometry'

import type Projector from '../'

// Due to the nature of the Web Mercator design, it's easiest to store an MVP matrix for each tile
// because of this when

export default function getTilesInView (
  zoom: number,
  projector: Projector,
  lon: number,
  lat: number
): bigint[] {
  if (zoom < 1) return [0n]
  const tiles: bigint[] = []
  const checkList: Array<[number, number, number]> = []
  const checkedTiles = new Set<string>()
  zoom = zoom << 0 // move to whole number

  // let's find the current tile and store it
  const [x, y] = llToTile([lon, lat], zoom, projector.tileSize)
  tiles.push(toID(zoom, x, y))
  // add the first set of neighbors
  addNeighbors(zoom, x, y, checkedTiles, checkList)

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
      tiles.push(toID(zCheck, xCheck, yCheck))
      // add the surounding tiles we have not checked
      addNeighbors(zCheck, xCheck, yCheck, checkedTiles, checkList)
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
  zoom: number,
  x: number,
  y: number,
  checkedTiles: Set<string>,
  checkList: Array<[number, number, number]>
): void {
  // add the surounding tiles we have not checked
  for (const [nZoom, nX, nY] of neighborsXY(zoom, x, y)) {
    const zxy = `${String(nZoom)}-${String(nX)}-${String(nY)}`
    if (!checkedTiles.has(zxy)) {
      checkedTiles.add(zxy)
      checkList.push([nZoom, nX, nY])
    }
  }
}

function tileMatrix (projector: Projector, tileZoom: number, tileX: number, tileY: number): Float32Array {
  const { zoom, lon, lat } = projector
  const scale = Math.pow(2, zoom - tileZoom)
  const offset = llToTilePx([lon, lat], [tileZoom, tileX, tileY], 1)

  return projector.getMatrix(scale, offset)
}

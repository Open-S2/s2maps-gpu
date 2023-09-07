/** Convert zoom-x-y to a singular number */
export function toID (zoom: number, x: number, y: number): bigint {
  return BigInt((((1 << zoom) * y + x) * 32) + zoom)
}

/** Convert a number or bigint to [zoom, x, y] */
export function fromID (idB: bigint): [zoom: number, x: number, y: number] {
  let id = Number(idB)
  const z = id % 32
  id = (id - z) / 32
  const x = id % (1 << z)
  const y = (id - x) / (1 << z)

  return [z, x, y]
}

/** Given a tile ID, find the 4 children tile IDs */
export function children (
  id: bigint
): [blID: bigint, brID: bigint, tlID: bigint, trID: bigint] {
  const [zoom, x, y] = fromID(id)
  return [
    toID(zoom + 1, x * 2, y * 2),
    toID(zoom + 1, x * 2 + 1, y * 2),
    toID(zoom + 1, x * 2, y * 2 + 1),
    toID(zoom + 1, x * 2 + 1, y * 2 + 1)
  ]
}

/**
 * grab the tiles next to the current tiles zoom-x-y
 * only include adjacent tiles, not diagonal
 */
export function neighborsXY (
  zoom: number,
  x: number,
  y: number
): Array<[zoom: number, x: number, y: number]> {
  const neighbors: Array<[zoom: number, x: number, y: number]> = []
  if (x - 1 >= 0) neighbors.push([zoom, x - 1, y])
  if (x + 1 < (1 << zoom)) neighbors.push([zoom, x + 1, y])
  if (y - 1 >= 0) neighbors.push([zoom, x, y - 1])
  if (y + 1 < (1 << zoom)) neighbors.push([zoom, x, y + 1])
  return neighbors
}

/** Given a tileID, find the parent tile */
export function parent (id: bigint): bigint {
  const [z, x, y] = fromID(id)
  return toID(z - 1, Math.floor(x / 2), Math.floor(y / 2))
}

/**
 * convert an id to a zoom-x-y after setting it to a new parent zoom
 */
export function toIJ (id: bigint, level?: number | bigint): [zoom: number, i: number, j: number] {
  if (level !== undefined) {
    let [currentZoom] = fromID(id)
    while (level < currentZoom) {
      id = parent(id)
      currentZoom--
    }
  }
  return fromID(id)
}

/** Check if the parentID contains the childID within the sub quads */
export function contains (parentID: bigint, childID: bigint): boolean {
  const [pz, px, py] = fromID(parentID)
  const [cz, cx, cy] = fromID(childID)
  if (pz > cz) return false
  else if (pz === cz) return px === cx && py === cy
  else {
    const diff = cz - pz
    const mask = (1 << diff) - 1
    return (px === (cx & ~mask)) && (py === (cy & ~mask))
  }
}

/** Given a Tile ID, check if the zoom is 0 or not */
export function isFace (id: bigint): boolean {
  const [z] = fromID(id)
  return z === 0
}

/** Get the zoom from the tile ID */
export function level (id: bigint): number {
  const [z] = fromID(id)
  return z
}

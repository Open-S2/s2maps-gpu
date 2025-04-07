import type { ZXY } from '../proj.spec';
import { mod } from '../util';

/**
 * Convert zoom-x-y to a singular number
 * @param zoom
 * @param x
 * @param y
 */
export function toID(zoom: number, x: number, y: number): bigint {
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
 * Convert a number or bigint to [zoom, x, y]
 * @param idB
 */
export function fromID(idB: bigint): ZXY {
  const remainder = idB >> 65n;
  const adjustedX = zagzig(Number(remainder));
  idB = idB - (remainder << 65n);
  const z = idB % 32n;
  idB = (idB - z) / 32n;
  const x = idB % (1n << z);
  const y = (idB - x) / (1n << z);

  return [Number(z), Number(x) + adjustedX, Number(y)];
}

/**
 * Given a tile ID, find the 4 children tile IDs
 * @param id
 */
export function children(id: bigint): [blID: bigint, brID: bigint, tlID: bigint, trID: bigint] {
  const [zoom, x, y] = fromID(id);
  return [
    toID(zoom + 1, x * 2, y * 2),
    toID(zoom + 1, x * 2 + 1, y * 2),
    toID(zoom + 1, x * 2, y * 2 + 1),
    toID(zoom + 1, x * 2 + 1, y * 2 + 1),
  ];
}

/**
 * grab the tiles next to the current tiles zoom-x-y
 * only include adjacent tiles, not diagonal.
 * If includeOutOfBounds set to true, it will include out of bounds tiles
 * on the x-axis
 * @param zoom
 * @param x
 * @param y
 * @param includeOutOfBounds
 */
export function neighborsXY(zoom: number, x: number, y: number, includeOutOfBounds = false): ZXY[] {
  const size = 1 << zoom;
  const neighbors: ZXY[] = [];
  const xOutOfBounds = x < 0 || x >= size;
  if (x - 1 >= 0 || includeOutOfBounds) neighbors.push([zoom, x - 1, y]);
  if (x + 1 < size || includeOutOfBounds) neighbors.push([zoom, x + 1, y]);
  if (!xOutOfBounds && y - 1 >= 0) neighbors.push([zoom, x, y - 1]);
  if (!xOutOfBounds && y + 1 < size) neighbors.push([zoom, x, y + 1]);
  return neighbors;
}

/**
 * Check if the tile is not a real world tile that fits inside the quad tree
 * Out of bounds tiles exist if the map has `duplicateHorizontally` set to true.
 * This is useful for filling in the canvas on the x axis instead of leaving it blank.
 * @param id
 */
export function isOutOfBounds(id: bigint): boolean {
  const [zoom, x, y] = fromID(id);
  const size = 1 << zoom;
  return x < 0 || y < 0 || x >= size || y >= size;
}

/**
 * Given a tile ID, find the "wrapped" tile ID.
 * It may resolve to itself. This is useful for maps that have
 * `duplicateHorizontally` set to true. It forces the tile to be
 * within the bounds of the quad tree.
 * @param id
 */
export function tileIDWrapped(id: bigint): bigint {
  const [zoom, x, y] = fromID(id);
  const size = 1 << zoom;
  return toID(zoom, mod(x, size), mod(y, size));
}

/**
 * Given a tileID, find the parent tile
 * @param id
 */
export function parent(id: bigint): bigint {
  const [z, x, y] = fromID(id);
  return toID(z - 1, Math.floor(x / 2), Math.floor(y / 2));
}

/**
 * convert an id to a zoom-x-y after setting it to a new parent zoom
 * @param id
 * @param level
 */
export function toIJ(id: bigint, level?: number | bigint): ZXY {
  if (level !== undefined) {
    let [currentZoom] = fromID(id);
    while (level < currentZoom) {
      id = parent(id);
      currentZoom--;
    }
  }
  return fromID(id);
}

/**
 * Check if the parentID contains the childID within the sub quads
 * @param parentID
 * @param childID
 */
export function contains(parentID: bigint, childID: bigint): boolean {
  const [pz, px, py] = fromID(parentID);
  const [cz, cx, cy] = fromID(childID);
  if (pz > cz) return false;
  // Calculate the difference of child at the parent's level
  const diff = cz - pz;
  // check if x and y match adjusting child x,y to parent's level
  return px === cx >> diff && py === cy >> diff;
}

/**
 * Given a Tile ID, check if the zoom is 0 or not
 * @param id
 */
export function isFace(id: bigint): boolean {
  return fromID(id)[0] === 0;
}

/**
 * Get the zoom from the tile ID
 * @param id
 */
export function level(id: bigint): number {
  return fromID(id)[0];
}

/**
 * encode a number as always positive interweaving negative and postive values
 * @param n
 */
export function zigzag(n: number): number {
  return (n >> 31) ^ (n << 1);
}

/**
 * decode a number that was encoded with zigzag
 * @param n
 */
export function zagzig(n: number): number {
  return (n >> 1) ^ -(n & 1);
}

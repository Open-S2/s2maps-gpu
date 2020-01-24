// @flow
import Tile from './tile'

export default class TileCache extends Map<number, Tile> {
  maxCacheSize: number = 75 // assuming an average of 150kb per source & 2 sources per tile, this is 22.5 mb
  order: Array<number> = []
  constructor (maxCacheSize?: number) {
    super()
    if (maxCacheSize) this.maxCacheSize = maxCacheSize
  }

  set (tileHash: number, tile: Tile) {
    // place in front the new
    this.order.unshift(tileHash)
    while (this.order.length > this.maxCacheSize) this.delete(this.order.pop())
    return super.set(tileHash, tile)
  }

  get (tileHash: number): Tile {
    // update the place in the array and than get
    this.order.splice(this.order.indexOf(tileHash), 1)
    this.order.unshift(tileHash)
    return super.get(tileHash)
  }

  getBatch (tileHashes: Array<number>): Array<Tile> {
    const tiles: Array<Tile> = []
    for (const tileHash of tileHashes) {
      if (this.has(tileHash)) tiles.push(this.get(tileHash))
    }
    return tiles
  }

  delete (tileHash: number) {
    if (super.has(tileHash)) {
      const tile = super.get(tileHash)
      tile.destroy()
    }
    this.order.splice(this.order.indexOf(tileHash), 1)
    return super.delete(tileHash)
  }
}

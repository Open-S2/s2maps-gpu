// @flow
import { Tile } from '../../source'

export default class TileCache extends Map<BigInt, Tile> {
  maxCacheSize: number
  order: Array<number> = []
  constructor (maxCacheSize?: number = 100) {
    super()
    this.maxCacheSize = maxCacheSize
  }

  set (key: BigInt, tile: Tile) {
    // place in front the new
    this.order.unshift(key)
    while (this.order.length > this.maxCacheSize) this.delete(this.order[this.order.length - 1])
    return super.set(key, tile)
  }

  get (key: BigInt): Tile {
    // update the place in the array and than get
    this.order.splice(this.order.indexOf(key), 1)
    this.order.unshift(key)
    return super.get(key)
  }

  getBatch (keys: Array<BigInt>): Array<Tile> {
    const tiles: Array<Tile> = []
    for (const key of keys) {
      if (this.has(key)) tiles.push(this.get(key))
    }
    return tiles
  }

  delete (key: BigInt) {
    this.order.splice(this.order.indexOf(key), 1)
    const tile = super.get(key)
    if (tile && typeof tile.delete === 'function') tile.delete()
    return super.delete(key)
  }

  deleteAll () { // eslint-disable-next-line
    for (const [_, tile] of this) if (tile && typeof tile.delete === 'function') tile.delete()
    super.clear()
    this.order = []
  }
}

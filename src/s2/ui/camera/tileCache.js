// @flow
import { Tile } from '../../source'

export default class TileCache extends Map<number, Tile> {
  maxCacheSize: number
  order: Array<number>
  constructor (maxCacheSize?: number = 85) {
    super()
    this.maxCacheSize = maxCacheSize
    this.order = []
  }

  set (key: number, tile: Tile) {
    // place in front the new
    this.order.unshift(key)
    while (this.order.length > this.maxCacheSize) this._delete(this.order.pop())
    return super.set(key, tile)
  }

  get (key: number): Tile {
    // update the place in the array and than get
    this.order.splice(this.order.indexOf(key), 1)
    this.order.unshift(key)
    return super.get(key)
  }

  getBatch (keys: Array<number>): Array<Tile> {
    const tiles: Array<Tile> = []
    for (const key of keys) {
      if (this.has(key)) tiles.push(this.get(key))
    }
    return tiles
  }

  _delete (key: number) {
    this.order.splice(this.order.indexOf(key), 1)
    const tile = super.get(key)
    if (tile) tile.delete()
    return super.delete(key)
  }

  deleteAll () { // eslint-disable-next-line
    for (const [_, tile] of this) tile.delete()
    super.clear()
    this.order = []
  }
}

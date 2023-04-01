interface CachedObject {
  delete?: () => void
}

export default class Cache<U, T extends CachedObject> extends Map<U, T> {
  maxCacheSize: number
  order: U[] = []
  constructor (maxCacheSize = 100) {
    super()
    this.maxCacheSize = maxCacheSize
  }

  set (key: U, value: T): this {
    // place in front the new
    this.order.unshift(key)
    while (this.order.length > this.maxCacheSize) this.delete(this.order[this.order.length - 1])
    return super.set(key, value)
  }

  get (key: U): T | undefined {
    // update the place in the array and than get
    this.order.splice(this.order.indexOf(key), 1)
    this.order.unshift(key)
    return super.get(key)
  }

  getBatch (keys: U[]): T[] {
    const values: T[] = []
    for (const key of keys) {
      const value = this.get(key)
      if (value !== undefined) values.push(value)
    }
    return values
  }

  delete (key: U): boolean {
    this.order.splice(this.order.indexOf(key), 1)
    const value = super.get(key)
    if (value !== undefined && typeof value.delete === 'function') value.delete()
    return super.delete(key)
  }

  deleteAll (): void {
    for (const [, value] of this) {
      if (typeof value === 'object' && typeof value.delete === 'function') value.delete()
    }
    super.clear()
    this.order = []
  }
}

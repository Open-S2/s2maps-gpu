interface CachedObject {
  delete?: () => void
}

/** Cache that keeps the most recently used items and deletes the least recently used items */
export default class Cache<U, T extends CachedObject> extends Map<U, T> {
  maxCacheSize: number
  #order: U[] = []
  constructor (maxCacheSize = 15) {
    super()
    this.maxCacheSize = maxCacheSize
  }

  /** Set a value in the cache. If the cache is full, the least recently used item will be deleted */
  set (key: U, value: T): this {
    // place in front the new
    this.#order.unshift(key)
    while (this.#order.length > this.maxCacheSize) this.delete(this.#order[this.#order.length - 1])
    return super.set(key, value)
  }

  /** Get a value from the cache. If the value exists, it will be placed in the front of the cache */
  get (key: U): T | undefined {
    // update the place in the array and than get
    this.#order.splice(this.#order.indexOf(key), 1)
    this.#order.unshift(key)
    return super.get(key)
  }

  /** Get a batch of values from the cache. If the value exists, it will be placed in the front of the cache */
  getBatch (keys: U[]): T[] {
    const values: T[] = []
    for (const key of keys) {
      const value = this.get(key)
      if (value !== undefined) values.push(value)
    }
    return values
  }

  /** Get all values from the cache */
  getAll (): T[] {
    return this.getBatch(this.#order)
  }

  /** Delete a value from the cache */
  delete (key: U): boolean {
    this.#order.splice(this.#order.indexOf(key), 1)
    const value = super.get(key)
    value?.delete?.()
    return super.delete(key)
  }

  /** Delete all values from the cache */
  deleteAll (): void {
    for (const [, value] of this) value?.delete?.()
    super.clear()
    this.#order = []
  }
}

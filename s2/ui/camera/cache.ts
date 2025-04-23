/** The Value of the Cache assumes the object has a delete method */
interface CachedObject {
  delete?: () => void;
}

/** Cache that keeps the most recently used items and deletes the least recently used items */
export default class Cache<U, T extends CachedObject> extends Map<U, T> {
  maxCacheSize: number;
  #order: U[] = [];
  /** @param maxCacheSize - the maximum size of the cache */
  constructor(maxCacheSize = 100) {
    super();
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Set a value in the cache. If the cache is full, the least recently used item will be deleted
   * @param key - the key
   * @param value - the value
   * @returns sets the key-value and returns the cache
   */
  override set(key: U, value: T): this {
    // place in front the new
    this.#order.unshift(key);
    while (this.#order.length > this.maxCacheSize) this.delete(this.#order[this.#order.length - 1]);
    return super.set(key, value);
  }

  /**
   * Get a value from the cache. If the value exists, it will be placed in the front of the cache
   * @param key - the key
   * @returns the value or undefined if the value does not exist
   */
  override get(key: U): T | undefined {
    // update the place in the array and than get
    this.#order.splice(this.#order.indexOf(key), 1);
    this.#order.unshift(key);
    return super.get(key);
  }

  /**
   * Get a batch of values from the cache. If the value exists, it will be placed in the front of the cache
   * @param keys - the keys to get
   * @returns the values
   */
  getBatch(keys: U[]): T[] {
    const values: T[] = [];
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) values.push(value);
    }
    return values;
  }

  /** @returns all values from the cache */
  getAll(): T[] {
    return this.getBatch(this.#order);
  }

  /**
   * Delete a value from the cache
   * @param key - the key to delete
   * @returns true if the value was deleted
   */
  override delete(key: U): boolean {
    this.#order.splice(this.#order.indexOf(key), 1);
    const value = super.get(key);
    value?.delete?.();
    return super.delete(key);
  }

  /** Delete all values from the cache */
  deleteAll(): void {
    for (const [, value] of this) value?.delete?.();
    super.clear();
    this.#order = [];
  }
}

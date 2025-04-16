/**
 * # Cache System
 *
 * ## Description
 * A cache of values with a max size to ensure that too much old data is not stored.
 * The deletion system uses the FIFO policy
 *
 * ## Usage
 *
 * ```ts
 * import { Cache } from 'gis-tools-ts';
 *
 * const onDelete = (key: string, value: string) => {
 *   console.log(`Deleted key ${key} with value ${value}`);
 * };
 * const cache = new Cache<string, string>(10, onDelete);
 * cache.set('key', 'value');
 * console.log(cache.get('key')); // 'value'
 * cache.delete('key');
 * ```
 */
export class Cache<K, V> extends Map<K, V> {
  order: K[] = [];
  /**
   * @param maxSize - the max size of the cache before dumping old data
   * @param onDelete - if provided, will be called when a value is removed
   */
  constructor(
    private readonly maxSize: number,
    private onDelete?: (key: K, value: V) => void,
  ) {
    super();
  }

  /**
   * @param key - the offset position in the data
   * @param value - the value to store
   * @returns this
   */
  set(key: K, value: V): this {
    // if key exists, we just update the place in the array
    if (super.has(key)) this.order.splice(this.order.indexOf(key), 1);
    // add the key to the start of the array
    this.order.unshift(key);
    while (this.order.length > this.maxSize) this.delete(this.order.pop() as K);

    return super.set(key, value);
  }

  /**
   * @param key - the offset position in the data
   * @returns - the value if found
   */
  get(key: K): V | undefined {
    // update the place in the array and than get
    if (super.has(key)) {
      this.order.splice(this.order.indexOf(key), 1);
      this.order.unshift(key);
    }
    return super.get(key);
  }

  /**
   * @param key - the offset position in the data
   * @returns - true if found
   */
  delete(key: K): boolean {
    const value = super.get(key);
    if (value !== undefined && this.onDelete !== undefined) this.onDelete(key, value);
    return super.delete(key);
  }
}

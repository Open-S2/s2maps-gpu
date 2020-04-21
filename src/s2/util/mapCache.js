// @flow
export default class MapCache extends Map<number, any> {
  maxCacheSize: number
  order: Array<number>
  constructor (maxCacheSize?: number = 75) {
    super()
    this.maxCacheSize = maxCacheSize
    this.order = []
  }

  set (key: number, value: any) {
    // place in front the new
    this.order.unshift(key)
    while (this.order.length > this.maxCacheSize) this.delete(this.order.pop())
    return super.set(key, value)
  }

  get (key: number): any {
    // update the place in the array and than get
    this.order.splice(this.order.indexOf(key), 1)
    this.order.unshift(key)
    return super.get(key)
  }

  getBatch (keys: Array<number>): Array<any> {
    const data: Array<any> = []
    for (const key of keys) {
      if (this.has(key)) data.push(this.get(key))
    }
    return data
  }

  delete (key: number) {
    this.order.splice(this.order.indexOf(key), 1)
    return super.delete(key)
  }
}

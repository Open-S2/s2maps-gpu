// @flow
/* eslint-env browser */
import Source from './source'

import type { TileRequest } from '../workerPool'
import type { Face } from '../../../style/styleSpec'

const MAX_SIZE = 1_500_000 // ~1.5 MB
const NODE_SIZE = 10
const DIR_SIZE = 1_365 * NODE_SIZE // (13_650) -> 6 levels, the 6th level has both node and leaf (1+4+16+64+256+1024)*2 = 2_730
const ROOT_DIR_SIZE = DIR_SIZE * 6 // (81_900) -> 6 faces of 6 level directories + their leaves
const DB_METADATA_SIZE = ROOT_DIR_SIZE + 20 // (81_920) -> 6 faces of 6 level directories + their leaves + 20 bytes for the header

class DirCache extends Map<number, DataView> {
  order: Array<number> = []

  set (key: number, dir: DataView) {
    // place in front the new
    this.order.unshift(key)
    while (this.order.length > 7) this.delete(this.order.pop())
    return super.set(key, dir)
  }

  get (key: number): DataView {
    // update the place in the array and than get
    this.order.splice(this.order.indexOf(key), 1)
    this.order.unshift(key)
    return super.get(key)
  }

  delete (key: number) {
    return super.delete(key)
  }
}

export default class S2TilesSource extends Source {
  version: number = 1
  rootDir: { [Face]: DataView } = {}
  dirCache: DirCache = new DirCache()
  async build (mapID: string) {
    const self = this
    // fetch the metadata
    const ab = await this.getRange(`${this.path}?type=dir`, 0, DB_METADATA_SIZE, mapID)
    if (!ab || ab.byteLength !== DB_METADATA_SIZE) { // if the return is empty, we failed
      self.active = false
      console.log(`Failed to extrapolate ${this.path} metadata`)
    } else { // prep a data view, store in header, build metadata
      const dv = new DataView(ab, 0, 20)
      if (dv.getUint16(0, true) !== 12883) { // the first two bytes are S and 2, we validate
        self.active = false
        console.log(`Bad metadata from ${this.path}`)
      } else { // parse
        // grab the version
        this.version = dv.getUint16(2, true)
        // parse the JSON metadata length and offset
        const mL = dv.getUint32(4, true)
        const mO = getUint48(dv, 8)
        if (mL === 0 || mO === 0) { // if the metadata is empty, we failed
          self.active = false
          console.log(`Failed to extrapolate ${this.path} metadata`)
          return
        }
        // create root directories
        for (const face of [0, 1, 2, 3, 4, 5]) this.rootDir[face] = new DataView(ab, 20 + face * DIR_SIZE, DIR_SIZE)
        const metadata = await this.getRange(`${this.path}?type=metadata`, mO, mL, mapID, true)
        this._buildMetadata(metadata, mapID)
      }
    }
  }

  // Here, we use the memory mapped file directory tree system to find our data
  async _tileRequest (mapID: string, tile: TileRequest,
    sourceName: string, parent: false | Object, layerIndexes?: Array<number>) {
    const { type, encoding, session } = this
    const { face, id, zoom, i, j } = parent || tile

    // pull in the correct face's directory
    const dir = this.rootDir[face]
    // now we walk to the next directory as necessary
    const node = await this._walk(mapID, dir, zoom, i, j) // [offset, length]
    if (!node) return this._flush(mapID, id, sourceName)

    // we found the vector file, let's send the details off to the tile worker
    const data = await this.getRange(`${this.path}?type=tile&enc=${encoding}`, node[0], node[1], mapID)
    if (data) {
      const worker = session.requestWorker()
      worker.postMessage({ mapID, type: type === 'vector' ? 'pbfdata' : 'rasterdata', tile, sourceName, parent, data, layerIndexes }, [data])
    } else { return this._flush(mapID, id, sourceName) }
  }

  async _walk (mapID: string, dir: DataView, zoom: number, i: number, j: number): null | [number, number] {
    const { maxzoom } = this
    const path = getPath(zoom, i, j)
    let offset: number, length: number

    // walk the tree if past zoom 0
    while (path.length) {
      // grab position
      const nodePos = path.shift() * NODE_SIZE
      // set
      offset = getUint48(dir, nodePos)
      length = dir.getUint32(nodePos + 6, true)
      if (!length) return null
      // if we are still walking, grab the new directory
      if (path.length) {
        // corner case: if maxzoom matches the zoom and is divisible by 5, the leaf is actually a node
        if (maxzoom % 5 === 0 && zoom === maxzoom && path.length === 1 && path[0] === 0) {
          return [offset, length]
        }
        // otherwise fetch the directory
        dir = await this._getDir(mapID, offset, length)
        if (!dir) return null
      }
    }

    if (!length || length > MAX_SIZE) return null
    return [offset, length]
  }

  async _getDir (mapID: string, offset: number, length: number): null | DataView {
    if (this.dirCache.has(offset)) return this.dirCache.get(offset)
    const ab = await this.getRange(`${this.path}?type=dir`, offset, length, mapID)
    if (ab) {
      const dir = new DataView(ab)
      this.dirCache.set(offset, dir)
      return dir
    }
    return null
  }

  async getRange (url: string, offset: number, length: number, mapID: string, json?: boolean = false): Promise<ArrayBuffer | Object> {
    const { type } = this
    const headers = { Accept: 'application/x-protobuf,image/webp,application/json' }
    const bytes = offset + '-' + (offset + length - 1)
    const Authorization = this.needsToken && await this.session.requestSessionToken(mapID)
    if (Authorization) headers.Authorization = Authorization
    if (length === 0 || length > MAX_SIZE) return null
    const res = await fetch(`${url}&bytes=${bytes}&subtype=${type}`, { headers })
    if (res.status !== 200 && res.status !== 206) return null
    if (json) return res.json()
    return res.arrayBuffer()
  }
}

const getUint48 = (dataview: DataView, pos: number): number => {
  return dataview.getUint32(pos + 2, true) * (1 << 16) + dataview.getUint16(pos, true)
}

const getPath = (zoom: Number, x: Number, y: number): Array<number> => {
  const { max, pow } = Math
  const path = []

  // grab 6 bits at a time
  while (zoom >= 5) {
    // store at offset
    path.push([5, x & 31, y & 31])
    // adjust
    x >>= 5
    y >>= 5
    zoom = max(0, zoom - 5)
  }
  // store leftovers
  path.push([zoom, x, y])

  return path.map(([zoom, x, y]) => {
    let val = 0
    // adjust by position at current zoom
    val += y * (1 << zoom) + x
    // adjust by previous zoom tile sizes
    while (zoom--) val += pow(1 << zoom, 2)

    return val
  })
}

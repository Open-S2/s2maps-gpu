// @flow
import Source from './source'

const MAX_SIZE = 1_500_000 // ~1.5 MB
const ROOT_DIR_SIZE = 5_461 * 10 // (54_610) -> 7 levels, the 7th level is always a leaf (1+4+16+64+256+1024+4096)

export type RootDirectory = {
  0: DataView, // length => ROOT_DIR_SIZE
  1: DataView, // length => ROOT_DIR_SIZE
  2: DataView, // length => ROOT_DIR_SIZE
  3: DataView, // length => ROOT_DIR_SIZE
  4: DataView, // length => ROOT_DIR_SIZE
  5: DataView // length => ROOT_DIR_SIZE
}

export default class S2TilesSource extends Source {
  version: number = 1
  rootDir: RootDirectory = {}
  async build (token: string) {
    const self = this
    // fetch the metadata
    const ab = await this.getRange(`${this.path}?type=metadata`, 0, 327669, token)
    if (!ab || ab.byteLength !== 327669) { // if the return is empty, we failed
      self.active = false
      console.log(`Failed to extrapolate ${this.path} metadata`)
    } else { // prep a data view, store in header, build metadata
      const dv = new DataView(ab, 0, 9)
      if (dv.getUint16(0, true) !== 12883) { // the first two bytes are S and 2, we validate
        self.active = false
        console.log(`Bad metadata from ${this.path}`)
      } else { // parse
        // parse the header
        const mL = this._parseHeader(dv)
        // create root directories
        this.rootDir[0] = new DataView(ab, 9, ROOT_DIR_SIZE)
        this.rootDir[1] = new DataView(ab, 54619, ROOT_DIR_SIZE)
        this.rootDir[2] = new DataView(ab, 109229, ROOT_DIR_SIZE)
        this.rootDir[3] = new DataView(ab, 163839, ROOT_DIR_SIZE)
        this.rootDir[4] = new DataView(ab, 218449, ROOT_DIR_SIZE)
        this.rootDir[5] = new DataView(ab, 273059, ROOT_DIR_SIZE)
        const md = await this.getRange(`${this.path}?type=metadata`, 327669, mL, token)
        const metadata = JSON.parse(new TextDecoder('utf-8').decode(new DataView(md, 0, mL)))
        this._buildMetadata(metadata)
      }
    }
  }

  // grab the version, maxzoom, and metadata length
  _parseHeader (dataview): number {
    this.version = dataview.getUint16(2, true)
    this.maxzoom = dataview.getUint8(4, true)
    return dataview.getUint32(5, true)
  }

  // Here, we use the memory mapped file directory tree system to find our data
  async _tileRequest (mapID: string, token: string, tile: TileRequest, worker: Worker,
    sourceName: string, parent: false | Object) {
    const { name, s2json, type, encoding } = this
    let { face, zoom, x, y, hash } = parent ? parent : tile

    // pull in the correct face's directory
    let dir = this.rootDir[face]
    // now we walk to the next directory as necessary
    const path = getPath(zoom, x, y)
    for (const leaf of path) {
      if (leaf[0] === 6) dir = await this._walkPath(dir, leaf, token)
      else { zoom = leaf[0]; x = leaf[1]; y = leaf[2] }
      if (!dir) return this._flush(mapID, hash, sourceName)
    }
    // if we made it here, we need to pull out the node and read its [offset, length]
    const node = this._readNode(dir, zoom, x, y)
    if (!node) return this._flush(mapID, hash, sourceName)

    // we found the vector file, let's send the details off to the tile worker
    const data = await this.getRange(`${this.path}?type=tile&subtype=${type}&enc=${encoding}`, node[0], node[1], token)
    if (data) {
      worker.postMessage({ mapID, type: type === 'vector' ? 'pbfdata' : 'rasterdata', tile, sourceName, parent, data }, [data])
      // postMessage({ mapID, type: 'addsource', hash, sourceName })
    } else { return this._flush(mapID, hash, sourceName) }
  }

  // from a starting directory and leaf identifier, move to the next leaf directory
  // if said directory does not exist, we create it (assuming we are writing and not reading)
  async _walkPath (dir: DataView, leaf: [number, number, number], token: string): DataView {
    // pull position from leaf
    const [zoom, x, y] = leaf
    const newDir = this._readNode(dir, zoom, x, y)
    if (!newDir || newDir[1] === 0) return null // corner cases: length = 0 because that leaf does not exist
    // return the new directory
    const ab = await this.getRange(`${this.path}?type=dir`, newDir[0], newDir[1], token)
    if (ab) return new DataView(ab)
  }

  // read the [offset, length] at said node. Note, is NOT a leaf but directions to pulling in a tile
  _readNode (dir: DataView, zoom: number, x: number, y: number): [number, number] {
    const dirPos = getPos(zoom, x, y)
    // if the position is greater then size of the directory, return null (if maxzoom is 14, but tile request is 15+)
    if (dirPos > dir.byteLength) return null
    // read the nodes information
    const offset = getUint48(dir, dirPos)
    const length = dir.getUint32(dirPos + 6, true)

    return [offset, length]
  }

  async getRange (url: string, offset: number, length: number, Authorization?: string): ArrayBuffer {
    if (!this.needsToken) Authorization = null
    if (length === 0 || length > MAX_SIZE) return null
    const res = await fetch(url, { headers: { Authorization, Bytes: offset + '-' + (offset + length - 1) } })
    if (res.status !== 200 && res.status !== 206) return null
    return res.arrayBuffer()
  }
}

const getUint48 = (dataview: DataView, pos: number): number => {
  return dataview.getUint32(pos + 2, true) * (1 << 16) + dataview.getUint16(pos, true)
}

const getPos = (zoom: number, x: number, y: number): number => {
  const { pow } = Math
  let val = 0
  // adjust by position at current zoom
  val += y * (1 << zoom) + x
  // adjust by previous zoom tile sizes
  while (zoom--) val += pow(1 << zoom, 2)

  return val * 10 // 10 is the size of each offset+length
}

// looks a little ugly, but we track when the x or y positions are shifted in the quad tree
// then we work our way back down from the intermediary position to the original position
// but starting at [0, 0, 0] ensuring we re-add the x and y shifts.
const getPath = (zoom: number, x: number, y: number): Array<[number, number, number]> => {
  const path = []
  while (zoom > 6) {
    let dist = zoom % 6
    if (dist === 0) dist = 6
    const xs = []
    const ys = []
    do {
      xs.unshift((x % 2 !== 0) ? 1 : 0)
      ys.unshift((y % 2 !== 0) ? 1 : 0)
      zoom--
      x = x >> 1
      y = y >> 1
    } while (zoom % 6 !== 0)
    let interX = 0
    let interY = 0
    while (xs.length) {
      interX = interX * 2 + xs.shift()
      interY = interY * 2 + ys.shift()
    }
    path.unshift([dist, interX, interY])
  }
  // store the now root directory position
  if (zoom === 6) path.unshift([zoom, x, y])
  if (path.length && path[path.length - 1][0] === 6) path.push([0, 0, 0])

  return path
}

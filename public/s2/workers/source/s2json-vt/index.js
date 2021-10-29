// @flow
/** MODULES **/
import convert from './convert' // GeoJSON conversion and preprocessing
import clip from './clip'
import transformTile from './transform' // coordinate transformation
import createTile from './tile' // final simplified tile generation
/** TYPES **/
import type { Tile } from './tile'
import type { FeatureVector } from './feature'

type Options = {
  maxZoom: number, // max zoom to preserve detail on
  indexMaxZoom: number, // max zoom in the tile index
  indexMaxPoints: number, // max number of points per tile in the tile index
  tolerance: number, // simplification tolerance (higher means simpler)
  extent: number, // tile extent
  buffer: number, // tile extent is usually 4096x4096. However, we usually overdraw to ensure the data draws correctly
  promoteId: null | number, // name of a feature property to be promoted to feature.id
  generateId: boolean // whether to generate feature ids. Cannot be used with promoteId
}

export type Face = 0 | 1 | 2 | 3 | 4 | 5

export type Point = [number, number]

export type GeometryType = 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon'

export type Feature = {
  id?: number,
  type: 'S2Feature',
  face: Face,
  properties: Object,
  geometry: {
    type: GeometryType,
    coordinates: any,
  }
}

export type FeatureCollection = {
  type: 'S2FeatureCollection',
  features: Array<Feature>,
  faces: Array<Face>
}

export type Tiles = {
  [number]: Tile
}

export default class S2JsonVT {
  minZoom: number = 0
  maxZoom: number = 20
  faces: Set = new Set()
  indexMaxZoom: number = 4
  indexMaxPoints: number = 100000
  tolerance: number = 3
  extent: number = 8192
  buffer: number = 64
  promoteId: null | number = null
  generateId: boolean = false
  tiles: Tiles = {}
  constructor (data: Feature | FeatureCollection, options: Options) {
    // prep all values $FlowIgnore
    for (let key in options) this[key] = options[key]
    // sanity check
    if (this.maxZoom < 0 || this.maxZoom > 20) throw new Error('maxZoom should be in the 0-24 range')
    if (this.promoteId && this.generateId) throw new Error('promoteId and generateId cannot be used together.')
    // convert features
    let features: Array<FeatureVector> = convert(data, this)
    // organize features to faces
    const faces = [[], [], [], [], [], []]
    features.forEach(feature => faces[feature.face].push(feature))
    // for each face, start slicing from the top tile down
    for (let i = 0; i < 6; i++) {
      if (faces[i].length) {
        this.faces.add(i)
        this.splitTile(faces[i], i, 0, 0, 0)
      }
    }
  }

  splitTile (features: Array<FeatureVector>, face: Face, z: number, x: number,
    y: number, cz?: number, cx?: number, cy?: number) {
    const stack: Array<any> = [features, z, x, y]
    // avoid recxrsion by using a processing queue
    while (stack.length) {
      y = stack.pop()
      x = stack.pop()
      z = stack.pop()
      features = stack.pop()
      // prep variables
      const id = this.hash(face, z, x, y)
      let tile = this.tiles[id]
      // if the tile we need does not exist, we create it
      if (!tile) tile = this.tiles[id] = createTile(features, face, z, x, y, this)
      // stop tiling if it's the first-pass tiling, and we either reached max zoom or the tile is too simple
      if (!cz && (z === this.indexMaxZoom || tile.numPoints <= this.indexMaxPoints)) {
        continue
      } else if (z === this.maxZoom) { // stop tiling if we reached base zoom
        continue
      } else if (cz) {
        if (z === cz) continue // stop tiling if we reach our target tile zoom
        const m = 1 << (cz - z) // $FlowIgnore
        if (x !== Math.floor(cx / m) || y !== Math.floor(cy / m)) continue // stop tiling if it's not an ancestor of the target tile
      }
      // if we slice further down, no need to keep source geometry
      tile.source = null
      // dummy check: no features to clip
      if (features.length === 0) continue
      // acquire the new four tiles
      const [bl, br, tl, tr] = clip(features, tile, this)
      // push the new features to the stack
      stack.push(bl, z + 1, x * 2, y * 2)
      stack.push(tl, z + 1, x * 2, y * 2 + 1)
      stack.push(br, z + 1, x * 2 + 1, y * 2)
      stack.push(tr, z + 1, x * 2 + 1, y * 2 + 1)
    }
  }

  getTile (face: Face, z: number, x: number, y: number): Tile {
    if (z < 0 || z > 24) return null

    const id = this.hash(face, z, x, y)
    if (this.tiles[id]) return transformTile(this.tiles[id], this.extent)

    let z0 = z
    let x0 = x
    let y0 = y
    let parent

    while (!parent && z0 > 0) {
      z0--
      x0 = x0 >> 1
      y0 = y0 >> 1
      parent = this.tiles[this.hash(face, z0, x0, y0)]
    }

    if (!parent || !parent.source) return null

    this.splitTile(parent.source, face, z0, x0, y0, z, x, y)

    return this.tiles[id] ? transformTile(this.tiles[id], this.extent) : null
  }

  hash (f: Face, z: number, x: number, y: number): number {
    const tileLength = (1 << z)
    const tileSize = tileLength * tileLength
    const xyz = tileLength * (tileLength + x) + y
    return f * (tileSize) + tileSize + xyz
  }
}

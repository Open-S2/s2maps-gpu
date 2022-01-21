// @flow
/** MODULES **/
import { fromFace, isFace, level, face as getFace, parent as parentID, childrenIJ, contains } from 's2projection/s2CellID'
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
  [BigInt]: Tile
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
    // prep all values
    for (const key in options) this[key] = options[key]
    // sanity check
    if (this.maxZoom < 0 || this.maxZoom > 20) throw new Error('maxZoom should be in the 0-24 range')
    if (this.promoteId && this.generateId) throw new Error('promoteId and generateId cannot be used together.')
    // convert features
    const features: Array<FeatureVector> = convert(data, this)
    // organize features to faces
    const faces = [[], [], [], [], [], []]
    features.forEach(feature => faces[feature.face].push(feature))
    // for each face, start slicing from the top tile down
    for (let i = 0; i < 6; i++) {
      if (faces[i].length) {
        this.faces.add(i)
        this.splitTile(faces[i], fromFace(i))
      }
    }
  }

  splitTile (features: Array<FeatureVector>, id: BigInt, endID?: BigInt, endZoom?: number) {
    const stack: Array<any> = [features, id]
    // avoid recxrsion by using a processing queue
    while (stack.length) {
      const id = stack.pop()
      features = stack.pop()
      // prep variables
      let tile = this.tiles[id]
      // if the tile we need does not exist, we create it
      if (!tile) tile = this.tiles[id] = createTile(features, id, this)
      // 1: stop tiling if it's the first-pass tiling, and we either reached max zoom or the tile is too simple
      // 2: getTile splitTile; stop at currently needed maxzoom OR current tile does not include child
      // 3: OR stop tiling if we reached base zoom
      if (
        (!endID && (tile.zoom === this.indexMaxZoom || tile.numPoints <= this.indexMaxPoints)) || // 1
        (endID && (tile.zoom === endZoom || !contains(id, endID))) || // 2
        tile.zoom === this.maxZoom // 3
      ) continue
      // if we slice further down, no need to keep source geometry
      tile.source = null
      // dummy check: no features to clip
      if (features.length === 0) continue
      // acquire the new four tiles and four children
      const [bl, br, tl, tr] = clip(features, tile, this)
      const [blID, brID, tlID, trID] = childrenIJ(getFace(id), tile.zoom, tile.i, tile.j)
      // push the new features to the stack
      stack.push(bl, blID)
      stack.push(br, brID)
      stack.push(tl, tlID)
      stack.push(tr, trID)
    }
  }

  getTile (id: BigInt): Tile {
    const zoom = level(id)
    if (zoom < 0 || zoom > 24 || !this.faces.has(getFace(id))) return null
    if (this.tiles[id]) return transformTile(this.tiles[id], this.extent)

    let pID = id
    let parent
    while (!parent && !isFace(pID)) {
      pID = parentID(pID)
      parent = this.tiles[pID]
    }

    if (!parent || !parent.source) return null

    this.splitTile(parent.source, pID, id, zoom)

    return this.tiles[id] ? transformTile(this.tiles[id], this.extent) : null
  }
}

/** MODULES **/
import {
  childrenIJ,
  contains,
  fromFace,
  face as getFace,
  isFace,
  level,
  parent as parentID
} from 's2/projections/s2/s2CellID'
import convert from './convert' // GeoJSON conversion and preprocessing
import clip from './clip'
import transformTile from './transform' // coordinate transformation
import createTile from './tile' // final simplified tile generation
/** TYPES **/
import type { JSONTile, JSONVectorTile } from './tile'
import type { FeatureVector } from './feature'
import type { Face, S2Feature, S2FeatureCollection } from 's2/projections'

export interface Options {
  maxzoom?: number // max zoom to preserve detail on
  indexMaxzoom?: number // max zoom in the tile index
  indexMaxPoints?: number // max number of points per tile in the tile index
  tolerance?: number // simplification tolerance (higher means simpler)
  extent?: number // tile extent
  buffer?: number // tile extent is usually 4096x4096. However, we usually overdraw to ensure the data draws correctly
}

export type Tiles = Map<bigint, JSONTile>

type FaceSet = [
  FeatureVector[], // 0
  FeatureVector[], // 1
  FeatureVector[], // 2
  FeatureVector[], // 3
  FeatureVector[], // 4
  FeatureVector[] // 5
]

export default class S2JsonVT {
  minzoom = 0
  maxzoom: number
  faces: Set<Face> = new Set()
  indexMaxzoom: number
  indexMaxPoints: number
  tolerance: number
  extent: number
  buffer: number
  tiles: Tiles = new Map()
  constructor (data: S2Feature | S2FeatureCollection, options: Options = {}) {
    // prep initial values
    const { maxzoom, indexMaxzoom, indexMaxPoints, tolerance, extent, buffer } = options
    this.maxzoom = maxzoom ?? 20
    this.indexMaxzoom = indexMaxzoom ?? 4
    this.indexMaxPoints = indexMaxPoints ?? 100000
    this.tolerance = tolerance ?? 3
    this.extent = extent ?? 8_192
    this.buffer = buffer ?? 64
    // sanity check
    if (this.maxzoom < 0 || this.maxzoom > 20) throw new Error('maxzoom should be in the 0-24 range')
    // convert features
    const features: FeatureVector[] = convert(data, this)
    // organize features to faces
    const faces: FaceSet = [[], [], [], [], [], []]
    features.forEach(feature => faces[feature.face].push(feature))
    // for each face, start slicing from the top tile down
    for (let i = 0; i < 6; i++) {
      if (faces[i].length > 0) {
        this.faces.add(i as Face)
        this.splitTile(faces[i], fromFace(i as Face))
      }
    }
  }

  splitTile (features: FeatureVector[], id: bigint, endID?: bigint, endZoom?: number): void {
    const stack: Array<[FeatureVector[], bigint]> = [[features, id]]
    // avoid recxrsion by using a processing queue
    while (stack.length > 0) {
      const stackList = stack.pop()
      if (stackList === undefined) break
      const [features, id] = stackList
      // prep variables
      let tile = this.tiles.get(id)
      // if the tile we need does not exist, we create it
      if (tile === undefined) {
        tile = createTile(features, id, this)
        this.tiles.set(id, tile)
      }
      // 1: stop tiling if it's the first-pass tiling, and we either reached max zoom or the tile is too simple
      // 2: getTile splitTile; stop at currently needed maxzoom OR current tile does not include child
      // 3: OR stop tiling if we reached base zoom
      if (
        (endID === undefined && (tile.zoom === this.indexMaxzoom || tile.numPoints <= this.indexMaxPoints)) || // 1
        (endID !== undefined && (tile.zoom === endZoom || !contains(id, endID))) || // 2
        tile.zoom === this.maxzoom // 3
      ) continue
      // if we slice further down, no need to keep source geometry
      tile.source = undefined
      // dummy check: no features to clip
      if (features.length === 0) continue
      // acquire the new four tiles and four children
      const [bl, br, tl, tr] = clip(features, tile, this)
      const [blID, brID, tlID, trID] = childrenIJ(getFace(id), tile.zoom, tile.i, tile.j)
      // push the new features to the stack
      stack.push([bl, blID])
      stack.push([br, brID])
      stack.push([tl, tlID])
      stack.push([tr, trID])
    }
  }

  getTile (id: bigint): undefined | JSONVectorTile {
    const zoom = level(id)
    if (zoom < 0 || zoom > 24 || !this.faces.has(getFace(id))) return
    let tile = this.tiles.get(id)
    if (tile !== undefined) return transformTile(tile, this.extent)

    let pID = id
    let parent: undefined | JSONTile
    while (parent === undefined && !isFace(pID)) {
      pID = parentID(pID)
      parent = this.tiles.get(pID)
    }

    if (parent === undefined || parent.source === undefined) return
    this.splitTile(parent.source, pID, id, zoom)

    tile = this.tiles.get(id)
    return tile !== undefined ? transformTile(tile, this.extent) : undefined
  }
}

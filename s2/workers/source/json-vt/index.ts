/** MODULES **/
import {
  childrenIJ,
  contains,
  fromFace,
  face as getFace,
  isFace,
  level,
  parent as parentID
} from 'geometry/id'
import convert from './convert' // GeoJSON conversion and preprocessing
import clip from './clip'
import transformTile from './transform' // coordinate transformation
import createTile from './tile' // final simplified tile generation
/** TYPES **/
import type { JSONTile, JSONVectorTile } from './tile'
import type { FeatureVector } from './feature'
import type { Face, Feature, FeatureCollection, S2Feature, S2FeatureCollection } from 'geometry'
import type { Projection } from 'style/style.spec'

export type Tiles = Map<bigint, JSONTile>

type FaceSet = [
  FeatureVector[], // 0
  FeatureVector[], // 1
  FeatureVector[], // 2
  FeatureVector[], // 3
  FeatureVector[], // 4
  FeatureVector[] // 5
]

export default class JsonVT {
  minzoom = 0 // min zoom to preserve detail on
  maxzoom = 20 // max zoom to preserve detail on
  faces = new Set<Face>() // store which faces are active. 0 face could be entire WM projection
  indexMaxzoom = 4 // max zoom in the tile index
  indexMaxPoints = 100000 // max number of points per tile in the tile index
  tolerance = 3 // simplification tolerance (higher means simpler)
  extent = 8_192 // tile extent
  buffer = 64 // tile extent is usually 4096x4096. However, we usually overdraw to ensure the data draws correctly
  tiles: Tiles = new Map() // stores both WM and S2 tiles
  projection: Projection = 'S2'
  constructor (data: Feature | FeatureCollection | S2Feature | S2FeatureCollection) {
    // update projection
    if (data.type === 'Feature' || data.type === 'FeatureCollection') this.projection = 'WM'
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
        this.splitTile(faces[i], fromFace(this.projection, i as Face))
      }
    }
  }

  splitTile (features: FeatureVector[], id: bigint, endID?: bigint, endZoom?: number): void {
    const { projection } = this
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
        (endID !== undefined && (tile.zoom === endZoom || !contains(projection, id, endID))) || // 2
        tile.zoom === this.maxzoom // 3
      ) continue
      // if we slice further down, no need to keep source geometry
      tile.source = undefined
      // dummy check: no features to clip
      if (features.length === 0) continue
      // acquire the new four tiles and four children
      const [bl, br, tl, tr] = clip(features, tile, this)
      const [blID, brID, tlID, trID] = childrenIJ(projection, getFace(projection, id), tile.zoom, tile.i, tile.j)
      // push the new features to the stack
      stack.push([bl, blID])
      stack.push([br, brID])
      stack.push([tl, tlID])
      stack.push([tr, trID])
    }
  }

  getTile (id: bigint): undefined | JSONVectorTile {
    const { projection } = this
    const zoom = level(projection, id)
    if (zoom < 0 || zoom > 24 || !this.faces.has(getFace(projection, id))) return
    let tile = this.tiles.get(id)
    if (tile !== undefined) return transformTile(tile, this.extent)

    let pID = id
    let parent: undefined | JSONTile
    while (parent === undefined && !isFace(projection, pID)) {
      pID = parentID(projection, pID)
      parent = this.tiles.get(pID)
    }

    if (parent?.source === undefined) return
    this.splitTile(parent.source, pID, id, zoom)

    tile = this.tiles.get(id)
    return tile !== undefined ? transformTile(tile, this.extent) : undefined
  }
}
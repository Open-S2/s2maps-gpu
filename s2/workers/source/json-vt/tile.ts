/** MODULES **/
import { level, toIJ } from 'geometry/id'
import type JsonVT from '.'
/** TYPES **/
import type { Properties } from 'geometry'
import type { FeatureVector } from './feature'
import type {
  S2VectorGeometry,
  S2VectorLines,
  S2VectorMultiPoly,
  S2VectorPoints,
  S2VectorPoly
} from 's2-vector-tile'

export interface JSONVectorFeatureBase {
  extent: number
  properties: Properties
  loadGeometry?: () => S2VectorGeometry
  loadGeometryFlat: undefined
}

export interface JSONVectorPointsFeature extends JSONVectorFeatureBase {
  type: 1
  geometry: S2VectorPoints
}

export interface JSONVectorLinesFeature extends JSONVectorFeatureBase {
  type: 2
  geometry: S2VectorLines
}

export interface JSONVectorPolyFeature extends JSONVectorFeatureBase {
  type: 3
  geometry: S2VectorPoly
}

export interface JSONVectorMultiPolyFeature extends JSONVectorFeatureBase {
  type: 4
  geometry: S2VectorMultiPoly
}

export type JSONVectorFeature =
  JSONVectorPointsFeature | JSONVectorLinesFeature |
  JSONVectorPolyFeature | JSONVectorMultiPolyFeature

export interface VTFeatureBase {
  extent: number
  properties: Properties
}

export interface VTPointsFeature extends VTFeatureBase {
  type: 1
  geometry: number[]
}

export interface VTLinesFeature extends VTFeatureBase {
  type: 2
  geometry: number[][]
}

export interface VTPolyFeature extends VTFeatureBase {
  type: 3
  geometry: number[][]
}

export interface VTMultiPolyFeature extends VTFeatureBase {
  type: 4
  geometry: number[][][]
}

export type VTFeature =
  VTPointsFeature | VTLinesFeature |
  VTPolyFeature | VTMultiPolyFeature

export interface JSONLayer {
  extent: number
  features: JSONVectorFeature[] & VTFeature[]
  length: number
  feature?: (i: number) => JSONVectorFeature
}

export type JSONLayers = Record<string, JSONLayer>

export interface JSONTile {
  extent: number
  layers: JSONLayers
  numPoints: number
  numSimplified: number
  numFeatures: number
  source?: FeatureVector[]
  id: bigint
  zoom: number
  i: number
  j: number
  transformed: boolean
  minS: number
  minT: number
  maxS: number
  maxT: number
}

// data used by the engine
export interface JSONVectorTile {
  zoom: number
  i: number
  j: number
  layers: JSONLayers
  extent: number
}

export default function createTile (features: FeatureVector[], id: bigint, jsonVT: JsonVT): JSONTile {
  const { projection, maxzoom, extent } = jsonVT
  const zoom = level(projection, id)
  const [, i, j] = toIJ(projection, id, zoom)
  const tolerance = (zoom === maxzoom)
    ? 0
    : jsonVT.tolerance / ((1 << zoom) * extent)
  const tile: JSONTile = {
    extent,
    layers: {},
    numPoints: 0,
    numSimplified: 0,
    numFeatures: 0,
    source: features,
    id,
    zoom,
    i,
    j,
    transformed: false,
    minS: 2,
    minT: 2,
    maxS: -2,
    maxT: -2
  }
  // run through each feature, adding them with the right bbox
  const { min, max } = Math
  for (const feature of features) {
    tile.numFeatures++
    addFeature(tile, feature, tolerance)

    tile.minS = min(tile.minS, feature.minS)
    tile.minT = min(tile.minT, feature.minT)
    tile.maxS = max(tile.maxS, feature.maxS)
    tile.maxT = max(tile.maxT, feature.maxT)
  }

  return tile
}

function addFeature (tile: JSONTile, feature: FeatureVector, tolerance: number): void {
  const { type } = feature
  let simplified: number[] | number[][] | number[][][]

  if (type === 'Point' || type === 'MultiPoint') {
    simplified = [] as number[]
    for (let i = 0; i < feature.geometry.length; i += 3) {
      simplified.push(feature.geometry[i])
      simplified.push(feature.geometry[i + 1])
      tile.numPoints++
      tile.numSimplified++
    }
  } else if (type === 'LineString') {
    simplified = [] as number[][]
    addLine(simplified, feature.geometry, tile, tolerance, false, false)
  } else if (type === 'MultiLineString' || type === 'Polygon') {
    simplified = [] as number[][]
    for (let i = 0; i < feature.geometry.length; i++) {
      addLine(simplified, feature.geometry[i], tile, tolerance, type === 'Polygon', i === 0)
    }
  } else if (type === 'MultiPolygon') {
    simplified = [] as number[][][]
    for (let k = 0; k < feature.geometry.length; k++) {
      const polygon = feature.geometry[k]
      const polySimplified: number[][] = []
      for (let i = 0; i < polygon.length; i++) {
        addLine(polySimplified, polygon[i], tile, tolerance, true, i === 0)
      }
      simplified.push(polySimplified)
    }
  } else {
    return
  }

  if (simplified.length > 0) {
    const tileFeature = {
      extent: tile.extent,
      geometry: simplified,
      type: (type === 'MultiPolygon')
        ? 4
        : (type === 'Polygon')
            ? 3
            : type === 'LineString' || type === 'MultiLineString'
              ? 2
              : 1,
      properties: feature.properties
    }
    const layerName = feature.properties.__layer as string ?? 'default'
    if (tile.layers[layerName] === undefined) {
      tile.layers[layerName] = {
        extent: tile.extent,
        features: [],
        length: 0
      }
    }
    const layer = tile.layers[layerName]
    layer.features.push(tileFeature as any)
    layer.length++
  }
}

function addLine (
  result: number[][],
  geom: number[],
  tile: JSONTile,
  tolerance: number,
  isPolygon: boolean,
  isOuter: boolean
): void {
  const sqTolerance = tolerance * tolerance
  const size = geom.length / 3
  if (tolerance > 0 && (size < (isPolygon ? sqTolerance : tolerance))) {
    tile.numPoints += size
    return
  }

  const ring = []

  for (let i = 0; i < geom.length; i += 3) {
    if (tolerance === 0 || geom[i + 2] > sqTolerance) {
      tile.numSimplified++
      ring.push(geom[i])
      ring.push(geom[i + 1])
    }
    tile.numPoints++
  }

  if (isPolygon) rewind(ring, isOuter)
  result.push(ring)
}

function rewind (ring: number[], clockwise: boolean): void {
  let area = 0
  for (let i = 0, len = ring.length, j = len - 2; i < len; j = i, i += 2) {
    area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1])
  }
  if ((area > 0) === clockwise) {
    for (let i = 0, len = ring.length; i < len / 2; i += 2) {
      const s = ring[i]
      const t = ring[i + 1]
      ring[i] = ring[len - 2 - i]
      ring[i + 1] = ring[len - 1 - i]
      ring[len - 2 - i] = s
      ring[len - 1 - i] = t
    }
  }
}

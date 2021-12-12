// @flow
/** MODULES **/
import { toIJ, level } from '../../../geo/S2CellID'
import S2JsonVT from './'
/** TYPES **/
import type { Feature } from './'

export type VectorFeature = {
  id: null | number,
  geometry: Array<any>,
  type: number,
  properties: Object,
  loadGeometry: Function
}

export type Layer = {
  extent: number,
  features: Array<VectorFeature>,
  length: number,
  feature: Function
}

export type Tile = {
  extent: number,
  layers: { [string]: Layer },
  numPoints: number,
  numSimplified: number,
  numFeatures: number,
  source: null | Array<Feature>,
  id: BigInt,
  zoom: number,
  i: number,
  j: number,
  ori: number,
  transformed: boolean,
  minS: number,
  minT: number,
  maxS: number,
  maxT: number
}

export default function createTile (features: Array<Feature>, id: BigInt, s2jsonVT: S2JsonVT): Tile {
  const zoom = level(id)
  const [, i, j, ori] = toIJ(id, zoom)
  const tolerance = (zoom === s2jsonVT.maxZoom) ? 0 : s2jsonVT.tolerance / ((1 << zoom) * s2jsonVT.extent)
  const tile: Tile = {
    extent: s2jsonVT.extent,
    layers: {},
    numPoints: 0,
    numSimplified: 0,
    numFeatures: 0,
    source: features,
    id,
    zoom,
    i,
    j,
    ori,
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

function addFeature (tile: Tile, feature: Feature, tolerance: number) {
  const geom = feature.geometry
  const type = feature.type
  const simplified = []

  if (type === 'Point' || type === 'MultiPoint') {
    for (let i = 0; i < geom.length; i += 3) {
      simplified.push(geom[i])
      simplified.push(geom[i + 1])
      tile.numPoints++
      tile.numSimplified++
    }
  } else if (type === 'LineString') {
    addLine(simplified, geom, tile, tolerance, false, false)
  } else if (type === 'MultiLineString' || type === 'Polygon') {
    for (let i = 0; i < geom.length; i++) {
      addLine(simplified, geom[i], tile, tolerance, type === 'Polygon', i === 0)
    }
  } else if (type === 'MultiPolygon') {
    for (let k = 0; k < geom.length; k++) {
      const polygon = geom[k]
      const polySimplified = []
      for (let i = 0; i < polygon.length; i++) {
        addLine(polySimplified, polygon[i], tile, tolerance, true, i === 0)
      }
      simplified.push(polySimplified)
    }
  }

  if (simplified.length) {
    const tileFeature = {
      id: (feature.id) ? feature.id : null,
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
    const layerName = feature.properties._layer || 'default'
    if (!tile.layers[layerName]) {
      tile.layers[layerName] = {
        extent: tile.extent,
        features: [],
        length: 0
      }
    }
    const layer = tile.layers[layerName]
    layer.features.push(tileFeature)
    layer.length++
  }
}

function addLine (result: Array<number>, geom: Array<number>, tile: Tile,
  tolerance: number, isPolygon: boolean, isOuter: boolean) {
  const sqTolerance = tolerance * tolerance
  // $FlowIgnore
  if (tolerance > 0 && (geom.size < (isPolygon ? sqTolerance : tolerance))) {
    tile.numPoints += geom.length / 3
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
  // $FlowIgnore
  result.push(ring)
}

function rewind (ring: Array<number>, clockwise: boolean) {
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

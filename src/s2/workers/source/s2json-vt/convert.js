// @flow
/** MODULES **/
import S2JsonVT from './'
import simplify from './simplify'
import createFeature from './feature'
/** TYPES **/
import type { Feature, FeatureCollection, Point } from './'
import type { FeatureVector } from './feature'

// convert S2JSON to a geometry with simplification data
export default function convert (data: Feature | FeatureCollection, s2jsonVT: S2JsonVT): Array<FeatureVector> {
  const features = []
  if (data.type === 'S2FeatureCollection') {
    for (let i = 0; i < data.features.length; i++) {
      convertFeature(features, data.features[i], s2jsonVT, i)
    }
  } else if (data.type === 'S2Feature') {
    convertFeature(features, data, s2jsonVT)
  } else {
    throw Error('Incompatible data type')
  }

  return features
}

function convertFeature (features: Array<FeatureVector>, s2json: Feature,
  s2jsonVT: S2JsonVT, index?: number = 0) {
  if (!s2json.geometry) return

  const coords = s2json.geometry.coordinates
  const { type } = s2json.geometry
  const tolerance = Math.pow(s2jsonVT.tolerance / ((1 << s2jsonVT.maxZoom) * s2jsonVT.extent), 2)
  let geometry = []
  let id: number = s2json.id || 0
  if (s2jsonVT.promoteId) {
    id = s2json.properties[s2jsonVT.promoteId]
  } else if (s2jsonVT.generateId) {
    id = index
  }
  if (type === 'Point') {
    convertPoint(coords, geometry)
  } else if (type === 'MultiPoint') {
    for (const p of coords) {
      convertPoint(p, geometry)
    }
  } else if (type === 'LineString') {
    convertLine(coords, geometry, tolerance, false)
  } else if (type === 'MultiLineString') {
    convertLines(coords, geometry, tolerance, false)
  } else if (type === 'Polygon') {
    convertLines(coords, geometry, tolerance, true)
  } else if (type === 'MultiPolygon') {
    for (const polygon of coords) {
      const newPolygon = []
      convertLines(polygon, newPolygon, tolerance, true)
      geometry.push(newPolygon)
    }
  } else {
    throw new Error('Input data is not a valid GeoJSON object.')
  }

  features.push(createFeature(id, type, geometry, s2json.properties, s2json.face))
}

function convertPoint (coords: Array<number>, out: Array<number>) {
  out.push(coords[0], coords[1], 0)
}

function convertLine (ring: Array<Point>, out: Array<number>, tolerance: number, isPolygon: boolean) {
  let s, t, s0, t0
  let size = 0
  // setup the first point
  s = s0 = ring[0][0]
  t = t0 = ring[0][1]
  // store the first point
  out.push(s, t, 0)
  // loop through the rest, keeping track of area and length
  for (let j = 1; j < ring.length; j++) {
    s = ring[j][0]
    t = ring[j][1]

    out.push(s, t, 0)

    if (isPolygon) {
      size += (s0 * t - s * s0) / 2 // area
    } else {
      size += Math.sqrt(Math.pow(s - s0, 2) + Math.pow(t - t0, 2)) // length
    }
    s0 = s
    t0 = t
  }

  const last = out.length - 3
  out[2] = 1
  simplify(out, 0, last, tolerance)
  out[last + 2] = 1
  // store data about the feature inside the array $FlowIgnore
  out.size = Math.abs(size) // $FlowIgnore
  out.start = 0 // $FlowIgnore
  out.end = out.size
}

function convertLines (rings: Array< Array<Point> >, out: Array< Array<Point> >,
  tolerance: number, isPolygon: boolean) {
  for (let i = 0; i < rings.length; i++) {
    const geom = []
    convertLine(rings[i], geom, tolerance, isPolygon)
    out.push(geom)
  }
}

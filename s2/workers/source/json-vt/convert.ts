/** MODULES **/
import JsonVT from '.'
import simplify from './simplify'
import createFeature from './feature'
/** TYPES **/
import type { FeatureVector } from './feature'
import type { Feature, FeatureCollection, Point, S2Feature, S2FeatureCollection } from 's2/geometry'
import type { Projection } from 's2/style/style.spec'

// convert S2JSON to a geometry with simplification data
export default function convert (
  data: Feature | FeatureCollection | S2Feature | S2FeatureCollection,
  jsonVT: JsonVT
): FeatureVector[] {
  const features: FeatureVector[] = []
  if (data.type === 'S2FeatureCollection') {
    for (const feature of data.features) {
      convertFeature(features, feature, jsonVT, 'S2')
    }
  } else if (data.type === 'S2Feature') {
    convertFeature(features, data, jsonVT, 'S2')
  } else if (data.type === 'FeatureCollection') {
    for (const feature of data.features) {
      convertFeature(features, feature, jsonVT, 'WM')
    }
  } else if (data.type === 'Feature') {
    convertFeature(features, data, jsonVT, 'WM')
  } else {
    throw Error('Incompatible data type')
  }

  return features
}

function convertFeature (
  features: FeatureVector[],
  json: Feature | S2Feature,
  jsonVT: JsonVT,
  projection: Projection
): void {
  if (json.geometry === undefined) return

  const { type, coordinates } = json.geometry
  const tolerance = Math.pow(jsonVT.tolerance / ((1 << jsonVT.maxzoom) * jsonVT.extent), 2)
  const geometry: any = []
  if (type === 'Point') {
    convertPoint(coordinates, geometry as number[], projection)
  } else if (type === 'MultiPoint') {
    for (const p of coordinates) {
      convertPoint(p, geometry as number[], projection)
    }
  } else if (type === 'LineString') {
    convertLine(coordinates, geometry as number[], tolerance, projection)
  } else if (type === 'MultiLineString') {
    convertLines(coordinates, geometry as number[][], tolerance, projection)
  } else if (type === 'Polygon') {
    convertLines(coordinates, geometry as number[][], tolerance, projection)
  } else if (type === 'MultiPolygon') {
    for (const polygon of coordinates) {
      const newPolygon: number[][] = []
      convertLines(polygon, newPolygon, tolerance, projection)
      geometry.push(newPolygon)
    }
  } else {
    throw new Error('Input data is not a valid GeoJSON object.')
  }

  if (geometry.length > 0) {
    features.push(
      createFeature(type, geometry, json.properties, 'face' in json ? json.face : 0)
    )
  }
}

function convertPoint (coords: number[], out: number[], projection: Projection): void {
  out.push(projectX(coords[0], projection), projectY(coords[1], projection), 0)
}

function convertLine (
  ring: Point[],
  out: number[],
  tolerance: number,
  projection: Projection
): void {
  let s, t
  // setup the first point
  s = ring[0][0]
  t = ring[0][1]
  // store the first point
  out.push(projectX(s, projection), projectY(t, projection), 0)
  // loop through the rest, keeping track of area and length
  for (let j = 1; j < ring.length; j++) {
    s = ring[j][0]
    t = ring[j][1]

    out.push(projectX(s, projection), projectY(t, projection), 0)
  }

  const last = out.length - 3
  out[2] = 1
  simplify(out, 0, last, tolerance)
  out[last + 2] = 1
}

function convertLines (
  rings: Point[][],
  out: number[][],
  tolerance: number,
  projection: Projection
): void {
  for (let i = 0; i < rings.length; i++) {
    const geom: number[] = []
    convertLine(rings[i], geom, tolerance, projection)
    out.push(geom)
  }
}

function projectX (x: number, projection: Projection): number {
  if (projection === 'S2') return x
  return x / 360 + 0.5
}

function projectY (y: number, projection: Projection): number {
  if (projection === 'S2') return y
  const sin = Math.sin(y * Math.PI / 180)
  const y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI

  return y2 < 0 ? 0 : y2 > 1 ? 1 : y2
}

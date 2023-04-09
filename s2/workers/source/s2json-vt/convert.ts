/** MODULES **/
import S2JsonVT from '.'
import simplify from './simplify'
import createFeature from './feature'
/** TYPES **/
import type { FeatureVector } from './feature'
import type { Point, S2Feature, S2FeatureCollection } from 's2/geometry'

// convert S2JSON to a geometry with simplification data
export default function convert (
  data: S2Feature | S2FeatureCollection,
  s2jsonVT: S2JsonVT
): FeatureVector[] {
  const features: FeatureVector[] = []
  if (data.type === 'S2FeatureCollection') {
    for (let i = 0; i < data.features.length; i++) {
      convertFeature(features, data.features[i], s2jsonVT)
    }
  } else if (data.type === 'S2Feature') {
    convertFeature(features, data, s2jsonVT)
  } else {
    throw Error('Incompatible data type')
  }

  return features
}

function convertFeature (
  features: FeatureVector[],
  s2json: S2Feature,
  s2jsonVT: S2JsonVT
): void {
  if (s2json.geometry === undefined) return

  const { type, coordinates } = s2json.geometry
  const tolerance = Math.pow(s2jsonVT.tolerance / ((1 << s2jsonVT.maxzoom) * s2jsonVT.extent), 2)
  const geometry: any = []
  if (type === 'Point') {
    convertPoint(coordinates, geometry as number[])
  } else if (type === 'MultiPoint') {
    for (const p of coordinates) {
      convertPoint(p, geometry as number[])
    }
  } else if (type === 'LineString') {
    convertLine(coordinates, geometry as number[], tolerance)
  } else if (type === 'MultiLineString') {
    convertLines(coordinates, geometry as number[][], tolerance)
  } else if (type === 'Polygon') {
    convertLines(coordinates, geometry as number[][], tolerance)
  } else if (type === 'MultiPolygon') {
    for (const polygon of coordinates) {
      const newPolygon: number[][] = []
      convertLines(polygon, newPolygon, tolerance)
      geometry.push(newPolygon)
    }
  } else {
    throw new Error('Input data is not a valid GeoJSON object.')
  }

  if (geometry.length > 0) features.push(createFeature(type, geometry, s2json.properties, s2json.face))
}

function convertPoint (coords: number[], out: number[]): void {
  out.push(coords[0], coords[1], 0)
}

function convertLine (
  ring: Point[],
  out: number[],
  tolerance: number
): void {
  let s, t
  // setup the first point
  s = ring[0][0]
  t = ring[0][1]
  // store the first point
  out.push(s, t, 0)
  // loop through the rest, keeping track of area and length
  for (let j = 1; j < ring.length; j++) {
    s = ring[j][0]
    t = ring[j][1]

    out.push(s, t, 0)
  }

  const last = out.length - 3
  out[2] = 1
  simplify(out, 0, last, tolerance)
  out[last + 2] = 1
}

function convertLines (
  rings: Point[][],
  out: number[][],
  tolerance: number
): void {
  for (let i = 0; i < rings.length; i++) {
    const geom: number[] = []
    convertLine(rings[i], geom, tolerance)
    out.push(geom)
  }
}

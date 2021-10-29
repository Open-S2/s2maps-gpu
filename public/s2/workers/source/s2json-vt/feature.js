// @flow
/** TYPES **/
import type { Face, GeometryType, Point } from './'

export type FeatureVector = {
  id: null | number,
  type: GeometryType,
  geometry: Array<Point> | Array<Array<Point>>,
  properties: Object,
  face: Face,
  minS: number,
  minT: number,
  maxS: number,
  maxT: number
}

export default function createFeature (id?: null | number = null, type: GeometryType,
  geometry: Array<Point> | Array<Array<Point>>, properties: Object = {}, face: Face): FeatureVector {
  const feature: FeatureVector = {
    id,
    type,
    geometry,
    properties,
    face,
    minS: Infinity,
    minT: Infinity,
    maxS: -Infinity,
    maxT: -Infinity
  }
  calcBBox(feature)
  return feature
}

function calcBBox (feature: FeatureVector) {
  const { geometry, type } = feature

  if (type === 'Point' || type === 'MultiPoint' || type === 'LineString') {
    calcLineBBox(feature, geometry)
  } else if (type === 'Polygon' || type === 'MultiLineString') {
    for (const line of geometry) {
      calcLineBBox(feature, line)
    }
  } else if (type === 'MultiPolygon') {
    for (const polygon of geometry) {
      for (const line of polygon) {
        calcLineBBox(feature, line)
      }
    }
  }
}

function calcLineBBox (feature: FeatureVector, geometry: Array<any>) {
  for (let i = 0; i < geometry.length; i += 3) {
    feature.minS = Math.min(feature.minS, geometry[i])
    feature.minT = Math.min(feature.minT, geometry[i + 1])
    feature.maxS = Math.max(feature.maxS, geometry[i])
    feature.maxT = Math.max(feature.maxT, geometry[i + 1])
  }
}

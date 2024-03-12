/** TYPES **/
import type { Face, S2GeometryType } from 'geometry'
import type { Properties } from 'geometry/proj.spec'

export interface FeatureVectorBase {
  properties: Properties
  face: Face
  minS: number
  minT: number
  maxS: number
  maxT: number
}

export interface FeatureVectorPoint extends FeatureVectorBase {
  type: 'Point'
  geometry: number[]
}

export interface FeatureVectorMultiPoint extends FeatureVectorBase {
  type: 'MultiPoint'
  geometry: number[]
}

export interface FeatureVectorLineString extends FeatureVectorBase {
  type: 'LineString'
  geometry: number[]
}

export interface FeatureVectorMultiLineString extends FeatureVectorBase {
  type: 'MultiLineString'
  geometry: number[][]
}

export interface FeatureVectorPolygon extends FeatureVectorBase {
  type: 'Polygon'
  geometry: number[][]
}

export interface FeatureVectorMultiPolygon extends FeatureVectorBase {
  type: 'MultiPolygon'
  geometry: number[][][]
}

export type FeatureVector =
  FeatureVectorPoint | FeatureVectorMultiPoint | FeatureVectorLineString |
  FeatureVectorMultiLineString | FeatureVectorPolygon | FeatureVectorMultiPolygon

export default function createFeature (
  type: S2GeometryType,
  geometry: number[] | number[][] | number[][][],
  properties: Properties = {},
  face: Face
): FeatureVector {
  const feature = {
    type,
    geometry,
    properties,
    face,
    minS: Infinity,
    minT: Infinity,
    maxS: -Infinity,
    maxT: -Infinity
  }
  calcBBox(feature as FeatureVector)
  return feature as FeatureVector
}

function calcBBox (feature: FeatureVector): void {
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

function calcLineBBox (feature: FeatureVector, geometry: number[]): void {
  for (let i = 0; i < geometry.length; i += 3) {
    feature.minS = Math.min(feature.minS, geometry[i])
    feature.minT = Math.min(feature.minT, geometry[i + 1])
    feature.maxS = Math.max(feature.maxS, geometry[i])
    feature.maxT = Math.max(feature.maxT, geometry[i + 1])
  }
}

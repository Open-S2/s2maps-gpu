import type { Properties } from '../proj.spec'

export const kLimitIJ = 1 << 30

export type Face = 0 | 1 | 2 | 3 | 4 | 5

/** S2 GEOMETRY **/

export interface S2FeatureCollection {
  type: 'S2FeatureCollection'
  features: S2Feature[]
  faces: Face[]
}

export interface S2Feature {
  type: 'S2Feature'
  id?: number
  face: Face
  properties: Properties
  geometry: S2Geometry
}

export type S2GeometryType =
  'Point' | 'MultiPoint' | 'LineString' |
  'MultiLineString' | 'Polygon' | 'MultiPolygon'
export type S2Geometry =
  S2PointGeometry | S2MultiPointGeometry | S2LineStringGeometry |
  S2MultiLineStringGeometry | S2PolygonGeometry | S2MultiPolygonGeometry

// [s, t]
export type S2Point = [s: number, t: number]
export type S2MultiPoint = S2Point[]
export type S2LineString = S2Point[]
export type S2MultiLineString = S2LineString[]
export type S2Polygon = S2Point[][]
export type S2MultiPolygon = S2Polygon[]

export interface S2PointGeometry {
  type: 'Point'
  coordinates: S2Point
}

export interface S2MultiPointGeometry {
  type: 'MultiPoint'
  coordinates: S2MultiPoint
}

export interface S2LineStringGeometry {
  type: 'LineString'
  coordinates: S2LineString
}

export interface S2MultiLineStringGeometry {
  type: 'MultiLineString'
  coordinates: S2MultiLineString
}

export interface S2PolygonGeometry {
  type: 'Polygon'
  coordinates: S2Polygon
}

export interface S2MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: S2MultiPolygon
}

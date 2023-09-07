import type { Properties } from '../proj.spec'

export type Sources = '900913' | 'WGS84'

/** GEOMETRY **/

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export interface Feature {
  type: 'Feature'
  id?: number
  properties: Properties
  geometry: Geometry
}

export type GeometryType =
  'Point' | 'MultiPoint' | 'LineString' |
  'MultiLineString' | 'Polygon' | 'MultiPolygon'
export type Geometry =
  PointGeometry | MultiPointGeometry | LineStringGeometry |
  MultiLineStringGeometry | PolygonGeometry | MultiPolygonGeometry

// [x, y]
export type Point = [x: number, y: number]
export type MultiPoint = Point[]
export type LineString = Point[]
export type MultiLineString = LineString[]
export type Polygon = Point[][]
export type MultiPolygon = Polygon[]

export interface PointGeometry {
  type: 'Point'
  coordinates: Point
}

export interface MultiPointGeometry {
  type: 'MultiPoint'
  coordinates: MultiPoint
}

export interface LineStringGeometry {
  type: 'LineString'
  coordinates: LineString
}

export interface MultiLineStringGeometry {
  type: 'MultiLineString'
  coordinates: MultiLineString
}

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Polygon
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: MultiPolygon
}

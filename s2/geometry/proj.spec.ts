import type { Feature, FeatureCollection, S2Feature, S2FeatureCollection } from 'geometry'

export type JSONFeatures = Feature | FeatureCollection | S2Feature | S2FeatureCollection
export type JSONFeatureCollection = FeatureCollection | S2FeatureCollection

export type BBox = [left: number, bottom: number, right: number, top: number]

export type Point = [x: number, y: number]

export type FaceIJ = [face: number, i: number, j: number]

export type ZXY = [zoom: number, x: number, y: number]

export type XYZ = [x: number, y: number, z: number]

export type Value = string | number | boolean | null

export type Properties = Record<string, Value | unknown>

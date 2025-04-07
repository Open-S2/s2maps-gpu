import type { Feature, FeatureCollection, S2Feature, S2FeatureCollection } from 'geometry';

/**
 *
 */
export type JSONFeatures = Feature | FeatureCollection | S2Feature | S2FeatureCollection;
/**
 *
 */
export type JSONFeatureCollection = FeatureCollection | S2FeatureCollection;

/**
 * A BBOX is defined in lon-lat space and helps with zooming motion to
 * see the entire line or polygon
 */
export type BBox = [left: number, bottom: number, right: number, top: number];
/**
 * A BBOX is defined in lon-lat space and helps with zooming motion to
 * see the entire 3D line or polygon
 */
export type BBox3D = [
  left: number,
  bottom: number,
  right: number,
  top: number,
  near: number,
  far: number,
];

/**
 * The new OpenVectorTile type can create complex nested objects.
 * May either be a string, number, boolean, null, an array of those types, or an object of those types
 * Object keys are always strings, values can be any basic type, an array, or a nested object.
 */
export type Value = string | number | boolean | null | Value[] | { [key: string]: Value };

/**
 * Some components inside the OpenVectorTile spec require the starting with an object of key-value pairs.
 * `MValues`and `feature properties` are such a case.
 */
export type Properties = Record<string, Value>;

/**
 * Can be an x,y but also may contain an MValue if the geometry is
 * a line or polygon
 */
export interface Point {
  x: number;
  y: number;
  m?: Properties;
}
/**
 * Can be an x,y,z but also may contain an MValue if the geometry
 * is a line or polygon
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
  m?: Properties;
}

/**
 *
 */
export type FlatPoint = [x: number, y: number];

/**
 *
 */
export type FlatPoint3D = [x: number, y: number, z: number];

/**
 *
 */
export type FaceIJ = [face: number, i: number, j: number];

/**
 *
 */
export type ZXY = [zoom: number, x: number, y: number];

/**
 *
 */
export type XYZ = [x: number, y: number, z: number];

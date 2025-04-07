import { fromST, toLonLat } from './s2Point';

import type { Face, S2Feature, S2Geometry } from './s2Proj.spec';
import type { Feature, Geometry } from '../wm/mercProj.spec';

/**
 * Convet an S2Feature to a GeoJSON Feature
 * @param data
 */
export function toWM(data: S2Feature): Feature {
  const { face, properties, geometry } = data;
  return {
    type: 'Feature',
    properties,
    geometry: convertGeometry(face, geometry),
  };
}

/**
 * Underlying conversion mechanic to move S2Geometry to GeoJSON Geometry
 * @param face
 * @param geometry
 */
function convertGeometry(face: Face, geometry: S2Geometry): Geometry {
  const { type, coordinates } = geometry;
  if (type === 'Point') {
    const [s, t] = coordinates;
    const [lon, lat] = toLonLat(fromST(face, s, t));
    return {
      type: 'Point',
      coordinates: [lon, lat],
    };
  } else {
    throw new Error('Either the conversion is not yet supported or Invalid S2Geometry type.');
  }
}

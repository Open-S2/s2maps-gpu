import { fromLonLat, toST } from 'geometry/s2/s2Point'

import type { Feature, Geometry } from './mercProj.spec'
import type { Face, S2Feature, S2Geometry } from '../s2/s2Proj.spec'

/** Convet a GeoJSON Feature to an S2Feature */
export function toS2 (data: Feature): S2Feature {
  const { geometry, face } = convertGeometry(data.geometry)
  return {
    type: 'S2Feature',
    face,
    properties: data.properties,
    geometry
  }
}

/** Underlying conversion mechanic to move GeoJSON Geometry to S2Geometry */
function convertGeometry (geometry: Geometry): { geometry: S2Geometry, face: Face } {
  const { type, coordinates } = geometry
  if (type === 'Point') {
    const [lon, lat] = coordinates
    const [face, s, t] = toST(fromLonLat(lon, lat))
    return {
      face,
      geometry: {
        type: 'Point',
        coordinates: [s, t]
      }
    }
  } else {
    throw new Error('Either the conversion is not yet supported or Invalid S2Geometry type.')
  }
}

import { fromST, toLonLat } from 'geometry/s2/s2Point'

import type { Face, S2Feature, S2Geometry } from './s2Proj.spec'
import type { Feature, Geometry } from '../webMerc/mercProj.spec'

export function toWM (data: S2Feature): Feature {
  const { face, properties, geometry } = data
  return {
    type: 'Feature',
    properties,
    geometry: convertGeometry(face, geometry)
  }
}

function convertGeometry (face: Face, geometry: S2Geometry): Geometry {
  const { type, coordinates } = geometry
  if (type === 'Point') {
    const [s, t] = coordinates
    const [lon, lat] = toLonLat(fromST(face, s, t))
    return {
      type: 'Point',
      coordinates: [lon, lat]
    }
  } else {
    throw new Error('Either the conversion is not yet supported or Invalid S2Geometry type.')
  }
}

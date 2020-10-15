// @flow
import type { TileRequest } from '../tile.worker'

// this builds a default tile structure with properties relating to the specific tile asked
export default function buildTile (tile: TileRequest) {
  const { hash, face, zoom, x, y } = tile

  return {
    layers: {
      'boundary': {
        extent: 4096,
        length: 1,
        feature: () => {
          return {
            properties: { hash, face, zoom, x, y },
            type: 3, // Polygon
            loadGeometry: () => { return [[[0, 0], [4096, 0], [4096, 4096], [0, 4096], [0, 0]]] }
          }
        }
      },
      'name': {
        extent: 4096,
        length: 1,
        feature: () => {
          return {
            properties: { hash, face, zoom, x, y },
            type: 1, // Point
            loadGeometry: () => { return [[0, 4096]] }
          }
        }
      }
    }
  }
}

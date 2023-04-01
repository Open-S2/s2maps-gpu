/* eslint-env worker */
import type { TileRequest } from '../worker.spec'

export interface LocalTile {
  layers: {
    boundary: {
      extent: 8_192
      length: 1
      feature: Function
    }
    name: {
      extent: 8_192
      length: 1
      feature: Function
    }
  }
}

export default class LocalSource {
  name = 'local'
  isTimeFormat = false
  styleLayers: undefined
  build (): void { /* no-op */ }

  tileRequest (_mapID: string, tile: TileRequest): LocalTile {
    const { id, face, zoom, i, j } = tile

    return {
      layers: {
        boundary: {
          extent: 8_192,
          length: 1,
          feature: () => {
            return {
              properties: { id, face, zoom, i, j },
              type: 3, // Polygon
              loadGeometry: () => { return [[[0, 0], [8_192, 0], [8_192, 8_192], [0, 8_192], [0, 0]]] }
            }
          }
        },
        name: {
          extent: 8_192,
          length: 1,
          feature: () => {
            return {
              properties: { id, face, zoom, i, j },
              type: 1, // Point
              loadGeometry: () => { return [[4096, 4096]] }
            }
          }
        }
      }
    }
  }
}

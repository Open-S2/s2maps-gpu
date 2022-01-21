// @flow
/* eslint-env worker */
import type { TileRequest } from '../workerPool'

export type LocalTile = {
  layers: {
    boundary: {
      extent: 8192,
      length: 1,
      feature: Function
    },
    name: {
      extent: 8192,
      length: 1,
      feature: Function
    }
  }
}

export default class LocalSource {
  build () {}

  tileRequest (mapID: string, tile: TileRequest): LocalTile {
    const { id, face, zoom, i, j } = tile

    return {
      layers: {
        boundary: {
          extent: 8192,
          length: 1,
          feature: () => {
            return {
              properties: { id, face, zoom, i, j },
              type: 3, // Polygon
              loadGeometry: () => { return [[[0, 0], [8192, 0], [8192, 8192], [0, 8192], [0, 0]]] }
            }
          }
        },
        name: {
          extent: 8192,
          length: 1,
          feature: () => {
            return {
              properties: { id, face, zoom, i, j },
              type: 1, // Point
              loadGeometry: () => { return [[0, 8192]] }
            }
          }
        }
      }
    }
  }
}

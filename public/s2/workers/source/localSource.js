// @flow
export default class LocalSource {
  build () {}

  tileRequest (mapID: string, tile: TileRequest) {
    const { hash, face, zoom, x, y } = tile

    return {
      layers: {
        'boundary': {
          extent: 8192,
          length: 1,
          feature: () => {
            return {
              properties: { hash, face, zoom, x, y },
              type: 3, // Polygon
              loadGeometry: () => { return [[[0, 0], [8192, 0], [8192, 8192], [0, 8192], [0, 0]]] }
            }
          }
        },
        'name': {
          extent: 8192,
          length: 1,
          feature: () => {
            return {
              properties: { hash, face, zoom, x, y },
              type: 1, // Point
              loadGeometry: () => { return [[0, 8192]] }
            }
          }
        }
      }
    }
  }
}

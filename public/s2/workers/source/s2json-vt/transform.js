// @flow
/** TYPES **/
import type { Tile } from './tile'
// Transforms the coordinates of each feature in the given tile from
// uv-projected space into (extent x extent) tile space.
export default function transformTile (tile: Tile, extent: number): Tile {
  if (!tile.transformed) {
    const zoom = 1 << tile.z
    const tx = tile.x
    const ty = tile.y

    for (const layer in tile.layers) {
      for (const feature of tile.layers[layer].features) {
        const { geometry, type } = feature

        let newGeometry = []

        if (type === 1) { // point or MultiPoint
          for (let j = 0; j < geometry.length; j += 2) {
            newGeometry.push(transformPoint(geometry[j], geometry[j + 1], extent, zoom, tx, ty))
          }
        } else if (type === 4) { // MultiPolygon
          for (let p = 0, gl = geometry.length; p < gl; p++) {
            const polygon = geometry[p]
            const newPoly = []
            for (let j = 0, pl = polygon.length; j < pl; j++) {
              const ring = []
              for (let k = 0; k < polygon[j].length; k += 2) {
                ring.push(transformPoint(polygon[j][k], polygon[j][k + 1], extent, zoom, tx, ty))
              }
              if (j === 0 || (j > 0 && ring.length >= 4)) newPoly.push(ring)
            }
            if (newPoly[0].length >= 4) newGeometry.push(newPoly) // ignore polygons that are not big enough
          }
        } else { // LineString, MultiLineString, or Polygon
          for (let j = 0, gl = geometry.length; j < gl; j++) {
            const ring = []
            for (let k = 0, rl = geometry[j].length; k < rl; k += 2) {
              ring.push(transformPoint(geometry[j][k], geometry[j][k + 1], extent, zoom, tx, ty))
            }
            newGeometry.push(ring)
          }
          if (type === 3 && newGeometry[0].length < 4) newGeometry = []
        }

        feature.geometry = newGeometry
      }
    }

    tile.transformed = true
  }

  const { face, z, x, y, layers } = tile
  return { face, zoom: z, x, y, layers, extent }
}

function transformPoint (x: number, y: number, extent: number, zoom: number,
  tx: number, ty: number): [number, number] {
  return [
    Math.round(extent * (x * zoom - tx)),
    Math.round(extent * (y * zoom - ty))
  ]
}

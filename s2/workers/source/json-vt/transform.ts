/** TYPES **/
import type { JSONTile, JSONVectorTile } from './tile'
import type { Point } from 'geometry'
// Transforms the coordinates of each feature in the given tile from
// uv-projected space into (extent x extent) tile space.
export default function transformTile (tile: JSONTile, extent: number): JSONVectorTile {
  if (!tile.transformed) {
    const zoom = 1 << tile.zoom
    const ti = tile.i
    const tj = tile.j
    const { layers } = tile

    for (const l in layers) {
      const layer = layers[l]
      for (const feature of layer.features) {
        const { type } = feature

        let newGeometry = []

        if (type === 1) { // point or MultiPoint
          const geometry = feature.geometry as number[]
          for (let j = 0; j < geometry.length; j += 2) {
            newGeometry.push(transformPoint(geometry[j], geometry[j + 1], extent, zoom, ti, tj))
          }
        } else if (type === 4) { // MultiPolygon
          const geometry = feature.geometry as number[][][]
          for (let p = 0, gl = geometry.length; p < gl; p++) {
            const polygon = geometry[p]
            const newPoly = []
            for (let j = 0, pl = polygon.length; j < pl; j++) {
              const ring = []
              for (let k = 0; k < polygon[j].length; k += 2) {
                ring.push(transformPoint(polygon[j][k], polygon[j][k + 1], extent, zoom, ti, tj))
              }
              if (j === 0 || (j > 0 && ring.length >= 4)) newPoly.push(ring)
            }
            if (newPoly[0].length >= 4) newGeometry.push(newPoly) // ignore polygons that are not big enough
          }
        } else { // LineString, MultiLineString, or Polygon
          const geometry = feature.geometry as number[][]
          for (let j = 0, gl = geometry.length; j < gl; j++) {
            const ring = []
            for (let k = 0, rl = geometry[j].length; k < rl; k += 2) {
              ring.push(transformPoint(geometry[j][k], geometry[j][k + 1], extent, zoom, ti, tj))
            }
            if (j === 0 || (type === 3 && j > 0 && ring.length >= 4)) {
              newGeometry.push(ring)
            }
          }
          if (type === 3 && newGeometry[0].length <= 4) newGeometry = []
        }

        feature.geometry = newGeometry as any
      }
      layer.features = layer.features.filter(f => f.geometry.length > 0) as any
    }

    tile.transformed = true
  }

  const { zoom, i, j, layers } = tile
  return { zoom, i, j, layers, extent }
}

function transformPoint (
  i: number,
  j: number,
  extent: number,
  zoom: number,
  ti: number,
  tj: number
): Point {
  const { round } = Math
  return [
    round(extent * (i * zoom - ti)),
    round(extent * (j * zoom - tj))
  ]
}

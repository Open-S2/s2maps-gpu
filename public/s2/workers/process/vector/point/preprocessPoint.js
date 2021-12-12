// @flow
import type { Feature } from ''

export default function preprocessPoint (feature: Feature, zoom: number) {
  const { extent, properties, geometry, vertices, indices, sourceLayer } = feature
  const weight = (sourceLayer.type === 'heatmap') && sourceLayer.layoutLocal.weight(null, properties, zoom)
  // create multiplier
  const multiplier = 8192 / extent
  // if weight, then it is a heatmap and we add weight data
  const { round } = Math
  if (weight) {
    for (const point of geometry) {
      vertices.push(round(point[0] * multiplier), round(point[1] * multiplier))
      indices.push(weight)
    }
  } else {
    for (const point of geometry) vertices.push(round(point[0] * multiplier), round(point[1] * multiplier))
  }
}

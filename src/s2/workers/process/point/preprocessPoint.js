// @flow
type Point = [number, number]

export default function preprocessPoint (geometry: Array<Point>,
  vertices: Array<number>, weights: Array<number>, extent: number, weight?: number) {
  // edge case: no geometry
  if (!geometry.length) return
  // create multiplier
  const multiplier = 8192 / extent
  // if weight, then it is a heatmap and we add weight data
  const { round } = Math
  if (weight) {
    for (let point of geometry) {
      vertices.push(round(point[0] * multiplier), round(point[1] * multiplier))
      weights.push(weight)
    }
  } else {
    for (let point of geometry) vertices.push(round(point[0] * multiplier), round(point[1] * multiplier))
  }
}

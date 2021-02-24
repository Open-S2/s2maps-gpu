// @flow
type Point = [number, number]

export default function preprocessPoint (geometry: Array<Point>,
  vertices: Array<number>, weights: Array<number>, extent: number, weight?: number) {
  // edge case: no geometry
  if (!geometry.length) return
  // if weight, then it is a heatmap and we add weight data
  if (weight) {
    for (let point of geometry) {
      vertices.push(point[0] / extent, point[1] / extent)
      weights.push(weight)
    }
  } else {
    for (let point of geometry) vertices.push(point[0] / extent, point[1] / extent)
  }
}

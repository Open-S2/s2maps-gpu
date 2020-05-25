// @flow
import type { Feature } from '../tile.worker.js'

export default function featureSort (a: Feature, b: Feature): number {
  // layerID
  let diff = a.layerID - b.layerID
  let index = 0
  let maxSize = Math.min(a.code.length, b.code.length)
  while (diff === 0 && index < maxSize) {
    diff = a.code[index] - b.code[index]
    index++
  }
  return diff
}

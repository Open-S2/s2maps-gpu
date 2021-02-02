// @flow
import featureSort from '../featureSort'

import type { Feature } from '../../tile.worker'

// const MAX_FEATURE_BATCH_SIZE = 1 << 7 // 128
const MAX_FEATURE_BATCH_SIZE = 1 << 6 // 64

export default function postprocessFill (mapID: string, source: string,
  tileID: string, features: Array<Feature>, postMessage: Function) {
  // now that we have created all triangles, let's merge into bundled buffer sets
  // for the main thread to build VAOs.

  // Step 1: Sort by layerIndex, than sort by feature code.
  features.sort(featureSort)

  // Step 1a: If WebGL1 the variable "featureCode" will exist; Swap the two
  let tmp
  let webgl1 = false
  if (features[0].featureCode) {
    webgl1 = true
    for (const feature of features) {
      tmp = feature.code
      feature.code = feature.featureCode
      feature.featureCode = tmp
    }
  }

  // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
  // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
  // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
  let vertices: Array<number> = []
  let indices: Array<number> = []
  let codeType: Array<number> = []
  let featureGuide: Array<number> = []
  let encodings: Array<number> = []
  let subEncodings: Array<number> = []
  let indicesOffset: number = 0
  let vertexOffset: number = 0
  let encodingIndexes = { '': 0 }
  let encodingIndex
  let curlayerIndex = features[0].layerIndex

  for (const feature of features) {
    // on layer change or max encoding size, we have to setup a new featureGuide, encodings, and encodingIndexes
    if (
      curlayerIndex !== feature.layerIndex ||
      (encodings.length + feature.code.length > MAX_FEATURE_BATCH_SIZE)
    ) {
      // only store if count is actually greater than 0
      if (indices.length - indicesOffset) featureGuide.push(curlayerIndex, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerIndex, count, offset, encoding size, encodings
      if (webgl1) featureGuide.push(subEncodings.length, ...subEncodings)
      // update variables for reset
      indicesOffset = indices.length
      encodings = []
      subEncodings = []
      encodingIndexes = { '': 0 }
    }
    // setup encodings data. If we didn't have current feature's encodings already, create and set index
    const feKey = feature.code.toString()
    encodingIndex = encodingIndexes[feKey]
    if (encodingIndex === undefined) {
      encodingIndex = encodingIndexes[feKey] = webgl1 ? subEncodings.length : encodings.length
      encodings.push(...feature.code)
      if (webgl1) subEncodings.push(...feature.featureCode)
    }
    // store
    vertexOffset = vertices.length / 2
    // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
    // so we just do a for loop
    for (let f = 0, fl = feature.vertices.length; f < fl; f++) vertices.push(feature.vertices[f])
    for (let f = 0, fl = feature.indices.length; f < fl; f++) {
      const index = feature.indices[f] + vertexOffset
      indices.push(index)
      codeType[index] = encodingIndex
    }
    // update previous layerIndex
    curlayerIndex = feature.layerIndex
  }
  // store the very last featureGuide batch
  if (indices.length - indicesOffset) {
    featureGuide.push(curlayerIndex, indices.length - indicesOffset, indicesOffset, encodings.length, ...encodings) // layerIndex, count, offset, encoding size, encodings
    if (webgl1) featureGuide.push(subEncodings.length, ...subEncodings) // subEncoding size, encoding
  }

  // Upon building the batches, convert to buffers and ship.
  const vertexBuffer = new Float32Array(vertices).buffer
  const indexBuffer = new Uint32Array(indices).buffer
  const codeTypeBuffer = new Uint8Array(codeType).buffer
  const featureGuideBuffer = new Float32Array(featureGuide).buffer
  // ship the vector data.
  postMessage({
    mapID,
    type: 'filldata',
    source,
    tileID,
    vertexBuffer,
    indexBuffer,
    codeTypeBuffer,
    featureGuideBuffer
  }, [vertexBuffer, indexBuffer, codeTypeBuffer, featureGuideBuffer])
}

// @flow
import featureSort from '../featureSort'

import type { Feature } from '../../tile.worker'

export default function postprocessLine (mapID: string, source: string, tileID: string,
  features: Array<Feature>, postMessage: Function) {
  // now that we have created all triangles, let's merge into bundled buffer sets
  // for the main thread to build VAOs.

  // Step 1: Sort by layerID, than sort by feature code.
  features.sort(featureSort)

  // step 2: Run through all features and bundle into the fewest featureBatches. Caveats:
  // 1) don't store VAO set larger than index size (we use an extension for WebGL1, so we will probably never go over 1 << 32)
  // 2) don't store any feature code larger than MAX_FEATURE_BATCH_SIZE
  let vertices: Array<number> = []
  let featureGuide: Array<number> = []
  let encodings: Array<number> = features[0].code
  let indexCount: number = 0
  let indexOffset: number = 0
  let curFeatureCode = encodings.toString()
  let curLayerID = features[0].layerID

  for (const feature of features) {
    // on layer change or max feature code change, we have to setup a new featureGuide
    if (
      indexCount &&
      (
        curLayerID !== feature.layerID ||
        curFeatureCode !== feature.code.toString()
      )
    ) {
      // store the current feature
      featureGuide.push(curLayerID, indexCount, indexOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings
      // update indexOffset
      indexOffset += indexCount
      // reset indexCount
      indexCount = 0
      // update to new encoding set
      encodings = feature.code
      // update what the current encoding is
      curFeatureCode = encodings.toString()
    }
    // NOTE: Spreader functions on large arrays are failing in chrome right now -_-
    // so we just do a for loop. Store vertices and feature code for each vertex set
    const fl: number = feature.vertices.length
    for (let f = 0; f < fl; f++) vertices.push(feature.vertices[f])
    // update previous layerID
    curLayerID = feature.layerID
    // increment indexCount
    indexCount += fl / 6
  }
  // store the very last featureGuide batch if not yet stored
  if (indexCount) featureGuide.push(curLayerID, indexCount, indexOffset, encodings.length, ...encodings) // layerID, count, offset, encoding size, encodings

  // Upon building the batches, convert to buffers and ship.
  const vertexBuffer = new Int16Array(vertices).buffer
  const featureGuideBuffer = new Uint32Array(featureGuide).buffer
  // ship the vector data.
  postMessage({
    mapID,
    type: 'linedata',
    source,
    tileID,
    vertexBuffer,
    featureGuideBuffer
  }, [vertexBuffer, featureGuideBuffer])
}

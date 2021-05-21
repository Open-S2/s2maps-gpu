// @flow
import type { GlyphObject } from './glyph'

export default function postprocessGlyph (mapID: string, sourceName: string,
  tileID: string, features: Array<GlyphObject>, postMessage: Function) {
  // setup draw thread variables
  const glyphFilterVertices = []
  const glyphQuads = []
  const glyphColors = []
  const featureGuide = []
  // run through features and store
  let curlayerIndex = features[0].layerIndex
  let curType = features[0].type
  let encoding: Array<number> = features[0].code
  let subEncoding: Array<number> = features[0].featureCode
  let codeStr: string = features[0].code.toString()
  let filterOffset = 0
  let quadOffset = 0
  let filterCount = 0
  let quadCount = 0
  // iterate features, store as we go
  for (const glyph of features) {
    const { type, layerIndex, code, featureCode, quads, filter } = glyph
    // if there is a change in layer index or
    if (quadCount && (curlayerIndex !== layerIndex || codeStr !== code.toString() || curType !== type)) {
      // store featureGuide
      featureGuide.push(curlayerIndex, curType, filterOffset, filterCount, quadOffset, quadCount, encoding.length, ...encoding)
      if (subEncoding) featureGuide.push(...subEncoding)
      // update to new codes
      curlayerIndex = layerIndex
      codeStr = code.toString()
      curType = type
      encoding = code
      subEncoding = featureCode
      // update offests
      filterOffset += filterCount
      quadOffset += quadCount
      // reset counts
      filterCount = 0
      quadCount = 0
    }
    // store the quads and colors
    glyphFilterVertices.push(...filter)
    filterCount += filter.length / 10
    glyphQuads.push(...quads)
    const qCount = quads.length / 13
    quadCount += qCount
    for (let i = 0; i < qCount; i++) glyphColors.push(255, 255, 255, 255)
  }
  // store last set
  if (quadCount) {
    featureGuide.push(curlayerIndex, curType, filterOffset, filterCount, quadOffset, quadCount, encoding.length, ...encoding)
    if (subEncoding) featureGuide.push(...subEncoding)
  }

  // filter data
  const glyphFilterBuffer = new Float32Array(glyphFilterVertices).buffer
  // quad draw data
  const glyphQuadBuffer = new Float32Array(glyphQuads).buffer
  const glyphColorBuffer = new Uint8ClampedArray(glyphColors).buffer
  const featureGuideBuffer = new Float32Array(featureGuide).buffer

  // ship the data
  postMessage({
    mapID,
    type: 'glyphdata',
    source: sourceName,
    tileID,
    glyphFilterBuffer,
    glyphQuadBuffer,
    glyphColorBuffer,
    featureGuideBuffer
  }, [glyphFilterBuffer, glyphQuadBuffer, glyphColorBuffer, featureGuideBuffer])
}

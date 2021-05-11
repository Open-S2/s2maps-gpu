// @flow
import featureSort from '../featureSort'
import { GlyphBuilder, anchorOffset } from './glyphBuilder'

import type { GlyphObject } from './glyph'

export default function postprocessGlyph (mapID: string, sourceName: string,
  tileID: string, glyphs: Array<GlyphObject>, glyphBuilder: GlyphBuilder, id: number,
  postMessage: Function) {
  // sort by layerIndex
  glyphs = glyphs.sort(featureSort)

  // Assuming we pass the quad test, We need to build 3 components:
  // 1) Glyph quads explaining where to draw, and where on the texture to look
  // 3) For each text object we need a "filter" quad defining it's total width and size.
  //    This is for the pre-draw step to check overlap. The GlyphBuilder will also be building this.
  let curlayerIndex = glyphs[0].layerIndex
  let curType = glyphs[0].type
  let encoding: Array<number> = glyphs[0].code
  let subEncoding: Array<number> = glyphs[0].featureCode
  let codeStr: string = glyphs[0].code.toString()
  for (const glyph of glyphs) {
    const { type, layerIndex, code, featureCode } = glyph

    if (curlayerIndex !== layerIndex || codeStr !== code.toString() || type !== curType) {
      // glyphBuilder.finishLayer(curlayerIndex, curType, encoding, subEncoding)
      curlayerIndex = layerIndex
      curType = type
      codeStr = code.toString()
      encoding = code
      subEncoding = featureCode
    }
  }
  // add the width and height to the beginning of the layerGuide
  layerGuide.unshift(id, height)

  // filter data
  const glyphFilterBuffer = new Float32Array(glyphFilterVertices).buffer
  // quad draw data
  const glyphQuadBuffer = new Float32Array(glyphQuads).buffer
  const glyphColorBuffer = new Uint8ClampedArray(glyphColors).buffer
  const layerGuideBuffer = new Float32Array(layerGuide).buffer

  // ship the data
  postMessage({
    mapID,
    type: 'glyphdata',
    source: sourceName,
    tileID,
    glyphFilterBuffer,
    glyphQuadBuffer,
    glyphColorBuffer,
    layerGuideBuffer
  }, [glyphFilterBuffer, glyphQuadBuffer, glyphColorBuffer, layerGuideBuffer])
}

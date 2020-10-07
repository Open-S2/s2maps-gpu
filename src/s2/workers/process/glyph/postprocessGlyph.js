// @flow
import featureSort from '../featureSort'
import { GlyphBuilder, anchorOffset } from './glyphBuilder'

import type { GlyphObject } from './glyph'

export default function postprocessGlyph (mapID: string, sourceName: string,
  tileID: string, glyphs: Array<GlyphObject>, glyphBuilder: GlyphBuilder, id: number,
  postMessage: Function) {
  // sort by layerIndex
  glyphs = glyphs.sort(featureSort)

  // Get the width of the feature, and filter out any glyphs that overlap already
  // existant text. Sometimes datapoints can range in the 100s in one tile, so
  // this step reduces cost dramatically.
  for (const glyph of glyphs) {
    const { family, field, anchor } = glyph
    let [width, glyphData] = glyphBuilder.getWidthAndGlyphData(family, field)
    if (!width) continue
    glyph.width = width
    glyph.glyphData = glyphData
    // get anchor offset positions
    let [x, y] = anchorOffset(anchor, width)
    // add actual offset
    glyph.x = x
    glyph.y = y
  }

  // filter
  glyphs = glyphs.filter(text => {
    if (!text.width) return false
    return glyphBuilder.testQuad(text)
  })
  if (!glyphs.length) return

  // Assuming we pass the quad test, We need to build 3 components:
  // 1) Glyph quads explaining where to draw, and where on the texture to look
  // 2) The GlyphBuilder will build in the background any new glyphs it needs to a "texturePack"
  // 3) For each text object we need a "filter" quad defining it's total width and size.
  //    This is for the pre-draw step to check overlap. The GlyphBuilder will also be building this.
  let curlayerIndex = glyphs[0].layerIndex
  let encoding: Array<number> = glyphs[0].code
  let subEncoding: Array<number> = glyphs[0].featureCode
  let codeStr: string = glyphs[0].code.toString()
  for (const glyph of glyphs) {
    const { layerIndex, code, featureCode } = glyph

    if (curlayerIndex !== layerIndex || codeStr !== code.toString()) {
      glyphBuilder.finishLayer(curlayerIndex, encoding, subEncoding)
      curlayerIndex = layerIndex
      codeStr = code.toString()
      encoding = code
      subEncoding = featureCode
    }

    glyphBuilder.buildText(glyph)
  }
  // finish the last layer
  glyphBuilder.finishLayer(curlayerIndex, encoding, subEncoding)
  // if the layerGuide doesn't grow, we move on
  if (!glyphBuilder.layerGuide.length) return

  // pull out the data
  const { texturePack, glyphFilterVertices, glyphQuads, layerGuide } = glyphBuilder
  const { height, fillVertices, fillIndices, lineVertices } = texturePack
  // add the width and height to the beginning of the layerGuide
  layerGuide.unshift(id, height)

  // filter data
  const glyphFilterBuffer = new Float32Array(glyphFilterVertices).buffer
  // glyph texture data
  const glyphFillVertexBuffer = new Float32Array(fillVertices).buffer
  const glyphFillIndexBuffer = new Uint32Array(fillIndices).buffer
  const glyphLineVertexBuffer = new Float32Array(lineVertices).buffer
  // quad draw data
  const glyphQuadBuffer = new Float32Array(glyphQuads).buffer
  const layerGuideBuffer = new Float32Array(layerGuide).buffer

  // ship the data
  postMessage({
    mapID,
    type: 'glyphdata',
    source: sourceName,
    tileID,
    glyphFilterBuffer,
    glyphFillVertexBuffer,
    glyphFillIndexBuffer,
    glyphLineVertexBuffer,
    glyphQuadBuffer,
    layerGuideBuffer
  }, [glyphFilterBuffer, glyphFillVertexBuffer, glyphFillIndexBuffer, glyphLineVertexBuffer, glyphQuadBuffer, layerGuideBuffer])

  // clear the glyphBuilder
  glyphBuilder.clear()
}

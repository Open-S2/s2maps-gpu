// @flow
import featureSort from '../featureSort'
import { GlyphBuilder, anchorOffset } from './glyphBuilder'

import type { Text } from '../../tile.worker'

export default function postprocessGlyph (mapID: string, sourceName: string,
  tileID: string, texts: Array<Text>, glyphBuilder: GlyphBuilder, id: number, postMessage: Function) {
  // sort by layerID
  texts = texts.sort(featureSort)

  // Get the width of the feature, and filter out any texts that overlap already
  // existant text. Sometimes datapoints can range in the 100s in one tile, so
  // this step reduces cost dramatically.
  for (const text of texts) {
    const { family, field, padding, offset, height, anchor } = text
    let [width, glyphData] = glyphBuilder.getWidthAndGlyphData(family, field)
    if (!width) continue
    text.width = width
    text.glyphData = glyphData
    // get anchor offset positions
    let [x, y] = anchorOffset(anchor, width)
    // add actual offset
    text.x = x
    text.y = y
  }

  // filter
  texts = texts.filter(text => {
    if (!text.width) return false
    return glyphBuilder.testQuad(text)
  })
  if (!texts.length) return

  // Assuming we pass the quad test, We need to build 3 components:
  // 1) Glyph quads explaining where to draw, and where on the texture to look
  // 2) The GlyphBuilder will build in the background any new glyphs it needs to a "texturePack"
  // 3) For each text object we need a quad defining it's total shape.
  //    This is for the pre-draw step to check overlap. The GlyphBuilder will also be building this.
  //    Upon eventual request, it needs to first be sorted biggest to smallest.
  let curLayerID = texts[0].layerID
  let encoding: Array<number> = texts[0].code
  let codeStr: string = texts[0].code.toString()
  for (const text of texts) {
    const { layerID, code } = text

    if (curLayerID !== layerID || codeStr !== code.toString()) {
      glyphBuilder.finishLayer(curLayerID, encoding)
      curLayerID = layerID
      codeStr = code.toString()
      encoding = code
    }
    glyphBuilder.buildText(text)
  }
  // finish the last layer
  glyphBuilder.finishLayer(curLayerID, encoding)
  // if the layerGuide doesn't grow, we move on
  if (!glyphBuilder.layerGuide.length) return

  // pull out the data
  const { texturePack, glyphFilterVertices, glyphQuads, layerGuide } = glyphBuilder
  const { height, fillVertices, lineVertices, fillIndices } = texturePack
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
  const layerGuideBuffer = new Uint32Array(layerGuide).buffer

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

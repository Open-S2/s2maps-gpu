// @flow
import featureSort from '../featureSort'
import { GlyphBuilder, anchorOffset } from './glyphBuilder'

import type { Text } from '../../tile.worker'

export default function postprocessGlyph (mapID: string, sourceName: string,
  tileID: string, texts: Array<Text>, glyphBuilder, postMessage: Function) {
  // sort by layerID
  texts = texts.sort(featureSort)

  // Get the width of the feature, and filter out any texts that overlap already
  // existant text. Sometimes datapoints can range in the 100s in one tile, so
  // this step reduces cost dramatically.
  for (const text of texts) {
    const { family, field, size, padding, offset, height, anchor } = text
    let [width, glyphData] = glyphBuilder.getWidthAndGlyphData(family, field, size)
    if (!width) continue
    text.width = width + (padding[0] * 2)
    text.glyphData = glyphData
    // get anchor offset positions
    let [x, y] = anchorOffset(anchor, width, height)
    // add actual offset
    text.x = x + offset[0]
    text.y = y + offset[1]
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
  for (const text of texts) {
    const { layerID } = text
    if (curLayerID !== layerID) {
      glyphBuilder.finishLayer(curLayerID)
      curLayerID = layerID
    }
    glyphBuilder.buildText(text)
  }
  // finish the last layer
  glyphBuilder.finishLayer(curLayerID)
  // if the layerGuide doesn't grow, we move on
  if (!glyphBuilder.layerGuide.length) return

  // pull out the data
  const { texturePack, glyphFilterVertices, glyphQuads, color, layerGuide } = glyphBuilder
  const { width, height, vertices, indices } = texturePack
  // add the width and height to the beginning of the layerGuide
  layerGuide.unshift(width, height)

  // filter data
  const glyphFilterBuffer = new Float32Array(glyphFilterVertices).buffer
  // glyph texture data
  const glyphVertexBuffer = new Float32Array(vertices).buffer
  const glyphIndexBuffer = new Uint32Array(indices).buffer
  // quad draw data
  const glyphQuadBuffer = new Float32Array(glyphQuads).buffer
  const colorBuffer = new Uint8Array(color).buffer
  const layerGuideBuffer = new Uint32Array(layerGuide).buffer

  // ship the data
  postMessage({
    mapID,
    type: 'glyphdata',
    source: sourceName,
    tileID,
    glyphFilterBuffer,
    glyphVertexBuffer,
    glyphIndexBuffer,
    glyphQuadBuffer,
    colorBuffer,
    layerGuideBuffer
  }, [glyphFilterBuffer, glyphVertexBuffer, glyphIndexBuffer, glyphQuadBuffer, colorBuffer, layerGuideBuffer])

  // clear the glyphBuilder
  glyphBuilder.clear()
}

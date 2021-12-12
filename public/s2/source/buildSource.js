// @flow
/* eslint-env browser */
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import type { RasterTileSource, VectorTileSource, GlyphTileSource } from './tile'

// given
export default function buildSource (context: WebGL2Context | WebGLContext, source: RasterTileSource | VectorTileSource | GlyphTileSource) {
  const { gl } = context
  // type vector
  if (source.type === 'vector') {
    // Create a starting vertex array object (attribute state)
    source.vao = gl.createVertexArray()
    // and make it the one we're currently working with
    gl.bindVertexArray(source.vao)
    // FEATURE INDEX
    if (source.codeTypeArray && source.codeTypeArray.length) {
      // Create the feature index buffer
      source.codeTypeBuffer = gl.createBuffer()
      // Bind and buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.codeTypeBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, source.codeTypeArray, gl.STATIC_DRAW)
      // setup feature attribute
      gl.enableVertexAttribArray(7)
      gl.vertexAttribPointer(7, 1, gl.UNSIGNED_BYTE, false, 0, 0)
    }
    // INDEX
    if (source.indexArray && source.indexArray.length) {
      // Create an index buffer
      source.indexBuffer = gl.createBuffer()
      // bind and buffer
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, source.indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indexArray, gl.STATIC_DRAW)
    }

    // PREP VERTEX DATA
    // Create a vertex buffer
    source.vertexBuffer = gl.createBuffer()
    // bind and buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.vertexArray, gl.STATIC_DRAW)

    // ADDITIONAL CHANGES
    if (source.subType === 'fill') {
      // link attributes (fill & point & heatmap & etc.)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.SHORT, false, 0, 0)
    } else if (source.subType === 'point' || source.subType === 'heatmap') {
      // link attributes (fill & point & heatmap & etc.)
      gl.enableVertexAttribArray(1)
      gl.vertexAttribPointer(1, 2, gl.SHORT, false, 4, 0)
      // make our aPos instanced
      gl.vertexAttribDivisor(1, 1)

      // if heatmap, we encode the "indexArray"
      // Create a weight buffer
      if (source.subType === 'heatmap') {
        source.weightBuffer = gl.createBuffer()
        // bind and buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, source.weightBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, source.indexArray, gl.STATIC_DRAW)
        // link weights to attribute position 2
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 4, 0)
        // make our aWeight instanced
        gl.vertexAttribDivisor(2, 1)
      }

      // create default triangle set
      // [[-1, -1], [1, -1], [-1, 1]]  &  [[1, -1], [1, 1], [-1, 1]]
      source.typeArray = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1])
      // create buffer
      source.typeBuffer = gl.createBuffer()
      // bind and buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.typeBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, source.typeArray, gl.STATIC_DRAW)
      // link attributes
      gl.enableVertexAttribArray(0) // position type (how to re-adjust)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    } else if (source.subType === 'line') {
      gl.enableVertexAttribArray(1) // prev
      gl.enableVertexAttribArray(2) // curr
      gl.enableVertexAttribArray(3) // next
      gl.vertexAttribPointer(1, 2, gl.SHORT, false, 12, 0)
      gl.vertexAttribPointer(2, 2, gl.SHORT, false, 12, 4)
      gl.vertexAttribPointer(3, 2, gl.SHORT, false, 12, 8)
      gl.vertexAttribDivisor(1, 1)
      gl.vertexAttribDivisor(2, 1)
      gl.vertexAttribDivisor(3, 1)
      // we build out the standard build
      // 0 -> curr
      // 1 -> curr + (-1 * normal)
      // 2 -> curr + (normal)
      // 3 -> next + (-1 * normal)
      // 4 -> next + (normal)
      // 5 -> curr + (normal) [check that prev, curr, and next is CCW otherwise invert normal]
      // 6 -> curr + (previous-normal) [check that prev, curr, and next is CCW otherwise invert normal]
      // create default triangle set
      source.typeArray = new Float32Array([1, 3, 4, 1, 4, 2, 0, 5, 6])
      // create buffer
      source.typeBuffer = gl.createBuffer()
      // bind and buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.typeBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, source.typeArray, gl.STATIC_DRAW)
      // link attributes
      gl.enableVertexAttribArray(0) // position type (how to re-adjust)
      gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0)
    }

    // cleanup
    context.cleanup()
  } else if (source.type === 'glyph') {
    // Create VAOS
    source.filterVAO = gl.createVertexArray()
    source.vao = gl.createVertexArray() // quad vao

    // STEP 1 - FILTER
    gl.bindVertexArray(source.filterVAO)
    // Create the UV buffer
    source.stepBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.stepBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0) // u-v
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0)
    // create the boxVertex buffer
    source.glyphFilterBuffer = gl.createBuffer()
    // Bind and buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, source.glyphFilterBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.glyphFilterVertices, gl.STATIC_DRAW)
    // setup attrinute data
    // s, t
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 40, 0)
    gl.vertexAttribDivisor(1, 1)
    // x, y
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 8)
    gl.vertexAttribDivisor(2, 1)
    // padding
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 40, 16)
    gl.vertexAttribDivisor(3, 1)
    // width, height
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 40, 24)
    gl.vertexAttribDivisor(4, 1)
    // index
    gl.enableVertexAttribArray(5)
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 40, 32)
    gl.vertexAttribDivisor(5, 1)
    // id
    gl.enableVertexAttribArray(6)
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 40, 36)
    gl.vertexAttribDivisor(6, 1)

    // STEP 2 - QUADS
    gl.bindVertexArray(source.vao)
    // Create the UV buffer
    source.uvBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.uvBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0) // u-v
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    // create the vertex and color buffers
    source.glyphQuadBuffer = gl.createBuffer()
    // bind each and buffer the data
    gl.bindBuffer(gl.ARRAY_BUFFER, source.glyphQuadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.glyphQuads, gl.STATIC_DRAW)
    // setup attribute data
    // s, t
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 52, 0)
    gl.vertexAttribDivisor(1, 1)
    // x, y
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 52, 8)
    gl.vertexAttribDivisor(2, 1)
    // xOffset, yOffset
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 52, 16)
    gl.vertexAttribDivisor(3, 1)
    // width, height
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 52, 24)
    gl.vertexAttribDivisor(4, 1)
    // texture x, y
    gl.enableVertexAttribArray(5)
    gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 52, 32)
    gl.vertexAttribDivisor(5, 1)
    // texture-width, texture-height
    gl.enableVertexAttribArray(6)
    gl.vertexAttribPointer(6, 2, gl.FLOAT, false, 52, 40)
    gl.vertexAttribDivisor(6, 1)
    // id
    gl.enableVertexAttribArray(7)
    gl.vertexAttribPointer(7, 1, gl.FLOAT, false, 52, 48)
    gl.vertexAttribDivisor(7, 1)

    // create the vertex and color buffers
    source.glyphColorBuffer = gl.createBuffer()
    // bind each and buffer the data
    gl.bindBuffer(gl.ARRAY_BUFFER, source.glyphColorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.glyphColors, gl.STATIC_DRAW)
    // colors
    gl.enableVertexAttribArray(8)
    gl.vertexAttribPointer(8, 4, gl.UNSIGNED_BYTE, true, 4, 0)
    gl.vertexAttribDivisor(8, 1)

    // cleanup
    context.cleanup()
  } else if (source.type === 'raster') {
    // setup texture params
    source.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, source.texture)
    if (source.image.src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.image)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.image)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }
}

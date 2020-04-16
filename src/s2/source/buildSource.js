// @flow
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import type { RasterTileSource, VectorTileSource, TextureMapTileSource } from './tile'

const IS_NOT_CHROME = navigator.userAgent.indexOf('Chrome') === -1

// given
export default function buildSource (context: WebGL2Context | WebGLContext, source: RasterTileSource | VectorTileSource | TextureMapTileSource) {
  const { gl } = context
  // type vector
  if (source.type === 'vector') {
    // cleanup old setup
    if (source.vertexBuffer) gl.deleteBuffer(source.vertexBuffer)
    if (source.radiiBuffer) gl.deleteBuffer(source.radiiBuffer)
    if (source.codeOffsetBuffer) gl.deleteBuffer(source.codeOffsetBuffer)
    if (source.indexBuffer) gl.deleteBuffer(source.indexBuffer)
    if (source.vao) gl.deleteVertexArray(source.vao)
    // Create a starting vertex array object (attribute state)
    source.vao = gl.createVertexArray()
    // and make it the one we're currently working with
    gl.bindVertexArray(source.vao)
    // VERTEX
    // Create a vertex buffer
    source.vertexBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, source.vertexArray, gl.STATIC_DRAW)
    // link attributes:
    // fill
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    // line
    gl.enableVertexAttribArray(1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 0)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 16, 8)
    // gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 16, 12)
    // RADII
    if (source.radiiArray) {
      // Create a vertex buffer
      source.radiiBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.radiiBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, source.radiiArray, gl.STATIC_DRAW)
      // radii attribute
      gl.enableVertexAttribArray(6)
      // tell attribute how to get data out of radii buffer
      gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0)
    }
    // FEATURE INDEX
    if (source.codeOffsetArray && source.codeOffsetArray.length) {
      // Create the feature index buffer
      source.codeOffsetBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.codeOffsetBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, source.codeOffsetArray, gl.STATIC_DRAW)
      // feature attribute
      gl.enableVertexAttribArray(7)
      gl.enableVertexAttribArray(8)
      // tell attribute how to get data out of feature index buffer
      gl.vertexAttribPointer(7, 1, gl.UNSIGNED_BYTE, false, 2, 0)
      gl.vertexAttribPointer(8, 1, gl.UNSIGNED_BYTE, false, 2, 1)
    }
    // INDEX
    // Create an index buffer
    source.indexBuffer = gl.createBuffer()
    // bind to ELEMENT_ARRAY
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, source.indexBuffer)
    // buffer the data
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indexArray, gl.STATIC_DRAW)

    // done setting up the VAO
    gl.bindVertexArray(null)
  } else if (source.type === 'text') {
    // Create a starting vertex array object (attribute state)
    source.vao = gl.createVertexArray()
    // and make it the one we're currently working with
    gl.bindVertexArray(source.vao)
    // UV
    // Create a vertex buffer
    source.uvBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.uvBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, source.uvArray, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0) // u-v
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // VERTEX
    // Create a vertex buffer
    source.vertexBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, source.vertexArray, gl.STATIC_DRAW)
    // link attributes:
    // s, t & id positions
    gl.enableVertexAttribArray(1) // s-t
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 12, 0)
    gl.enableVertexAttribArray(2) // id
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 12, 8)
    // add divisors to reuse for entire instance
    gl.vertexAttribDivisor(1, 1) // s-t
    gl.vertexAttribDivisor(2, 1) // id

    // RADII
    if (source.radiiArray) {
      // Create a vertex buffer
      source.radiiBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.radiiBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, source.radiiArray, gl.STATIC_DRAW)
      // radii attribute
      gl.enableVertexAttribArray(6)
      // tell attribute how to get data out of radii buffer
      gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0)
      // add divisors to reuse for entire instance
      gl.vertexAttribDivisor(6, 1) // r
    }

    // TEXTURE POSITION
    // Create a tex buffer
    source.texPositionBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.texPositionBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, source.texPositionArray, gl.STATIC_DRAW)
    // link attributes:
    // texture x, y, width, height, & anchor
    gl.enableVertexAttribArray(3) // x-y
    gl.vertexAttribPointer(3, 2, gl.SHORT, false, 10, 0)
    gl.enableVertexAttribArray(4) // width-height
    gl.vertexAttribPointer(4, 2, gl.SHORT, false, 10, 4)
    gl.enableVertexAttribArray(5) // anchor
    gl.vertexAttribPointer(5, 1, gl.SHORT, false, 10, 8)
    // add divisors to reuse for entire instance
    gl.vertexAttribDivisor(3, 1) // x-y
    gl.vertexAttribDivisor(4, 1) // width-height
    gl.vertexAttribDivisor(5, 1) // anchor

    // done setting up the VAO
    gl.bindVertexArray(null)

    // TEXTURE
    gl.bindTexture(gl.TEXTURE_2D, source.texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.imageBitmap)
  } else if (source.type === 'raster') {
    // setup texture params
    const length = this.size * 2
    gl.bindTexture(gl.TEXTURE_2D, source.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, length, length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    if (IS_NOT_CHROME) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }
}

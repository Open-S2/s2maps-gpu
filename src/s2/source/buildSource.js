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
    if (source.codeTypeBuffer) gl.deleteBuffer(source.codeTypeBuffer)
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
    gl.vertexAttribPointer(0, 2, gl.SHORT, false, 0, 0)
    // line
    gl.enableVertexAttribArray(2) // prev
    gl.enableVertexAttribArray(3) // curr
    gl.enableVertexAttribArray(4) // next
    gl.vertexAttribPointer(2, 2, gl.SHORT, false, 12, 0)
    gl.vertexAttribPointer(3, 2, gl.SHORT, false, 12, 4)
    gl.vertexAttribPointer(4, 2, gl.SHORT, false, 12, 8)
    gl.vertexAttribDivisor(2, 1)
    gl.vertexAttribDivisor(3, 1)
    gl.vertexAttribDivisor(4, 1)
    // RADII
    if (source.radiiArray) {
      // Create a vertex buffer
      source.radiiBuffer = gl.createBuffer()
      // Bind and buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.radiiBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, source.radiiArray, gl.STATIC_DRAW)
      // setup radii attribute
      gl.enableVertexAttribArray(6)
      gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0)
    }
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

    if (source.subType === 'line') {
      // we build out the standard build
      // 0 -> curr + (-1)
      // 1 -> curr + (1)
      // 2 -> next + (-1)
      // 3 -> next + (1)
      // create default triangle set
      source.typeArray = new Float32Array([1, 3, 4, 1, 4, 2, 0, 5, 6])
      // create buffer
      source.typeBuffer = gl.createBuffer()
      // bind and buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.typeBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, source.typeArray, gl.STATIC_DRAW)
      // link attributes
      gl.enableVertexAttribArray(1) // position type (how to re-adjust)
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0)
    }

    // done setting up the VAO
    gl.bindVertexArray(null)
  } else if (source.type === 'glyph') {
    // find size data
    source.instanceCount = source.glyphFilterVertices.length / 7
    source.glyphPrimcount = source.glyphQuads.length / 9
    source.texSize = new Float32Array([source.width, source.height])
    // pre-build the glyph texture
    source.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, source.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // FRAMEBUFFER
    source.glyphFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, source.glyphFramebuffer)
    // attach texture to glyphFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, source.texture, 0)
    // rebind our default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    // Create VAOS
    source.boxVAO = gl.createVertexArray()
    source.glyphVAO = gl.createVertexArray()
    source.glyphQuadVAO = gl.createVertexArray()

    // STEP 1 - build box VAO
    gl.bindVertexArray(source.boxVAO)
    // Create the UV buffer
    source.uvBuffer = gl.createBuffer()
    // Bind the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, source.uvBuffer)
    // Buffer the data
    gl.bufferData(gl.ARRAY_BUFFER, source.uvArray, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0) // u-v
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    // create the boxVertex buffer
    source.glyphFilterBuffer = gl.createBuffer()
    // Bind and buffer data
    gl.bindBuffer(gl.ARRAY_BUFFER, source.glyphFilterBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.glyphFilterVertices, gl.STATIC_DRAW)
    // setup attrinute data
    // s, t
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 0)
    gl.vertexAttribDivisor(1, 1)
    // x, y
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 8)
    gl.vertexAttribDivisor(2, 1)
    // width, height
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 28, 16)
    gl.vertexAttribDivisor(3, 1)
    // id
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 28, 24)
    gl.vertexAttribDivisor(4, 1)

    // STEP 2 - Drawing Glyph to texture data
    gl.bindVertexArray(source.glyphVAO)
    // create the vertex and index buffers
    source.glyphVertexBuffer = gl.createBuffer()
    source.glyphIndexBuffer = gl.createBuffer()
    // bind vertex and buffer the data
    gl.bindBuffer(gl.ARRAY_BUFFER, source.glyphVertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.glyphVertices, gl.STATIC_DRAW)
    // setup attribute data
    // x, y
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0)
    // type
    gl.enableVertexAttribArray(7)
    gl.vertexAttribPointer(7, 1, gl.FLOAT, false, 12, 8)
    // bind index and buffer data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, source.glyphIndexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.glyphIndices, gl.STATIC_DRAW)

    // STEP 3 - Drawing glyphs from texture to screen space
    gl.bindVertexArray(source.glyphQuadVAO)
    // add UV again
    gl.bindBuffer(gl.ARRAY_BUFFER, source.uvBuffer)
    gl.enableVertexAttribArray(0) // u-v
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    // create the vertex and color buffers
    source.glyphQuadBuffer = gl.createBuffer()
    source.colorBuffer = gl.createBuffer()
    // bind each and buffer the data
    gl.bindBuffer(gl.ARRAY_BUFFER, source.glyphQuadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.glyphQuads, gl.STATIC_DRAW)
    // setup attribute data
    // s, t
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 9 * 4, 0)
    gl.vertexAttribDivisor(1, 1)
    // x, y
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 9 * 4, 8)
    gl.vertexAttribDivisor(2, 1)
    // texture u, v
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 9 * 4, 16)
    gl.vertexAttribDivisor(3, 1)
    // width, height
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 9 * 4, 24)
    gl.vertexAttribDivisor(4, 1)
    // id
    gl.enableVertexAttribArray(5)
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 9 * 4, 32)
    gl.vertexAttribDivisor(5, 1)
    // color
    gl.bindBuffer(gl.ARRAY_BUFFER, source.colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, source.color, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(6)
    gl.vertexAttribPointer(6, 4, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(6, 1)

    // done setting up the VAO
    gl.bindVertexArray(null)
  } else if (source.type === 'raster') {
    // setup texture params
    const length = source.size * 2
    gl.bindTexture(gl.TEXTURE_2D, source.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, length, length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    if (IS_NOT_CHROME) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }
}

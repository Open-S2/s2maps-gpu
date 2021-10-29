// @flow
import Program from './program'

// WEBGL1
import vert1 from '../shaders/glyphFilter1.vertex.glsl'
import frag1 from '../shaders/glyphFilter1.fragment.glsl'
// WEBGL2
import vert2 from '../shaders/glyphFilter2.vertex.glsl'
import frag2 from '../shaders/glyphFilter2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, GlyphTileSource } from '../../source/tile'

export default class GlyphFilterProgram extends Program {
  uSize: WebGLUniformLocation
  quadFramebuffer: WebGLFramebuffer
  uIndexOffset: WebGLUniformLocation
  uSamples: WebGLUniformLocation
  quadTexture: WebGLTexture
  resultTexture: WebGLTexture
  textures: Array<WebGLTexture>
  depthBuffer: WebGLRenderbuffer
  indexOffset: number = 0
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // if webgl1, setup attribute locations
    if (type === 1) gl.attributeLocations = { aStep: 0, aST: 1, aXY: 2, aPad: 3, aWH: 4, aIndex: 5, aID: 6 }
    // inject Program
    super(context)
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1)
    else this.buildShaders(vert2, frag2)
    // finish building the textures
    this._buildTextures()
  }

  _buildTextures () {
    const { gl, devicePixelRatio } = this.context
    this.use()
    // setup the devicePixelRatio
    this.setDevicePixelRatio(devicePixelRatio)

    // TEXTURES
    this.quadTexture = gl.createTexture()
    this.resultTexture = gl.createTexture()

    // result texture
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
    // create pointTexture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // quad texture using floats
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // FRAMEBUFFERS
    // QUAD FRAMEBUFFER
    this.quadFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    // attach quadTexture to quadFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.quadTexture, 0)
    // RESULT FRAMEBUFFER
    this.resultFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer)
    // attach quadTexture to resultFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.resultTexture, 0)

    // we are finished, so go back to our main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  delete () {
    const { gl, quadTexture, resultTexture, quadFramebuffer, resultFramebuffer } = this
    // delete textures
    gl.deleteTexture(quadTexture)
    gl.deleteTexture(resultTexture)
    // delete framebuffers
    gl.deleteFramebuffer(quadFramebuffer)
    gl.deleteFramebuffer(resultFramebuffer)
    // cleanup programs
    super.delete()
  }

  resize () {
    const { gl } = this
    // bind the resultTexture
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  }

  setIndexOffset () {
    this.gl.uniform1f(this.uIndexOffset, this.indexOffset)
  }

  bindResultTexture () {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
  }

  bindQuadFrameBuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    context.clearColorBuffer()
    context.disableBlend()
    gl.viewport(0, 0, 2048, 2)
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
    // clear indexOffset
    this.indexOffset = 0
  }

  bindResultFramebuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer)
    context.enableBlend()
    context.resetViewport()
    context.clearColorBuffer()
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // clear indexOffset
    this.indexOffset = 0
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource, mode: 0 | 1 | 2) {
    const { gl, context } = this
    const { type } = context
    // set current indexOffset
    this.setIndexOffset()
    // grab variables
    const { size, featureCode, filterCount, filterOffset } = featureGuide
    const { glyphFilterBuffer } = source
    // set feature code
    if (type === 1) gl.uniform1f(this.uSize, size)
    else this.setFeatureCode(featureCode)
    // apply the appropriate offset
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphFilterBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 40, 0 + (filterOffset * 40)) // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 8 + (filterOffset * 40)) // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 40, 16 + (filterOffset * 40)) // paddingX, paddingY
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 40, 24 + (filterOffset * 40)) // width, height
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 40, 32 + (filterOffset * 40)) // index
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 40, 36 + (filterOffset * 40)) // ID
    // draw based upon mode
    if (mode === 1) gl.drawArraysInstanced(gl.POINTS, 0, 2, filterCount)
    else gl.drawArraysInstanced(gl.POINTS, 0, 1, filterCount)
    // increment offset
    this.indexOffset += filterCount
  }
}

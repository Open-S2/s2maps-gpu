// @flow
/* global WebGLUniformLocation WebGLFramebuffer WebGLUniformLocation WebGLTexture WebGLRenderbuffer */
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyphFilter1.vertex.glsl'
import frag1 from '../../shaders/glyphFilter1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyphFilter2.vertex.glsl'
import frag2 from '../../shaders/glyphFilter2.fragment.glsl'

import type { Context } from '../contexts'
import type { FeatureGuide, GlyphTileSource } from '../../source/tile'

export default class GlyphFilterProgram extends Program {
  uSize: WebGLUniformLocation
  pointFramebuffer: WebGLFramebuffer
  quadFramebuffer: WebGLFramebuffer
  resultFramebuffer: WebGLFramebuffer
  uIndexOffset: WebGLUniformLocation
  uPoints: WebGLUniformLocation
  uQuads: WebGLUniformLocation
  pointTexture: WebGLTexture
  quadTexture: WebGLTexture
  resultTexture: WebGLTexture
  textures: Array<WebGLTexture>
  depthBuffer: WebGLRenderbuffer
  indexOffset: number = 0
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // inject Program
    super(context)
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build said shaders
        self.buildShaders(vertex, fragment)
        self.use()
        // setup the devicePixelRatio
        self.setDevicePixelRatio(devicePixelRatio)
        // set sampler positions
        gl.uniform1i(self.uPoints, 0) // uFeatures texture unit 0
        gl.uniform1i(self.uQuads, 1) // uGlyphTex texture unit 1

        // TEXTURES
        self.pointTexture = gl.createTexture()
        self.quadTexture = gl.createTexture()
        self.resultTexture = gl.createTexture()
        self.textures = [self.pointTexture, self.resultTexture]

        for (const texture of self.textures) {
          // bind
          gl.bindTexture(gl.TEXTURE_2D, texture)
          // create pointTexture's aspect
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
          // set filter system
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        }

        // quad texture using floats
        gl.bindTexture(gl.TEXTURE_2D, self.quadTexture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        // set filter system
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        // DEPTH
        self.depthBuffer = gl.createRenderbuffer()
        // bind
        gl.bindRenderbuffer(gl.RENDERBUFFER, self.depthBuffer)
        // allocate renderbuffer
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)

        // FRAMEBUFFERS
        // POINT FRAMEBUFFER
        self.pointFramebuffer = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.pointFramebuffer)
        // attach pointTexture to pointFramebuffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.pointTexture, 0)
        // attach depthBuffer renderbuffer to pointFramebuffer
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, self.depthBuffer)
        // QUAD FRAMEBUFFER
        self.quadFramebuffer = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.quadFramebuffer)
        // attach quadTexture to quadFramebuffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.quadTexture, 0)
        // RESULT FRAMEBUFFER
        self.resultFramebuffer = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, self.resultFramebuffer)
        // attach quadTexture to resultFramebuffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, self.resultTexture, 0)

        // we are finished, so go back to our main buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        return self
      })
  }

  delete () {
    const {
      gl,
      pointTexture, quadTexture, resultTexture,
      depthBuffer, pointFramebuffer, quadFramebuffer, resultFramebuffer
    } = this
    // delete textures
    gl.deleteTexture(pointTexture)
    gl.deleteTexture(quadTexture)
    gl.deleteTexture(resultTexture)
    this.textures = []
    // delete renderBuffer
    gl.deleteRenderbuffer(depthBuffer)
    // delete framebuffers
    gl.deleteFramebuffer(pointFramebuffer)
    gl.deleteFramebuffer(quadFramebuffer)
    gl.deleteFramebuffer(resultFramebuffer)
    // cleanup programs
    super.delete()
  }

  resize () {
    const { gl } = this
    // fix texture sizes
    for (const texture of this.textures) {
      // bind the pointTexture
      gl.bindTexture(gl.TEXTURE_2D, texture)
      // update the texture's aspect
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
    // update the depthBuffer's aspect
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)
  }

  setIndexOffset () {
    this.gl.uniform1f(this.uIndexOffset, this.indexOffset)
  }

  bindResultTexture () {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
  }

  bindPointFrameBuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    context.clearColorDepthBuffers()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // set z-testing
    context.lequalDepth()
    // clear indexOffset
    this.indexOffset = 0
  }

  bindQuadFrameBuffer () {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    gl.viewport(0, 0, 2048, 1)
    // context.clearColorBuffer()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // clear indexOffset
    this.indexOffset = 0
  }

  bindResultFramebuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer)
    context.resetViewport()
    context.clearColorBuffer()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // clear indexOffset
    this.indexOffset = 0
  }

  draw (featureGuide: FeatureGuide, source: GlyphTileSource, mode: 0 | 1 | 2) {
    const { gl, context } = this
    const { type } = context
    // set current indexOffset
    if (mode !== 0) this.setIndexOffset()
    // grab variables
    const { size, featureCode, filterCount, filterOffset } = featureGuide
    const { glyphFilterBuffer } = source
    // set feature code
    if (type === 1) gl.uniform1f(this.uSize, size)
    else { this.setFeatureCode(featureCode) }
    // apply the appropriate offset
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphFilterBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 0 + (filterOffset * 36)) // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 8 + (filterOffset * 36)) // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 36, 16 + (filterOffset * 36)) // padding
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 36, 24 + (filterOffset * 36)) // width
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 36, 28 + (filterOffset * 36)) // index
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 36, 32 + (filterOffset * 36)) // ID
    // draw based upon mode
    if (mode === 1) gl.drawArraysInstanced(gl.POINTS, 0, 2, filterCount)
    else gl.drawArraysInstanced(gl.POINTS, 0, 1, filterCount)
    // increment offset
    if (mode !== 0) this.indexOffset += filterCount
  }
}

// @flow
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
  pointFramebuffer: WebGLFramebuffer
  quadFramebuffer: WebGLFramebuffer
  resultFramebuffer: WebGLFramebuffer
  pointTexture: WebGLTexture
  quadTexture: WebGLTexture
  resultTexture: WebGLTexture
  textures: Array<WebGLTexture>
  depthBuffer: WebGLRenderbuffer
  constructor (context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { 'aUV': 0, 'aST': 1, 'aXY': 2, 'aPad': 3, 'aWidth': 4, 'aID': 5 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }

    // setup the devicePixelRatio
    this.use()
    this.setDevicePixelRatio(devicePixelRatio)

    // TEXTURES
    this.pointTexture = gl.createTexture()
    this.quadTexture = gl.createTexture()
    this.resultTexture = gl.createTexture()
    this.textures = [this.pointTexture, this.quadTexture, this.resultTexture]

    for (const texture of this.textures) {
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

    // DEPTH
    this.depthBuffer = gl.createRenderbuffer()
    // bind
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
    // allocate renderbuffer
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)

    // FRAMEBUFFERS
    // POINT FRAMEBUFFER
    this.pointFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    // attach pointTexture to pointFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pointTexture, 0)
    // attach depthBuffer renderbuffer to pointFramebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthBuffer)
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

  clearScene () {
    const { context, gl } = this
    // clear pointFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    context.clearColorDepthBuffers()
    // clear quadFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    context.clearColorBuffer()
    // clear resultFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer)
    context.clearColorBuffer()
    // return to main framebuffer
    context.bindMainBuffer()
  }

  bindResultTexture () {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture)
  }

  bindPointFrameBuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    context.clearColorDepthBuffers()
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // set z-testing
    context.lequalDepth()
  }

  bindQuadFrameBuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    context.clearColorBuffer()
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    context.setBlendDefault()
    // remove z-testing
    context.alwaysDepth()
    context.stencilFunc(0)
  }

  bindResultFramebuffer () {
    const { context, gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer)
    context.clearColorBuffer()
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
  }

  draw (featureGuide: FeatureGuide, sourceData: GlyphTileSource, mode: 0 | 1 | 2) {
    const { gl } = this
    // grab variables
    const { featureCode, filterCount, filterOffset } = featureGuide
    const { glyphFilterBuffer } = sourceData
    // set feature code
    if (mode !== 0 && featureCode && featureCode.length) gl.uniform1fv(this.uFeatureCode, featureCode)
    // apply the appropriate offset
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphFilterBuffer)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 0 + ((filterOffset | 0) * 32)) // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 8 + ((filterOffset | 0) * 32)) // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 32, 16 + ((filterOffset | 0) * 32)) // padding
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 32, 24 + ((filterOffset | 0) * 32)) // width
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 32, 28 + ((filterOffset | 0) * 32)) // ID
    // draw based upon mode
    if (mode === 1) gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, filterCount) // quads
    else gl.drawArraysInstanced(gl.POINTS, 0, 1, filterCount) // points
  }
}

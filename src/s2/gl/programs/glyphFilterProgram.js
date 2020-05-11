// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyphFilter1.vertex.glsl'
import frag1 from '../../shaders/glyphFilter1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyphFilter2.vertex.glsl'
import frag2 from '../../shaders/glyphFilter2.fragment.glsl'

import type { Context } from '../contexts'
import type { GlyphTileSource } from '../../source/tile'

export default class GlyphFilterProgram extends Program {
  pointFramebuffer: WebGLFramebuffer
  pointTexture: WebGLTexture
  quadTexture: WebGLTexture
  depthBuffer: WebGLRenderbuffer
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { 'aUV': 0, 'aST': 1, 'aXY': 2, 'aWH': 3, 'aID': 4, 'aRadius': 6 }
      super(context, vert1, frag1)
    } else {
      super(context, vert2, frag2)
    }

    // TEXTURES
    // POINT TEXTURE
    this.pointTexture = gl.createTexture()
    // bind
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // create pointTexture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // QUAD TEXTURE
    this.quadTexture = gl.createTexture()
    // bind
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // create quadTexture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

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
    context.clearColorDepthBuffers()
    // QUAD FRAMEBUFFER
    this.quadFramebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    // attach quadTexture to quadFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.quadTexture, 0)
    context.clearColorBuffer()

    // we are finished, so go back to our main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  resize () {
    const { gl } = this
    // bind the pointFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFramebuffer)
    // bind the pointTexture
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // bind the depthBuffer buffer
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
    // update the depthBuffer's aspect
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, gl.canvas.width, gl.canvas.height)
    // bind the quadFramebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer)
    // bind the quadTexture
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture)
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // reassociate with the main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
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
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture)
    // remove z-testing
    context.alwaysDepth()
    context.stencilFunc(0)
  }

  drawPoints (sourceData: GlyphTileSource) {
    // grab context
    const { context } = this
    const { gl } = context
    const { boxPrimcount } = sourceData
    // set 3D uniform
    // this.set3D(threeD)
    // draw points
    gl.drawArraysInstanced(gl.POINTS, 0, 1, boxPrimcount)
  }

  drawQuads (sourceData: GlyphTileSource, tmpMaskID: number) {
    // grab context
    const { context } = this
    const { gl } = context
    const { boxPrimcount } = sourceData
    // draw quads
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, boxPrimcount)
  }

  drawTextBounds (sourceData: GlyphTileSource) {

  }
}

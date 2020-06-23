// @flow
import Program from './program'

// WEBGL1
import vert1 from '../../shaders/glyph1.vertex.glsl'
import frag1 from '../../shaders/glyph1.fragment.glsl'
// WEBGL2
import vert2 from '../../shaders/glyph2.vertex.glsl'
import frag2 from '../../shaders/glyph2.fragment.glsl'

import type { Context } from '../contexts'
import type { GlyphTileSource } from '../../source/tile'

type FBO = {
  width: number,
  height: number,
  texSize: Float32Array,
  texture: WebGLTexture,
  depthStencil: WebGLRenderbuffer,
  glyphFramebuffer: WebGLFramebuffer
}

export default class GlyphProgram extends Program {
  uTexSize: WebGLUniformLocation
  glyphLineProgram: Program
  fbos: Array<FBO> = []
  constructor (context: Context, glyphLineProgram: Program) {
    // get gl from context
    const { gl, type } = context
    // build shaders
    if (type === 1) {
      gl.attributeLocations = { aPos: 0, type: 7 }
      super(context, vert1, frag1, false)
    } else {
      super(context, vert2, frag2, false)
    }
    // store line program
    this.glyphLineProgram = glyphLineProgram
    // get uniform locations
    this.uTexSize = gl.getUniformLocation(this.glProgram, 'uTexSize')
  }

  injectFrameUniforms () {}
  flush () {}

  getFBO (id: number, height?: number = 1): FBO {
    let fbo = this.fbos[id]
    // if fbo exists, return it, otherwise we have to create the fbo
    if (!fbo) fbo = this.fbos[id] = this._buildFramebuffer(id, Math.max(height, 210))
    // if the height doesn't match the source, we update the height
    else if (height > fbo.height) fbo = this.fbos[id] = this._increaseFBOSize(id, fbo, height)

    return fbo
  }

  _buildFramebuffer (id: number, height: number): FBO {
    const { gl } = this
    const fbo = {
      height,
      texSize: new Float32Array([2048, height]),
      texture: gl.createTexture(),
      depthStencil: gl.createRenderbuffer(),
      glyphFramebuffer: gl.createFramebuffer()
    }
    // TEXTURE BUFFER
    // pre-build the glyph texture
    // bind
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture)
    // allocate size
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // DEPTH & STENCIL BUFFER
    // bind
    gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.depthStencil)
    // allocate size
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, 2048, height)
    // FRAMEBUFFER
    // bind
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyphFramebuffer)
    // attach texture to glyphFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo.texture, 0)
    // attach stencil renderbuffer to framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, fbo.depthStencil)
    // rebind our default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return fbo
  }

  _increaseFBOSize (id: number, fbo: FBO, height: number): FBO {
    // TODO: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/copyTexSubImage2D
    const { gl, context } = this

    // build the new fbo
    const newFBO = this._buildFramebuffer(id, height)
    // copy over data
    if (context.type === 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyphFramebuffer)
      gl.bindTexture(gl.TEXTURE_2D, newFBO.texture)
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, 2048, fbo.height)
    } else {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo.glyphFramebuffer)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, newFBO.glyphFramebuffer)
      gl.blitFramebuffer(0, 0, 2048, fbo.height, 0, 0, 2048, fbo.height, gl.COLOR_BUFFER_BIT, gl.LINEAR)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // TODO: delete old FBO and set new
    this._deleteFBO(fbo)
    // update to new FBO
    return newFBO
  }

  _deleteFBO (fbo: FBO) {
    const { gl } = this
    gl.deleteTexture(fbo.texture)
    gl.deleteRenderbuffer(fbo.depthStencil)
    gl.deleteFramebuffer(fbo.glyphFramebuffer)
    delete fbo.width
    delete fbo.height
    delete fbo.texSize
    delete fbo.texture
    delete fbo.depthStencil
    delete fbo.glyphFramebuffer
  }

  setTexSize (texSize: Float32Array) {
    this.gl.uniform2fv(this.uTexSize, texSize)
  }

  cleanGlyphSource (source: GlyphTileSource) {
    const { gl } = this

    gl.deleteBuffer(source.glyphFillVertexBuffer)
    gl.deleteBuffer(source.glyphFillIndexBuffer)
    gl.deleteBuffer(source.glyphLineVertexBuffer)
    gl.deleteVertexArray(source.glyphFillVAO)
    gl.deleteVertexArray(source.glyphLineVAO)
    delete source.glyphFillVertexBuffer
    delete source.glyphFillIndexBuffer
    delete source.glyphLineVertexBuffer
    delete source.glyphFillVAO
    delete source.glyphLineVAO
    delete source.glyphLineVertices
    delete source.glyphLineTypeArray
    delete source.glyphFillVertices
    delete source.glyphFillIndices
  }

  draw (source: GlyphTileSource) {
    const { context, gl, glyphLineProgram } = this
    // pull out the appropriate data from the source
    const { textureID, glyphFillVAO, glyphFillIndices } = source

    // PREPARE
    // grab the correct framebuffer variables
    const { height, texSize, glyphFramebuffer } = this.getFBO(textureID, source.height)
    // bind the framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphFramebuffer)
    // set the viewport
    gl.viewport(0, 0, 2048, height)
    // allow front and back faces
    context.disableCullFace()

    // LINE
    // set depth test is on
    context.enableDepthTest()
    context.lessDepth()
    // disable stencil
    context.disableStencilTest()
    // set program as current
    glyphLineProgram.use()
    // set appropriate aspect
    glyphLineProgram.setAspect(texSize)
    // draw lines
    glyphLineProgram.draw(source)
    // enable stencil
    context.enableStencilTest()

    // FILL
    const indexLength = glyphFillIndices.length
    if (indexLength) {
      // prep blending type
      context.inversionBlending()
      // now use current program
      this.use()
      // set the texture size uniform
      this.setTexSize(texSize)
      // disable depth test
      context.disableDepthTest()
      // set the correct vao
      gl.bindVertexArray(glyphFillVAO)
      // draw fill onto the stencil
      context.stencilInvert()
      gl.drawElements(gl.TRIANGLES, indexLength, gl.UNSIGNED_INT, 0)
      // draw fill using the stencil as a guide
      context.stencilZero()
      context.lockMasks()
      gl.drawElements(gl.TRIANGLES, indexLength, gl.UNSIGNED_INT, 0)
      // turn depth testing back on
      context.enableDepthTest()
    }

    this.cleanGlyphSource(source)

    // rebind default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // reset viewport
    context.resetViewport()
  }
}

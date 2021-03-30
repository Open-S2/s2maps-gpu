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
  stencil: WebGLRenderbuffer,
  glyphFramebuffer: WebGLFramebuffer
}

export default class GlyphProgram extends Program {
  uTexSize: WebGLUniformLocation
  uOffset: WebGLUniformLocation
  glyphLineProgram: Program
  fbos: Array<FBO> = []
  constructor (context: Context) {
    // get gl from context
    const { gl, type } = context
    // build shaders
    if (type === 1) gl.attributeLocations = { aPos: 0, aType: 7 }
    // inject program
    super(context)
    const self = this

    return Promise.all([
      (type === 1) ? vert1 : vert2,
      (type === 1) ? frag1 : frag2
    ])
      .then(([vertex, fragment]) => {
        // build said shaders
        self.buildShaders(vertex, fragment)

        return self
      })
  }

  injectGlyphLine (glyphLineProgram: Program) {
    // store line program
    this.glyphLineProgram = glyphLineProgram
  }

  delete () {
    // cleanup fbos
    this.clearCache()
    // cleanup programs
    super.delete()
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

  clearCache () {
    for (const fbo of this.fbos) this._deleteFBO(fbo)
    this.fbos = []
  }

  _buildFramebuffer (id: number, height: number): FBO {
    const { gl } = this
    const fbo = {
      height,
      texSize: new Float32Array([2048, height]),
      texture: gl.createTexture(),
      stencil: gl.createRenderbuffer(),
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
    gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.stencil)
    // allocate size
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, 2048, height)
    // FRAMEBUFFER
    // bind
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.glyphFramebuffer)
    // attach texture to glyphFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo.texture, 0)
    // attach stencil renderbuffer to framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, fbo.stencil)
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
    if (fbo) {
      gl.deleteTexture(fbo.texture)
      gl.deleteRenderbuffer(fbo.stencil)
      gl.deleteFramebuffer(fbo.glyphFramebuffer)
      delete fbo.width
      delete fbo.height
      delete fbo.texSize
      delete fbo.texture
      delete fbo.stencil
      delete fbo.glyphFramebuffer
    }
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
    const { context, gl, glyphLineProgram, uOffset } = this
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
    context.disableDepthTest()
    // disable stencil
    context.disableStencilTest()
    // set program as current
    glyphLineProgram.use()
    // set appropriate aspect
    glyphLineProgram.setAspect(texSize)
    // draw lines
    glyphLineProgram.draw(source)

    // FILL
    const indexLength = glyphFillIndices.length
    if (indexLength) {
      // prep blending type
      context.inversionBlend()
      // now use current program
      this.use()
      // set the texture size uniform
      this.setTexSize(texSize)
      // set the correct vao
      gl.bindVertexArray(glyphFillVAO)
      for (let i = 0; i < 4; i++) {
        // set the offset
        gl.uniform1i(uOffset, i)
        // draw fill onto the stencil
        context.stencilInvert()
        gl.drawElements(gl.TRIANGLES, indexLength, gl.UNSIGNED_INT, 0)
        // draw fill onto texture using the stencil as a guide
        context.stencilZero()
        gl.drawElements(gl.TRIANGLES, indexLength, gl.UNSIGNED_INT, 0)
      }
    }

    // cleanup
    this.cleanGlyphSource(source)

    // rebind default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // reset viewport
    context.resetViewport()
  }
}

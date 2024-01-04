/* eslint-env browser */
import buildMask from './buildMask'

import type { MapOptions } from 'ui/s2mapUI'
import type { Context as ContextSpec, FBO, MaskSource } from './context.spec'
import type { GPUType, Projection } from 'style/style.spec'
import type { BBox } from 'geometry'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { SpriteImageMessage } from 'workers/worker.spec'

const DEPTH_ESPILON = 1 / Math.pow(2, 16)

// CONSIDER: get apple devices https://github.com/pmndrs/detect-gpu/blob/master/src/internal/deobfuscateAppleGPU.ts

export default class Context implements ContextSpec {
  gl: WebGLRenderingContext | WebGL2RenderingContext
  presentation: { width: number, height: number } = { width: 0, height: 0 }
  renderer: string // ex: AMD Radeon Pro 560 OpenGL Engine (https://github.com/pmndrs/detect-gpu)
  devicePixelRatio: number
  interactive = false
  depthState: boolean
  cullState: boolean
  stencilState: boolean
  blendState: boolean
  blendMode = -1 // 0 -> default ; 1 ->
  zTestMode = -1 // 0 -> always ; 1 -> less ; 2 -> lessThenOrEqual
  zLow = 0
  zHigh = 1
  type: GPUType = 1
  projection: Projection = 'S2'
  clearColorRGBA: [r: number, g: number, b: number, a: number] = [0, 0, 0, 0]
  featurePoint: Uint8Array = new Uint8Array(4)
  masks = new Map<number, MaskSource>() // <zoom, mask>
  vao!: WebGLVertexArrayObject
  vertexBuffer!: WebGLBuffer
  interactTexture!: WebGLTexture
  stencilBuffer!: WebGLRenderbuffer
  interactFramebuffer!: WebGLFramebuffer
  defaultBounds: BBox = [0, 0, 1, 1]
  nullTexture!: WebGLTexture
  sharedFBO: FBO
  constructor (context: WebGLRenderingContext | WebGL2RenderingContext, options: MapOptions) {
    const { canvasMultiplier } = options
    const gl = this.gl = context
    this.devicePixelRatio = canvasMultiplier ?? 1
    this.#buildNullTexture()
    this.sharedFBO = this.#buildFramebuffer(200)
    this.#buildInteractFBO()
    // lastly grab the renderers id
    const debugRendererInfo = context.getExtension('WEBGL_debug_renderer_info')
    if (debugRendererInfo !== undefined) this.renderer = cleanRenderer(context.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL))
    else this.renderer = context.getParameter(context.RENDERER)
    // set initial states
    gl.enable(gl.STENCIL_TEST)
    this.stencilState = true
    gl.enable(gl.DEPTH_TEST)
    this.depthState = true
    gl.enable(gl.CULL_FACE)
    this.cullState = true
    gl.enable(gl.BLEND)
    this.blendState = true
    this.defaultBlend()
  }

  // SETUP NULL TEXTURE

  #buildNullTexture (): void {
    this.nullTexture = this.buildTexture(null, 1)
  }

  // MANAGE FRAMEBUFFER OBJECTS

  #buildFramebuffer (height: number): FBO {
    const { gl } = this
    const texture = gl.createTexture()
    if (texture === null) throw new Error('Failed to create glyph texture')
    const stencil = gl.createRenderbuffer()
    if (stencil === null) throw new Error('Failed to create glyph stencil')
    const glyphFramebuffer = gl.createFramebuffer()
    if (glyphFramebuffer === null) throw new Error('Failed to create glyph framebuffer')
    // TEXTURE BUFFER
    // pre-build the glyph texture
    // bind
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // allocate size
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // DEPTH & STENCIL BUFFER
    // bind
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencil)
    // allocate size
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, 2048, height)
    // FRAMEBUFFER
    // bind
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphFramebuffer)
    // attach texture to glyphFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    // attach stencil renderbuffer to framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil)
    // rebind our default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return {
      width: 2048,
      height,
      texSize: [2048, height],
      texture,
      stencil,
      glyphFramebuffer
    }
  }

  #increaseFBOSize (height: number): void {
    const { gl, type, sharedFBO } = this
    if (height <= sharedFBO.height) return

    // build the new fbo
    const newFBO = this.#buildFramebuffer(height)
    // copy over data
    if (type === 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sharedFBO.glyphFramebuffer)
      gl.bindTexture(gl.TEXTURE_2D, newFBO.texture)
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, 2048, sharedFBO.height)
    } else {
      const gl2 = gl as WebGL2RenderingContext
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, sharedFBO.glyphFramebuffer)
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, newFBO.glyphFramebuffer)
      gl2.blitFramebuffer(0, 0, 2048, sharedFBO.height, 0, 0, 2048, sharedFBO.height, gl.COLOR_BUFFER_BIT, gl.LINEAR)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // delete old FBO and set new
    this.#deleteFBO(sharedFBO)
    // update to new FBO
    this.sharedFBO = newFBO
  }

  #deleteFBO (fbo: FBO): void {
    const { gl } = this
    if (fbo !== undefined) {
      gl.deleteTexture(fbo.texture)
      gl.deleteRenderbuffer(fbo.stencil)
      gl.deleteFramebuffer(fbo.glyphFramebuffer)
    }
  }

  // MANAGE IMAGE IMPORTS

  injectImages (maxHeight: number, images: GlyphImages): void {
    const { gl } = this
    // increase texture size if necessary
    this.#increaseFBOSize(maxHeight)
    // iterate through images and store
    gl.bindTexture(gl.TEXTURE_2D, this.sharedFBO.texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    for (const { posX, posY, width, height, data } of images) {
      const srcData = new Uint8ClampedArray(data)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, posX, posY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, srcData, 0)
    }
  }

  injectSpriteImage (data: SpriteImageMessage): void {
    const { gl } = this
    const { image, built, offsetX, offsetY, width, height, maxHeight } = data
    // increase texture size if necessary
    this.#increaseFBOSize(maxHeight)
    // do not premultiply
    gl.bindTexture(gl.TEXTURE_2D, this.sharedFBO.texture)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)
    if (built) {
      // @ts-expect-error - not sure why this is throwing an error, it works and the types account for it.
      gl.texSubImage2D(gl.TEXTURE_2D, 0, offsetX, offsetY, gl.RGBA, gl.UNSIGNED_BYTE, image as ImageBitmap)
    } else {
      const srcData = new Uint8ClampedArray(image as ArrayBuffer)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, offsetX, offsetY, width, height, gl.RGBA, gl.UNSIGNED_BYTE, srcData, 0)
    }
  }

  // SETUP INTERACTIVE BUFFER

  #buildInteractFBO (): void {
    const { gl } = this
    // TEXTURE & STENCIL
    const texture = gl.createTexture()
    if (texture === null) throw new Error('Failed to create interactive texture')
    this.interactTexture = texture
    const stencil = gl.createRenderbuffer()
    if (stencil === null) throw new Error('Failed to create interactive stencil buffer')
    this.stencilBuffer = stencil
    this.resizeInteract()
    // FRAMEBUBFFER
    const interactFrameBuffer = gl.createFramebuffer()
    if (interactFrameBuffer === null) throw new Error('Failed to create interactive framebuffer')
    this.interactFramebuffer = interactFrameBuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, interactFrameBuffer)
    // attach texture to feature framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    // attach stencilBuffer renderbuffer to feature framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil)
    // cleanup
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  resize (): void {
    const { width, height } = this.gl.canvas
    this.presentation = { width, height }
    this.resizeInteract()
  }

  setInteractive (interactive: boolean): void {
    this.interactive = interactive
    this.resizeInteract()
  }

  setProjection (projection: Projection): void {
    const { gl } = this
    this.projection = projection
    if (projection === 'S2') gl.cullFace(gl.BACK)
    else gl.cullFace(gl.FRONT)
  }

  resizeInteract (): void {
    const { gl, interactive } = this
    const width = interactive ? gl.canvas.width : 1
    const height = interactive ? gl.canvas.height : 1
    // bind the pointTexture
    gl.bindTexture(gl.TEXTURE_2D, this.interactTexture)
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // update the depthBuffer's aspect
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, width, height)
  }

  async getFeatureAtMousePosition (x: number, y: number): Promise<undefined | number> {
    const { gl, interactFramebuffer, featurePoint } = this
    // bind the feature framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, interactFramebuffer)
    // grab the data
    gl.readPixels(x, gl.canvas.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, featurePoint)

    if (featurePoint[3] !== 255) return
    // create the actual feature id
    const featureID = featurePoint[0] + (featurePoint[1] << 8) + (featurePoint[2] << 16)
    // return if we found something
    if (featureID > 0) return featureID
  }

  delete (): void {
    const { gl, vertexBuffer, vao, interactTexture, stencilBuffer, interactFramebuffer } = this
    // remove local data
    gl.deleteBuffer(vertexBuffer)
    gl.deleteVertexArray(vao)
    gl.deleteTexture(interactTexture)
    gl.deleteRenderbuffer(stencilBuffer)
    gl.deleteFramebuffer(interactFramebuffer)
    // remove all possible references
    // gl.bindBuffer(gl.ARRAY_BUFFER, null)
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    // gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.#deleteFBO(this.sharedFBO)
    // set canvas to smallest size possible
    gl.canvas.width = 1
    gl.canvas.height = 1
    // attempt to force a context loss
    gl.getExtension('WEBGL_lose_context').loseContext()
  }

  /** CONSTRUCTION **/

  _createDefaultQuad (): void {
    const { gl } = this
    // create a vertex array object
    this.vao = this.buildVAO()
    // Create a vertex buffer
    const ab = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1])
    this.vertexBuffer = this.bindEnableVertexAttr(ab, 0, 2, gl.FLOAT, false, 0, 0)
    // clear vao
    gl.bindVertexArray(null)
  }

  // the zoom determines the number of divisions necessary to maintain a visually
  // asthetic spherical shape. As we zoom in, the tiles are practically flat,
  // so division is less useful.
  // 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
  // context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
  getMask (division: number): MaskSource {
    const { masks } = this
    // check if we have a mask for this level
    let mask = masks.get(division)
    if (mask !== undefined) return mask
    // otherwise, create a new mask
    mask = buildMask(division, this)
    masks.set(division, mask)
    return mask
  }

  drawQuad (): void {
    const { gl, vao } = this
    // bind the vao
    gl.bindVertexArray(vao)
    // draw a fan
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }

  /** PREP PHASE **/

  resetViewport (): void {
    const { gl } = this
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }

  bindMainBuffer (): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  setClearColor (clearColor: [r: number, g: number, b: number, a: number]): void {
    this.clearColorRGBA = clearColor
  }

  newScene (): void {
    const { gl } = this
    this.clearColor()
    gl.clearStencil(0x0)
    gl.clearDepth(1)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
  }

  clearInteractBuffer (): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.interactFramebuffer)
    gl.clearColor(0, 0, 0, 0)
    gl.clearStencil(0x0)
    gl.clear(gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
  }

  clearColor (): void {
    const { gl } = this
    gl.clearColor(...this.clearColorRGBA)
    gl.blendColor(0, 0, 0, 0)
  }

  clearColorDepthBuffers (): void {
    const { gl } = this
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT)
  }

  clearColorBuffer (): void {
    const { gl } = this
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** TEXTURE **/

  buildTexture (
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height: number = width,
    repeat = false
  ): WebGLTexture {
    const { gl } = this
    const texture = gl.createTexture()
    const param = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
    if (texture === null) throw new Error('Failed to create texture')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    // check if ImageBitmap
    if (imageData instanceof ImageBitmap) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, param)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, param)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

    return texture
  }

  updateTexture (
    texture: WebGLTexture,
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height: number
  ): void {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }

  /** DEPTH **/

  enableDepthTest (): void {
    const { gl, depthState } = this
    if (!depthState) {
      gl.enable(gl.DEPTH_TEST)
      this.depthState = true
    }
  }

  disableDepthTest (): void {
    const { gl, depthState } = this
    if (depthState) {
      gl.disable(gl.DEPTH_TEST)
      this.depthState = false
    }
  }

  alwaysDepth (): void {
    const { gl, zTestMode } = this
    if (zTestMode !== 0) {
      this.zTestMode = 0
      gl.depthFunc(gl.ALWAYS)
    }
  }

  lessDepth (): void {
    const { gl, zTestMode } = this
    if (zTestMode !== 1) {
      this.zTestMode = 1
      gl.depthFunc(gl.LESS)
    }
  }

  lequalDepth (): void {
    const { gl, zTestMode } = this
    if (zTestMode !== 2) {
      this.zTestMode = 2
      gl.depthFunc(gl.LEQUAL)
    }
  }

  setDepthRange (depthPos: number): void {
    const { gl, zLow, zHigh } = this
    const depth = 1 - (depthPos + 1) * DEPTH_ESPILON
    if (zLow !== depth || zHigh !== depth) {
      gl.depthRange(depth, depth)
      this.zLow = this.zHigh = depth
    }
  }

  resetDepthRange (): void {
    const { gl, zLow, zHigh } = this
    if (zLow !== 0 || zHigh !== 1) {
      gl.depthRange(0, 1)
      this.zLow = 0
      this.zHigh = 1
    }
  }

  /** WALLPAPER **/

  wallpaperState (): void {
    this.defaultBlend()
    this.disableCullFace()
    this.disableDepthTest()
    this.enableStencilTest()
    this.stencilFuncEqual(0)
  }

  /** CULLING **/

  enableCullFace (): void {
    const { gl, cullState } = this
    if (!cullState) {
      gl.enable(gl.CULL_FACE)
      this.cullState = true
    }
  }

  disableCullFace (): void {
    const { gl, cullState } = this
    if (cullState) {
      gl.disable(gl.CULL_FACE)
      this.cullState = false
    }
  }

  /** BLENDING **/

  enableBlend (): void {
    const { gl, blendState } = this
    if (!blendState) {
      gl.enable(gl.BLEND)
      this.blendState = true
    }
  }

  disableBlend (): void {
    const { gl, blendState } = this
    if (blendState) {
      gl.disable(gl.BLEND)
      this.blendState = false
    }
  }

  defaultBlend (): void {
    const { gl, blendMode } = this
    this.enableBlend()
    if (blendMode !== 0) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      this.blendMode = 0
    }
  }

  shadeBlend (): void {
    const { gl, blendMode } = this
    this.enableBlend()
    if (blendMode !== 1) {
      gl.blendFunc(gl.DST_COLOR, gl.ZERO)
      this.blendMode = 1
    }
  }

  inversionBlend (): void {
    const { gl, blendMode } = this
    this.enableBlend()
    if (blendMode !== 2) {
      gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR)
      this.blendMode = 2
    }
  }

  zeroBlend (): void {
    const { gl, blendMode } = this
    this.enableBlend()
    if (blendMode !== 3) {
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR)
      this.blendMode = 3
    }
  }

  oneBlend (): void {
    const { gl, blendMode } = this
    this.enableBlend()
    if (blendMode !== 4) {
      gl.blendFunc(gl.ONE, gl.ONE)
      this.blendMode = 4
    }
  }

  /** STENCILING **/

  enableStencilTest (): void {
    const { gl, stencilState } = this
    if (!stencilState) {
      gl.enable(gl.STENCIL_TEST)
      this.stencilState = true
    }
  }

  disableStencilTest (): void {
    const { gl, stencilState } = this
    if (stencilState) {
      gl.disable(gl.STENCIL_TEST)
      this.stencilState = false
    }
  }

  stencilFuncAlways (ref: number): void {
    const { gl } = this
    gl.stencilFunc(gl.ALWAYS, ref, 0xFF)
  }

  stencilFuncEqual (ref: number): void {
    const { gl } = this
    gl.stencilFunc(gl.EQUAL, ref, 0xFF)
  }

  stencilDefault (): void {
    const { gl } = this
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.colorMask(true, true, true, true)
  }

  stencilInvert (): void {
    const { gl } = this
    gl.colorMask(false, false, false, false)
    gl.stencilOp(gl.KEEP, gl.INVERT, gl.INVERT)
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF)
  }

  stencilZero (): void {
    const { gl } = this
    gl.colorMask(true, true, true, true)
    gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE)
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xFF)
  }

  /** MASKING **/

  enableMaskTest (): void {
    const { gl } = this
    this.defaultBlend()
    this.enableCullFace()
    this.disableDepthTest()
    this.enableStencilTest()
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    gl.colorMask(false, false, false, false)
  }

  flushMask (): void {
    this.gl.colorMask(true, true, true, true)
  }

  /** VAO **/
  buildVAO (): WebGLVertexArrayObject {
    const { gl } = this
    const vao = gl.createVertexArray()
    if (vao === null) throw new Error('Failed to create vertex array object')
    // and make it the one we're currently working with
    gl.bindVertexArray(vao)

    return vao
  }

  /** Attributes **/

  bindEnableVertexAttr (
    ab: ArrayBufferView,
    indx: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    instance = false
  ): WebGLBuffer {
    const buf = this.bindAndBuffer(ab)

    this.defineBufferState(indx, size, type, normalized, stride, offset, instance)

    return buf
  }

  bindEnableVertexAttrMulti (
    ab: ArrayBufferView,
    // [indx, size, type, normalized, stride, offset]
    attributes: Array<[index: number, size: number, type: number, normalized: boolean, stride: number, offset: number]>,
    instance = false
  ): WebGLBuffer {
    const buf = this.bindAndBuffer(ab)

    for (const attr of attributes) this.defineBufferState(...attr, instance)

    return buf
  }

  bindAndBuffer (ab: ArrayBufferView): WebGLBuffer {
    const { gl } = this
    const buf = gl.createBuffer()
    if (buf === null) throw Error('Failed to create buffer')
    // Bind and buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW)

    return buf
  }

  defineBufferState (
    indx: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    instance = false
  ): void {
    const { gl } = this
    // setup feature attribute
    gl.enableVertexAttribArray(indx)
    gl.vertexAttribPointer(indx, size, type, normalized, stride, offset)
    // instance attribute if needed
    if (instance) gl.vertexAttribDivisor(indx, 1)
  }

  bindElementArray (ab: ArrayBufferView): WebGLBuffer {
    const { gl } = this
    const buf = gl.createBuffer()
    if (buf === null) throw Error('Failed to create buffer')
    // Bind and buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ab, gl.STATIC_DRAW)

    return buf
  }

  /** CLEANUP **/

  cleanup (): void {
    const { gl } = this
    gl.bindVertexArray(null)
    // gl.bindBuffer(gl.ARRAY_BUFFER, null)
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

function cleanRenderer (renderer: string): string {
  return renderer
    .toLowerCase()
    .replace(/angle \((.+)\)*$/, '$1')
    // .replace(/\s+([0-9]+gb|direct3d|opengl.+$)|\(r\)| \([^)]+\)$/g, '')
}

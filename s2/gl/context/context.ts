import { GPUType } from 'style/style.spec';
import buildMask from './buildMask';

import type { BBox } from 'gis-tools';
import type { ColorArray } from 'style/color';
import type { GlyphImages } from 'workers/source/glyphSource';
import type { MapOptions } from 'ui/s2mapUI';
import type { Painter } from '../painter.spec';
import type { Projection } from 'style/style.spec';
import type { SpriteImageMessage } from 'workers/worker.spec';
import type { TileGL as Tile } from 'source/tile.spec';
import type { MaskSource, TileMaskSource, Workflow } from '../workflows/workflow.spec';

/** Frame buffer object like wrapper */
export interface FBO {
  width: number;
  height: number;
  texSize: number[];
  texture: WebGLTexture;
  stencil: WebGLRenderbuffer;
  glyphFramebuffer: WebGLFramebuffer;
}

const DEPTH_ESPILON = 1 / Math.pow(2, 16);

// CONSIDER: get apple devices https://github.com/pmndrs/detect-gpu/blob/master/src/internal/deobfuscateAppleGPU.ts

/**
 * # Context
 *
 * ## Description
 * A WebGL(1|2) context with GPU information.
 * A useful wrapper to store state and reduce costly GPU calls when unnecessary
 */
export default class Context {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  painter: Painter;
  type: GPUType = GPUType.WebGL1;
  projection: Projection = 'S2';
  presentation: { width: number; height: number } = { width: 0, height: 0 };
  renderer: string; // ex: AMD Radeon Pro 560 OpenGL Engine (https://github.com/pmndrs/detect-gpu)
  devicePixelRatio: number;
  interactive = false;
  depthState: boolean;
  cullState: boolean;
  stencilState: boolean;
  blendState: boolean;
  stencilRef = -1;
  blendMode = -1; // 0 -> default ; 1 ->
  zTestMode = -1; // 0 -> always ; 1 -> less ; 2 -> lessThenOrEqual
  zLow = 0;
  zHigh = 1;
  currWorkflow: undefined | Workflow = undefined;
  clearColorRGBA: ColorArray = [0, 0, 0, 0];
  featurePoint: Uint8Array = new Uint8Array(4);
  masks = new Map<number, MaskSource>(); // <zoom, mask>
  vao!: WebGLVertexArrayObject;
  vertexBuffer!: WebGLBuffer;
  interactTexture!: WebGLTexture;
  stencilBuffer!: WebGLRenderbuffer;
  interactFramebuffer!: WebGLFramebuffer;
  defaultBounds: BBox = [0, 0, 1, 1];
  nullTexture!: WebGLTexture;
  sharedFBO: FBO;
  /**
   * @param context - The WebGL1 or WebGL2 context to read from
   * @param options - Map options
   * @param painter - The painter that will use this context to manage rendering state
   */
  constructor(
    context: WebGLRenderingContext | WebGL2RenderingContext,
    options: MapOptions,
    painter: Painter,
  ) {
    const { canvasMultiplier } = options;
    const gl = (this.gl = context);
    this.painter = painter;
    this.devicePixelRatio = canvasMultiplier ?? 1;
    this.#buildNullTexture();
    this.sharedFBO = this.#buildFramebuffer(200);
    this.#buildInteractFBO();
    // lastly grab the renderers id
    const debugRendererInfo: WEBGL_debug_renderer_info | null = context.getExtension(
      'WEBGL_debug_renderer_info',
    );
    if (debugRendererInfo !== null)
      this.renderer = cleanRenderer(
        context.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL) as string,
      );
    else this.renderer = context.getParameter(context.RENDERER);
    // set initial states
    gl.enable(gl.STENCIL_TEST);
    this.stencilState = true;
    gl.enable(gl.DEPTH_TEST);
    this.depthState = true;
    gl.enable(gl.CULL_FACE);
    this.cullState = true;
    gl.enable(gl.BLEND);
    this.blendState = true;
    this.defaultBlend();
  }

  /* SETUP NULL TEXTURE */

  /** Setup a null texture for cases where we don't need to use the texture but the uniform is required */
  #buildNullTexture(): void {
    this.nullTexture = this.buildTexture(null, 1);
  }

  /* MANAGE FRAMEBUFFER OBJECTS */

  /**
   * Setup a framebuffer for things like glyph/icon/sprite/image rendering
   * @param height - The height of the framebuffer
   * @returns A framebuffer that can handle glyph/icon/sprite/image rendering
   */
  #buildFramebuffer(height: number): FBO {
    const { gl } = this;
    const texture = gl.createTexture();
    if (texture === null) throw new Error('Failed to create glyph texture');
    const stencil = gl.createRenderbuffer();
    if (stencil === null) throw new Error('Failed to create glyph stencil');
    const glyphFramebuffer = gl.createFramebuffer();
    if (glyphFramebuffer === null) throw new Error('Failed to create glyph framebuffer');
    // TEXTURE BUFFER
    // pre-build the glyph texture
    // bind
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // allocate size
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2048, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // DEPTH & STENCIL BUFFER
    // bind
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
    // allocate size
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, 2048, height);
    // FRAMEBUFFER
    // bind
    gl.bindFramebuffer(gl.FRAMEBUFFER, glyphFramebuffer);
    // attach texture to glyphFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    // attach stencil renderbuffer to framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
    // rebind our default framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      width: 2048,
      height,
      texSize: [2048, height],
      texture,
      stencil,
      glyphFramebuffer,
    };
  }

  /**
   * Increase the size of the glyph/icon/sprite/image framebuffer to accomodate more data
   * @param height - The height of the framebuffer
   */
  #increaseFBOSize(height: number): void {
    const { gl, type, sharedFBO } = this;
    if (height <= sharedFBO.height) return;

    // build the new fbo
    const newFBO = this.#buildFramebuffer(height);
    // copy over data
    if (type === 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sharedFBO.glyphFramebuffer);
      gl.bindTexture(gl.TEXTURE_2D, newFBO.texture);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, 2048, sharedFBO.height);
    } else {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, sharedFBO.glyphFramebuffer);
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, newFBO.glyphFramebuffer);
      gl2.blitFramebuffer(
        0,
        0,
        2048,
        sharedFBO.height,
        0,
        0,
        2048,
        sharedFBO.height,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // delete old FBO and set new
    this.#deleteFBO(sharedFBO);
    // update to new FBO
    this.sharedFBO = newFBO;
  }

  /**
   * Delete a framebuffer
   * @param fbo - The framebuffer to cleanup
   */
  #deleteFBO(fbo: FBO): void {
    const { gl } = this;
    if (fbo !== undefined) {
      gl.deleteTexture(fbo.texture);
      gl.deleteRenderbuffer(fbo.stencil);
      gl.deleteFramebuffer(fbo.glyphFramebuffer);
    }
  }

  /* MANAGE IMAGE IMPORTS */

  /**
   * Inject a glyph/icon image to the GPU
   * @param maxHeight - the maximum height of the texture required to hold the image
   * @param images - the glyph/icon images
   */
  injectImages(maxHeight: number, images: GlyphImages): void {
    const { gl } = this;
    // increase texture size if necessary
    this.#increaseFBOSize(maxHeight);
    // iterate through images and store
    gl.bindTexture(gl.TEXTURE_2D, this.sharedFBO.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    for (const { posX, posY, width, height, data } of images) {
      const srcData = new Uint8ClampedArray(data);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        posX,
        posY,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        srcData,
        0,
      );
    }
  }

  /**
   * Inject a sprite image to the GPU
   * @param data - the raw image data of the sprite
   */
  injectSpriteImage(data: SpriteImageMessage): void {
    const { gl } = this;
    const { image, offsetX, offsetY, width, height, maxHeight } = data;
    // increase texture size if necessary
    this.#increaseFBOSize(maxHeight);
    // do not premultiply
    gl.bindTexture(gl.TEXTURE_2D, this.sharedFBO.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    // (target: number, level: number, xoffset: number, yoffset: number, width: number, height: number, format: number, type: number, source: ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => void) &
    if (this.type === 1)
      (gl as WebGLRenderingContext).texSubImage2D(
        gl.TEXTURE_2D,
        0,
        offsetX,
        offsetY,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
    else
      (gl as WebGL2RenderingContext).texSubImage2D(
        gl.TEXTURE_2D,
        0,
        offsetX,
        offsetY,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
  }

  /* SETUP INTERACTIVE BUFFER */

  /** Setup an interactive FBO */
  #buildInteractFBO(): void {
    const { gl } = this;
    // TEXTURE & STENCIL
    const texture = gl.createTexture();
    if (texture === null) throw new Error('Failed to create interactive texture');
    this.interactTexture = texture;
    const stencil = gl.createRenderbuffer();
    if (stencil === null) throw new Error('Failed to create interactive stencil buffer');
    this.stencilBuffer = stencil;
    this.resizeInteract();
    // FRAMEBUBFFER
    const interactFrameBuffer = gl.createFramebuffer();
    if (interactFrameBuffer === null) throw new Error('Failed to create interactive framebuffer');
    this.interactFramebuffer = interactFrameBuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, interactFrameBuffer);
    // attach texture to feature framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    // attach stencilBuffer renderbuffer to feature framebuffer
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
    // cleanup
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Resize the size of the canvas and all associating buffers */
  resize(): void {
    const { width, height } = this.gl.canvas;
    this.presentation = { width, height };
    this.resizeInteract();
  }

  /**
   * Set the interactive mode
   * @param interactive - the interactive mode (true means it is interactive)
   */
  setInteractive(interactive: boolean): void {
    this.interactive = interactive;
    this.resizeInteract();
  }

  /**
   * Set the projection type (S2 or WM)
   * @param projection - the projection
   */
  setProjection(projection: Projection): void {
    const { gl } = this;
    this.projection = projection;
    if (projection === 'S2') gl.cullFace(gl.BACK);
    else gl.cullFace(gl.FRONT);
  }

  /** Resize the interactive buffer */
  resizeInteract(): void {
    const { gl, interactive } = this;
    const width = interactive ? gl.canvas.width : 1;
    const height = interactive ? gl.canvas.height : 1;
    // bind the pointTexture
    gl.bindTexture(gl.TEXTURE_2D, this.interactTexture);
    // update the texture's aspect
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // update the depthBuffer's aspect
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.stencilBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, width, height);
  }

  /**
   * Get the collection of features found at the mouse position
   * @param x - x mouse position
   * @param y - y mouse position
   * @returns the collection of features found
   */
  async getFeatureAtMousePosition(x: number, y: number): Promise<number[]> {
    const { gl, interactFramebuffer, featurePoint } = this;
    const res: number[] = [];
    // bind the feature framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, interactFramebuffer);
    // grab the data
    gl.readPixels(x, gl.canvas.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, featurePoint);

    if (featurePoint[3] !== 255) return res;
    // create the actual feature id
    const featureID = featurePoint[0] + (featurePoint[1] << 8) + (featurePoint[2] << 16);
    // return if we found something
    if (featureID > 0) res.push(featureID);
    return await res;
  }

  /** Delete/cleanup the context */
  delete(): void {
    const { gl, vertexBuffer, vao, interactTexture, stencilBuffer, interactFramebuffer } = this;
    // remove local data
    gl.deleteBuffer(vertexBuffer);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(interactTexture);
    gl.deleteRenderbuffer(stencilBuffer);
    gl.deleteFramebuffer(interactFramebuffer);
    // remove all possible references
    // gl.bindBuffer(gl.ARRAY_BUFFER, null)
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    // gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.#deleteFBO(this.sharedFBO);
    // set canvas to smallest size possible
    gl.canvas.width = 1;
    gl.canvas.height = 1;
    // attempt to force a context loss
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** CONSTRUCTION */

  /** Create a default quad for cases where a quad is needed (avoid allocation for every quad) */
  _createDefaultQuad(): void {
    const { gl } = this;
    // create a vertex array object
    this.vao = this.buildVAO();
    // Create a vertex buffer
    const ab = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    this.vertexBuffer = this.bindEnableVertexAttr(ab, 0, 2, gl.FLOAT, false, 0, 0);
    // clear vao
    gl.bindVertexArray(null);
  }

  /**
   * Get the mask for a tile
   * the zoom determines the number of divisions necessary to maintain a visually
   * asthetic spherical shape. As we zoom in, the tiles are practically flat,
   * so division is less useful.
   * 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
   * context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
   * @param division - number of division to slice the geometry by
   * @param tile - the tile to create the mask for
   * @returns the mask
   */
  getMask(division: number, tile: Tile): TileMaskSource {
    const { masks } = this;
    // check if we have a mask for this level
    let mask = masks.get(division);
    if (mask === undefined) {
      mask = buildMask(division, this);
      masks.set(division, mask);
    }
    // we want to mimic the functionality of other draw structures
    const tileMaskSource: TileMaskSource = {
      ...mask,
      tile,
      /** internal draw command */
      draw: (): void => {
        const { fill } = this.painter.workflows;
        if (fill === undefined) return;
        // let the context know the current workflow
        this.setWorkflow(fill);
        this.stencilFuncAlways(tile.tmpMaskID);
        // ensure the tile information is set
        fill.setTileUniforms(tile);
        fill.drawMask(tileMaskSource);
      },
      /** internal destroy command */
      destroy: (): void => {},
    };

    return tileMaskSource;
  }

  /** Draw a quad */
  drawQuad(): void {
    const { gl, vao } = this;
    // bind the vao
    gl.bindVertexArray(vao);
    // draw a fan
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }

  /* PREP PHASE */

  /** Reset the viewport */
  resetViewport(): void {
    const { gl } = this;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  /** Bind to the main buffer */
  bindMainBuffer(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Set a clear color for the initialization draws (like the background color)
   * @param clearColor - the clear color
   */
  setClearColor(clearColor: ColorArray): void {
    this.clearColorRGBA = clearColor;
  }

  /** Setup a new scene for future draw calls */
  newScene(): void {
    const { gl } = this;
    // ensure we are attached to the main buffer
    this.bindMainBuffer();
    // prep context variables
    this.clearColor();
    this.stencilRef = -1;
    gl.clearStencil(0x0);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  }

  /** Reset the current workflow */
  resetWorkflow(): void {
    this.currWorkflow = undefined;
  }

  /**
   * Set the current workflow
   * @param workflow - the workflow to set as the current
   * @param use - flag to say we want to also activate the workflow
   */
  setWorkflow(workflow: Workflow, use = true): void {
    if (this.currWorkflow?.label === workflow.label) return;
    if (use) workflow?.use();
    this.currWorkflow = workflow;
  }

  /** Clear the interact buffer */
  clearInteractBuffer(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.interactFramebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clearStencil(0x0);
    gl.clear(gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  }

  /** Clear the canvas using the current clear color */
  clearColor(): void {
    const { gl } = this;
    gl.clearColor(...this.clearColorRGBA);
    gl.blendColor(0, 0, 0, 0);
  }

  /** Clear both the color and depth buffers */
  clearColorDepthBuffers(): void {
    const { gl } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  }

  /** Clear the color buffer */
  clearColorBuffer(): void {
    const { gl } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /* TEXTURE */

  /**
   * Build a new texture
   * @param imageData - the raw image data to inject to the texture
   * @param width - width of the texture
   * @param height - height of the texture
   * @param repeat - should the texture repeat
   * @returns the texture
   */
  buildTexture(
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height: number = width,
    repeat = false,
  ): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    if (texture === null) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // do not premultiply
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    // set the texture params
    const param = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // inject image data. Check if ImageBitmap or ArrayBuffer
    if (imageData instanceof ImageBitmap) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageData,
      );
    }

    return texture;
  }

  /**
   * Update an existing texture
   * @param texture - the texture to update
   * @param imageData - the new image data to inject
   * @param width - the new width
   * @param height - the new height
   */
  updateTexture(
    texture: WebGLTexture,
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height: number,
  ): void {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      imageData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  /* DEPTH */

  /** Enable depth testing */
  enableDepthTest(): void {
    const { gl, depthState } = this;
    if (!depthState) {
      gl.enable(gl.DEPTH_TEST);
      this.depthState = true;
    }
  }

  /** Disable depth testing */
  disableDepthTest(): void {
    const { gl, depthState } = this;
    if (depthState) {
      gl.disable(gl.DEPTH_TEST);
      this.depthState = false;
    }
  }

  /** Always pass depth test */
  alwaysDepth(): void {
    const { gl, zTestMode } = this;
    if (zTestMode !== 0) {
      this.zTestMode = 0;
      gl.depthFunc(gl.ALWAYS);
    }
  }

  /** Depth testing should pass if the depth is less than the reference value */
  lessDepth(): void {
    const { gl, zTestMode } = this;
    if (zTestMode !== 1) {
      this.zTestMode = 1;
      gl.depthFunc(gl.LESS);
    }
  }

  /** Depth testing should pass if the depth is less than or equal to the reference value */
  lequalDepth(): void {
    const { gl, zTestMode } = this;
    if (zTestMode !== 2) {
      this.zTestMode = 2;
      gl.depthFunc(gl.LEQUAL);
    }
  }

  /**
   * Set the depth range
   * @param depthPos - the depth position
   */
  setDepthRange(depthPos: number): void {
    const { gl, zLow, zHigh } = this;
    const depth = 1 - (depthPos + 1) * DEPTH_ESPILON;
    if (zLow !== depth || zHigh !== depth) {
      gl.depthRange(depth, depth);
      this.zLow = this.zHigh = depth;
    }
  }

  /** Reset the depth range to the full depth range */
  resetDepthRange(): void {
    const { gl, zLow, zHigh } = this;
    if (zLow !== 0 || zHigh !== 1) {
      gl.depthRange(0, 1);
      this.zLow = 0;
      this.zHigh = 1;
    }
  }

  /* CULLING */

  /** Enable face culling */
  enableCullFace(): void {
    const { gl, cullState } = this;
    if (!cullState) {
      gl.enable(gl.CULL_FACE);
      this.cullState = true;
    }
  }

  /** Disable face culling */
  disableCullFace(): void {
    const { gl, cullState } = this;
    if (cullState) {
      gl.disable(gl.CULL_FACE);
      this.cullState = false;
    }
  }

  /* BLENDING */

  /** Enable blending */
  enableBlend(): void {
    const { gl, blendState } = this;
    if (!blendState) {
      gl.enable(gl.BLEND);
      this.blendState = true;
    }
  }

  /** Disable blending */
  disableBlend(): void {
    const { gl, blendState } = this;
    if (blendState) {
      gl.disable(gl.BLEND);
      this.blendState = false;
    }
  }

  /** Set the blending mode to a default state */
  defaultBlend(): void {
    const { gl, blendMode } = this;
    this.enableBlend();
    if (blendMode !== 0) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.blendMode = 0;
    }
  }

  /** Set the blending mode to blend mode */
  shadeBlend(): void {
    const { gl, blendMode } = this;
    this.enableBlend();
    if (blendMode !== 1) {
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      this.blendMode = 1;
    }
  }

  /** Set the blending mode to inversion mode */
  inversionBlend(): void {
    const { gl, blendMode } = this;
    this.enableBlend();
    if (blendMode !== 2) {
      gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE_MINUS_SRC_COLOR);
      this.blendMode = 2;
    }
  }

  /** Set the blending mode to zero mode */
  zeroBlend(): void {
    const { gl, blendMode } = this;
    this.enableBlend();
    if (blendMode !== 3) {
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      this.blendMode = 3;
    }
  }

  /** Set the blending mode to one mode */
  oneBlend(): void {
    const { gl, blendMode } = this;
    this.enableBlend();
    if (blendMode !== 4) {
      gl.blendFunc(gl.ONE, gl.ONE);
      this.blendMode = 4;
    }
  }

  /* STENCILING */

  /** Enable stencil testing */
  enableStencilTest(): void {
    const { gl, stencilState } = this;
    if (!stencilState) {
      gl.enable(gl.STENCIL_TEST);
      this.stencilState = true;
    }
  }

  /** Disable stencil testing */
  disableStencilTest(): void {
    const { gl, stencilState } = this;
    if (stencilState) {
      gl.disable(gl.STENCIL_TEST);
      this.stencilState = false;
    }
  }

  /**
   * Set the stencil function to always pass but you can still update the reference value
   * @param ref - the reference value
   */
  stencilFuncAlways(ref: number): void {
    const { gl } = this;
    if (this.stencilRef === ref) return;
    this.stencilRef = ref;
    gl.stencilFunc(gl.ALWAYS, ref, 0xff);
  }

  /**
   * Set the stencil function to pass if the stencil value is equal to the reference value
   * @param ref - the reference value
   */
  stencilFuncEqual(ref: number): void {
    const { gl } = this;
    if (this.stencilRef === ref) return;
    this.stencilRef = ref;
    gl.stencilFunc(gl.EQUAL, ref, 0xff);
  }

  /** Set the stenci mode to default */
  stencilDefault(): void {
    const { gl } = this;
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.colorMask(true, true, true, true);
  }

  /** Set the stencil mode to invert */
  stencilInvert(): void {
    const { gl } = this;
    gl.colorMask(false, false, false, false);
    gl.stencilOp(gl.KEEP, gl.INVERT, gl.INVERT);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
  }

  /** Set the stencil mode to zero */
  stencilZero(): void {
    const { gl } = this;
    gl.colorMask(true, true, true, true);
    gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
  }

  /* MASKING */

  /** enable mask testing */
  enableMaskTest(): void {
    const { gl } = this;
    this.defaultBlend();
    this.enableCullFace();
    this.disableDepthTest();
    this.enableStencilTest();
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.colorMask(false, false, false, false);
  }

  /** setup to "flush" a mask's coverage */
  flushMask(): void {
    this.gl.colorMask(true, true, true, true);
  }

  /* VAO */

  /**
   * Build a vertex array object
   * @returns the vertex array object
   */
  buildVAO(): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = gl.createVertexArray();
    if (vao === null) throw new Error('Failed to create vertex array object');
    // and make it the one we're currently working with
    gl.bindVertexArray(vao);

    return vao;
  }

  /* Attributes */

  /**
   * Bind a vertex attribute
   * @param ab - the array buffer
   * @param indx - the index
   * @param size - the size
   * @param type - the type
   * @param normalized - if true, normalize the input data
   * @param stride - the stride
   * @param offset - the offset
   * @param instance - if true, the VAO is used for instancing
   * @returns the buffer
   */
  bindEnableVertexAttr(
    ab: ArrayBufferView,
    indx: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    instance = false,
  ): WebGLBuffer {
    const buf = this.bindAndBuffer(ab);

    this.defineBufferState(indx, size, type, normalized, stride, offset, instance);

    return buf;
  }

  /**
   * Bind mulitiple vertex attribute
   * @param ab - the array buffer
   * @param attributes - the collection of attributes that use the same buffer
   * @param instance - if true, the resulting VAO is used for instancing
   * @returns the buffer
   */
  bindEnableVertexAttrMulti(
    ab: ArrayBufferView,
    // [indx, size, type, normalized, stride, offset]
    attributes: Array<
      [
        index: number,
        size: number,
        type: number,
        normalized: boolean,
        stride: number,
        offset: number,
      ]
    >,
    instance = false,
  ): WebGLBuffer {
    const buf = this.bindAndBuffer(ab);

    for (const attr of attributes) this.defineBufferState(...attr, instance);

    return buf;
  }

  /**
   * Bind and buffer an input array
   * @param ab - the array buffer
   * @returns the buffer
   */
  bindAndBuffer(ab: ArrayBufferView): WebGLBuffer {
    const { gl } = this;
    const buf = gl.createBuffer();
    if (buf === null) throw Error('Failed to create buffer');
    // Bind and buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, ab, gl.STATIC_DRAW);

    return buf;
  }

  /**
   * Define the state of a vertex attribute
   * @param indx - the index
   * @param size - the size
   * @param type - the type
   * @param normalized - if true, normalize the input data
   * @param stride - the stride
   * @param offset - the offset
   * @param instance - if true, the VAO is used for instancing
   */
  defineBufferState(
    indx: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
    instance = false,
  ): void {
    const { gl } = this;
    // setup feature attribute
    gl.enableVertexAttribArray(indx);
    gl.vertexAttribPointer(indx, size, type, normalized, stride, offset);
    // instance attribute if needed
    if (instance) gl.vertexAttribDivisor(indx, 1);
  }

  /**
   * Bind an element array
   * @param ab - the array buffer to bind
   * @returns the buffer
   */
  bindElementArray(ab: ArrayBufferView): WebGLBuffer {
    const { gl } = this;
    const buf = gl.createBuffer();
    if (buf === null) throw Error('Failed to create buffer');
    // Bind and buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ab, gl.STATIC_DRAW);

    return buf;
  }

  /* CLEANUP */

  /** At the end of rendering a frame/scene, call this function to cleanup the state */
  finish(): void {
    const { gl } = this;
    gl.bindVertexArray(null);
    // gl.bindBuffer(gl.ARRAY_BUFFER, null)
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
}

/**
 * A helper function to clean up the renderer string to be more human readable
 * @param renderer - the renderer string
 * @returns the cleaned string
 */
function cleanRenderer(renderer: string): string {
  return renderer.toLowerCase().replace(/angle \((.+)\)*$/, '$1');
  // .replace(/\s+([0-9]+gb|direct3d|opengl.+$)|\(r\)| \([^)]+\)$/g, '')
}

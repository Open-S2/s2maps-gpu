import Workflow from './workflow';

// WEBGL1
import frag1 from '../shaders/glyphFilter1.fragment.glsl';
import vert1 from '../shaders/glyphFilter1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/glyphFilter2.fragment.glsl';
import vert2 from '../shaders/glyphFilter2.vertex.glsl';

import type Context from '../context/context';
import type {
  GlyphFeature,
  GlyphFilterUniforms,
  GlyphFilterWorkflow as GlyphFilterWorkflowSpec,
} from './workflow.spec';

/**
 *
 */
export default class GlyphFilterWorkflow extends Workflow implements GlyphFilterWorkflowSpec {
  label = 'glyphFilter' as const;
  quadTexture!: WebGLTexture;
  resultTexture!: WebGLTexture;
  quadFramebuffer!: WebGLFramebuffer;
  resultFramebuffer!: WebGLFramebuffer;
  indexOffset = 0;
  mode: 1 | 2 = 1;
  declare uniforms: { [key in GlyphFilterUniforms]: WebGLUniformLocation };
  /**
   * @param context
   */
  constructor(context: Context) {
    // get gl from context
    const { type } = context;
    // inject Program
    super(context);
    // build shaders
    if (type === 1)
      this.buildShaders(vert1, frag1, {
        aStep: 0,
        aST: 1,
        aXY: 2,
        aOffset: 3,
        aPad: 4,
        aWH: 5,
        aIndex: 6,
        aID: 7,
      });
    else this.buildShaders(vert2, frag2);
    // finish building the textures
    this.#buildTextures();
  }

  /**
   *
   */
  #buildTextures(): void {
    const { gl, devicePixelRatio } = this.context;
    this.use();
    // setup the devicePixelRatio
    this.setDevicePixelRatio(devicePixelRatio);

    // TEXTURES
    const quadTexture = gl.createTexture();
    if (quadTexture === null) throw new Error('Failed to create GlyphFilter:quadTexture');
    this.quadTexture = quadTexture;
    const resultTexture = gl.createTexture();
    if (resultTexture === null) throw new Error('Failed to create GlyphFilter:resultTexture');
    this.resultTexture = resultTexture;

    // result texture
    gl.bindTexture(gl.TEXTURE_2D, resultTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // quad texture using floats
    gl.bindTexture(gl.TEXTURE_2D, quadTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4_096, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // set filter system
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // FRAMEBUFFERS
    // QUAD FRAMEBUFFER
    const quadFramebuffer = gl.createFramebuffer();
    if (quadFramebuffer === null) throw new Error('Failed to create GlyphFilter:quadFramebuffer');
    this.quadFramebuffer = quadFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, quadFramebuffer);
    // attach quadTexture to quadFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, quadTexture, 0);
    // RESULT FRAMEBUFFER
    const resultFramebuffer = gl.createFramebuffer();
    if (resultFramebuffer === null)
      throw new Error('Failed to create GlyphFilter:resultFramebuffer');
    this.resultFramebuffer = resultFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, resultFramebuffer);
    // attach quadTexture to resultFramebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resultTexture, 0);

    // we are finished, so go back to our main buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   *
   */
  override delete(): void {
    const { gl, quadTexture, resultTexture, quadFramebuffer, resultFramebuffer } = this;
    // delete textures
    gl.deleteTexture(quadTexture);
    gl.deleteTexture(resultTexture);
    // delete framebuffers
    gl.deleteFramebuffer(quadFramebuffer);
    gl.deleteFramebuffer(resultFramebuffer);
    // cleanup
    super.delete();
  }

  /**
   *
   */
  resize(): void {
    const { gl, resultTexture } = this;
    // bind the resultTexture
    gl.bindTexture(gl.TEXTURE_2D, resultTexture);
    // update the texture's aspect
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.canvas.width,
      gl.canvas.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  /**
   * @param mode
   */
  override setMode(mode: number): void {
    this.mode = mode as 1 | 2;
    super.setMode(mode);
  }

  /**
   *
   */
  bindResultTexture(): void {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture);
  }

  /**
   *
   */
  bindQuadFrameBuffer(): void {
    const { context, gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.quadFramebuffer);
    context.clearColorBuffer();
    context.disableBlend();
    gl.viewport(0, 0, 4_096, 2);
    gl.bindTexture(gl.TEXTURE_2D, this.resultTexture);
    // clear indexOffset
    this.indexOffset = 0;
  }

  /**
   *
   */
  bindResultFramebuffer(): void {
    const { context, gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    context.defaultBlend();
    context.resetViewport();
    context.clearColorBuffer();
    gl.bindTexture(gl.TEXTURE_2D, this.quadTexture);
    // clear indexOffset
    this.indexOffset = 0;
  }

  /**
   * @param featureGuide
   * @param _interactive
   */
  draw(featureGuide: GlyphFeature, _interactive = false): void {
    const { gl, context, mode, uniforms, indexOffset } = this;
    const { type } = context;
    // set current indexOffset
    gl.uniform1f(uniforms.uIndexOffset, indexOffset);
    // grab variables
    const { featureCode, filterCount, filterOffset, source, size } = featureGuide;
    const { glyphFilterBuffer, glyphFilterIDBuffer, filterVAO } = source;
    // set feature code
    if (type === 1) {
      gl.uniform1f(uniforms.uSize, size ?? 1);
    } else {
      this.setFeatureCode(featureCode);
    }
    // use vao
    gl.bindVertexArray(filterVAO);
    // apply the appropriate offset
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphFilterBuffer);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 44, filterOffset * 44); // s, t
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 8 + filterOffset * 44); // x, y
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 44, 16 + filterOffset * 44); // offsetX, offsetY
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 44, 24 + filterOffset * 44); // paddingX, paddingY
    gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 44, 32 + filterOffset * 44); // width, height
    gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 44, 40 + filterOffset * 44); // index
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphFilterIDBuffer);
    gl.vertexAttribPointer(7, 4, gl.UNSIGNED_BYTE, true, 4, filterOffset * 4);
    // draw based upon mode
    if (mode === 1) gl.drawArraysInstanced(gl.POINTS, 0, 2, filterCount);
    else gl.drawArraysInstanced(gl.POINTS, 0, 1, filterCount);
    // increment offset
    this.indexOffset += filterCount;
  }
}

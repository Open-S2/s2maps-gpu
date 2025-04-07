import { buildDashImage } from 'style/color';
import encodeLayerAttribute from 'style/encodeLayerAttribute';
import Workflow, { Feature } from './workflow';

// WEBGL1
import frag1 from '../shaders/line1.fragment.glsl';
import vert1 from '../shaders/line1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/line2.fragment.glsl';
import vert2 from '../shaders/line2.vertex.glsl';

import type Context from '../context/context';
import type { LineData } from 'workers/worker.spec';
import type { TileGL as Tile } from 'source/tile.spec';
import type {
  ColorArray,
  LayerDefinitionBase,
  LineDefinition,
  LineStyle,
  LineWorkflowLayerGuide,
} from 'style/style.spec';
import type {
  LineFeature as LineFeatureSpec,
  LineSource,
  LineWorkflow as LineWorkflowSpec,
  LineWorkflowUniforms,
} from './workflow.spec';

/**
 *
 */
export class LineFeature extends Feature implements LineFeatureSpec {
  type = 'line' as const;
  color?: ColorArray; // webgl1
  opacity?: number; // webgl1
  width?: number; // webgl1
  gapwidth?: number; // webgl1
  /**
   * @param workflow
   * @param layerGuide
   * @param source
   * @param tile
   * @param count
   * @param offset
   * @param featureCode
   * @param cap
   * @param parent
   */
  constructor(
    public override workflow: LineWorkflowSpec,
    public override layerGuide: LineWorkflowLayerGuide,
    public source: LineSource,
    public override tile: Tile,
    public count: number,
    public offset: number,
    public override featureCode: number[],
    public cap: number,
    public override parent?: Tile,
  ) {
    super(workflow, tile, layerGuide, featureCode, parent);
  }

  /**
   * @param interactive
   */
  override draw(interactive = false): void {
    super.draw(interactive);
    this.workflow.draw(this, interactive);
  }

  /**
   * @param tile
   * @param parent
   */
  duplicate(tile: Tile, parent?: Tile): LineFeature {
    const {
      workflow,
      layerGuide,
      source,
      count,
      offset,
      featureCode,
      cap,
      color,
      opacity,
      width,
      gapwidth,
    } = this;
    const newFeature = new LineFeature(
      workflow,
      layerGuide,
      source,
      tile,
      count,
      offset,
      featureCode,
      cap,
      parent,
    );
    newFeature.setWebGL1Attributes(color, opacity, width, gapwidth);
    return newFeature;
  }

  /**
   * @param color
   * @param opacity
   * @param width
   * @param gapwidth
   */
  setWebGL1Attributes(
    color?: ColorArray,
    opacity?: number,
    width?: number,
    gapwidth?: number,
  ): void {
    this.color = color;
    this.opacity = opacity;
    this.width = width;
    this.gapwidth = gapwidth;
  }
}

/**
 *
 */
export default class LineWorkflow extends Workflow implements LineWorkflowSpec {
  label = 'line' as const;
  curTexture = -1;
  typeBuffer?: WebGLBuffer;
  layerGuides = new Map<number, LineWorkflowLayerGuide>();
  declare uniforms: { [key in LineWorkflowUniforms]: WebGLUniformLocation };
  /**
   * @param context
   */
  constructor(context: Context) {
    // get gl from context
    const { gl, type, devicePixelRatio } = context;
    // inject Program
    super(context);
    // build shaders
    if (type === 1)
      this.buildShaders(vert1, frag1, { aType: 0, aPrev: 1, aCurr: 2, aNext: 3, aLengthSoFar: 4 });
    else this.buildShaders(vert2, frag2);
    // activate so we can setup samplers
    this.use();
    // create the null texture align with line
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, context.nullTexture);
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio);
  }

  /**
   *
   */
  #bindTypeBuffer(): void {
    const { gl, context, typeBuffer } = this;

    if (typeBuffer === undefined) {
      // 0 -> curr
      // 1 -> curr + (-1 * normal)
      // 2 -> curr + (normal)
      // 3 -> next + (-1 * normal)
      // 4 -> next + (normal)
      // 5 -> curr + (normal) [check that prev, curr, and next is CCW otherwise invert normal]
      // 6 -> curr + (previous-normal) [check that prev, curr, and next is CCW otherwise invert normal]
      const typeArray = new Float32Array([1, 3, 4, 1, 4, 2, 0, 5, 6]);
      this.typeBuffer = context.bindEnableVertexAttr(typeArray, 0, 1, gl.FLOAT, false, 0, 0);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, typeBuffer);
      context.defineBufferState(0, 1, gl.FLOAT, false, 0, 0);
    }
  }

  // workflows helps design the appropriate layer parameters
  /**
   * @param layerBase
   * @param layer
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: LineStyle): LineDefinition {
    const { context } = this;
    const { type } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    const { cap, join } = layer;
    let {
      interactive,
      cursor,
      geoFilter,
      // paint
      color,
      opacity,
      width,
      gapwidth,
      // layout
      dasharray,
    } = layer;
    color = color ?? 'rgba(0, 0, 0, 0)';
    opacity = opacity ?? 1;
    width = width ?? 1;
    gapwidth = gapwidth ?? 0;
    geoFilter = geoFilter ?? [];
    // 1) build definition
    const dashed = Array.isArray(dasharray) && dasharray.length > 0;
    interactive = interactive ?? false;
    cursor = cursor ?? 'default';
    dasharray = dasharray ?? [];
    const layerDefinition: LineDefinition = {
      ...layerBase,
      type: 'line',
      color,
      opacity,
      width,
      gapwidth,
      cap: cap ?? 'butt',
      join: join ?? 'miter',
      dasharray,
      geoFilter,
      dashed,
      interactive,
      cursor,
    };
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = [];
    if (type === 2) {
      for (const paint of [color, opacity, width, gapwidth]) {
        layerCode.push(...encodeLayerAttribute(paint, lch));
      }
    }
    // if dashed, build a texture
    const { length, dashCount, image } = buildDashImage(dasharray, context.devicePixelRatio);
    const dashTexture = length > 0 ? context.buildTexture(image, length, 5) : context.nullTexture;
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      dashed,
      dashCount,
      dashLength: length,
      dashTexture,
      interactive,
      cursor,
      visible,
      opaque: false,
    });

    return layerDefinition;
  }

  /**
   * @param lineData
   * @param tile
   */
  buildSource(lineData: LineData, tile: Tile): void {
    const { gl, context } = this;
    const { featureGuideBuffer } = lineData;
    // prep buffers
    const vertexA = new Int16Array(lineData.vertexBuffer);
    const lengthSoFarA = new Float32Array(lineData.lengthSoFarBuffer);
    // const fillIDA = new Uint8Array(lineData.fillIDBuffer)
    // Create a starting vertex array object (attribute state)
    const vao = gl.createVertexArray();
    if (vao === null) throw new Error('Failed to create vertex array object');
    // and make it the one we're currently working with
    gl.bindVertexArray(vao);

    // bind buffers to the vertex array object
    const vertexBuffer = context.bindEnableVertexAttrMulti(
      vertexA,
      [
        // [indx, size, type, normalized, stride, offset]
        [1, 2, gl.FLOAT, false, 24, 0],
        [2, 2, gl.FLOAT, false, 24, 8],
        [3, 2, gl.FLOAT, false, 24, 16],
      ],
      true,
    );
    const lengthSoFarBuffer = context.bindEnableVertexAttr(
      lengthSoFarA,
      4,
      1,
      gl.FLOAT,
      false,
      4,
      0,
      true,
    );
    // const fillIDBuffer = context.bindEnableVertexAttr(fillIDA, 6, 3, gl.UNSIGNED_BYTE, true, 0, 0)

    // bind the typeBuffer
    this.#bindTypeBuffer();

    const source: LineSource = {
      type: 'line',
      vertexBuffer,
      lengthSoFarBuffer,
      // fillIDBuffer,
      vao,
    };
    context.finish(); // flush vao

    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer));
  }

  /**
   * @param source
   * @param tile
   * @param featureGuideArray
   */
  #buildFeatures(source: LineSource, tile: Tile, featureGuideArray: Float32Array): void {
    const features: LineFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [cap, layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 5);
      i += 5;
      // pull in the layerGuide
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      // build feature
      const feature = new LineFeature(this, layerGuide, source, tile, count, offset, [0], cap);
      if (this.type === 1) {
        const [r, g, b, a, o, w, gw] = featureGuideArray.slice(i, i + 7);
        feature.setWebGL1Attributes([r, g, b, a], o, w, gw);
        i += 7;
      } else if (this.type === 2 && encodingSize > 0) {
        feature.featureCode = [...featureGuideArray.slice(i, i + encodingSize)];
        // update index
        i += encodingSize;
      }
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   *
   */
  override use(): void {
    super.use();
    const { context } = this;
    const { gl } = context;
    // setup context
    context.defaultBlend();
    context.disableCullFace();
    context.enableDepthTest();
    context.enableStencilTest();
    context.lequalDepth();
    gl.activeTexture(gl.TEXTURE0);
  }

  /**
   * @param featureGuide
   * @param _interactive
   */
  draw(featureGuide: LineFeatureSpec, _interactive = false): void {
    // grab context
    const { gl, context, type, uniforms } = this;
    const { uCap, uDashed, uDashCount, uTexLength, uColor, uOpacity, uWidth } = uniforms;
    // get current source data
    const {
      count,
      offset,
      featureCode,
      source,
      cap,
      color,
      opacity,
      width,
      layerGuide: { dashed, dashCount, dashLength, dashTexture, layerIndex, visible },
    } = featureGuide;
    if (!visible) return;
    const { vao, vertexBuffer, lengthSoFarBuffer } = source;
    context.setDepthRange(layerIndex);
    // set cap and dashed
    gl.uniform1f(uCap, cap);
    gl.uniform1i(uDashed, ~~dashed);
    // ensure a dash texture is mapped, if feature isn't dashed, use nullTexture
    if (dashed) {
      this.curTexture = layerIndex;
      gl.uniform1f(uTexLength, dashLength);
      gl.uniform1f(uDashCount, dashCount);
      gl.bindTexture(gl.TEXTURE_2D, dashTexture);
    }
    // set feature code
    if (type === 1) {
      gl.uniform4fv(uColor, color ?? [0, 0, 0, 1]);
      gl.uniform1f(uOpacity, opacity ?? 1);
      gl.uniform1f(uWidth, width ?? 1);
    } else {
      this.setFeatureCode(featureCode);
    }
    // bind vao
    gl.bindVertexArray(vao);
    // apply the appropriate offset in the source vertexBuffer attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 0 + offset * 24);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 8 + offset * 24);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 24, 16 + offset * 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, lengthSoFarBuffer);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 0, offset * 4);
    // draw elements
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, count); // gl.drawArraysInstancedANGLE(mode, first, count, primcount)
  }
}

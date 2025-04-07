import { colorFunc } from 'workers/process/vectorWorker';
import encodeLayerAttribute from 'style/encodeLayerAttribute';
import parseFeatureFunction from 'style/parseFeatureFunction';
import Workflow, { Feature } from './workflow';

// WEBGL1
import frag1 from '../shaders/fill1.fragment.glsl';
import vert1 from '../shaders/fill1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/fill2.fragment.glsl';
import vert2 from '../shaders/fill2.vertex.glsl';

import type Context from '../context/context';
import type { FillData } from 'workers/worker.spec';
import type { TileGL as Tile } from 'source/tile.spec';
import type { VectorPoint } from 'gis-tools';
import type {
  ColorArray,
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuide,
  LayerDefinitionBase,
} from 'style/style.spec';
import type {
  FillFeature as FillFeatureSpec,
  FillSource,
  FillWorkflow as FillWorkflowSpec,
  FillWorkflowUniforms,
  TileMaskSource,
} from './workflow.spec';

/**
 *
 */
export class FillFeature extends Feature implements FillFeatureSpec {
  type = 'fill' as const;
  color?: number[]; // webgl1
  opacity?: number[]; // webgl1
  /**
   * @param workflow
   * @param layerGuide
   * @param maskLayer
   * @param source
   * @param mode
   * @param count
   * @param offset
   * @param patternXY
   * @param patternWH
   * @param patternMovement
   * @param featureCode
   * @param tile
   * @param parent
   */
  constructor(
    public override workflow: FillWorkflowSpec,
    public override layerGuide: FillWorkflowLayerGuide,
    public maskLayer: boolean,
    public source: FillSource | TileMaskSource,
    public mode: number,
    public count: number,
    public offset: number,
    public patternXY: VectorPoint,
    public patternWH: [w: number, h: number],
    public patternMovement: number,
    public override featureCode: number[],
    public override tile: Tile,
    public override parent?: Tile,
  ) {
    super(workflow, tile, layerGuide, featureCode, parent);
  }

  /**
   * @param interactive
   */
  override draw(interactive = false): void {
    super.draw(interactive);
    const { maskLayer, tile, parent, workflow } = this;
    const { mask } = parent ?? tile;
    // draw
    if (maskLayer) workflow.drawMask(mask);
    else workflow.draw(this, interactive);
  }

  /**
   * @param tile
   * @param parent
   */
  duplicate(tile: Tile, parent?: Tile): FillFeature {
    const {
      workflow,
      layerGuide,
      maskLayer,
      source,
      mode,
      count,
      offset,
      patternXY,
      patternWH,
      patternMovement,
      featureCode,
      color,
      opacity,
    } = this;
    const newFeature = new FillFeature(
      workflow,
      layerGuide,
      maskLayer,
      source,
      mode,
      count,
      offset,
      patternXY,
      patternWH,
      patternMovement,
      featureCode,
      tile,
      parent,
    );
    newFeature.setWebGL1Attributes(color, opacity);
    return newFeature;
  }

  /**
   * @param color
   * @param opacity
   */
  setWebGL1Attributes(color?: number[], opacity?: number[]): void {
    this.color = color;
    this.opacity = opacity;
  }
}

/**
 *
 */
export default class FillWorkflow extends Workflow implements FillWorkflowSpec {
  label = 'fill' as const;
  declare uniforms: { [key in FillWorkflowUniforms]: WebGLUniformLocation };
  layerGuides = new Map<number, FillWorkflowLayerGuide>();
  /**
   * @param context
   */
  constructor(context: Context) {
    // inject Program
    super(context);
    // get gl from context
    const { type } = context;

    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0, aID: 1, aIndex: 2 });
    else this.buildShaders(vert2, frag2);
  }

  // workflow helps design the appropriate layer parameters
  /**
   * @param layerBase
   * @param layer
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: FillStyle): FillDefinition {
    const { type } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    const { pattern } = layer;
    let { color, opacity, invert, opaque, patternFamily, patternMovement, interactive, cursor } =
      layer;
    invert = invert ?? false;
    opaque = opaque ?? false;
    interactive = interactive ?? false;
    cursor = cursor ?? 'default';
    color = color ?? 'rgb(0, 0, 0)';
    opacity = opacity ?? 1;
    patternFamily = patternFamily ?? '__images';
    patternMovement = patternMovement ?? false;
    // 1) Build layer definition
    const layerDefinition: FillDefinition = {
      ...layerBase,
      type: 'fill',
      // paint
      color,
      opacity,
      // layout
      pattern,
      patternFamily,
      patternMovement,
      // properties
      invert,
      interactive,
      opaque,
      cursor,
    };
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = [];
    if (type === 2) {
      for (const paint of [color, opacity]) {
        layerCode.push(...encodeLayerAttribute(paint, lch));
      }
    }
    // if mask source, and webgl1, build maskColor and maskOpacity
    const isGL1Mask = type === 1 && source === 'mask';
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      invert,
      opaque,
      interactive,
      pattern: pattern !== undefined,
      color: isGL1Mask
        ? parseFeatureFunction<string, ColorArray>(color, colorFunc(lch))
        : undefined,
      opacity: isGL1Mask
        ? parseFeatureFunction<number, number[]>(opacity, (i: number) => [i])
        : undefined,
      visible,
    });

    return layerDefinition;
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  /**
   * @param root0
   * @param root0.layerIndex
   * @param root0.minzoom
   * @param root0.maxzoom
   * @param tile
   */
  buildMaskFeature({ layerIndex, minzoom, maxzoom }: FillDefinition, tile: Tile): void {
    const { type, gl, layerGuides } = this;
    const { zoom, mask } = tile;
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return;

    const layerGuide = layerGuides.get(layerIndex);
    if (layerGuide === undefined) return;
    const { color, opacity } = layerGuide;
    const feature = new FillFeature(
      this,
      layerGuide,
      true,
      mask,
      gl.TRIANGLE_STRIP,
      mask.count,
      mask.offset,
      { x: 0, y: 0 },
      [0, 0],
      0,
      [0],
      tile,
    );
    // If webgl1 add color and opacity
    if (type === 1) {
      feature.setWebGL1Attributes(color?.([], {}, zoom), opacity?.([], {}, zoom));
    }
    tile.addFeatures([feature]);
  }

  /**
   * @param fillData
   * @param tile
   */
  buildSource(fillData: FillData, tile: Tile): void {
    const { gl, context } = this;
    const { featureGuideBuffer } = fillData;
    // prep buffers
    const vertexA = new Float32Array(fillData.vertexBuffer);
    const indexA = new Uint32Array(fillData.indexBuffer);
    const fillIDA = new Uint8Array(fillData.idBuffer);
    const codeTypeA = new Uint8Array(fillData.codeTypeBuffer);
    // Create a starting vertex array object (attribute state)
    const vao = context.buildVAO();

    // bind buffers to the vertex array object
    // Create the feature index buffer
    const vertexBuffer = context.bindEnableVertexAttr(vertexA, 0, 2, gl.FLOAT, false, 0, 0);
    const indexBuffer = context.bindElementArray(indexA);
    const idBuffer = context.bindEnableVertexAttr(fillIDA, 1, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    const codeTypeBuffer = context.bindEnableVertexAttr(
      codeTypeA,
      2,
      1,
      gl.UNSIGNED_BYTE,
      false,
      0,
      0,
    );

    const source: FillSource = {
      type: 'fill',
      vertexBuffer,
      indexBuffer,
      idBuffer,
      codeTypeBuffer,
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
  #buildFeatures(source: FillSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { gl } = this;
    const features: FillFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4);
      i += 4;
      // If webgl1, we pull out the color and opacity otherwise build featureCode
      let featureCode: number[] = [0];
      let color: number[] | undefined;
      let opacity: number[] | undefined;
      if (this.type === 1) {
        color = [];
        opacity = [];
        for (let s = 0, len = encodingSize / 5; s < len; s++) {
          const idx = i + s * 5;
          color.push(...featureGuideArray.slice(idx, idx + 4));
          opacity.push(featureGuideArray[idx + 4]);
        }
        if (color.length === 0) color = undefined;
        if (opacity.length === 0) opacity = undefined;
      } else if (this.type === 2 && encodingSize > 0) {
        featureCode = [...featureGuideArray.slice(i, i + encodingSize)];
      }
      // update index
      i += encodingSize;
      const [patternX, patternY, patternW, patternH, patternMovement] = featureGuideArray.slice(
        i,
        i + 5,
      );
      i += 5;

      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;

      if (count > 0) {
        const feature = new FillFeature(
          this,
          layerGuide,
          false,
          source,
          gl.TRIANGLES,
          count,
          offset,
          { x: patternX, y: patternY },
          [patternW, patternH],
          patternMovement,
          featureCode,
          tile,
        );
        if (this.type === 1) {
          feature.color = color;
          feature.opacity = opacity;
        }
        features.push(feature);
      }
    }

    tile.addFeatures(features);
  }

  /**
   * @param featureGuide
   * @param interactive
   */
  draw(featureGuide: FillFeatureSpec, interactive = false): void {
    // grab context
    const { gl, context, type, uniforms } = this;
    const { uTexSize, uPatternXY, uPatternWH, uPatternMovement, uColors, uOpacity } = uniforms;
    const { texture, texSize } = context.sharedFBO;
    // get current source data
    const {
      source,
      tile,
      parent,
      count,
      offset,
      layerGuide: { layerIndex, visible, invert },
      color,
      opacity,
      featureCode,
      mode,
      patternXY,
      patternWH,
      patternMovement,
    } = featureGuide;
    if (!visible) return;
    const { vao } = source;
    const { mask } = parent ?? tile;
    // ensure proper context state
    context.defaultBlend();
    context.enableDepthTest();
    context.enableCullFace();
    context.enableStencilTest();
    context.lessDepth();
    context.setDepthRange(layerIndex);
    // set texture data
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform2fv(uTexSize, texSize);
    gl.uniform2fv(uPatternXY, [patternXY.x, patternXY.y]);
    gl.uniform2fv(uPatternWH, patternWH);
    gl.uniform1i(uPatternMovement, patternMovement);
    if (interactive) context.stencilFuncAlways(0);
    if (invert) gl.colorMask(false, false, false, false);
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform4fv(uColors, color ?? [0, 0, 0, 1]);
      gl.uniform1fv(uOpacity, opacity ?? [1]);
    } else {
      this.setFeatureCode(featureCode ?? [0]);
    }
    // draw elements
    gl.bindVertexArray(vao);
    gl.drawElements(mode, count, gl.UNSIGNED_INT, offset * 4);
    // If invert reset color mask & draw a full tile mask
    if (invert) {
      gl.colorMask(true, true, true, true);
      this.drawMask(mask);
    }
  }

  /**
   * @param mask
   */
  drawMask(mask: TileMaskSource): void {
    const { gl, context } = this;
    const {
      count,
      offset,
      vao,
      tile: { type },
    } = mask;
    if (type === 'S2') context.enableCullFace();
    else context.disableCullFace();
    // bind vao & draw
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset * 4);
  }
}

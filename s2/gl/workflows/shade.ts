import Workflow, { Feature } from './workflow.js';

import frag1 from '../shaders/shade1.fragment.glsl';
import vert1 from '../shaders/shade1.vertex.glsl';

import frag2 from '../shaders/shade2.fragment.glsl';
import vert2 from '../shaders/shade2.vertex.glsl';

import type Context from '../context/context.js';
import type { TileGL as Tile } from 'source/tile.spec.js';
import type {
  LayerDefinitionBase,
  ShadeDefinition,
  ShadeStyle,
  ShadeWorkflowLayerGuide,
} from 'style/style.spec.js';
import type {
  MaskSource,
  ShadeFeature as ShadeFeatureSpec,
  ShadeWorkflow as ShadeWorkflowSpec,
  ShadeWorkflowUniforms,
} from './workflow.spec.js';

/** Shape Feature is a standalone shade render storage unit that can be drawn to the GPU */
export class ShadeFeature extends Feature implements ShadeFeatureSpec {
  type = 'shade' as const;
  maskLayer = true;
  /**
   * @param layerGuide - layer guide for this feature
   * @param workflow - the shade workflow
   * @param source - the input mask source
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param tile - the tile that the feature is drawn on
   */
  constructor(
    public override layerGuide: ShadeWorkflowLayerGuide,
    public override workflow: ShadeWorkflowSpec,
    public source: MaskSource,
    public override featureCode: number[],
    public override tile: Tile,
  ) {
    super(workflow, tile, layerGuide, featureCode);
  }

  /** Draw this feature to the GPU */
  override draw(): void {
    super.draw();
    this.workflow.draw(this);
  }

  /**
   * Duplicate this feature
   * @param tile - the tile that the feature is drawn on
   * @returns the duplicated feature
   */
  duplicate(tile: Tile): ShadeFeature {
    const { layerGuide, workflow, source, featureCode } = this;
    return new ShadeFeature(layerGuide, workflow, source, featureCode, tile);
  }
}

/** Shade Workflow */
export default class ShadeWorkflow extends Workflow implements ShadeWorkflowSpec {
  label = 'shade' as const;
  declare uniforms: { [key in ShadeWorkflowUniforms]: WebGLUniformLocation };
  /** @param context - The WebGL(1|2) context */
  constructor(context: Context) {
    // get gl from context
    const { type, devicePixelRatio } = context;
    // inject Program
    super(context);
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0 });
    else this.buildShaders(vert2, frag2);
    // activate so we can setup devicePixelRatio
    this.use();
    // set pixel ratio
    this.setDevicePixelRatio(devicePixelRatio);
  }

  /**
   * Build a layer definition for this workflow given the user input layer
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: ShadeStyle): ShadeDefinition {
    let { color } = layer;
    color = color ?? 'rgb(0.6, 0.6, 0.6)';
    return {
      ...layerBase,
      type: 'shade',
      color,
    };
  }

  /**
   * given a set of layerIndexes that use Masks and the tile of interest, build a mask feature
   * @param layerDefinition - layer definition
   * @param tile - the tile that needs a mask
   */
  buildMaskFeature(layerDefinition: ShadeDefinition, tile: Tile): void {
    const { mask, zoom } = tile;
    const { minzoom, maxzoom } = layerDefinition;
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return;

    // set the layer guide
    const layerGuide: ShadeWorkflowLayerGuide = {
      ...layerDefinition,
      sourceName: 'mask',
      layerCode: [],
      interactive: false,
      opaque: false,
    };

    tile.addFeatures([new ShadeFeature(layerGuide, this, mask, [0], tile)]);
  }

  /** Use this workflow as the current shaders for the GPU */
  override use(): void {
    super.use();
    // grab context & prep
    const { context } = this;
    context.enableCullFace();
    context.enableDepthTest();
    context.disableStencilTest();
    context.shadeBlend();
    context.lessDepth();
  }

  /** Set the layer code uniforms for this workflow */
  override setLayerCode(): void {
    // noop
  }

  /**
   * Draw a shade feature
   * @param feature - the feature
   */
  draw(feature: ShadeFeatureSpec): void {
    const { gl, context } = this;
    const {
      source,
      layerGuide: { layerIndex, visible },
    } = feature;
    const { count, offset, vao } = source;
    if (!visible) return;
    // bind vao & draw
    context.setDepthRange(layerIndex);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset * 4);
  }
}

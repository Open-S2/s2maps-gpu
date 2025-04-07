import encodeLayerAttribute from 'style/encodeLayerAttribute';
import Workflow, { Feature } from './workflow';

// WEBGL1
import frag1 from '../shaders/raster1.fragment.glsl';
import vert1 from '../shaders/raster1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/raster2.fragment.glsl';
import vert2 from '../shaders/raster2.vertex.glsl';

import type Context from '../context/context';
import type { RasterData } from 'workers/worker.spec';
import type { TileGL as Tile } from 'source/tile.spec';
import type {
  LayerDefinitionBase,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuide,
  Resampling,
} from 'style/style.spec';
import type {
  RasterFeature as RasterFeatureSpec,
  RasterSource,
  RasterWorkflow as RasterWorkflowSpec,
  RasterWorkflowUniforms,
} from './workflow.spec';

/**
 *
 */
export class RasterFeature extends Feature implements RasterFeatureSpec {
  type = 'raster' as const;
  opacity?: number; // webgl1
  saturation?: number; // webgl1
  contrast?: number; // webgl1
  /**
   * @param layerGuide
   * @param workflow
   * @param source
   * @param featureCode
   * @param tile
   * @param fadeStartTime
   * @param parent
   */
  constructor(
    public override layerGuide: RasterWorkflowLayerGuide,
    public override workflow: RasterWorkflowSpec,
    public source: RasterSource,
    public override featureCode: number[],
    public override tile: Tile,
    public fadeStartTime = Date.now(),
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
  duplicate(tile: Tile, parent?: Tile): RasterFeature {
    const {
      layerGuide,
      workflow,
      source,
      featureCode,
      fadeStartTime,
      opacity,
      saturation,
      contrast,
    } = this;
    const newFeature = new RasterFeature(
      layerGuide,
      workflow,
      source,
      featureCode,
      tile,
      fadeStartTime,
      parent,
    );
    newFeature.setWebGL1Attributes(opacity, saturation, contrast);
    return newFeature;
  }

  /**
   * @param opacity
   * @param saturation
   * @param contrast
   */
  setWebGL1Attributes(opacity?: number, saturation?: number, contrast?: number): void {
    this.opacity = opacity;
    this.saturation = saturation;
    this.contrast = contrast;
  }
}

/**
 *
 */
export default class RasterWorkflow extends Workflow implements RasterWorkflowSpec {
  label = 'raster' as const;
  curSample: 'none' | 'linear' | 'nearest' = 'none';
  layerGuides = new Map<number, RasterWorkflowLayerGuide>();
  declare uniforms: { [key in RasterWorkflowUniforms]: WebGLUniformLocation };
  /**
   * @param context
   */
  constructor(context: Context) {
    // get gl from context
    const { type } = context;
    // inject Program
    super(context);
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0 });
    else this.buildShaders(vert2, frag2);
  }

  /**
   * @param type
   */
  #setSampleType(type: Resampling): void {
    const { curSample, gl } = this;
    if (curSample === type) return;
    this.curSample = type;
    if (type === 'nearest') {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  }

  // workflows helps design the appropriate layer parameters
  /**
   * @param layerBase
   * @param layer
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: RasterStyle): RasterDefinition {
    const { type } = this;
    const { source, layerIndex, lch, visible, opaque } = layerBase;
    // PRE) get layer base
    const { resampling, fadeDuration } = layer;
    let { opacity, saturation, contrast } = layer;
    opacity = opacity ?? 1;
    saturation = saturation ?? 0;
    contrast = contrast ?? 0;
    // 1) build definition
    const layerDefinition: RasterDefinition = {
      ...layerBase,
      type: 'raster',
      opacity: opacity ?? 1,
      saturation: saturation ?? 0,
      contrast: contrast ?? 0,
    };
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = [];
    if (type === 2) {
      for (const paint of [opacity, saturation, contrast]) {
        layerCode.push(...encodeLayerAttribute(paint, lch));
      }
    }
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      fadeDuration: fadeDuration ?? 300,
      resampling: resampling ?? 'linear',
      visible,
      interactive: false,
      opaque: opaque ?? false,
    });

    return layerDefinition;
  }

  /**
   * @param rasterData
   * @param tile
   */
  buildSource(rasterData: RasterData, tile: Tile): void {
    const { context } = this;
    const { image, size } = rasterData;
    // setup texture params
    const texture = context.buildTexture(image, size);

    // Extend mask
    const rasterSource: RasterSource = { type: 'raster', texture, size };

    this.#buildFeatures(rasterSource, rasterData, tile);
  }

  /**
   * @param source
   * @param rasterData
   * @param tile
   */
  #buildFeatures(source: RasterSource, rasterData: RasterData, tile: Tile): void {
    const { featureGuides } = rasterData;
    // for each layer that maches the source, build the feature

    const features: RasterFeature[] = [];

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const feature = new RasterFeature(layerGuide, this, source, code, tile);
      if (this.type === 1) feature.setWebGL1Attributes(code[0], code[1], code[2]);
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
    context.defaultBlend();
    context.enableDepthTest();
    context.enableCullFace();
    context.enableStencilTest();
    context.lessDepth();
  }

  /**
   * @param featureGuide
   * @param _interactive
   */
  draw(featureGuide: RasterFeatureSpec, _interactive = false): void {
    // grab gl from the context
    const { type, gl, context, uniforms } = this;
    const { uFade, uOpacity, uContrast, uSaturation } = uniforms;

    // get current source data
    const {
      tile,
      parent,
      source,
      featureCode,
      opacity,
      contrast,
      saturation,
      layerGuide: { layerIndex, visible, resampling },
    } = featureGuide;
    if (!visible) return;
    const { texture } = source;
    const { vao, count, offset } = (parent ?? tile).mask;
    context.setDepthRange(layerIndex);
    // set fade
    gl.uniform1f(uFade, 1);
    // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform1f(uOpacity, opacity ?? 1);
      gl.uniform1f(uContrast, contrast ?? 0);
      gl.uniform1f(uSaturation, saturation ?? 0);
    } else {
      this.setFeatureCode(featureCode);
    }
    // bind vao
    gl.bindVertexArray(vao);
    // setup the texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.#setSampleType(resampling);
    // draw elements
    gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset);
  }
}

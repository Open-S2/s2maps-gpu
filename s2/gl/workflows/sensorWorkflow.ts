import { Feature } from './workflow';
import { buildColorRamp } from 'style/color';
import encodeLayerAttribute from 'style/encodeLayerAttribute';

// WEBGL1
import frag1 from '../shaders/sensors1.fragment.glsl';
import vert1 from '../shaders/sensors1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/sensors2.fragment.glsl';
import vert2 from '../shaders/sensors2.vertex.glsl';

import type Context from '../context/context';
import type { SensorData } from 'workers/worker.spec';
import type { SensorTextureDefinition } from 'ui/camera/timeCache';
import type { TileGL as Tile } from 'source/tile.spec';
import type TimeCache from 'ui/camera/timeCache';
import type {
  LayerDefinitionBase,
  SensorDefinition,
  SensorStyle,
  SensorWorkflowLayerGuide,
} from 'style/style.spec';
import type {
  SensorFeature as SensorFeatureSpec,
  SensorSource,
  SensorWorkflow as SensorWorkflowSpec,
  SensorWorkflowUniforms,
} from './workflow.spec';

/** Sensor Feature is a standalone sensor render storage unit that can be drawn to the GPU */
export class SensorFeature extends Feature implements SensorFeatureSpec {
  type = 'sensor' as const;
  opacity?: number; // webgl1
  /**
   * @param layerGuide - sensor layer guide for this feature
   * @param workflow - the sensor workflow
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param tile - the tile that the feature is drawn on
   * @param fadeStartTime - the start time of the "fade" to be applied
   * @param parent - the parent tile
   */
  constructor(
    public override layerGuide: SensorWorkflowLayerGuide,
    public override workflow: SensorWorkflowSpec,
    public override featureCode: number[],
    public override tile: Tile,
    public fadeStartTime = Date.now(),
    public override parent?: Tile,
  ) {
    super(workflow, tile, layerGuide, featureCode, parent);
  }

  /**
   * Draw this feature to the GPU
   * @param interactive - whether or not the feature is interactive for compute or render
   */
  override draw(interactive = false): void {
    super.draw(interactive);
    this.workflow.draw(this, interactive);
  }

  /**
   * Duplicate this feature
   * @param tile - the tile that the feature is drawn on
   * @param parent - the parent tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile): SensorFeature {
    const { layerGuide, workflow, featureCode, fadeStartTime, opacity } = this;
    const newFeature = new SensorFeature(
      layerGuide,
      workflow,
      featureCode,
      tile,
      fadeStartTime,
      parent,
    );
    newFeature.setWebGL1Attributes(opacity);
    return newFeature;
  }

  /**
   * Get the sensor textures
   * @returns the sensor textures
   */
  getTextures(): SensorTextureDefinition {
    const {
      tile: { id },
      workflow: { timeCache },
      layerGuide: { sourceName },
    } = this;
    return timeCache?.getTextures(id, sourceName) ?? {};
  }

  /**
   * Set the webgl1 attributes if the context is webgl1
   * @param opacity - the opacity
   */
  setWebGL1Attributes(opacity?: number): void {
    this.opacity = opacity;
  }
}

/**
 * Build the sensor workflow. This workflow is added to the painter modularly
 * @param context - The WebGL(1|2) context
 * @returns the sensor workflow
 */
export default async function sensorWorkflow(context: Context): Promise<SensorWorkflowSpec> {
  const Workflow = await import('./workflow').then((m) => m.default);

  /** Sensor Workflow that draws sensor features for WebGL(1|2) */
  class SensorWorkflow extends Workflow implements SensorWorkflowSpec {
    label = 'sensor' as const;
    nullTexture!: WebGLTexture;
    timeCache?: TimeCache;
    layerGuides = new Map<number, SensorWorkflowLayerGuide>();
    declare uniforms: { [key in SensorWorkflowUniforms]: WebGLUniformLocation };
    /** @param context - the WebGL(1|2) context */
    constructor(context: Context) {
      // get gl from context
      const { gl, type } = context;
      // inject Program
      super(context);
      // build shaders
      if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0 });
      else this.buildShaders(vert2, frag2);
      // activate so we can setup samplers
      this.use();
      // set sampler positions
      const { uColorRamp, uImage, uNextImage } = this.uniforms;
      gl.uniform1i(uColorRamp, 0);
      gl.uniform1i(uImage, 1);
      gl.uniform1i(uNextImage, 2);
      // set a null texture
      this.#createNullTexture();
    }

    /** Create a null texture for cases where a texture doesn't exist or is null */
    #createNullTexture(): void {
      const { gl } = this;
      const texture = gl.createTexture();
      if (texture === null) throw new Error('Failed to create sensor null texture');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.nullTexture = texture;
    }

    /**
     * Inject a time cache as the current cache for the sensor workflow
     * @param timeCache - the time cache
     */
    injectTimeCache(timeCache: TimeCache): void {
      this.timeCache = timeCache;
    }

    /**
     * Build sensor source data
     * @param sensorData - the input sensor data
     * @param tile - the tile we are building the features for
     */
    buildSource(sensorData: SensorData, tile: Tile): void {
      const { gl, context } = this;
      const { image, sourceName, size, time } = sensorData;
      // do not premultiply
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      // setup texture params
      const texture = context.buildTexture(image, size);

      // Extend mask
      const sensorSource: SensorSource = {
        texture,
      };
      // inject source into timeCache
      this.timeCache?.addSourceData(tile.id, time, sourceName, sensorSource);

      this.#buildFeatures(sensorData, tile);
    }

    /**
     * Build sensor features
     * @param rasterData - the input sensor data
     * @param tile - the tile we are building the features for
     */
    #buildFeatures(rasterData: SensorData, tile: Tile): void {
      const { featureGuides } = rasterData;
      const features: SensorFeatureSpec[] = [];
      // for each layer that maches the source, build the feature
      for (const { code, layerIndex } of featureGuides) {
        const layerGuide = this.layerGuides.get(layerIndex);
        if (layerGuide === undefined) continue;
        const feature = new SensorFeature(layerGuide, this, [0], tile);
        if (this.type === 1) feature.setWebGL1Attributes(code[0]);
        features.push(feature);
      }

      tile.addFeatures(features);
    }

    /**
     * Build the layer definition
     * @param layerBase - the common layer attributes
     * @param layer - the user defined layer attributes
     * @returns a built layer definition that's ready to describe how to render a sensor feature
     */
    buildLayerDefinition(layerBase: LayerDefinitionBase, layer: SensorStyle): SensorDefinition {
      const { source, layerIndex, lch, visible, interactive } = layerBase;
      // PRE) get layer properties
      const { cursor } = layer;
      let { colorRamp, opacity, fadeDuration } = layer;
      opacity = opacity ?? 1;
      colorRamp = colorRamp ?? 'sinebow';
      fadeDuration = fadeDuration ?? 300;
      // 1) build definition
      const layerDefinition: SensorDefinition = {
        ...layerBase,
        type: 'sensor',
        opacity,
        colorRamp,
        fadeDuration,
        interactive: interactive ?? false,
        cursor: cursor ?? 'default',
      };
      // 2) Store layer workflow, building code if webgl2
      const layerCode: number[] = [];
      layerCode.push(...encodeLayerAttribute(opacity, lch));
      this.layerGuides.set(layerIndex, {
        sourceName: source,
        layerIndex,
        layerCode,
        lch,
        fadeDuration,
        colorRamp: context.buildTexture(buildColorRamp(colorRamp, lch), 256, 4),
        visible,
        interactive: interactive ?? false,
        opaque: false,
      });

      return layerDefinition;
    }

    /** Use this workflow as the current shaders for the GPU */
    override use(): void {
      super.use();
      context.oneBlend();
      context.enableDepthTest();
      context.enableCullFace();
      context.enableStencilTest();
      context.lessDepth();
    }

    /**
     * Draw a sensor feature
     * @param feature - the feature to draw
     * @param _interactive - whether or not the feature is interactive
     */
    draw(feature: SensorFeatureSpec, _interactive = false): void {
      // grab gl from the context
      const { gl, type, context, nullTexture, uniforms } = this;
      const { uTime, uOpacity } = uniforms;

      // get current source data. Time is a uniform
      const {
        tile,
        parent,
        featureCode,
        opacity,
        layerGuide: { layerIndex, visible, colorRamp },
      } = feature;
      if (!visible) return;
      const { time, texture, textureNext } = feature.getTextures();
      const { mask } = parent ?? tile;
      const { vao, count, offset } = mask;
      if (time === undefined || texture === undefined) return;
      context.setDepthRange(layerIndex);
      // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
      if (type === 1) {
        gl.uniform1f(uOpacity, opacity ?? 1);
      } else {
        this.setFeatureCode(featureCode);
      }
      // set time uniform
      gl.uniform1f(uTime, time);
      // setup the textures
      gl.activeTexture(gl.TEXTURE2); // uNextImage
      if (textureNext !== undefined) gl.bindTexture(gl.TEXTURE_2D, textureNext);
      else gl.bindTexture(gl.TEXTURE_2D, nullTexture);
      gl.activeTexture(gl.TEXTURE1); // uImage
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.activeTexture(gl.TEXTURE0); // uColorRamp
      gl.bindTexture(gl.TEXTURE_2D, colorRamp);
      // draw elements
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset);
    }
  }

  return new SensorWorkflow(context);
}

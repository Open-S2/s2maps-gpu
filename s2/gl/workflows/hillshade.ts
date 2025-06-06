import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import Workflow, { Feature } from './workflow.js';

// WEBGL1
import frag1 from '../shaders/hillshade1.fragment.glsl';
import vert1 from '../shaders/hillshade1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/hillshade2.fragment.glsl';
import vert2 from '../shaders/hillshade2.vertex.glsl';

import type Context from '../context/context.js';
import type { HillshadeData } from 'workers/worker.spec.js';
import type { TileGL as Tile } from 'source/tile.spec.js';
import type {
  ColorArray,
  HillshadeDefinition,
  HillshadeStyle,
  HillshadeWorkflowLayerGuide,
  LayerDefinitionBase,
  UnpackData,
} from 'style/style.spec.js';
import type {
  HillshadeFeature as HillshadeFeatureSpec,
  HillshadeWorkflow as HillshadeWorkflowSpec,
  HillshadeWorkflowUniforms,
  RasterSource,
} from './workflow.spec.js';

/** Hillshade Feature is a standalone hillshade render storage unit that can be drawn to the GPU */
export class HilllshadeFeature extends Feature implements HillshadeFeatureSpec {
  type = 'hillshade' as const;
  opacity?: number; // webgl1
  shadowColor?: ColorArray; // webgl1
  accentColor?: ColorArray; // webgl1
  highlightColor?: ColorArray; // webgl1
  azimuth?: number; // webgl1
  altitude?: number; // webgl1
  /**
   * @param workflow - the hillshade workflow
   * @param layerGuide - layer guide for this feature
   * @param tile - the tile that the feature is drawn on
   * @param source - the raster source
   * @param fadeStartTime - the start time of the fade
   * @param parent - the parent tile
   */
  constructor(
    public override workflow: HillshadeWorkflowSpec,
    public override layerGuide: HillshadeWorkflowLayerGuide,
    public override tile: Tile,
    public source: RasterSource,
    public fadeStartTime = Date.now(),
    public override parent?: Tile,
  ) {
    super(workflow, tile, layerGuide, [0], parent);
  }

  /**
   * Draw the feature to the GPU
   * @param interactive - whether or not the feature is interactive
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
  duplicate(tile: Tile, parent?: Tile): HilllshadeFeature {
    const {
      layerGuide,
      workflow,
      source,
      fadeStartTime,
      opacity,
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
    } = this;
    const newFeature = new HilllshadeFeature(
      workflow,
      layerGuide,
      tile,
      source,
      fadeStartTime,
      parent,
    );
    newFeature.setWebGL1Attributes(
      opacity,
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
    );
    return newFeature;
  }

  /**
   * Set the attributes of the feature if the context is webgl1
   * @param opacity - the opacity
   * @param shadowColor - the shadow color
   * @param accentColor - the accent color
   * @param highlightColor - the highlight color
   * @param azimuth - the azimuth
   * @param altitude - the altitude
   */
  setWebGL1Attributes(
    opacity?: number,
    shadowColor?: ColorArray,
    accentColor?: ColorArray,
    highlightColor?: ColorArray,
    azimuth?: number,
    altitude?: number,
  ): void {
    this.opacity = opacity;
    this.shadowColor = shadowColor;
    this.accentColor = accentColor;
    this.highlightColor = highlightColor;
    this.azimuth = azimuth;
    this.altitude = altitude;
  }

  /**
   * Set the attributes of the feature if the context is webgl1
   * @param code - the code
   */
  setWebGL1AttributesCode(code: number[]): void {
    this.setWebGL1Attributes(
      code[0],
      code.slice(1, 5) as ColorArray,
      code.slice(5, 9) as ColorArray,
      code.slice(9, 13) as ColorArray,
      code[13],
      code[14],
    );
  }
}

/** Hillshade Workflow */
export default class HillshadeWorkflow extends Workflow implements HillshadeWorkflowSpec {
  label = 'hillshade' as const;
  layerGuides = new Map<number, HillshadeWorkflowLayerGuide>();
  declare uniforms: { [key in HillshadeWorkflowUniforms]: WebGLUniformLocation };
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
    const { uTexture } = this.uniforms;
    gl.uniform1i(uTexture, 0);
  }

  /**
   * Build the hillshade source
   * @param hillshadeData - the hillshade data sent from the Tile Worker
   * @param tile - the tile that the feature is drawn on
   */
  buildSource(hillshadeData: HillshadeData, tile: Tile): void {
    const { gl, context } = this;
    const { image, size } = hillshadeData;
    // do not premultiply
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    // setup texture params
    const texture = context.buildTexture(image, size);
    // create the soruce
    const source: RasterSource = { type: 'raster', texture, size };
    // build features
    this.#buildFeatures(source, hillshadeData, tile);
  }

  /**
   * Build the hillshade features
   * @param source - the source
   * @param hillshadeData - the hillshade data
   * @param tile - the tile that the features are drawn on
   */
  #buildFeatures(source: RasterSource, hillshadeData: HillshadeData, tile: Tile): void {
    const { featureGuides } = hillshadeData;
    // for each layer that maches the source, build the feature

    const features: HillshadeFeatureSpec[] = [];

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const feature = new HilllshadeFeature(this, layerGuide, tile, source);
      if (this.type === 1) feature.setWebGL1AttributesCode(code);
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the layer definition
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: HillshadeStyle): HillshadeDefinition {
    const { type } = this;
    const { source, layerIndex, lch, visible, interactive } = layerBase;
    // PRE) get layer properties
    let {
      unpack,
      shadowColor,
      accentColor,
      highlightColor,
      opacity,
      azimuth,
      altitude,
      fadeDuration,
    } = layer;
    shadowColor = shadowColor ?? '#000';
    accentColor = accentColor ?? '#000';
    highlightColor = highlightColor ?? '#fff';
    opacity = opacity ?? 1;
    azimuth = azimuth ?? 315;
    altitude = altitude ?? 45;
    fadeDuration = fadeDuration ?? 300;
    // defaults to mapbox unpack
    unpack = unpack ?? {
      offset: -10000,
      zFactor: 0.1,
      aMultiplier: 0,
      bMultiplier: 1,
      gMultiplier: 256,
      rMultiplier: 256 * 256,
    };
    // 1) build definition
    const layerDefinition: HillshadeDefinition = {
      ...layerBase,
      type: 'hillshade',
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
      opacity,
      unpack,
    };
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = [];
    if (type === 2) {
      for (const paint of [opacity, shadowColor, accentColor, highlightColor, azimuth, altitude]) {
        layerCode.push(...encodeLayerAttribute(paint, lch));
      }
    }
    // 3) Store layer guide
    const unpackData: UnpackData = [
      unpack.offset,
      unpack.zFactor,
      unpack.rMultiplier,
      unpack.gMultiplier,
      unpack.bMultiplier,
      unpack.aMultiplier,
    ];
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      fadeDuration,
      unpack: unpackData,
      visible,
      interactive: interactive ?? false,
      opaque: false,
    });

    return layerDefinition;
  }

  /** Use this workflow as the current shaders for the GPU */
  override use(): void {
    super.use();
    const { context } = this;
    // setup context
    context.defaultBlend();
    context.enableDepthTest();
    context.enableCullFace();
    context.enableStencilTest();
    context.lessDepth();
  }

  /**
   * Draw the hillshade feature
   * @param feature - the feature guide
   * @param _interactive - whether or not the feature is interactive
   */
  draw(feature: HillshadeFeatureSpec, _interactive = false): void {
    // grab gl from the context
    const { type, gl, context, uniforms } = this;
    const {
      uFade,
      uTexLength,
      uUnpack,
      uOpacity,
      uShadowColor,
      uAccentColor,
      uHighlightColor,
      uAzimuth,
      uAltitude,
    } = uniforms;
    const { PI, min, max } = Math;

    // get current source data
    const {
      tile,
      parent,
      source,
      layerGuide: { layerIndex, visible, unpack },
      featureCode,
      opacity,
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
    } = feature;
    if (!visible) return;
    const { texture, size } = source;
    const { vao, count, offset } = (parent ?? tile).mask;
    context.setDepthRange(layerIndex);
    // set fade
    gl.uniform1f(uFade, 1);
    gl.uniform1fv(uUnpack, unpack);
    // set feature code (webgl 1 we store the opacity, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform1f(uTexLength, size);
      gl.uniform1f(uOpacity, opacity ?? 1);
      gl.uniform4fv(uShadowColor, shadowColor ?? [0, 0, 0, 1]);
      gl.uniform4fv(uAccentColor, accentColor ?? [0, 0, 0, 1]);
      gl.uniform4fv(uHighlightColor, highlightColor ?? [1, 1, 1, 1]);
      gl.uniform1f(uAzimuth, (min(max(azimuth ?? 315, 0), 360) * PI) / 180);
      gl.uniform1f(uAltitude, min(max(altitude ?? 45, 0), 90) / 90);
    } else {
      this.setFeatureCode(featureCode);
    }
    // bind vao
    gl.bindVertexArray(vao);
    // setup the texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // draw elements
    gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset);
  }
}

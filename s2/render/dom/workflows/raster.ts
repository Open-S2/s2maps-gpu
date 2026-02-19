import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import Workflow, { Feature } from './workflow.js';

import type { DOMContext as Context } from '../context.js';
import type { RasterData } from 'workers/worker.spec.js';
import type { TileDOM as Tile } from 'source/tile.spec.js';
import type {
  LayerDefinitionBase,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuide,
  // Resampling,
} from 'style/style.spec.js';
import type {
  RasterFeature as RasterFeatureSpec,
  RasterSource,
  RasterWorkflow as RasterWorkflowSpec,
} from './workflow.spec.js';

/** Raster Feature is a standalone raster render storage unit that can be drawn to the GPU */
export class RasterFeature extends Feature implements RasterFeatureSpec {
  type = 'raster' as const;
  opacity?: number;
  saturation?: number;
  contrast?: number;
  /**
   * @param layerGuide - layer guide for this feature
   * @param workflow - the raster workflow
   * @param source - the raster source
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param tile - the tile that the feature is drawn on
   * @param fadeStartTime - the start time of the "fade" to be applied
   * @param parent - the parent tile
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
   * Duplicate this feature
   * @param tile - the tile that the feature is drawn on
   * @param parent - the parent tile if applicable
   * @returns the duplicated feature
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
    newFeature.setAttributes(opacity, saturation, contrast);
    return newFeature;
  }

  /**
   * Set the attributes
   * @param opacity - the opacity
   * @param saturation - the saturation
   * @param contrast - the contrast
   */
  setAttributes(opacity?: number, saturation?: number, contrast?: number): void {
    this.opacity = opacity;
    this.saturation = saturation;
    this.contrast = contrast;
  }
}

/** Raster Workflow */
export default class RasterWorkflow extends Workflow implements RasterWorkflowSpec {
  label = 'raster' as const;
  curSample: 'none' | 'linear' | 'nearest' = 'none';
  layerGuides = new Map<number, RasterWorkflowLayerGuide>();
  /** @param context - the WebGL(1|2) context */
  constructor(context: Context) {
    super(context);
  }

  // /**
  //  * Set the sample type
  //  * @param type - the sample type
  //  */
  // #setSampleType(type: Resampling): void {
  //   const { curSample } = this;
  //   if (curSample === type) return;
  //   this.curSample = type;
  //   // if (type === 'nearest') {
  //   //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  //   //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  //   // } else {
  //   //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  //   //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  //   // }
  // }

  /**
   * Build a layer definition for this workflow given the user input layer
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a raster feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: RasterStyle): RasterDefinition {
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
    for (const paint of [opacity, saturation, contrast]) {
      layerCode.push(...encodeLayerAttribute(paint, lch));
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
   * Build the source raster data into raster features
   * @param rasterData - the input raster data
   * @param tile - the tile we are building the features for
   */
  buildSource(rasterData: RasterData, tile: Tile): void {
    const { context } = this;
    const { image, size } = rasterData;
    // setup texture params and create source
    const texture = context.buildTexture(image, size);
    const rasterSource: RasterSource = { type: 'raster', texture, size };

    this.#buildFeatures(rasterSource, rasterData, tile);
  }

  /**
   * Build features for this source
   * @param source - the raster source
   * @param rasterData - the input raster data
   * @param tile - the tile we are building the features for
   */
  #buildFeatures(source: RasterSource, rasterData: RasterData, tile: Tile): void {
    const { featureGuides } = rasterData;
    // for each layer that maches the source, build the feature

    const features: RasterFeature[] = [];

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const feature = new RasterFeature(layerGuide, this, source, code, tile);
      feature.setAttributes(code[0], code[1], code[2]);
      features.push(feature);
    }

    tile.addFeatures(features);
  }
}

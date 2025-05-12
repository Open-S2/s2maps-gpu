import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import Workflow, { Feature } from './workflow.js';

// WEBGL1
import frag1 from '../shaders/point1.fragment.glsl';
import vert1 from '../shaders/point1.vertex.glsl';
// WEBGL2
import frag2 from '../shaders/point2.fragment.glsl';
import vert2 from '../shaders/point2.vertex.glsl';

import type Context from '../context/context.js';
import type { PointData } from 'workers/worker.spec.js';
import type { TileGL as Tile } from 'source/tile.spec.js';
import type {
  BBox,
  ColorArray,
  LayerDefinitionBase,
  PointDefinition,
  PointStyle,
  PointWorkflowLayerGuide,
} from 'style/style.spec.js';
import type {
  PointFeature as PointFeatureSpec,
  PointSource,
  PointWorkflow as PointWorkflowSpec,
  PointWorkflowUniforms,
} from './workflow.spec.js';

/** Point Feature is a standalone point render storage unit that can be drawn to the GPU */
export class PointFeature extends Feature implements PointFeatureSpec {
  type = 'point' as const;
  color?: ColorArray; // webgl1
  radius?: number; // webgl1
  stroke?: ColorArray; // webgl1
  strokeWidth?: number; // webgl1
  opacity?: number; // webgl1
  /**
   * @param workflow - the point workflow
   * @param source - the point source
   * @param layerGuide - layer guide for this feature
   * @param tile - the tile that the feature is drawn on
   * @param count - the number of points
   * @param offset - the offset of the points
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param parent - the parent tile if applicable
   * @param bounds - the bounds of the tile if applicable
   */
  constructor(
    public override workflow: PointWorkflow,
    public source: PointSource,
    public override layerGuide: PointWorkflowLayerGuide,
    public override tile: Tile,
    public count: number,
    public offset: number,
    public override featureCode: number[],
    public override parent?: Tile,
    public override bounds?: BBox,
  ) {
    super(workflow, tile, layerGuide, featureCode, parent);
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
   * @param bounds - the bounds of the tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile, bounds?: BBox): PointFeature {
    const {
      workflow,
      source,
      layerGuide,
      count,
      offset,
      featureCode,
      color,
      radius,
      stroke,
      strokeWidth,
      opacity,
    } = this;
    const newFeature = new PointFeature(
      workflow,
      source,
      layerGuide,
      tile,
      count,
      offset,
      featureCode,
      parent,
      bounds,
    );
    newFeature.setWebGL1Attributes(color, radius, stroke, strokeWidth, opacity);
    return newFeature;
  }

  /**
   * Set the attributes of the feature if the context is webgl1
   * @param color - the color
   * @param radius - the radius
   * @param stroke - the stroke
   * @param strokeWidth - the stroke width
   * @param opacity - the opacity
   */
  setWebGL1Attributes(
    color?: ColorArray,
    radius?: number,
    stroke?: ColorArray,
    strokeWidth?: number,
    opacity?: number,
  ): void {
    this.color = color;
    this.radius = radius;
    this.stroke = stroke;
    this.strokeWidth = strokeWidth;
    this.opacity = opacity;
  }
}

/** Point Workflow */
export default class PointWorkflow extends Workflow implements PointWorkflowSpec {
  label = 'point' as const;
  extentBuffer?: WebGLBuffer;
  layerGuides = new Map<number, PointWorkflowLayerGuide>();
  declare uniforms: { [key in PointWorkflowUniforms]: WebGLUniformLocation };
  /** @param context - the WebGL(1|2) context */
  constructor(context: Context) {
    // get gl from context
    const { type, devicePixelRatio } = context;
    // inject Program
    super(context);
    // build shaders
    if (type === 1) this.buildShaders(vert1, frag1, { aExtent: 0, aPos: 1, aID: 2 });
    else this.buildShaders(vert2, frag2);
    // activate so we can setup samplers
    this.use();
    // set device pixel ratio
    this.setDevicePixelRatio(devicePixelRatio);
  }

  /** Setup and bind the extent/quad buffer */
  #bindExtentBuffer(): void {
    const { gl, context, extentBuffer } = this;

    if (extentBuffer === undefined) {
      // simple quad set
      // [[-1, -1], [1, -1], [-1, 1]]  &  [[1, -1], [1, 1], [-1, 1]]
      const typeArray = new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]);
      this.extentBuffer = context.bindEnableVertexAttr(typeArray, 0, 2, gl.FLOAT, false, 0, 0);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, extentBuffer);
      context.defineBufferState(0, 2, gl.FLOAT, false, 0, 0);
    }
  }

  /**
   * Build the source raster data into raster features
   * @param pointData - the point data
   * @param tile - the tile we are building the features for
   */
  buildSource(pointData: PointData, tile: Tile): void {
    const { gl, context } = this;
    const { vertexBuffer: vertexB, idBuffer: idB, featureGuideBuffer } = pointData;
    // prep buffers
    const vertexA = new Float32Array(vertexB);
    const idA = new Uint8Array(idB);
    // Create a starting vertex array object (attribute state)
    const vao = context.buildVAO();

    // bind buffers to the vertex array object
    // Create the feature index buffer
    const vertexBuffer = context.bindEnableVertexAttr(vertexA, 1, 2, gl.FLOAT, false, 8, 0, true);
    const idBuffer = context.bindEnableVertexAttr(idA, 2, 4, gl.UNSIGNED_BYTE, true, 0, 0, true);

    // bind the extentBuffer
    this.#bindExtentBuffer();

    const source: PointSource = {
      type: 'point',
      vertexBuffer,
      idBuffer,
      vao,
    };

    context.finish(); // flush vao

    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer));
  }

  /**
   * Build the point features
   * @param source - the point source
   * @param tile - the tile we are building the features for
   * @param featureGuideArray - the feature guide describing how to decode the raw source data into features
   */
  #buildFeatures(source: PointSource, tile: Tile, featureGuideArray: Float32Array): void {
    const features: PointFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4);
      i += 4;
      // grab the layerGuide
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      // create the feature
      const feature = new PointFeature(this, source, layerGuide, tile, count, offset, [0]);
      if (this.type === 1) {
        const [ra, o, cr, cg, cb, ca, sr, sg, sb, sa, sw] = featureGuideArray.slice(i, i + 11);
        feature.setWebGL1Attributes([cr, cg, cb, ca], ra, [sr, sg, sb, sa], sw, o);
        i += 11;
      } else if (this.type === 2 && encodingSize > 0) {
        feature.featureCode = [...featureGuideArray.slice(i, i + encodingSize)];
        i += encodingSize;
      }
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the layer definition for this workflow
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a point feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: PointStyle): PointDefinition {
    const { type } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    let { radius, opacity, color, stroke, strokeWidth, geoFilter, interactive, cursor } = layer;
    radius = radius ?? 1;
    opacity = opacity ?? 1;
    color = color ?? 'rgba(0, 0, 0, 0)';
    stroke = stroke ?? 'rgba(0, 0, 0, 0)';
    strokeWidth = strokeWidth ?? 1;
    interactive = interactive ?? false;
    cursor = cursor ?? 'default';
    geoFilter = geoFilter ?? ['line', 'poly'];
    // 1) build definition
    const layerDefinition: PointDefinition = {
      ...layerBase,
      type: 'point',
      // paint
      radius,
      opacity,
      color,
      stroke,
      strokeWidth,
      // propreties
      geoFilter,
      interactive,
      cursor,
    };
    // 2) Store layer workflow, building code if webgl2
    const layerCode: number[] = [];
    if (type === 2) {
      for (const paint of [radius, opacity, color, stroke, strokeWidth]) {
        layerCode.push(...encodeLayerAttribute(paint, lch));
      }
    }
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      interactive,
      cursor,
      visible,
      opaque: false,
    });

    return layerDefinition;
  }

  /** Use this workflow as the current shaders for the GPU */
  override use(): void {
    super.use();
    const { context } = this;
    // Prepare context
    context.defaultBlend();
    context.enableDepthTest();
    context.disableCullFace();
    context.enableStencilTest();
    context.lequalDepth();
  }

  /**
   * Draw the point feature
   * @param feature - the point feature
   * @param _interactive - whether or not the feature is interactive
   */
  draw(feature: PointFeatureSpec, _interactive = false): void {
    // grab context
    const { gl, type, context, uniforms } = this;
    const { uColor, uRadius, uStroke, uSWidth, uOpacity, uBounds } = uniforms;
    const { defaultBounds } = context;
    // get current source data
    const {
      source,
      count,
      offset,
      featureCode,
      layerGuide: { layerIndex, visible },
      color,
      radius,
      stroke,
      strokeWidth,
      opacity,
      bounds,
    } = feature;
    if (!visible) return;
    const { vao, vertexBuffer } = source;
    context.stencilFuncAlways(0);
    context.setDepthRange(layerIndex);
    // if bounds exists, set them, otherwise set default bounds
    if (bounds !== undefined) gl.uniform4fv(uBounds, bounds);
    else gl.uniform4fv(uBounds, defaultBounds);
    // set feature code (webgl 1 we store the colors, webgl 2 we store layerCode lookups)
    if (type === 1) {
      gl.uniform4fv(uColor, color ?? [0, 0, 0, 1]);
      gl.uniform1f(uRadius, radius ?? 1);
      gl.uniform4fv(uStroke, stroke ?? [0, 0, 0, 1]);
      gl.uniform1f(uSWidth, strokeWidth ?? 1);
      gl.uniform1f(uOpacity, opacity ?? 1);
    } else {
      this.setFeatureCode(featureCode);
    }
    // setup offsets and draw
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, offset * 8);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
  }
}

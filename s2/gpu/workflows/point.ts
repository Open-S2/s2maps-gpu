import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import shaderCode from '../shaders/point.wgsl';

import type { BBox } from 'gis-tools/index.js';
import type { PointData } from 'workers/worker.spec.js';
import type { TileGPU as Tile } from 'source/tile.spec.js';
import type { WebGPUContext } from '../context/index.js';
import type {
  LayerDefinitionBase,
  PointDefinition,
  PointStyle,
  PointWorkflowLayerGuideGPU,
} from 'style/style.spec.js';
import type {
  PointFeature as PointFeatureSpec,
  PointSource,
  PointWorkflow as PointWorkflowSpec,
} from './workflow.spec.js';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // pos
    arrayStride: 4 * 2,
    stepMode: 'instance',
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
];

/** Point Feature is a standalone point render storage unit that can be drawn to the GPU */
export class PointFeature implements PointFeatureSpec {
  type = 'point' as const;
  bindGroup: GPUBindGroup;
  pointBindGroup: GPUBindGroup;
  pointInteractiveBindGroup: GPUBindGroup;
  /**
   * @param workflow - the point workflow
   * @param source - the point source
   * @param layerGuide - layer guide for this feature
   * @param tile - the tile this feature is drawn on
   * @param count - the number of points
   * @param offset - the offset of the points
   * @param featureCode - the encoded feature code
   * @param pointBoundsBuffer - the bounds of the points
   * @param pointInteractiveBuffer - the interactive buffer
   * @param featureCodeBuffer - the encoded feature code that tells the GPU how to compute it's properties
   * @param parent - the parent tile if applicable
   */
  constructor(
    public workflow: PointWorkflow,
    public source: PointSource,
    public layerGuide: PointWorkflowLayerGuideGPU,
    public tile: Tile,
    public count: number,
    public offset: number,
    public featureCode: number[],
    public pointBoundsBuffer: GPUBuffer,
    public pointInteractiveBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public parent?: Tile,
  ) {
    this.bindGroup = this.#buildBindGroup();
    this.pointBindGroup = this.#buildPointBindGroup();
    this.pointInteractiveBindGroup = this.#buildPointInteractiveBindGroup();
  }

  /** Draw the feature to the GPU */
  draw(): void {
    const { tile, workflow } = this;
    workflow.context.setStencilReference(tile.tmpMaskID);
    workflow.draw(this);
  }

  /** Compute the feature's interactivity with the mouse */
  compute(): void {
    this.workflow.computeInteractive(this);
  }

  /** Destroy and cleanup the feature */
  destroy(): void {
    const { pointBoundsBuffer, pointInteractiveBuffer, featureCodeBuffer } = this;
    pointBoundsBuffer.destroy();
    pointInteractiveBuffer.destroy();
    featureCodeBuffer.destroy();
  }

  /**
   * Duplicate this feature
   * @param tile - the tile this feature is drawn on
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
      pointBoundsBuffer,
      pointInteractiveBuffer,
      featureCodeBuffer,
    } = this;
    const { context } = workflow;
    const cE = context.device.createCommandEncoder();
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE);
    const newPointBoundsBuffer =
      bounds !== undefined
        ? context.buildGPUBuffer(
            'Point Uniform Buffer',
            new Float32Array(bounds),
            GPUBufferUsage.UNIFORM,
          )
        : context.duplicateGPUBuffer(pointBoundsBuffer, cE);
    const newPointInteractiveBuffer = context.duplicateGPUBuffer(pointInteractiveBuffer, cE);
    context.device.queue.submit([cE.finish()]);
    return new PointFeature(
      workflow,
      source,
      layerGuide,
      tile,
      count,
      offset,
      featureCode,
      newPointBoundsBuffer,
      newPointInteractiveBuffer,
      newFeatureCodeBuffer,
      parent,
    );
  }

  /**
   * Build the bind group for the point feature
   * @returns the GPU Bind Group for the point feature
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = parent ?? tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Point Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }

  /**
   * Build a bind group with point specific properties
   * @returns the GPU Bind Group for the point
   */
  #buildPointBindGroup(): GPUBindGroup {
    const { workflow, pointBoundsBuffer } = this;
    const { context, pointBindGroupLayout } = workflow;
    return context.buildGroup('Point BindGroup', pointBindGroupLayout, [pointBoundsBuffer]);
  }

  /**
   * Build a bind group with point interactive specific properties
   * @returns the GPU Bind Group for the point
   */
  #buildPointInteractiveBindGroup(): GPUBindGroup {
    const { workflow, pointBoundsBuffer, pointInteractiveBuffer, source } = this;
    const { context, pointInteractiveBindGroupLayout } = workflow;
    return context.buildGroup('Point Interactive BindGroup', pointInteractiveBindGroupLayout, [
      pointBoundsBuffer,
      pointInteractiveBuffer,
      source.vertexBuffer,
      source.idBuffer,
    ]);
  }
}

/** Point Workflow */
export default class PointWorkflow implements PointWorkflowSpec {
  context: WebGPUContext;
  layerGuides = new Map<number, PointWorkflowLayerGuideGPU>();
  pipeline!: GPURenderPipeline;
  interactivePipeline!: GPUComputePipeline;
  pointInteractiveBindGroupLayout!: GPUBindGroupLayout;
  pointBindGroupLayout!: GPUBindGroupLayout;
  module!: GPUShaderModule;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /** Setup the workflow */
  async setup(): Promise<void> {
    this.module = this.context.device.createShaderModule({ code: shaderCode });
    this.pipeline = await this.#getPipeline();
    this.interactivePipeline = await this.#getComputePipeline();
  }

  /** Destroy and cleanup the workflow */
  destroy(): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy();
      layerCodeBuffer.destroy();
    }
  }

  /**
   * Build the layer definition for this workflow
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: PointStyle): PointDefinition {
    const { context } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    let { radius, opacity, color, stroke, strokeWidth, interactive, cursor, geoFilter } = layer;
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
      type: 'point' as const,
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
    // 2) build the layerCode
    const layerCode: number[] = [];
    for (const paint of [radius, strokeWidth, opacity, color, stroke]) {
      layerCode.push(...encodeLayerAttribute(paint, lch));
    }
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildGPUBuffer(
      'Layer Uniform Buffer',
      new Float32Array([context.getDepthPosition(layerIndex), ~~lch]),
      GPUBufferUsage.UNIFORM,
    );
    const layerCodeBuffer = context.buildGPUBuffer(
      'Layer Code Buffer',
      new Float32Array(layerCode),
      GPUBufferUsage.STORAGE,
    );
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      lch,
      interactive,
      cursor,
      visible,
      opaque: false,
    });

    return layerDefinition;
  }

  /**
   * Build the source point data into point features
   * @param pointData - the input point data
   * @param tile - the tile we are building the features for
   */
  buildSource(pointData: PointData, tile: Tile): void {
    const { context } = this;
    const { vertexBuffer, idBuffer, featureGuideBuffer } = pointData;
    // prep buffers
    const source: PointSource = {
      type: 'point' as const,
      vertexBuffer: context.buildGPUBuffer(
        'Point Vertex Buffer',
        new Float32Array(vertexBuffer),
        GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      ),
      idBuffer: context.buildGPUBuffer(
        'Point Index Buffer',
        new Uint32Array(idBuffer),
        GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      ),
      /** destroy the point source */
      destroy: (): void => {
        const { vertexBuffer, idBuffer } = source;
        vertexBuffer.destroy();
        idBuffer.destroy();
      },
    };
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer));
  }

  /**
   * Build point features from input point source
   * @param source - the input point source
   * @param tile - the tile we are building the features for
   * @param featureGuideArray - the feature guide to help build the features properties
   */
  #buildFeatures(source: PointSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this;
    const features: PointFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4);
      i += 4;
      // build featureCode
      let featureCode: number[] = [0];

      featureCode = encodingSize > 0 ? [...featureGuideArray.slice(i, i + encodingSize)] : [0];
      // update index
      i += encodingSize;

      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const pointBoundsBuffer = context.buildGPUBuffer(
        'Point Uniform Buffer',
        new Float32Array([0, 0, 1, 1]),
        GPUBufferUsage.UNIFORM,
      );
      const featureCodeBuffer = context.buildGPUBuffer(
        'Feature Code Buffer',
        new Float32Array(featureCode),
        GPUBufferUsage.STORAGE,
      );
      const pointInteractiveBuffer = context.buildGPUBuffer(
        'Point Interactive Buffer',
        new Uint32Array([offset, count]),
        GPUBufferUsage.UNIFORM,
      );

      const feature = new PointFeature(
        this,
        source,
        layerGuide,
        tile,
        count,
        offset,
        featureCode,
        pointBoundsBuffer,
        pointInteractiveBuffer,
        featureCodeBuffer,
      );
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the render pipeline for the point workflow
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the render pipeline
   */
  async #getPipeline(): Promise<GPURenderPipeline> {
    const { module, context } = this;
    const {
      device,
      format,
      defaultBlend,
      sampleCount,
      frameBindGroupLayout,
      featureBindGroupLayout,
    } = context;

    this.pointBindGroupLayout = context.buildLayout('Point', ['uniform'], GPUShaderStage.VERTEX);

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.pointBindGroupLayout],
    });
    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace',
    };

    return await device.createRenderPipelineAsync({
      label: 'Point Pipeline',
      layout,
      vertex: { module, entryPoint: 'vMain', buffers: SHADER_BUFFER_LAYOUT },
      fragment: {
        module,
        entryPoint: 'fMain',
        targets: [{ format, blend: defaultBlend }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0xffffffff,
        stencilWriteMask: 0xffffffff,
      },
    });
  }

  /**
   * Build a compute pipeline to check for interactive point data that interects with the mouse
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the GPU compute pipeline
   */
  async #getComputePipeline(): Promise<GPUComputePipeline> {
    const { context, module } = this;
    const { device, frameBindGroupLayout, featureBindGroupLayout, interactiveBindGroupLayout } =
      context;

    this.pointInteractiveBindGroupLayout = device.createBindGroupLayout({
      label: 'Point Interactive BindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // bounds
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // interactive offset & count
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // positions
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // ids
      ],
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        frameBindGroupLayout,
        featureBindGroupLayout,
        this.pointInteractiveBindGroupLayout,
        interactiveBindGroupLayout,
      ],
    });

    return await context.device.createComputePipelineAsync({
      label: 'Point Interactive Compute Pipeline',
      layout,
      compute: { module, entryPoint: 'interactive' },
    });
  }

  /**
   * Draw a point feature to the GPU
   * @param feature - point feature guide
   */
  draw(feature: PointFeatureSpec): void {
    const {
      layerGuide: { visible },
      bindGroup,
      pointBindGroup,
      source,
      count,
      offset,
    } = feature;
    if (!visible) return;
    // get current source data
    const { passEncoder } = this.context;
    const { vertexBuffer } = source;

    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline);
    passEncoder.setBindGroup(1, bindGroup);
    passEncoder.setBindGroup(2, pointBindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    // draw
    passEncoder.draw(6, count, 0, offset);
  }

  /**
   * Compute the interactive features that interact with the mouse
   * @param feature - point feature guide
   */
  computeInteractive(feature: PointFeatureSpec): void {
    const {
      layerGuide: { visible },
      bindGroup,
      pointInteractiveBindGroup,
      count,
    } = feature;
    if (!visible) return;
    const { interactiveBindGroup, computePass } = this.context;
    this.context.setComputePipeline(this.interactivePipeline);
    // set bind group & draw
    computePass.setBindGroup(1, bindGroup);
    computePass.setBindGroup(2, pointInteractiveBindGroup);
    computePass.setBindGroup(3, interactiveBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(count / 64));
  }
}

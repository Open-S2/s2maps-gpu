import encodeLayerAttribute from 'style/encodeLayerAttribute';
import shaderCode from '../shaders/raster.wgsl';

import type { RasterData } from 'workers/worker.spec';
import type { TileGPU as Tile } from 'source/tile.spec';
import type { WebGPUContext } from '../context';
import type {
  LayerDefinitionBase,
  RasterDefinition,
  RasterStyle,
  RasterWorkflowLayerGuideGPU,
} from 'style/style.spec';
import type {
  RasterFeature as RasterFeatureSpec,
  RasterSource,
  RasterWorkflow as RasterWorkflowSpec,
} from './workflow.spec';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // position
    arrayStride: 4 * 2,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
];

/** Raster Feature is a standalone raster render storage unit that can be drawn to the GPU */
export class RasterFeature implements RasterFeatureSpec {
  type = 'raster' as const;
  bindGroup: GPUBindGroup;
  rasterBindGroup: GPUBindGroup;
  /**
   * @param layerGuide - the layer guide for this feature
   * @param workflow - the raster workflow
   * @param tile - the tile this feature is drawn on
   * @param source - the raster source
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param rasterFadeBuffer - the fade buffer
   * @param featureCodeBuffer - the feature code buffer
   * @param fadeStartTime - the start time of the fade for smooth transitions
   * @param parent - the parent tile if applicable
   */
  constructor(
    public layerGuide: RasterWorkflowLayerGuideGPU,
    public workflow: RasterWorkflowSpec,
    public tile: Tile,
    public source: RasterSource,
    public featureCode: number[],
    public rasterFadeBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public fadeStartTime = Date.now(),
    public parent?: Tile,
  ) {
    this.bindGroup = this.#buildBindGroup();
    this.rasterBindGroup = this.#buildRasterBindGroup();
  }

  /** Draw the feature to the GPU */
  draw(): void {
    const { tile, workflow } = this;
    workflow.context.setStencilReference(tile.tmpMaskID);
    workflow.draw(this);
  }

  /** Destroy and cleanup the feature */
  destroy(): void {
    const { rasterFadeBuffer, featureCodeBuffer } = this;
    rasterFadeBuffer.destroy();
    featureCodeBuffer.destroy();
  }

  /**
   * Duplicate the raster feature
   * @param tile - the tile this feature is drawn on
   * @param parent - the parent tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile): RasterFeature {
    const {
      layerGuide,
      workflow,
      source,
      featureCode,
      rasterFadeBuffer,
      featureCodeBuffer,
      fadeStartTime,
    } = this;
    const { context } = workflow;
    const cE = context.device.createCommandEncoder();
    const newRasterFadeBuffer = context.duplicateGPUBuffer(rasterFadeBuffer, cE);
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE);
    context.device.queue.submit([cE.finish()]);
    return new RasterFeature(
      layerGuide,
      workflow,
      tile,
      source,
      featureCode,
      newRasterFadeBuffer,
      newFeatureCodeBuffer,
      fadeStartTime,
      parent,
    );
  }

  /**
   * Build the feature into a bind group
   * @returns a new bind group
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = parent ?? tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Raster Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }

  /**
   * Build the raster specific properties into a bind group
   * @returns a new raster bind group
   */
  #buildRasterBindGroup(): GPUBindGroup {
    const { source, workflow, rasterFadeBuffer, layerGuide } = this;
    const { context, rasterBindGroupLayout } = workflow;
    const { resampling } = layerGuide;
    const sampler = context.buildSampler(resampling);
    return context.device.createBindGroup({
      label: 'Raster BindGroup',
      layout: rasterBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: rasterFadeBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: source.texture.createView() },
      ],
    });
  }
}

/** Raster Workflow */
export default class RasterWorkflow implements RasterWorkflowSpec {
  context: WebGPUContext;
  layerGuides = new Map<number, RasterWorkflowLayerGuideGPU>();
  pipeline!: GPURenderPipeline;
  rasterBindGroupLayout!: GPUBindGroupLayout;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /** Setup the workflow */
  async setup(): Promise<void> {
    this.pipeline = await this.#getPipeline();
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
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: RasterStyle): RasterDefinition {
    const { context } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    const { resampling, fadeDuration } = layer;
    let { opacity, saturation, contrast } = layer;
    opacity = opacity ?? 1;
    saturation = saturation ?? 0;
    contrast = contrast ?? 0;
    // 1) build definition
    const layerDefinition: RasterDefinition = {
      ...layerBase,
      type: 'raster' as const,
      opacity: opacity ?? 1,
      saturation: saturation ?? 0,
      contrast: contrast ?? 0,
    };
    // 2) Store layer workflow
    const layerCode: number[] = [];
    for (const paint of [opacity, saturation, contrast]) {
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
      lch,
      fadeDuration: fadeDuration ?? 300,
      resampling: resampling ?? 'linear',
      layerBuffer,
      layerCodeBuffer,
      visible,
      interactive: false,
      opaque: false,
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
    const { mask } = tile;

    const texture = context.buildTexture(image, size);
    // prep buffers
    const source: RasterSource = {
      type: 'raster' as const,
      texture,
      vertexBuffer: mask.vertexBuffer,
      indexBuffer: mask.indexBuffer,
      count: mask.count,
      offset: mask.offset,
      /** Destroy the raster source */
      destroy: () => {
        texture.destroy();
      },
    };
    // build features
    this.#buildFeatures(source, rasterData, tile);
  }

  /**
   * Build raster features from input raster source
   * @param source - the source to build features from
   * @param rasterData - the input raster data
   * @param tile - the tile we are building the features for
   */
  #buildFeatures(source: RasterSource, rasterData: RasterData, tile: Tile): void {
    const { context } = this;
    const { featureGuides } = rasterData;
    // for each layer that maches the source, build the feature
    const features: RasterFeatureSpec[] = [];

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;

      const rasterFadeBuffer = context.buildGPUBuffer(
        'Raster Uniform Buffer',
        new Float32Array([1]),
        GPUBufferUsage.UNIFORM,
      );
      const featureCodeBuffer = context.buildGPUBuffer(
        'Feature Code Buffer',
        new Float32Array(code.length > 0 ? code : [0]),
        GPUBufferUsage.STORAGE,
      );
      const feature = new RasterFeature(
        layerGuide,
        this,
        tile,
        source,
        code,
        rasterFadeBuffer,
        featureCodeBuffer,
      );
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the render pipeline for the raster workflow
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the render pipeline
   */
  async #getPipeline(): Promise<GPURenderPipeline> {
    const { context } = this;
    const {
      device,
      format,
      defaultBlend,
      projection,
      sampleCount,
      frameBindGroupLayout,
      featureBindGroupLayout,
    } = context;

    // prep raster uniforms
    this.rasterBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Raster BindGroupLayout',
      entries: [
        // uniforms
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    const module = device.createShaderModule({ code: shaderCode });
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.rasterBindGroupLayout],
    });
    const stencilState: GPUStencilFaceState = {
      compare: 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace',
    };

    return await device.createRenderPipelineAsync({
      label: 'Raster Pipeline',
      layout,
      vertex: { module, entryPoint: 'vMain', buffers: SHADER_BUFFER_LAYOUT },
      fragment: {
        module,
        entryPoint: 'fMain',
        targets: [{ format, blend: defaultBlend }],
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: projection === 'S2' ? 'back' : 'front',
        stripIndexFormat: 'uint32',
      },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0xffffffff,
        stencilWriteMask: 0xffffffff,
      },
    });
  }

  /**
   * Draw a raster feature to the GPU
   * @param feature - raster feature guide
   */
  draw(feature: RasterFeatureSpec): void {
    const {
      layerGuide: { visible },
      bindGroup,
      rasterBindGroup,
      source,
    } = feature;
    if (!visible) return;
    // get current source data
    const { passEncoder } = this.context;
    const { vertexBuffer, indexBuffer, count, offset } = source;
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint32');
    passEncoder.setBindGroup(1, bindGroup);
    passEncoder.setBindGroup(2, rasterBindGroup);
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0);
  }
}

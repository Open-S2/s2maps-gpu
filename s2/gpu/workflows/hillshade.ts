import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import shaderCode from '../shaders/hillshade.wgsl';

import type { HillshadeData } from 'workers/worker.spec.js';
import type { TileGPU as Tile } from 'source/tile.spec.js';
import type { WebGPUContext } from '../context/index.js';
import type {
  HillshadeDefinition,
  HillshadeStyle,
  HillshadeWorkflowLayerGuideGPU,
  LayerDefinitionBase,
} from 'style/style.spec.js';
import type {
  HillshadeFeature as HillshadeFeatureSpec,
  HillshadeWorkflow as HillshadeWorkflowSpec,
  RasterSource,
} from './workflow.spec.js';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // position
    arrayStride: 4 * 2,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
];

/** Hillshade Feature is a standalone hillshade render storage unit that can be drawn to the GPU */
export class HilllshadeFeature implements HillshadeFeatureSpec {
  type = 'hillshade' as const;
  sourceName: string;
  fadeDuration: number;
  bindGroup: GPUBindGroup;
  hillshadeBindGroup: GPUBindGroup;
  /**
   * @param layerGuide - the layer guide for this feature
   * @param workflow - the hillshade workflow
   * @param tile - the tile this feature is drawn on
   * @param source - the hillshade source
   * @param featureCode - the encoded feature code
   * @param hillshadeFadeBuffer - the fade buffer
   * @param featureCodeBuffer - the feature code buffer
   * @param fadeStartTime - the start time of the fade for smooth transitions
   * @param parent - the parent tile if applicable
   */
  constructor(
    public layerGuide: HillshadeWorkflowLayerGuideGPU,
    public workflow: HillshadeWorkflowSpec,
    public tile: Tile,
    public source: RasterSource,
    public featureCode: number[],
    public hillshadeFadeBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public fadeStartTime = Date.now(),
    public parent?: Tile,
  ) {
    const { sourceName, fadeDuration } = layerGuide;
    this.sourceName = sourceName;
    this.fadeDuration = fadeDuration;
    this.bindGroup = this.#buildBindGroup();
    this.hillshadeBindGroup = this.#buildHillshadeBindGroup();
  }

  /** Draw the feature to the GPU */
  draw(): void {
    const { tile, workflow } = this;
    workflow.context.setStencilReference(tile.tmpMaskID);
    workflow.draw(this);
  }

  /** Destroy the feature */
  destroy(): void {
    const { hillshadeFadeBuffer, featureCodeBuffer } = this;
    hillshadeFadeBuffer.destroy();
    featureCodeBuffer.destroy();
  }

  /**
   * Duplicate this feature
   * @param tile - the tile this feature is drawn on
   * @param parent - the parent tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile): HilllshadeFeature {
    const {
      layerGuide,
      workflow,
      source,
      featureCode,
      hillshadeFadeBuffer,
      featureCodeBuffer,
      fadeStartTime,
    } = this;
    const { context } = workflow;
    const cE = context.device.createCommandEncoder();
    const newHillshadeFadeBuffer = context.duplicateGPUBuffer(hillshadeFadeBuffer, cE);
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE);
    context.device.queue.submit([cE.finish()]);
    return new HilllshadeFeature(
      layerGuide,
      workflow,
      tile,
      source,
      featureCode,
      newHillshadeFadeBuffer,
      newFeatureCodeBuffer,
      fadeStartTime,
      parent,
    );
  }

  /**
   * Build the bind group for the hillshade feature
   * @returns the GPU Bind Group for the hillshade feature
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = parent ?? tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Hillshade Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }

  /**
   * Build the bind group for the hillshade feature
   * @returns the GPU Bind Group for the hillshade feature
   */
  #buildHillshadeBindGroup(): GPUBindGroup {
    const { source, workflow, hillshadeFadeBuffer, layerGuide } = this;
    const { context, hillshadeBindGroupLayout } = workflow;
    const { unpackBuffer } = layerGuide;
    return context.device.createBindGroup({
      label: 'Hillshade BindGroup',
      layout: hillshadeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: hillshadeFadeBuffer } },
        { binding: 1, resource: context.defaultSampler },
        { binding: 2, resource: source.texture.createView() },
        { binding: 3, resource: { buffer: unpackBuffer } },
      ],
    });
  }
}

/** Hillshade Workflow */
export default class HillshadeWorkflow implements HillshadeWorkflowSpec {
  context: WebGPUContext;
  layerGuides = new Map<number, HillshadeWorkflowLayerGuideGPU>();
  pipeline!: GPURenderPipeline;
  hillshadeBindGroupLayout!: GPUBindGroupLayout;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /** Setup the workflow */
  async setup(): Promise<void> {
    // create pipelines
    this.pipeline = await this.#getPipeline();
  }

  /** Destroy and cleanup the workflow */
  destroy(): void {
    for (const { layerBuffer, layerCodeBuffer, unpackBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy();
      layerCodeBuffer.destroy();
      unpackBuffer.destroy();
    }
  }

  /**
   * Build the layer definition for this workflow
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: HillshadeStyle): HillshadeDefinition {
    const { context } = this;
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
      // paint
      shadowColor,
      accentColor,
      highlightColor,
      azimuth,
      altitude,
      opacity,
      // layout
      unpack,
    };
    // 2) Store layer workflow
    const layerCode: number[] = [];
    for (const paint of [opacity, shadowColor, accentColor, highlightColor, azimuth, altitude]) {
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
    const unpackData = [
      unpack.offset,
      unpack.zFactor,
      unpack.rMultiplier,
      unpack.gMultiplier,
      unpack.bMultiplier,
      unpack.aMultiplier,
    ];
    const unpackBuffer = context.buildGPUBuffer(
      'Unpack Buffer',
      new Float32Array(unpackData),
      GPUBufferUsage.UNIFORM,
    );
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      lch,
      fadeDuration: fadeDuration ?? 300,
      layerBuffer,
      layerCodeBuffer,
      unpackBuffer,
      visible,
      interactive: interactive ?? false,
      opaque: false,
    });

    return layerDefinition;
  }

  /**
   * Build the source hillshade data into hillshade features
   * @param hillshadeData - the input hillshade data
   * @param tile - the tile we are building the features for
   */
  buildSource(hillshadeData: HillshadeData, tile: Tile): void {
    const { context } = this;
    const { image, size } = hillshadeData;
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
      destroy: (): void => {
        texture.destroy();
      },
    };
    // build features
    this.#buildFeatures(source, hillshadeData, tile);
  }

  /**
   * Build hillshade features from input hillshade source
   * @param source - the source to build features from
   * @param hillshadeData - the input hillshade data
   * @param tile - the tile we are building the features for
   */
  #buildFeatures(source: RasterSource, hillshadeData: HillshadeData, tile: Tile): void {
    const { context } = this;
    const { featureGuides } = hillshadeData;
    // for each layer that maches the source, build the feature
    const features: HillshadeFeatureSpec[] = [];

    for (const { code, layerIndex } of featureGuides) {
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;

      const hillshadeFadeBuffer = context.buildGPUBuffer(
        'Hillshade Uniform Buffer',
        new Float32Array([1]),
        GPUBufferUsage.UNIFORM,
      );
      const featureCodeBuffer = context.buildGPUBuffer(
        'Feature Code Buffer',
        new Float32Array(code.length > 0 ? code : [0]),
        GPUBufferUsage.STORAGE,
      );
      const feature = new HilllshadeFeature(
        layerGuide,
        this,
        tile,
        source,
        code,
        hillshadeFadeBuffer,
        featureCodeBuffer,
      );
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the render pipeline for the hillshade workflow
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

    // prep hillshade uniforms
    this.hillshadeBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Hillshade BindGroupLayout',
      entries: [
        // uniform
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        // unpack
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    const module = device.createShaderModule({ code: shaderCode });
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        frameBindGroupLayout,
        featureBindGroupLayout,
        this.hillshadeBindGroupLayout,
      ],
    });
    const cullMode: GPUCullMode = projection === 'S2' ? 'back' : 'front';
    const stencilState: GPUStencilFaceState = {
      compare: 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace',
    };

    return await device.createRenderPipelineAsync({
      label: 'Hillshade Pipeline',
      layout,
      vertex: { module, entryPoint: 'vMain', buffers: SHADER_BUFFER_LAYOUT },
      fragment: { module, entryPoint: 'fMain', targets: [{ format, blend: defaultBlend }] },
      primitive: { topology: 'triangle-strip', cullMode, stripIndexFormat: 'uint32' },
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
   * Draw a screen quad with the hillshade feature's properties
   * @param feature - hillshade feature
   */
  draw(feature: HillshadeFeatureSpec): void {
    const {
      layerGuide: { visible },
      bindGroup,
      hillshadeBindGroup,
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
    passEncoder.setBindGroup(2, hillshadeBindGroup);
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0);
  }
}

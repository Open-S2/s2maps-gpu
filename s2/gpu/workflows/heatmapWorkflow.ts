import { buildColorRamp } from 'style/color';
import encodeLayerAttribute from 'style/encodeLayerAttribute';
import shaderCode from '../shaders/heatmap.wgsl';

import type { BBox } from 'gis-tools';
import type { HeatmapData } from 'workers/worker.spec';
import type { TileGPU as Tile } from 'source/tile.spec';
import type { WebGPUContext } from '../context';
import type {
  HeatmapDefinition,
  HeatmapStyle,
  HeatmapWorkflowLayerGuideGPU,
  LayerDefinitionBase,
} from 'style/style.spec';
import type {
  HeatmapFeature as HeatmapFeatureSpec,
  HeatmapSource,
  HeatmapWorkflow as HeatmapWorkflowSpec,
} from './workflow.spec';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // pos
    arrayStride: 4 * 2,
    stepMode: 'instance',
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
  {
    // weight
    arrayStride: 4,
    stepMode: 'instance',
    attributes: [{ shaderLocation: 1, offset: 0, format: 'float32' }],
  },
];

/** Heatmap Feature is a standalone heatmap render storage unit that can be drawn to the GPU */
export class HeatmapFeature implements HeatmapFeatureSpec {
  type = 'heatmap' as const;
  bindGroup: GPUBindGroup;
  heatmapBindGroup: GPUBindGroup;
  /**
   * @param workflow - the heatmap workflow
   * @param source - the heatmap source
   * @param layerGuide - layer guide for this feature
   * @param tile - the tile this feature is drawn on
   * @param count - the number of points
   * @param offset - the offset of the points
   * @param featureCode - the encoded feature code
   * @param heatmapBoundsBuffer - the bounds of the heatmap
   * @param featureCodeBuffer - the encoded feature code that tells the GPU how to compute it's properties
   * @param parent - the parent tile if applicable
   */
  constructor(
    public workflow: HeatmapWorkflow,
    public source: HeatmapSource,
    public layerGuide: HeatmapWorkflowLayerGuideGPU,
    public tile: Tile,
    public count: number,
    public offset: number,
    public featureCode: number[],
    public heatmapBoundsBuffer: GPUBuffer,
    public featureCodeBuffer: GPUBuffer,
    public parent?: Tile,
  ) {
    this.bindGroup = this.#buildBindGroup();
    this.heatmapBindGroup = this.#buildHeatmapBindGroup();
  }

  /** Draw the feature to the GPU */
  draw(): void {
    const { tile, workflow } = this;
    workflow.context.setStencilReference(tile.tmpMaskID);
    workflow.draw(this);
  }

  /** Destroy and cleanup the feature */
  destroy(): void {
    const { heatmapBoundsBuffer, featureCodeBuffer } = this;
    heatmapBoundsBuffer.destroy();
    featureCodeBuffer.destroy();
  }

  /**
   * Duplicate this feature
   * @param tile - the tile this feature is drawn on
   * @param parent - the parent tile if applicable
   * @param bounds - the bounds of the tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile, bounds?: BBox): HeatmapFeature {
    const {
      workflow,
      source,
      layerGuide,
      count,
      offset,
      featureCode,
      featureCodeBuffer,
      heatmapBoundsBuffer,
    } = this;
    const { context } = workflow;
    const cE = context.device.createCommandEncoder();
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE);
    const newHeatmapBoundsBuffer =
      bounds !== undefined
        ? context.buildGPUBuffer(
            'Heatmap Uniform Buffer',
            new Float32Array(bounds),
            GPUBufferUsage.UNIFORM,
          )
        : context.duplicateGPUBuffer(heatmapBoundsBuffer, cE);
    context.device.queue.submit([cE.finish()]);
    return new HeatmapFeature(
      workflow,
      source,
      layerGuide,
      tile,
      count,
      offset,
      featureCode,
      newHeatmapBoundsBuffer,
      newFeatureCodeBuffer,
      parent,
    );
  }

  /**
   * Build the bind group for the heatmap feature
   * @returns the GPU Bind Group for the heatmap feature
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = parent ?? tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Heatmap Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }

  /**
   * Build the bind group for the heatmap feature
   * @returns the GPU Bind Group for the heatmap feature
   */
  #buildHeatmapBindGroup(): GPUBindGroup {
    const { workflow, heatmapBoundsBuffer } = this;
    const { context, heatmapTextureBindGroupLayout } = workflow;
    return context.buildGroup('Heatmap BindGroup', heatmapTextureBindGroupLayout, [
      heatmapBoundsBuffer,
    ]);
  }
}

// TODO: The texture target should just have a single float channel?

/** Heatmap Workflow */
export default class HeatmapWorkflow implements HeatmapWorkflowSpec {
  context: WebGPUContext;
  layerGuides = new Map<number, HeatmapWorkflowLayerGuideGPU>();
  pipeline!: GPURenderPipeline;
  module!: GPUShaderModule;
  texturePipeline!: GPURenderPipeline;
  heatmapBindGroupLayout!: GPUBindGroupLayout;
  heatmapTextureBindGroupLayout!: GPUBindGroupLayout;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /** Setup the workflow */
  async setup(): Promise<void> {
    const { context } = this;
    const { device } = context;
    this.heatmapTextureBindGroupLayout = context.buildLayout(
      'Heatmap Texture BindGroupLayout',
      ['uniform'],
      GPUShaderStage.VERTEX,
    );
    this.heatmapBindGroupLayout = device.createBindGroupLayout({
      label: 'Heatmap BindGroupLayout',
      entries: [
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // render target
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        // color ramp
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    this.module = device.createShaderModule({ code: shaderCode });
    this.pipeline = await this.#getPipeline('screen');
    this.texturePipeline = await this.#getPipeline('texture');
  }

  /** Resize the workflow's associated render targets and textures */
  resize(): void {
    for (const layerGuide of this.layerGuides.values()) {
      if (layerGuide.renderTarget !== undefined) layerGuide.renderTarget.destroy();
      layerGuide.renderTarget = this.#buildLayerRenderTarget();
      // setup render pass descriptor
      layerGuide.renderPassDescriptor = this.#buildLayerPassDescriptor(layerGuide.renderTarget);
      // set up bind group
      layerGuide.textureBindGroup = this.#buildLayerBindGroup(
        layerGuide.renderTarget,
        layerGuide.colorRamp,
      );
    }
  }

  /** Destroy and cleanup the workflow */
  destroy(): void {
    for (const {
      colorRamp,
      layerBuffer,
      layerCodeBuffer,
      renderTarget,
    } of this.layerGuides.values()) {
      colorRamp.destroy();
      layerBuffer.destroy();
      layerCodeBuffer.destroy();
      renderTarget.destroy();
    }
  }

  /**
   * Build the layer definition for this workflow
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: HeatmapStyle): HeatmapDefinition {
    const { context } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    const { weight } = layer;
    let {
      // paint
      radius,
      opacity,
      intensity,
      // layout
      colorRamp,
      // properties
      geoFilter,
    } = layer;
    radius = radius ?? 1;
    opacity = opacity ?? 1;
    intensity = intensity ?? 1;
    colorRamp = colorRamp ?? 'sinebow';
    geoFilter = geoFilter ?? ['line', 'poly'];
    // 1) build definition
    const layerDefinition: HeatmapDefinition = {
      ...layerBase,
      type: 'heatmap' as const,
      // paint
      radius,
      opacity,
      intensity,
      // layout
      weight: weight ?? 1,
      // properties
      colorRamp,
      geoFilter,
    };
    // 2) build layer code
    const layerCode: number[] = [];
    for (const paint of [radius, opacity, intensity]) {
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
    const colorRampTexture = context.buildTexture(buildColorRamp(colorRamp, lch), 256, 5);
    const renderTarget = this.#buildLayerRenderTarget();
    // 4) Store layer guide
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      lch,
      colorRamp: colorRampTexture,
      renderTarget,
      renderPassDescriptor: this.#buildLayerPassDescriptor(renderTarget),
      textureBindGroup: this.#buildLayerBindGroup(renderTarget, colorRampTexture),
      visible,
      interactive: false,
      opaque: false,
    });

    return layerDefinition;
  }

  /**
   * Build a render target for the heatmap render group
   * @returns the render target
   */
  #buildLayerRenderTarget(): GPUTexture {
    const { device, presentation, format } = this.context;
    return device.createTexture({
      size: presentation,
      // sampleCount,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
  }

  /**
   * Build a layer pass descriptor for the heatmap render group
   * @param renderTarget - the render target
   * @returns the pass descriptor
   */
  #buildLayerPassDescriptor(renderTarget: GPUTexture): GPURenderPassDescriptor {
    return {
      colorAttachments: [
        {
          view: renderTarget.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };
  }

  /**
   * Build the color ramp layer bind group for the heatmap render group
   * @param renderTarget - the render target
   * @param colorRamp - the color ramp
   * @returns the bind group
   */
  #buildLayerBindGroup(renderTarget: GPUTexture, colorRamp: GPUTexture): GPUBindGroup {
    return this.context.device.createBindGroup({
      layout: this.heatmapBindGroupLayout,
      entries: [
        { binding: 1, resource: this.context.defaultSampler },
        { binding: 2, resource: renderTarget.createView() },
        { binding: 3, resource: colorRamp.createView() },
      ],
    });
  }

  /**
   * Build the source heatmap data into heatmap features
   * @param heatmapData - the input heatmap data
   * @param tile - the tile we are building the features for
   */
  buildSource(heatmapData: HeatmapData, tile: Tile): void {
    const { context } = this;
    const { vertexBuffer, weightBuffer, featureGuideBuffer } = heatmapData;
    // prep buffers
    const source: HeatmapSource = {
      type: 'heatmap' as const,
      vertexBuffer: context.buildGPUBuffer(
        'Heatmap Vertex Buffer',
        new Float32Array(vertexBuffer),
        GPUBufferUsage.VERTEX,
      ),
      weightBuffer: context.buildGPUBuffer(
        'Heatmap Weight Buffer',
        new Float32Array(weightBuffer),
        GPUBufferUsage.VERTEX,
      ),
      /** destroy the heatmap source */
      destroy: (): void => {
        const { vertexBuffer, weightBuffer } = source;
        vertexBuffer.destroy();
        weightBuffer.destroy();
      },
    };
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer));
  }

  /**
   * Build heatmap features from input heatmap source
   * @param source - the input heatmap source
   * @param tile - the tile we are building the features for
   * @param featureGuideArray - the feature guide to help build the features properties
   */
  #buildFeatures(source: HeatmapSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this;
    const features: HeatmapFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4);
      i += 4;
      // build featureCode
      const featureCode: number[] =
        encodingSize > 0 ? [...featureGuideArray.slice(i, i + encodingSize)] : [0];
      // update index
      i += encodingSize;

      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const heatmapBoundsBuffer = context.buildGPUBuffer(
        'Heatmap Uniform Buffer',
        new Float32Array([0, 0, 1, 1]),
        GPUBufferUsage.UNIFORM,
      );
      const featureCodeBuffer = context.buildGPUBuffer(
        'Feature Code Buffer',
        new Float32Array(featureCode),
        GPUBufferUsage.STORAGE,
      );
      const feature = new HeatmapFeature(
        this,
        source,
        layerGuide,
        tile,
        count,
        offset,
        featureCode,
        heatmapBoundsBuffer,
        featureCodeBuffer,
      );

      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the render pipeline for the heatmap's texture and screen workflows
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @param type - build for the "texture" or "screen"
   * @returns the render pipelines
   */
  async #getPipeline(type: 'texture' | 'screen'): Promise<GPURenderPipeline> {
    const { context, module } = this;
    const {
      device,
      format,
      defaultBlend,
      sampleCount,
      frameBindGroupLayout,
      featureBindGroupLayout,
    } = context;
    const isScreen = type === 'screen';

    const layout = isScreen
      ? device.createPipelineLayout({
          bindGroupLayouts: [
            frameBindGroupLayout,
            featureBindGroupLayout,
            this.heatmapBindGroupLayout,
          ],
        })
      : device.createPipelineLayout({
          bindGroupLayouts: [
            frameBindGroupLayout,
            featureBindGroupLayout,
            this.heatmapTextureBindGroupLayout,
          ],
        });

    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace',
    };

    return await device.createRenderPipelineAsync({
      label: `Heatmap ${type} Pipeline`,
      layout,
      vertex: {
        module,
        entryPoint: isScreen ? 'vMain' : 'vTexture',
        buffers: isScreen ? undefined : SHADER_BUFFER_LAYOUT,
      },
      fragment: {
        module,
        entryPoint: isScreen ? 'fMain' : 'fTexture',
        targets: [
          {
            format,
            blend: isScreen
              ? defaultBlend
              : {
                  color: { srcFactor: 'one', dstFactor: 'one' },
                  alpha: { srcFactor: 'one', dstFactor: 'one' },
                },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      multisample: { count: isScreen ? sampleCount : undefined },
      depthStencil: isScreen
        ? {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus-stencil8',
            stencilFront: stencilState,
            stencilBack: stencilState,
            stencilReadMask: 0xffffffff,
            stencilWriteMask: 0xffffffff,
          }
        : undefined,
    });
  }

  /**
   * Draw the features to an early render target that will be an input texture for the screen workflow
   * @param features - the heatmap features to draw
   * @returns the resulting combination of associated features
   */
  textureDraw(features: HeatmapFeatureSpec[]): HeatmapFeatureSpec[] | undefined {
    if (features.length === 0) return undefined;
    const { context } = this;
    const { device, frameBufferBindGroup } = context;

    const output: HeatmapFeatureSpec[] = [];
    // group by layerIndex
    const layerFeatures = new Map<number, HeatmapFeatureSpec[]>();
    for (const feature of features) {
      const { layerIndex } = feature.layerGuide;
      const layer = layerFeatures.get(layerIndex);
      if (layer === undefined) {
        layerFeatures.set(layerIndex, [feature]);
        output.push(feature);
      } else layer.push(feature);
    }

    // draw each layer to their own render target
    for (const [layerIndex, features] of layerFeatures.entries()) {
      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      // set encoders
      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass(layerGuide.renderPassDescriptor);

      passEncoder.setPipeline(this.texturePipeline);
      passEncoder.setBindGroup(0, frameBufferBindGroup);
      for (const { bindGroup, heatmapBindGroup, source, count, offset } of features) {
        const { vertexBuffer, weightBuffer } = source;
        // setup pipeline, bind groups, & buffers
        passEncoder.setBindGroup(1, bindGroup);
        passEncoder.setBindGroup(2, heatmapBindGroup);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setVertexBuffer(1, weightBuffer);
        // draw
        passEncoder.draw(6, count, 0, offset);
      }
      // finish
      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);
    }

    return output;
  }

  /**
   * Draw a screen quad with the heatmap feature's properties describing the heatmap's texture inputs
   * @param feature - heatmap feature
   */
  draw(feature: HeatmapFeatureSpec): void {
    const {
      layerGuide: { textureBindGroup, visible },
      bindGroup,
    } = feature;
    // get current source data
    const { passEncoder } = this.context;
    if (!visible) return;
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline);
    passEncoder.setBindGroup(1, bindGroup);
    passEncoder.setBindGroup(2, textureBindGroup);
    // draw a screen quad
    passEncoder.draw(6);
  }
}

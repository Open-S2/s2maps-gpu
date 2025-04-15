import { buildDashImage } from 'style/color';
import encodeLayerAttribute from 'style/encodeLayerAttribute';
import shaderCode from '../shaders/line.wgsl';

import type { LineData } from 'workers/worker.spec';
import type { TileGPU as Tile } from 'source/tile.spec';
import type { WebGPUContext } from '../context';
import type {
  LayerDefinitionBase,
  LineDefinition,
  LineStyle,
  LineWorkflowLayerGuideGPU,
} from 'style/style.spec';
import type {
  LineFeature as LineFeatureSpec,
  LineSource,
  LineWorkflow as LineWorkflowSpec,
} from './workflow.spec';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // prev
    arrayStride: 6 * 4, // 6 elements of 4 bytes
    stepMode: 'instance',
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
  {
    // curr
    arrayStride: 6 * 4, // 6 elements of 4 bytes
    stepMode: 'instance',
    attributes: [
      // offset: 2 elements of 4 bytes
      { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' },
    ],
  },
  {
    // next
    arrayStride: 6 * 4, // 6 elements of 4 bytes
    stepMode: 'instance',
    attributes: [
      // offset: 4 elements of 4 bytes
      { shaderLocation: 2, offset: 4 * 4, format: 'float32x2' },
    ],
  },
  {
    // lengthSoFar
    arrayStride: 4,
    stepMode: 'instance',
    attributes: [{ shaderLocation: 3, offset: 0, format: 'float32' }],
  },
];

/** Line Feature is a standalone line render storage unit that can be drawn to the GPU */
export class LineFeature implements LineFeatureSpec {
  type = 'line' as const;
  bindGroup: GPUBindGroup;
  lineBindGroup: GPUBindGroup;
  /**
   * @param workflow - the line workflow
   * @param layerGuide - the layer guide for this feature
   * @param source - the line source
   * @param tile - the tile this feature is drawn on
   * @param count - the number of points
   * @param offset - the offset of the points
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param dashTexture - the dash texture
   * @param featureCodeBuffer - the encoded feature code that tells the GPU how to compute it's properties
   * @param lineUniformBuffer - the line uniform buffer
   * @param cap - the line cap
   * @param parent - the parent tile if applicable
   */
  constructor(
    public workflow: LineWorkflowSpec,
    public layerGuide: LineWorkflowLayerGuideGPU,
    public source: LineSource,
    public tile: Tile,
    public count: number,
    public offset: number,
    public featureCode: number[],
    public dashTexture: GPUTexture,
    public featureCodeBuffer: GPUBuffer,
    public lineUniformBuffer: GPUBuffer,
    public cap: number,
    public parent?: Tile,
  ) {
    this.bindGroup = this.#buildBindGroup();
    this.lineBindGroup = this.#buildLineBindGroup();
  }

  /** Draw the feature to the GPU */
  draw(): void {
    const { tile, workflow } = this;
    workflow.context.setStencilReference(tile.tmpMaskID);
    workflow.draw(this);
  }

  /** Destroy the feature */
  destroy(): void {
    const { featureCodeBuffer, lineUniformBuffer } = this;
    featureCodeBuffer.destroy();
    lineUniformBuffer.destroy();
  }

  /**
   * Duplicate the line feature
   * @param tile - the tile this feature is drawn on
   * @param parent - the parent tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile): LineFeature {
    const {
      workflow,
      layerGuide,
      source,
      count,
      offset,
      featureCode,
      dashTexture,
      featureCodeBuffer,
      lineUniformBuffer,
      cap,
    } = this;
    const { context } = workflow;
    const cE = context.device.createCommandEncoder();
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE);
    const newLineUniformBuffer = context.duplicateGPUBuffer(lineUniformBuffer, cE);
    context.device.queue.submit([cE.finish()]);
    return new LineFeature(
      workflow,
      layerGuide,
      source,
      tile,
      count,
      offset,
      featureCode,
      dashTexture,
      newFeatureCodeBuffer,
      newLineUniformBuffer,
      cap,
      parent,
    );
  }

  /**
   * Build the bind group for the line feature
   * @returns the GPU Bind Group for the line feature
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = parent ?? tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Line Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }

  /**
   * Build line specific properties into a bind group
   * @returns the GPU Bind Group for the line feature
   */
  #buildLineBindGroup(): GPUBindGroup {
    const { workflow, lineUniformBuffer, layerGuide } = this;
    const { context, lineBindGroupLayout } = workflow;
    const { dashTexture } = layerGuide;
    return context.device.createBindGroup({
      label: 'Line BindGroup',
      layout: lineBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: lineUniformBuffer } },
        { binding: 1, resource: context.defaultSampler },
        { binding: 2, resource: dashTexture.createView() },
      ],
    });
  }
}

/** Line Workflow */
export default class LineWorkflow implements LineWorkflowSpec {
  context: WebGPUContext;
  layerGuides = new Map<number, LineWorkflowLayerGuideGPU>();
  pipeline!: GPURenderPipeline;
  lineBindGroupLayout!: GPUBindGroupLayout;
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
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: LineStyle): LineDefinition {
    const { context } = this;
    const { devicePixelRatio, nullTexture } = context;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    const {
      // layout
      cap,
      join,
    } = layer;
    let {
      interactive,
      cursor,
      geoFilter,
      // paint
      color,
      opacity,
      width,
      gapwidth,
      // layout
      dasharray,
    } = layer;
    color = color ?? 'rgba(0, 0, 0, 0)';
    opacity = opacity ?? 1;
    width = width ?? 1;
    gapwidth = gapwidth ?? 0;
    geoFilter = geoFilter ?? [];
    // 1) build definition
    const dashed = Array.isArray(dasharray) && dasharray.length > 0;
    interactive = interactive ?? false;
    cursor = cursor ?? 'default';
    dasharray = dasharray ?? [];
    const layerDefinition: LineDefinition = {
      ...layerBase,
      type: 'line' as const,
      color,
      opacity,
      width,
      gapwidth,
      cap: cap ?? 'butt',
      join: join ?? 'miter',
      dasharray,
      geoFilter,
      dashed,
      interactive,
      cursor,
    };
    // 2) build the layerCode
    const layerCode: number[] = [];
    for (const paint of [color, opacity, width, gapwidth]) {
      layerCode.push(...encodeLayerAttribute(paint, lch));
    }
    // 3) Setup layer buffers in GPU
    const { length, dashCount, image } = buildDashImage(dasharray, devicePixelRatio);
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
    // if dashed, build a texture
    const dashTexture = length > 0 ? context.buildTexture(image, length, 5) : nullTexture;
    this.layerGuides.set(layerIndex, {
      sourceName: source,
      layerIndex,
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      lch,
      dashed,
      dashLength: length,
      dashCount,
      dashTexture,
      interactive,
      cursor,
      visible,
      opaque: false,
    });

    return layerDefinition;
  }

  /**
   * Build the source line data into line features
   * @param lineData - the input line data
   * @param tile - the tile we are building the features for
   */
  buildSource(lineData: LineData, tile: Tile): void {
    const { context } = this;
    const { vertexBuffer, lengthSoFarBuffer, featureGuideBuffer } = lineData;
    // prep buffers
    const source: LineSource = {
      type: 'line' as const,
      vertexBuffer: context.buildGPUBuffer(
        'Line Vertex Buffer',
        new Float32Array(vertexBuffer),
        GPUBufferUsage.VERTEX,
      ),
      lengthSoFarBuffer: context.buildGPUBuffer(
        'Line LengthSoFar Buffer',
        new Float32Array(lengthSoFarBuffer),
        GPUBufferUsage.VERTEX,
      ),
      /** destroy the line source */
      destroy: (): void => {
        const { vertexBuffer, lengthSoFarBuffer } = source;
        vertexBuffer.destroy();
        lengthSoFarBuffer.destroy();
      },
    };
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer));
  }

  /**
   * Build line features from input line source
   * @param source - the input line source
   * @param tile - the tile we are building the features for
   * @param featureGuideArray - the feature guide to help build the features properties
   */
  #buildFeatures(source: LineSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this;
    const features: LineFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [cap, layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 5);
      i += 5;
      // build featureCode
      let featureCode: number[] = [0];
      featureCode = encodingSize > 0 ? [...featureGuideArray.slice(i, i + encodingSize)] : [0];
      // update index
      i += encodingSize;

      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const { dashed, dashCount, dashTexture } = layerGuide;

      const lineUniformBuffer = context.buildGPUBuffer(
        'Line Uniform Buffer',
        new Float32Array([cap, ~~dashed, dashCount]),
        GPUBufferUsage.UNIFORM,
      );
      const featureCodeBuffer = context.buildGPUBuffer(
        'Feature Code Buffer',
        new Float32Array(featureCode),
        GPUBufferUsage.STORAGE,
      );
      const feature = new LineFeature(
        this,
        layerGuide,
        source,
        tile,
        count,
        offset,
        featureCode,
        dashTexture,
        featureCodeBuffer,
        lineUniformBuffer,
        cap,
      );
      features.push(feature);
    }

    tile.addFeatures(features);
  }

  /**
   * Build the render pipeline for the line workflow
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
      sampleCount,
      frameBindGroupLayout,
      featureBindGroupLayout,
    } = context;

    // prep line uniforms
    this.lineBindGroupLayout = context.device.createBindGroupLayout({
      label: 'Line BindGroupLayout',
      entries: [
        // uniforms
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    const module = device.createShaderModule({ code: shaderCode });
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.lineBindGroupLayout],
    });
    const stencilState: GPUStencilFaceState = {
      compare: 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace',
    };

    return await device.createRenderPipelineAsync({
      label: 'Line Pipeline',
      layout,
      vertex: { module, entryPoint: 'vMain', buffers: SHADER_BUFFER_LAYOUT },
      fragment: { module, entryPoint: 'fMain', targets: [{ format, blend: defaultBlend }] },
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
   * Draw a line feature to the GPU
   * @param feature - line feature guide
   */
  draw(feature: LineFeatureSpec): void {
    const {
      layerGuide: { visible },
      bindGroup,
      lineBindGroup,
      source,
      count,
      offset,
    } = feature;
    if (!visible) return;
    // get current source data
    const { passEncoder } = this.context;
    const { vertexBuffer, lengthSoFarBuffer } = source;

    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline);
    passEncoder.setBindGroup(1, bindGroup);
    passEncoder.setBindGroup(2, lineBindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer); // prev
    passEncoder.setVertexBuffer(1, vertexBuffer); // curr
    passEncoder.setVertexBuffer(2, vertexBuffer); // next
    passEncoder.setVertexBuffer(3, lengthSoFarBuffer);
    // draw
    passEncoder.draw(9, count, 0, offset);
  }
}

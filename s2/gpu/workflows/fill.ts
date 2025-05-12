import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import shaderCode from '../shaders/fill.wgsl';

import type { FillData } from 'workers/worker.spec.js';
import type { TileGPU as Tile } from 'source/tile.spec.js';
import type { WebGPUContext } from '../context/index.js';
import type {
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuideGPU,
  LayerDefinitionBase,
} from 'style/style.spec.js';
import type {
  FillFeature as FillFeatureSpec,
  FillSource,
  FillWorkflow as FillWorkflowSpec,
  MaskSource,
  TileMaskSource,
} from './workflow.spec.js';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // position
    arrayStride: 4 * 2,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
  {
    // code
    arrayStride: 4,
    attributes: [{ shaderLocation: 1, offset: 0, format: 'uint32' }],
  },
];

/** Fill Feature is a standalone fill render storage unit that can be drawn to the GPU */
export class FillFeature implements FillFeatureSpec {
  type = 'fill' as const;
  bindGroup: GPUBindGroup;
  fillPatternBindGroup: GPUBindGroup;
  fillInteractiveBindGroup?: GPUBindGroup | undefined;
  /**
   * @param workflow - the fill workflow
   * @param layerGuide - the layer guide for this feature
   * @param maskLayer - whether or not the layer is a mask type or not
   * @param source - the fill or mask source
   * @param count - the number of points
   * @param offset - the offset of the points
   * @param tile - the tile that the feature is drawn on
   * @param featureCodeBuffer - the encoded feature code that tells the GPU how to compute it's properties
   * @param fillTexturePositions - the fill texture positions
   * @param fillInteractiveBuffer - if interactive, this buffer helps the GPU compute interactivity
   * @param featureCode - the encoded feature code that tells the GPU how to compute it's properties
   * @param parent - the parent tile if applicable
   */
  constructor(
    public workflow: FillWorkflowSpec,
    public layerGuide: FillWorkflowLayerGuideGPU,
    public maskLayer: boolean,
    public source: FillSource | MaskSource,
    public count: number,
    public offset: number,
    public tile: Tile,
    public featureCodeBuffer: GPUBuffer,
    public fillTexturePositions: GPUBuffer,
    public fillInteractiveBuffer?: GPUBuffer,
    public featureCode: number[] = [0],
    public parent?: Tile,
  ) {
    this.fillPatternBindGroup = tile.context.createPatternBindGroup(fillTexturePositions);
    this.bindGroup = this.#buildBindGroup();
    if (fillInteractiveBuffer !== undefined)
      this.fillInteractiveBindGroup = this.#buildInteractiveBindGroup();
  }

  /** Draw the feature */
  draw(): void {
    const { maskLayer, tile, parent, workflow } = this;
    const { mask } = parent ?? tile;
    workflow.context.setStencilReference(tile.tmpMaskID);
    if (maskLayer) workflow.drawMask(mask, this);
    else workflow.draw(this);
  }

  /** Compute the feature's interactivity with the mouse */
  compute(): void {
    this.workflow.computeInteractive(this);
  }

  /** Update the shared texture's bind groups */
  updateSharedTexture(): void {
    const { context } = this.workflow;
    this.fillPatternBindGroup = context.createPatternBindGroup(this.fillTexturePositions);
  }

  /** Destroy and cleanup the feature */
  destroy(): void {
    this.featureCodeBuffer.destroy();
    this.fillTexturePositions.destroy();
    this.fillInteractiveBuffer?.destroy();
  }

  /**
   * Duplicate this point
   * @param tile - the tile that is being duplicated
   * @param parent - the parent tile if applicable
   * @returns the duplicated feature
   */
  duplicate(tile: Tile, parent?: Tile): FillFeature {
    const {
      workflow,
      layerGuide,
      maskLayer,
      source,
      count,
      offset,
      featureCodeBuffer,
      fillInteractiveBuffer,
      featureCode,
      fillTexturePositions,
    } = this;
    const { context } = this.workflow;
    const cE = context.device.createCommandEncoder();
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE);
    const newFillTexturePositions = context.duplicateGPUBuffer(fillTexturePositions, cE);
    const newFillInteractiveBuffer =
      fillInteractiveBuffer !== undefined
        ? context.duplicateGPUBuffer(fillInteractiveBuffer, cE)
        : undefined;
    context.device.queue.submit([cE.finish()]);
    return new FillFeature(
      workflow,
      layerGuide,
      maskLayer,
      source,
      count,
      offset,
      tile,
      newFeatureCodeBuffer,
      newFillTexturePositions,
      newFillInteractiveBuffer,
      featureCode,
      parent,
    );
  }

  /**
   * Build the bind group for the fill feature
   * @returns the GPU Bind Group for the fill feature
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = parent ?? tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Fill Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }

  /**
   * Build an interactive bind group for this feature
   * @returns the GPU Bind Group
   */
  #buildInteractiveBindGroup(): GPUBindGroup {
    const { workflow, tile, source, fillInteractiveBuffer } = this;
    if (fillInteractiveBuffer === undefined)
      throw new Error('Fill Interactive Buffer is undefined');
    if (!('idBuffer' in source)) throw new Error('Source does not have an idBuffer');
    return tile.context.buildGroup(
      'Fill Interactive BindGroup',
      workflow.fillInteractiveBindGroupLayout,
      [fillInteractiveBuffer, source.vertexBuffer, source.indexBuffer, source.idBuffer],
    );
  }
}

/** Fill Workflow */
export default class FillWorkflow implements FillWorkflowSpec {
  layerGuides = new Map<number, FillWorkflowLayerGuideGPU>();
  interactivePipeline!: GPUComputePipeline;
  maskPipeline!: GPURenderPipeline;
  fillPipeline!: GPURenderPipeline;
  maskFillPipeline!: GPURenderPipeline;
  invertPipeline!: GPURenderPipeline;
  #shaderModule!: GPUShaderModule;
  #pipelineLayout!: GPUPipelineLayout;
  fillInteractiveBindGroupLayout!: GPUBindGroupLayout;
  /** @param context - The WebGPU context */
  constructor(public context: WebGPUContext) {}

  /** Setup the workflow */
  async setup(): Promise<void> {
    const { device, frameBindGroupLayout, featureBindGroupLayout, maskPatternBindGroupLayout } =
      this.context;
    this.#shaderModule = device.createShaderModule({
      label: 'Fill Shader Module',
      code: shaderCode,
    });
    this.#pipelineLayout = device.createPipelineLayout({
      label: 'Fill Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, maskPatternBindGroupLayout],
    });
    this.maskPipeline = await this.#getPipeline('mask');
    this.fillPipeline = await this.#getPipeline('fill');
    this.maskFillPipeline = await this.#getPipeline('mask-fill');
    this.invertPipeline = await this.#getPipeline('invert');
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
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: FillStyle): FillDefinition {
    const { context } = this;
    const { source, layerIndex, lch, visible } = layerBase;
    // PRE) get layer base
    const { pattern } = layer;
    let { color, opacity, patternFamily, patternMovement, invert, opaque, interactive, cursor } =
      layer;
    invert = invert ?? false;
    opaque = opaque ?? false;
    interactive = interactive ?? false;
    cursor = cursor ?? 'default';
    // 1) build definition
    color = color ?? 'rgb(0, 0, 0)';
    opacity = opacity ?? 1;
    patternFamily = patternFamily ?? '__images';
    patternMovement = patternMovement ?? false;
    const layerDefinition: FillDefinition = {
      ...layerBase,
      type: 'fill' as const,
      // paint
      color,
      opacity,
      // layout
      pattern,
      patternFamily,
      patternMovement,
      // propreties
      invert,
      interactive,
      opaque,
      cursor,
    };
    // 2) build the layerCode
    const layerCode: number[] = [];
    for (const paint of [color, opacity]) {
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
      invert,
      opaque,
      pattern: pattern !== undefined,
      interactive,
      visible,
    });

    return layerDefinition;
  }

  /**
   * given a set of layerIndexes that use Masks and the tile of interest
   * @param definition - layer definition that uses masks
   * @param tile - the tile that needs a mask
   */
  buildMaskFeature(definition: FillDefinition, tile: Tile): void {
    const { context } = this;
    const { zoom, mask } = tile;
    const { layerIndex, minzoom, maxzoom } = definition;
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return;

    const layerGuide = this.layerGuides.get(layerIndex);
    if (layerGuide === undefined) return;
    const featureCodeBuffer = context.buildGPUBuffer(
      'Feature Code Buffer',
      new Float32Array([0]),
      GPUBufferUsage.STORAGE,
    );
    const fillTexturePositions = context.buildGPUBuffer(
      'Fill Texture Positions',
      new Float32Array([0, 0, 0, 0, 0]),
      GPUBufferUsage.UNIFORM,
    );
    const feature = new FillFeature(
      this,
      layerGuide,
      true,
      mask,
      mask.count,
      mask.offset,
      tile,
      featureCodeBuffer,
      fillTexturePositions,
    );
    tile.addFeatures([feature]);
  }

  /**
   * Build the source fill data into fill features
   * @param fillData - the input fill data
   * @param tile - the tile we are building the features for
   */
  buildSource(fillData: FillData, tile: Tile): void {
    const { context } = this;
    const { vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer, featureGuideBuffer } = fillData;
    // prep buffers
    const source: FillSource = {
      type: 'fill' as const,
      vertexBuffer: context.buildGPUBuffer(
        'Fill Vertex Buffer',
        new Float32Array(vertexBuffer),
        GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      ),
      indexBuffer: context.buildGPUBuffer(
        'Fill Index Buffer',
        new Uint32Array(indexBuffer),
        GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE,
      ),
      idBuffer: context.buildGPUBuffer(
        'Fill ID Buffer',
        new Uint32Array(idBuffer),
        GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
      ),
      codeTypeBuffer: context.buildGPUBuffer(
        'Fill Code Type Buffer',
        new Uint32Array(codeTypeBuffer),
        GPUBufferUsage.VERTEX,
      ),
      /** destroy the fill source */
      destroy: (): void => {
        const { vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer } = source;
        vertexBuffer.destroy();
        indexBuffer.destroy();
        idBuffer.destroy();
        codeTypeBuffer.destroy();
      },
    };
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer));
  }

  /**
   * Build fill features from input fill source
   * @param source - the input fill source
   * @param tile - the tile we are building the features for
   * @param featureGuideArray - the feature guide to help build the features properties
   */
  #buildFeatures(source: FillSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this;
    const features: FillFeatureSpec[] = [];

    const lgl = featureGuideArray.length;
    let i = 0;
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4);
      i += 4;
      // build featureCode
      let featureCode: number[] = [0];
      if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)];
      // update index
      i += encodingSize;
      // get the pattern
      const [texX, texY, texW, texH, patternMovement] = featureGuideArray.slice(i, i + 5);
      i += 5;

      const layerGuide = this.layerGuides.get(layerIndex);
      if (layerGuide === undefined) continue;
      const featureCodeBuffer = context.buildGPUBuffer(
        'Feature Code Buffer',
        new Float32Array(featureCode),
        GPUBufferUsage.STORAGE,
      );
      const fillTexturePositions = context.buildGPUBuffer(
        'Fill Texture Positions',
        new Float32Array([texX, texY, texW, texH, patternMovement]),
        GPUBufferUsage.UNIFORM,
      );
      const fillInteractiveBuffer = context.buildGPUBuffer(
        'Fill Interactive Buffer',
        new Uint32Array([offset / 3, count / 3]),
        GPUBufferUsage.UNIFORM,
      );
      features.push(
        new FillFeature(
          this,
          layerGuide,
          false,
          source,
          count,
          offset,
          tile,
          featureCodeBuffer,
          fillTexturePositions,
          fillInteractiveBuffer,
          featureCode,
        ),
      );
    }

    tile.addFeatures(features);
  }

  /**
   * Get the associating pipeline with the input type
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @param type - pipeline type (fill, mask, invert, mask-fill)
   * @returns the pipeline
   */
  async #getPipeline(type: 'fill' | 'mask' | 'invert' | 'mask-fill'): Promise<GPURenderPipeline> {
    const { context } = this;
    const { device, format, defaultBlend, sampleCount, projection } = context;
    const invert = type === 'invert';
    const mask = type === 'mask';
    const maskFill = type === 'mask-fill';

    const stencilState: GPUStencilFaceState = {
      compare: mask ? 'always' : 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace',
    };

    return await device.createRenderPipelineAsync({
      label: `Fill ${type} Pipeline`,
      layout: this.#pipelineLayout,
      vertex: {
        module: this.#shaderModule,
        entryPoint: 'vMain',
        buffers: SHADER_BUFFER_LAYOUT,
      },
      fragment: {
        module: this.#shaderModule,
        entryPoint: 'fMain',
        targets: [
          {
            format,
            writeMask: mask || invert ? 0 : GPUColorWrite.ALL,
            blend: defaultBlend,
          },
        ],
      },
      primitive: {
        topology: mask || maskFill ? 'triangle-strip' : 'triangle-list',
        cullMode: projection === 'S2' ? 'back' : 'front',
        stripIndexFormat: mask || maskFill ? 'uint32' : undefined,
      },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: !mask,
        depthCompare: mask ? 'always' : 'less',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0xffffffff,
        stencilWriteMask: 0xffffffff,
      },
    });
  }

  /**
   * Build a compute pipeline to check for interactive fill data that interects with the mouse
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the GPU compute pipeline
   */
  async #getComputePipeline(): Promise<GPUComputePipeline> {
    const { context } = this;
    const { device, frameBindGroupLayout, featureBindGroupLayout, interactiveBindGroupLayout } =
      context;

    this.fillInteractiveBindGroupLayout = device.createBindGroupLayout({
      label: 'Fill Interactive BindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // interactive offset & count
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // positions
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // indexes
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // ids
      ],
    });

    const layout = device.createPipelineLayout({
      label: 'Fill Interactive Pipeline Layout',
      bindGroupLayouts: [
        frameBindGroupLayout,
        featureBindGroupLayout,
        this.fillInteractiveBindGroupLayout,
        interactiveBindGroupLayout,
      ],
    });

    return await device.createComputePipelineAsync({
      label: 'Fill Interactive Pipeline',
      layout,
      compute: { module: this.#shaderModule, entryPoint: 'interactive' },
    });
  }

  /**
   * Draw a fill feature to the GPU
   * @param feature - fill feature guide
   */
  draw(feature: FillFeatureSpec): void {
    const { context, invertPipeline, fillPipeline } = this;
    // get current source data
    const { passEncoder } = context;
    const {
      tile,
      parent,
      bindGroup,
      fillPatternBindGroup,
      source,
      count,
      offset,
      layerGuide: { visible, invert },
    } = feature;
    const { vertexBuffer, indexBuffer, codeTypeBuffer } = source;
    const pipeline = invert ? invertPipeline : fillPipeline;
    const { mask } = parent ?? tile;
    // if the layer is not visible, move on
    if (!visible) return;

    // setup pipeline, bind groups, & buffers
    context.setRenderPipeline(pipeline);
    passEncoder.setBindGroup(1, bindGroup);
    passEncoder.setBindGroup(2, fillPatternBindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint32');
    passEncoder.setVertexBuffer(1, codeTypeBuffer);
    // draw
    passEncoder.drawIndexed(count, 1, offset);

    if (invert) this.drawMask(mask, feature);
  }

  /**
   * Draw a mask to the GPU
   * @param mask - mask source
   * @param feature - fill feature guide
   */
  drawMask(mask: TileMaskSource, feature?: FillFeatureSpec): void {
    const {
      vertexBuffer,
      indexBuffer,
      codeTypeBuffer,
      bindGroup,
      fillPatternBindGroup,
      count,
      offset,
    } = mask;
    const { context, maskPipeline, maskFillPipeline } = this;
    // if the layer is not visible, move on
    if (feature?.layerGuide?.visible === false) return;
    // get current source data
    const { passEncoder } = context;
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(feature === undefined ? maskPipeline : maskFillPipeline);
    passEncoder.setBindGroup(1, feature?.bindGroup ?? bindGroup);
    passEncoder.setBindGroup(2, feature?.fillPatternBindGroup ?? fillPatternBindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint32');
    passEncoder.setVertexBuffer(1, codeTypeBuffer);
    // draw
    passEncoder.drawIndexed(count, 1, offset);
  }

  /**
   * Compute the interactive fill features in current view
   * @param feature - fill feature guide
   */
  computeInteractive(feature: FillFeatureSpec): void {
    const {
      layerGuide: { visible },
      bindGroup,
      fillInteractiveBindGroup,
      count,
    } = feature;
    if (!visible || fillInteractiveBindGroup === undefined) return;
    const { computePass, interactiveBindGroup } = this.context;
    this.context.setComputePipeline(this.interactivePipeline);
    // set bind group & draw
    computePass.setBindGroup(1, bindGroup);
    computePass.setBindGroup(2, fillInteractiveBindGroup);
    computePass.setBindGroup(3, interactiveBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(count / 3 / 64));
  }
}

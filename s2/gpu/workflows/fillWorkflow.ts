import encodeLayerAttribute from 'style/encodeLayerAttribute';
import shaderCode from '../shaders/fill.wgsl';

import type { FillData } from 'workers/worker.spec';
import type { TileGPU as Tile } from 'source/tile.spec';
import type { WebGPUContext } from '../context';
import type {
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuideGPU,
  LayerDefinitionBase,
} from 'style/style.spec';
import type {
  FillFeature as FillFeatureSpec,
  FillSource,
  FillWorkflow as FillWorkflowSpec,
  MaskSource,
  TileMaskSource,
} from './workflow.spec';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // position
    arrayStride: 4 * 2,
    attributes: [
      {
        shaderLocation: 0,
        offset: 0,
        format: 'float32x2',
      },
    ],
  },
  {
    // code
    arrayStride: 4,
    attributes: [
      {
        shaderLocation: 1,
        offset: 0,
        format: 'uint32',
      },
    ],
  },
];

/**
 *
 */
export class FillFeature implements FillFeatureSpec {
  type = 'fill' as const;
  bindGroup: GPUBindGroup;
  fillPatternBindGroup: GPUBindGroup;
  fillInteractiveBindGroup?: GPUBindGroup | undefined;
  /**
   * @param workflow
   * @param layerGuide
   * @param maskLayer
   * @param source
   * @param count
   * @param offset
   * @param tile
   * @param featureCodeBuffer
   * @param fillTexturePositions
   * @param fillInteractiveBuffer
   * @param featureCode
   * @param parent
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

  /**
   *
   */
  draw(): void {
    const { maskLayer, tile, parent, workflow } = this;
    const { mask } = parent ?? tile;
    workflow.context.setStencilReference(tile.tmpMaskID);
    if (maskLayer) workflow.drawMask(mask, this);
    else workflow.draw(this);
  }

  /**
   *
   */
  compute(): void {
    this.workflow.computeInteractive(this);
  }

  /**
   *
   */
  updateSharedTexture(): void {
    const { context } = this.workflow;
    this.fillPatternBindGroup = context.createPatternBindGroup(this.fillTexturePositions);
  }

  /**
   *
   */
  destroy(): void {
    this.featureCodeBuffer.destroy();
    this.fillTexturePositions.destroy();
    this.fillInteractiveBuffer?.destroy();
  }

  /**
   * @param tile
   * @param parent
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
   *
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
   *
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

/**
 *
 */
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
  /**
   * @param context
   */
  constructor(public context: WebGPUContext) {}

  /**
   *
   */
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

  /**
   *
   */
  destroy(): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy();
      layerCodeBuffer.destroy();
    }
  }

  // workflows helps design the appropriate layer parameters
  /**
   * @param layerBase
   * @param layer
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
   * @param definition
   * @param tile
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
   * @param fillData
   * @param tile
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
      /**
       *
       */
      destroy: () => {
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
   * @param source
   * @param tile
   * @param featureGuideArray
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

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  /**
   * @param type
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
   *
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
   * @param featureGuide
   */
  draw(featureGuide: FillFeatureSpec): void {
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
    } = featureGuide;
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

    if (invert) this.drawMask(mask, featureGuide);
  }

  /**
   * @param root0
   * @param root0.vertexBuffer
   * @param root0.indexBuffer
   * @param root0.codeTypeBuffer
   * @param root0.bindGroup
   * @param root0.fillPatternBindGroup
   * @param root0.count
   * @param root0.offset
   * @param featureGuide
   */
  drawMask(
    {
      vertexBuffer,
      indexBuffer,
      codeTypeBuffer,
      bindGroup,
      fillPatternBindGroup,
      count,
      offset,
    }: TileMaskSource,
    featureGuide?: FillFeatureSpec,
  ): void {
    const { context, maskPipeline, maskFillPipeline } = this;
    // if the layer is not visible, move on
    if (featureGuide?.layerGuide?.visible === false) return;
    // get current source data
    const { passEncoder } = context;
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(featureGuide === undefined ? maskPipeline : maskFillPipeline);
    passEncoder.setBindGroup(1, featureGuide?.bindGroup ?? bindGroup);
    passEncoder.setBindGroup(2, featureGuide?.fillPatternBindGroup ?? fillPatternBindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint32');
    passEncoder.setVertexBuffer(1, codeTypeBuffer);
    // draw
    passEncoder.drawIndexed(count, 1, offset);
  }

  /**
   * @param root0
   * @param root0.layerGuide
   * @param root0.layerGuide.visible
   * @param root0.bindGroup
   * @param root0.fillInteractiveBindGroup
   * @param root0.count
   */
  computeInteractive({
    layerGuide: { visible },
    bindGroup,
    fillInteractiveBindGroup,
    count,
  }: FillFeatureSpec): void {
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

import encodeLayerAttribute from 'style/encodeLayerAttribute.js';
import shaderCode from '../shaders/shade.wgsl';

import type { TileGPU as Tile } from 'source/tile.spec.js';
import type { WebGPUContext } from '../context/index.js';
import type {
  LayerDefinitionBase,
  ShadeDefinition,
  ShadeStyle,
  ShadeWorkflowLayerGuideGPU,
} from 'style/style.spec.js';
import type {
  MaskSource,
  ShadeFeature as ShadeFeatureSpec,
  ShadeWorkflow as ShadeWorkflowSpec,
} from './workflow.spec.js';

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  {
    // position
    arrayStride: 4 * 2,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
  },
];

/** Shade Feature is a standalone shade render storage unit that can be drawn to the GPU */
export class ShadeFeature implements ShadeFeatureSpec {
  type = 'shade' as const;
  maskLayer = true;
  source: MaskSource;
  count: number;
  offset: number;
  featureCode = [0];
  bindGroup: GPUBindGroup;
  /**
   * @param workflow - the shade workflow
   * @param tile - the tile that the feature is drawn on
   * @param layerIndex - the layer's index
   * @param layerGuide - the layer guide for this feature
   * @param featureCodeBuffer - the encoded feature code that tells the GPU how to compute it's properties
   */
  constructor(
    public workflow: ShadeWorkflowSpec,
    public tile: Tile,
    public layerIndex: number,
    public layerGuide: ShadeWorkflowLayerGuideGPU,
    public featureCodeBuffer: GPUBuffer,
  ) {
    const { mask } = tile;
    this.source = mask;
    this.count = mask.count;
    this.offset = mask.offset;
    this.bindGroup = this.#buildBindGroup();
  }

  /** Draw the feature to the GPU */
  draw(): void {
    const { workflow } = this;
    workflow.context.setStencilReference(this.tile.tmpMaskID);
    workflow.draw(this);
  }

  /** Delete and cleanup the feature */
  destroy(): void {
    this.featureCodeBuffer.destroy();
  }

  /**
   * Build the bind group for the feature
   * @returns the feature's GPU bind group
   */
  #buildBindGroup(): GPUBindGroup {
    const { workflow, tile, layerGuide, featureCodeBuffer } = this;
    const { context } = workflow;
    const { mask } = tile;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    return context.buildGroup('Shade Feature BindGroup', context.featureBindGroupLayout, [
      mask.uniformBuffer,
      mask.positionBuffer,
      layerBuffer,
      layerCodeBuffer,
      featureCodeBuffer,
    ]);
  }
}

/** Shade Workflow */
export default class ShadeWorkflow implements ShadeWorkflowSpec {
  context: WebGPUContext;
  layerGuide?: ShadeWorkflowLayerGuideGPU;
  pipeline!: GPURenderPipeline;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /** Setup the shade workflow */
  async setup(): Promise<void> {
    this.pipeline = await this.#getPipeline();
  }

  /** Cleanup the shade workflow */
  destroy(): void {
    const { layerGuide } = this;
    if (layerGuide === undefined) return;
    const { layerBuffer, layerCodeBuffer } = layerGuide;
    layerBuffer.destroy();
    layerCodeBuffer.destroy();
  }

  /**
   * Build the layer definition for this workflow
   * @param layerBase - the common layer attributes
   * @param layer - the user defined layer attributes
   * @returns a built layer definition that's ready to describe how to render a feature
   */
  buildLayerDefinition(layerBase: LayerDefinitionBase, layer: ShadeStyle): ShadeDefinition {
    const { context } = this;
    const { lch, layerIndex } = layerBase;
    let { color } = layer;
    color = color ?? 'rgb(0.6, 0.6, 0.6)';
    // 2) build the layerCode
    const layerCode: number[] = [];
    layerCode.push(...encodeLayerAttribute(color, lch));
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
    // 4) store the layerDefinition and return
    const definition: ShadeDefinition = {
      ...layerBase,
      type: 'shade' as const,
      // layout
      color,
    };
    // 5) store the layerGuide
    this.layerGuide = {
      ...definition,
      sourceName: 'mask',
      layerCode,
      layerBuffer,
      layerCodeBuffer,
      interactive: false,
      opaque: false,
    };

    return definition;
  }

  /**
   * Build a mask feature for the tile that helps the shade guide work
   * @param shadeGuide - the shade guide
   * @param tile - the tile that needs a mask
   */
  buildMaskFeature(shadeGuide: ShadeDefinition, tile: Tile): void {
    const { layerIndex, minzoom, maxzoom } = shadeGuide;
    const { context, layerGuide } = this;
    const { zoom } = tile;
    // not in the zoom range, ignore
    if (layerGuide === undefined || zoom < minzoom || zoom > maxzoom) return;

    const featureCodeBuffer = context.buildGPUBuffer(
      'Feature Code Buffer',
      new Float32Array([0]),
      GPUBufferUsage.STORAGE,
    );
    const feature = new ShadeFeature(this, tile, layerIndex, layerGuide, featureCodeBuffer);
    tile.addFeatures([feature]);
  }

  /**
   * Build the render pipeline for the shade workflow
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the render pipeline
   */
  async #getPipeline(): Promise<GPURenderPipeline> {
    const { device, format, sampleCount, frameBindGroupLayout, featureBindGroupLayout } =
      this.context;

    const module = device.createShaderModule({ code: shaderCode });
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout],
    });

    const stencilState: GPUStencilFaceState = {
      compare: 'always',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'keep',
    };

    return await device.createRenderPipelineAsync({
      label: 'Shade Pipeline',
      layout,
      vertex: { module, entryPoint: 'vMain', buffers: SHADER_BUFFER_LAYOUT },
      fragment: {
        module,
        entryPoint: 'fMain',
        targets: [
          {
            format,
            blend: {
              // operation: common operation
              color: { srcFactor: 'dst', dstFactor: 'zero', operation: 'add' },
              // operation: assuming you want the same for alpha
              alpha: { srcFactor: 'dst', dstFactor: 'zero', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-strip', cullMode: 'back', stripIndexFormat: 'uint32' },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0,
        stencilWriteMask: 0,
      },
    });
  }

  /**
   * Draw a shade feature to the GPU
   * @param feature - shade feature guide
   */
  draw(feature: ShadeFeatureSpec): void {
    const {
      layerGuide: { visible },
      source,
      bindGroup,
    } = feature;
    if (!visible) return;
    const { context, pipeline } = this;
    const { passEncoder } = context;
    const { vertexBuffer, indexBuffer, count, offset } = source;
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(pipeline);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.setIndexBuffer(indexBuffer, 'uint32');
    passEncoder.setBindGroup(1, bindGroup);
    // draw
    passEncoder.drawIndexed(count, 1, offset);
  }
}

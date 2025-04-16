import { Color } from 'style/color/index.js';
import shaderCode from '../shaders/wallpaper.wgsl';

import type Projector from 'ui/camera/projector/index.js';
import type { StyleDefinition } from 'style/style.spec.js';
import type { WallpaperWorkflow as WallpaperWorkflowSpec } from './workflow.spec.js';
import type { WebGPUContext } from '../context/index.js';

/** Wallpaper color guide */
export interface WallpaperScheme {
  background: Color;
  fade1: Color;
  fade2: Color;
  halo: Color;
}

/** Wallpaper Workflow renders a user styled wallpaper to the GPU */
export default class WallpaperWorkflow implements WallpaperWorkflowSpec {
  context: WebGPUContext;
  scheme: WallpaperScheme;
  tileSize = 512;
  scale = new Float32Array([0, 0]);
  pipeline!: GPURenderPipeline;
  #uniformBuffer!: GPUBuffer;
  #wallpaperBindGroupLayout!: GPUBindGroupLayout;
  #bindGroup!: GPUBindGroup;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
    // setup scheme
    this.scheme = {
      background: new Color('#000'),
      fade1: new Color('#000'),
      fade2: new Color('#000'),
      halo: new Color('#000'),
    };
  }

  /** Setup the wallpaper workflow */
  async setup(): Promise<void> {
    const { context } = this;
    // prep the matrix buffer
    this.#uniformBuffer = context.buildGPUBuffer(
      'Wallpaper Uniform Buffer',
      new Float32Array(20),
      GPUBufferUsage.UNIFORM,
    );
    this.pipeline = await this.#getPipeline();
  }

  /** Cleanup the wallpaper workflow */
  destroy(): void {
    this.#uniformBuffer.destroy();
  }

  /**
   * Update the wallpaper style
   * @param style - input user defined style
   */
  updateStyle(style: StyleDefinition): void {
    const { scheme, context } = this;
    const { background, fade1, fade2, halo } = style.wallpaper ?? {};
    // inject wallpaper into scheme
    if (background !== undefined) scheme.background = new Color(background);
    if (fade1 !== undefined) scheme.fade1 = new Color(fade1);
    if (fade2 !== undefined) scheme.fade2 = new Color(fade2);
    if (halo !== undefined) scheme.halo = new Color(halo);
    // inject uniforms
    this.#updateUniforms();
    // build the bind group
    this.#bindGroup = context.buildGroup('Wallpaper', this.#wallpaperBindGroupLayout, [
      this.#uniformBuffer,
    ]);
  }

  /**
   * Update the scale
   * @param projector - Projector
   */
  #updateScale(projector: Projector): void {
    const { min, pow } = Math;
    const { dirty, zoom, aspect, multiplier } = projector;
    if (!dirty) return;
    const radius = this.tileSize * min(pow(2, zoom), 32_768);
    const mult2 = multiplier / 2;
    this.scale[0] = radius / (aspect.x / mult2);
    this.scale[1] = radius / (aspect.y / mult2);
    this.context.device.queue.writeBuffer(this.#uniformBuffer, 16 * 4, this.scale);
  }

  /** Update uniforms. Only updates on style change */
  #updateUniforms(): void {
    const { context, scheme } = this;
    context.device.queue.writeBuffer(
      this.#uniformBuffer,
      0,
      new Float32Array([
        ...scheme.fade1.getRGB(true),
        ...scheme.fade2.getRGB(true),
        ...scheme.halo.getRGB(true),
        ...scheme.background.getRGB(true),
      ]),
    );
  }

  /**
   * Setup the GPU Pipeline for drawing.
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the GPU Pipeline
   */
  async #getPipeline(): Promise<GPURenderPipeline> {
    const { device, format, sampleCount, frameBindGroupLayout } = this.context;

    // prep Wallpaper uniforms
    this.#wallpaperBindGroupLayout = this.context.buildLayout(
      'Wallpaper',
      ['uniform'],
      GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    );

    const module = device.createShaderModule({ code: shaderCode });
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, this.#wallpaperBindGroupLayout],
    });

    return await device.createRenderPipelineAsync({
      label: 'Wallpaper Pipeline',
      layout,
      vertex: { module, entryPoint: 'vMain' },
      fragment: { module, entryPoint: 'fMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
        format: 'depth24plus-stencil8',
      },
    });
  }

  /**
   * Draw the wallpaper to the GPU
   * @param projector - Projector
   */
  draw(projector: Projector): void {
    const { context } = this;
    // get current source data
    const { passEncoder } = context;

    // update scale if needed
    if (projector.dirty) this.#updateScale(projector);
    // setup pipeline, bind groups, & buffers
    context.setRenderPipeline(this.pipeline);
    passEncoder.setBindGroup(1, this.#bindGroup);
    // draw the quad
    passEncoder.draw(6);
  }
}

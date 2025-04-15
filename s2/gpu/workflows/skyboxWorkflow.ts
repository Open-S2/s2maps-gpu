import Color from 'style/color';
import adjustURL from 'util/adjustURL';
import { degToRad } from 'gis-tools';
import shaderCode from '../shaders/skybox.wgsl';
import { invert, multiply, perspective, rotate } from 'ui/camera/projector/mat4';

import type Camera from 'ui/camera';
import type Projector from 'ui/camera/projector';
import type { SkyboxWorkflow as SkyboxWorkflowSpec } from './workflow.spec';
import type { StyleDefinition } from 'style/style.spec';
import type { WebGPUContext } from '../context';

/** Skybox Workflow renders a user styled skybox to the GPU */
export default class SkyboxWorkflow implements SkyboxWorkflowSpec {
  context: WebGPUContext;
  facesReady = 0;
  ready = false;
  fov: number = degToRad(80);
  angle: number = degToRad(40);
  matrix: Float32Array = new Float32Array(16);
  pipeline!: GPURenderPipeline;
  #matrixBuffer!: GPUBuffer;
  #cubeMap!: GPUTexture;
  #sampler!: GPUSampler;
  #skyboxBindGroupLayout!: GPUBindGroupLayout;
  #bindGroup!: GPUBindGroup;
  /** @param context - The WebGPU context */
  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /** Setup the skybox workflow */
  async setup(): Promise<void> {
    const { context } = this;
    const { device } = context;
    // prep the matrix buffer
    this.#matrixBuffer = context.buildGPUBuffer(
      'Skybox Uniform Buffer',
      this.matrix,
      GPUBufferUsage.UNIFORM,
    );
    // prep the sampler
    this.#sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge',
    });
    this.pipeline = await this.#getPipeline();
  }

  /** Destroy the skybox workflow */
  destroy(): void {
    this.#matrixBuffer.destroy();
    this.#cubeMap.destroy();
  }

  /**
   * Update the skybox style
   * @param style - user defined style
   * @param camera - The camera
   * @param urlMap - The url map to properly resolve urls
   */
  updateStyle(style: StyleDefinition, camera: Camera, urlMap?: Record<string, string>): void {
    const { context } = this;
    const { device } = context;
    const { skybox } = style;
    const { type, size, loadingBackground } = style.skybox ?? {};
    let path = skybox?.path;
    if (typeof path !== 'string') throw new Error('Skybox path must be a string');
    if (typeof type !== 'string') throw new Error('Skybox type must be a string');
    if (typeof size !== 'number') throw new Error('Skybox size must be a number');
    path = adjustURL(path, urlMap);
    // grab clear color and set inside painter
    if (loadingBackground !== undefined) {
      context.setClearColor(new Color(loadingBackground ?? 'rgb(0, 0, 0)').getRGB());
    }
    // build a cube map and sampler
    if (this.#cubeMap !== undefined) this.#cubeMap.destroy();
    this.#cubeMap = context.buildTexture(null, size, size, 6);
    // build the bind group
    this.#bindGroup = device.createBindGroup({
      label: 'Skybox BindGroup',
      layout: this.#skyboxBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.#matrixBuffer } },
        { binding: 1, resource: this.#sampler },
        { binding: 2, resource: this.#cubeMap.createView({ dimension: 'cube' }) },
      ],
    });
    // reset our tracking variables
    this.facesReady = 0;
    this.ready = false;
    // request each face and assign to cube map
    for (let i = 0; i < 6; i++) void this.#getImage(i, `${path}/${size}/${i}.${type}`, camera);
  }

  /**
   * Setup the skybox pipeline
   * https://programmer.ink/think/several-best-practices-of-webgpu.html
   * BEST PRACTICE 6: it is recommended to create pipeline asynchronously
   * BEST PRACTICE 7: explicitly define pipeline layouts
   * @returns the WebGPU pipeline
   */
  async #getPipeline(): Promise<GPURenderPipeline> {
    const { device, format, sampleCount, frameBindGroupLayout } = this.context;

    // prep skybox uniforms
    this.#skyboxBindGroupLayout = device.createBindGroupLayout({
      label: 'Skybox BindGroupLayout',
      entries: [
        // matrix
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        // sampler
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        // texture
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: 'cube' },
        },
      ],
    });

    const module = device.createShaderModule({ label: 'Skybox Shader Module', code: shaderCode });
    const layout = device.createPipelineLayout({
      label: 'Skybox Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, this.#skyboxBindGroupLayout],
    });

    return await device.createRenderPipelineAsync({
      label: 'Skybox Pipeline',
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
   * Get the appropriate cube map image and upload the data to the GPU
   * @param index - the index
   * @param path - the path to the image
   * @param camera - the camera
   */
  async #getImage(index: number, path: string, camera: Camera): Promise<void> {
    const { context } = this;
    const data = await fetch(path)
      .then(async (res: Response) => {
        if (res.status !== 200 && res.status !== 206) return;
        return await res.blob();
      })
      .catch(() => {
        return undefined;
      });
    if (data === undefined) return;
    const image = await createImageBitmap(data);
    // upload to texture
    context.uploadTextureData(this.#cubeMap, image, image.width, image.height, undefined, {
      x: 0,
      y: 0,
      z: index,
    });
    // set the projector as dirty to ensure a proper initial render
    camera.projector.reset();
    // call the full re-render
    camera.render();
    // update the ready count
    this.facesReady++;
    // if all faces are uploaded, set the skybox as ready
    if (this.facesReady === 6) this.ready = true;
  }

  /**
   * Update to the projector's current matrix
   * @param projector - The projector
   */
  #updateMatrix(projector: Projector): void {
    const { context, fov, angle, matrix } = this;
    const { aspect, lon, lat } = projector;
    // create a perspective matrix
    perspective(matrix, fov, aspect.x / aspect.y, 1, 10000);
    // rotate perspective
    rotate(matrix, [degToRad(lat), degToRad(lon), angle]);
    // this is a simplified "lookat", since we maintain a set camera position
    multiply(matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    // invert view
    invert(matrix);
    // update matrix for the GPU
    context.device.queue.writeBuffer(this.#matrixBuffer, 0, matrix);
  }

  /**
   * Draw the skybox
   * @param projector - The projector
   */
  draw(projector: Projector): void {
    // get current source data
    const { passEncoder } = this.context;

    // update  matrix if necessary
    if (projector.dirty) this.#updateMatrix(projector);
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(this.pipeline);
    passEncoder.setBindGroup(1, this.#bindGroup);
    // draw the quad
    passEncoder.draw(6);
  }
}

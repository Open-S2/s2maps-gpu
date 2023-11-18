/* eslint-env browser */
import shaderCode from '../shaders/skybox.wgsl'
import Color from 'style/color'
import { degToRad } from 'geometry/util'
import { invert, multiply, perspective, rotate } from 'ui/camera/projector/mat4'

import type { SkyboxWorkflow as SkyboxWorkflowSpec } from './workflow.spec'
import type { WebGPUContext } from '../context'
import type Projector from 'ui/camera/projector'
import type { StyleDefinition } from 'style/style.spec'
import type Camera from 'ui/camera'

export default class SkyboxWorkflow implements SkyboxWorkflowSpec {
  context: WebGPUContext
  fov: number = degToRad(80)
  angle: number = degToRad(40)
  matrix: Float32Array = new Float32Array(16)
  pipeline!: GPURenderPipeline
  #matrixBuffer!: GPUBuffer
  #cubeMap!: GPUTexture
  #sampler!: GPUSampler
  #skyboxBindGroupLayout!: GPUBindGroupLayout
  #bindGroup!: GPUBindGroup
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { context } = this
    const { device } = context
    // prep the matrix buffer
    this.#matrixBuffer = context.buildGPUBuffer('Skybox Uniform Buffer', this.matrix, GPUBufferUsage.UNIFORM)
    // prep the sampler
    this.#sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      addressModeW: 'clamp-to-edge'
    })
    this.pipeline = await this.#getPipeline()
  }

  updateStyle (style: StyleDefinition, camera: Camera): void {
    const { context } = this
    const { device } = context
    const { path, type, size, loadingBackground } = style.skybox ?? {}
    if (typeof path !== 'string') throw new Error('Skybox path must be a string')
    if (typeof type !== 'string') throw new Error('Skybox type must be a string')
    if (typeof size !== 'number') throw new Error('Skybox size must be a number')
    // grab clear color and set inside painter
    if (loadingBackground !== undefined) {
      context.setClearColor(
        (new Color(loadingBackground ?? 'rgb(0, 0, 0)')).getRGB()
      )
    }
    // build a cube map and sampler
    if (this.#cubeMap !== undefined) this.#cubeMap.destroy()
    this.#cubeMap = context.buildTexture(null, size, size, 6)
    // build the bind group
    this.#bindGroup = device.createBindGroup({
      label: 'Skybox BindGroup',
      layout: this.#skyboxBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.#matrixBuffer }
        },
        {
          binding: 1,
          resource: this.#sampler
        },
        {
          binding: 2,
          resource: this.#cubeMap.createView({ dimension: 'cube' })
        }
      ]
    })
    // request each face and assign to cube map
    for (let i = 0; i < 6; i++) void this.#getImage(i, `${path}/${size}/${i}.${type}`, camera)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (): Promise<GPURenderPipeline> {
    const { device, format, sampleCount, frameBindGroupLayout } = this.context

    // prep skybox uniforms
    this.#skyboxBindGroupLayout = device.createBindGroupLayout({
      label: 'Skybox BindGroupLayout',
      entries: [
        { // matrix
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 0 }
        },
        { // sampler
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' }
        },
        { // texture
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: 'cube' }
        }
      ]
    })

    const module = device.createShaderModule({ code: shaderCode })
    const layout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, this.#skyboxBindGroupLayout]
    })

    return await device.createRenderPipelineAsync({
      layout,
      vertex: {
        module,
        entryPoint: 'vMain'
      },
      fragment: {
        module,
        entryPoint: 'fMain',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
        format: 'depth24plus-stencil8'
      }
    })
  }

  async #getImage (index: number, path: string, camera: Camera): Promise<void> {
    const { context } = this
    const data = await fetch(path)
      .then(async (res: Response) => {
        if (res.status !== 200 && res.status !== 206) return
        return await res.blob()
      })
      .catch(() => { /* no-op */ })
    if (data === undefined) return
    const image = await createImageBitmap(data)
    // upload to texture
    context.uploadTextureData(this.#cubeMap, image, image.width, image.height, { x: 0, y: 0, z: index })
    // set the projector as dirty to ensure a proper initial render
    camera.projector.reset()
    // call the full re-render
    camera.render()
  }

  #updateMatrix (projector: Projector): void {
    const { context, fov, angle, matrix } = this
    const { aspect, lon, lat } = projector
    // create a perspective matrix
    perspective(matrix, fov, aspect[0] / aspect[1], 1, 10000)
    // rotate perspective
    rotate(matrix, [degToRad(lat), degToRad(lon), angle])
    // this is a simplified "lookat", since we maintain a set camera position
    multiply(matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    // invert view
    invert(matrix)
    // update matrix for the GPU
    context.device.queue.writeBuffer(this.#matrixBuffer, 0, matrix)
  }

  draw (projector: Projector): void {
    // get current source data
    const { passEncoder } = this.context

    // update  matrix if necessary
    if (projector.dirty) this.#updateMatrix(projector)
    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(this.pipeline)
    passEncoder.setBindGroup(1, this.#bindGroup)
    // draw the quad
    passEncoder.draw(6)
  }
}

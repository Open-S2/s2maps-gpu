/* eslint-env browser */
import buildMask from './buildMask'

import type { GPUType } from 'style/style.spec'
import type { MapOptions } from 'ui/s2mapUI'
import type { MaskSource } from './context.spec'

export default class WebGPUContext {
  ready = false
  renderer = '' // ex: AMD Radeon Pro 560 OpenGL Engine (https://github.com/pmndrs/detect-gpu)
  gpu: GPUCanvasContext
  device!: GPUDevice
  presentation!: { width: number, height: number }
  #adapter!: GPUAdapter
  #depthStencilTexture!: GPUTexture
  #renderPassDescriptor!: GPURenderPassDescriptor
  devicePixelRatio: number
  interactive = false
  format!: GPUTextureFormat
  masks = new Map<number, MaskSource>()
  type: GPUType = 3 // specifying that we are using a WebGPUContext
  // manage buffers, layouts, and bind groups
  #vpBuffer!: GPUBuffer
  vpBindGroupLayout!: GPUBindGroupLayout
  vpBufferBindGroup!: GPUBindGroup
  constructor (context: GPUCanvasContext, options: MapOptions) {
    const { canvasMultiplier } = options
    this.gpu = context
    this.devicePixelRatio = canvasMultiplier ?? 1
    void this.connectGPU()
  }

  async connectGPU (): Promise<void> {
    // grab physical device adapter and device
    const adapter = await navigator.gpu.requestAdapter()
    if (adapter === null) throw new Error('Failed to get GPU adapter')
    this.#adapter = adapter
    const device = this.device = await this.#adapter.requestDevice()
    // configure context
    const format = this.format = navigator.gpu.getPreferredCanvasFormat()
    this.gpu.configure({
      device,
      format,
      alphaMode: 'premultiplied'
    })
    // set size
    this.resize()
    // TODO: Setup viewProjection matrix one time for all shaders

    // prepare renderpass descriptor
    this.#prepareRenderpassDescriptor()
    // prep view projection layout
    this.#buildViewProjectionLayout()
    // update state
    this.ready = true
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 1: Use the label attribute where it can be used
  // BEST PRACTICE 5: Buffer data upload (give priority to writeBuffer() API,
  //                  which avoids extra buffer replication operation.)
  buildGPUBuffer (
    label: string,
    inputArray: BufferSource,
    usage: number = GPUBufferUsage.VERTEX
  ): GPUBuffer {
    // prep buffer
    const gpuBuffer = this.device.createBuffer({
      label,
      size: inputArray.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST
    })
    // inject data then unmap
    this.device.queue.writeBuffer(gpuBuffer, 0, inputArray)

    return gpuBuffer
  }

  getFeatureAtMousePosition (x: number, y: number): undefined | number {
    return undefined
    // const { gl, interactFramebuffer, featurePoint } = this
    // // bind the feature framebuffer
    // gl.bindFramebuffer(gl.FRAMEBUFFER, interactFramebuffer)
    // // grab the data
    // gl.readPixels(x, gl.canvas.height - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, featurePoint)

    // if (featurePoint[3] !== 255) return
    // // create the actual feature id
    // const featureID = featurePoint[0] + (featurePoint[1] << 8) + (featurePoint[2] << 16)
    // // return if we found something
    // if (featureID > 0) return featureID
  }

  resize (): void {
    const { gpu, devicePixelRatio } = this
    const { canvas } = gpu
    // in webGPU, you only have to edit the canvas size
    const width = ('clientWidth' in canvas ? canvas.clientWidth : canvas.width) * devicePixelRatio
    const height = ('clientHeight' in canvas ? canvas.clientHeight : canvas.height) * devicePixelRatio
    this.presentation = { width, height }
    // adjust canvas to match presentation
    canvas.width = width
    canvas.height = height
  }

  setInteractive (interactive: boolean): void {
    this.interactive = interactive
    this.resizeInteract()
  }

  resizeInteract (): void {}

  // the zoom determines the number of divisions necessary to maintain a visually
  // asthetic spherical shape. As we zoom in, the tiles are practically flat,
  // so division is less useful.
  // 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
  // context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
  // TODO:
  getMask (division: number): MaskSource {
    const { masks } = this
    // check if we have a mask for this level
    let mask = masks.get(division)
    if (mask !== undefined) return mask
    // otherwise, create a new mask
    mask = buildMask(division, this)
    masks.set(division, mask)

    return mask
  }

  #prepareRenderpassDescriptor (): void {
    const { presentation, gpu } = this
    // Create the texture for our depth buffer
    this.#depthStencilTexture = this.device.createTexture({
      size: presentation,
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })

    // Create our render pass descriptor
    const colorAttachments: GPURenderPassColorAttachment[] = [
      {
        // @ts-expect-error ignore labels for now
        view: gpu, // set on each render pass
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }
    ]
    this.#renderPassDescriptor = {
      colorAttachments,
      depthStencilAttachment: {
        view: this.#depthStencilTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    }
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 7: shared resource binding group and binding group layout object
  #buildViewProjectionLayout (): void {
    const { device } = this
    const viewProjectionMatrix = new Float32Array(16)

    // Create a uniform buffers for our vp matrix
    this.#vpBuffer = this.buildGPUBuffer(
      'Tail VP Matrix Buffer',
      viewProjectionMatrix,
      GPUBufferUsage.UNIFORM
    )

    // Create a resource binding group layout of camera UBO and its binding group ontology
    this.vpBindGroupLayout = device.createBindGroupLayout({
      label: 'View Projection uniforms BindGroupLayout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {}
      }]
    })
    // Create the bind group mapping our uniform buffer to shader resources
    this.vpBufferBindGroup = device.createBindGroup({
      layout: this.vpBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.#vpBuffer }
      }]
    })
  }
}

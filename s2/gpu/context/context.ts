/* eslint-env browser */
import buildMask from './buildMask'

import type { GPUType } from 'style/style.spec'
import type { MapOptions } from 'ui/s2mapUI'
import type { MaskSource } from '../workflows/workflow.spec'
import type Projector from 'ui/camera/projector'
import type { ColorMode } from 's2Map'

const DEPTH_ESPILON = 1 / Math.pow(2, 20)

export default class WebGPUContext {
  ready = false
  #resizeNextFrame = false
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
  #viewUniformBuffer!: GPUBuffer
  #matrixUniformBuffer!: GPUBuffer
  frameBindGroupLayout!: GPUBindGroupLayout
  featureBindGroupLayout!: GPUBindGroupLayout
  frameBufferBindGroup!: GPUBindGroup
  // frame specific variables
  commandEncoder!: GPUCommandEncoder
  passEncoder!: GPURenderPassEncoder
  // track current states
  colorMode: ColorMode = 0
  stencilRef = -1
  cleanup: Array<() => void> = []
  constructor (context: GPUCanvasContext, options: MapOptions) {
    const { canvasMultiplier } = options
    this.gpu = context
    this.devicePixelRatio = canvasMultiplier ?? 1
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
    this.#resize()
    // prep uniform/storage buffers
    this.#buildContextStorageGroupsAndLayouts()
    // update state
    this.ready = true
  }

  newScene (projector: Projector): void {
    // if a resize was called, let's do that first
    if (this.#resizeNextFrame) this.#resize()
    // prepare descriptor
    this.#prepareRenderpassDescriptor()
    // set encoders
    this.commandEncoder = this.device.createCommandEncoder()
    this.passEncoder = this.commandEncoder.beginRenderPass(this.#renderPassDescriptor)

    // setup view and matrix uniforms immediately
    const matrix = projector.getMatrix('m')
    this.device.queue.writeBuffer(this.#matrixUniformBuffer, 0, matrix)
    this.device.queue.writeBuffer(this.#viewUniformBuffer, 4, projector.view)

    // setup bind groups
    this.passEncoder.setBindGroup(0, this.frameBufferBindGroup)
    // this.passEncoder.setBindGroup(1, this.featureBufferBindGroup)
  }

  finish (): void {
    // finish
    this.passEncoder.end()
    this.device.queue.submit([this.commandEncoder.finish()])
    this.#cleanupResources()
  }

  #cleanupResources (): void {
    // cleanup
    for (const cleanup of this.cleanup) cleanup()
    this.cleanup = []
  }

  setColorBlindMode (mode: ColorMode): void {
    if (this.colorMode === mode) return
    this.colorMode = mode
    this.device.queue.writeBuffer(this.#viewUniformBuffer, 0, new Float32Array([mode]))
  }

  buildStaticGPUBuffer (
    label: string,
    type: 'float' | 'uint' | 'int',
    inputArray: ArrayLike<number>,
    usage: number
  ): GPUBuffer {
    // prep buffer
    const gpuBuffer = this.device.createBuffer({
      label,
      size: inputArray.length * 4,
      usage,
      mappedAtCreation: true
    })
    const arrayBuffer = gpuBuffer.getMappedRange()
    const buffer = type === 'float' ? new Float32Array(arrayBuffer) : type === 'uint' ? new Uint32Array(arrayBuffer) : new Int32Array(arrayBuffer)
    buffer.set(inputArray)
    gpuBuffer.unmap()

    return gpuBuffer
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 1: Use the label attribute where it can be used
  // BEST PRACTICE 5: Buffer data upload (give priority to writeBuffer() API,
  //                  which avoids extra buffer replication operation.)
  buildGPUBuffer (
    label: string,
    inputArray: BufferSource,
    usage: number
  ): GPUBuffer {
    // prep buffer
    const gpuBuffer = this.device.createBuffer({
      label,
      size: inputArray.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST
    })
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
    this.#resizeNextFrame = true
  }

  #resize (): void {
    this.#resizeNextFrame = false
    const { gpu } = this
    const { canvas } = gpu
    // in webGPU, you only have to edit the canvas size
    const width = 'clientWidth' in canvas ? canvas.clientWidth : canvas.width
    const height = 'clientHeight' in canvas ? canvas.clientHeight : canvas.height
    this.presentation = { width, height }
    // adjust canvas to match presentation
    canvas.width = width
    canvas.height = height
    // fix the depth-stencil
    if (this.#depthStencilTexture !== undefined) this.#depthStencilTexture.destroy()
    this.#depthStencilTexture = this.device.createTexture({
      size: this.presentation,
      // sampleCount: 2,
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
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
  getMask (division: number): MaskSource {
    const { masks } = this
    // check if we have a mask for this level
    const mask = masks.get(division)
    if (mask !== undefined) return mask
    // otherwise, create a new mask
    const builtMask = buildMask(division, this)
    masks.set(division, builtMask)

    return builtMask
  }

  getDepthPosition (layerIndex: number): number {
    return 1 - (layerIndex + 1) * DEPTH_ESPILON
  }

  setStencilReference (stencilRef: number): void {
    if (this.stencilRef === stencilRef) return
    this.stencilRef = stencilRef
    this.passEncoder.setStencilReference(stencilRef)
  }

  #prepareRenderpassDescriptor (): void {
    // Create our render pass descriptor
    this.#renderPassDescriptor = {
      colorAttachments: [
        {
          view: this.gpu.getCurrentTexture().createView(), // set on each render pass
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ],
      depthStencilAttachment: {
        view: this.#depthStencilTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        stencilLoadOp: 'clear',
        stencilStoreOp: 'store'
      }
    }
  }

  #buildContextStorageGroupsAndLayouts (): void {
    // setup position uniforms
    this.#viewUniformBuffer = this.buildGPUBuffer('View Uniform Buffer', new Float32Array(11), GPUBufferUsage.UNIFORM)
    this.#matrixUniformBuffer = this.buildGPUBuffer('Matrix Uniform Buffer', new Float32Array(16), GPUBufferUsage.UNIFORM)
    this.frameBindGroupLayout = this.buildLayout('Frame', ['uniform', 'uniform'])
    this.frameBufferBindGroup = this.buildGroup('Frame BindGroup', this.frameBindGroupLayout, [this.#viewUniformBuffer, this.#matrixUniformBuffer])
    // setup per feature uniforms
    this.featureBindGroupLayout = this.buildLayout('Feature', ['uniform', 'uniform', 'read-only-storage', 'read-only-storage'])
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 7: shared resource binding group and binding group layout object
  buildLayout (
    name: string,
    bindings: GPUBufferBindingType[]
  ): GPUBindGroupLayout {
    return this.device.createBindGroupLayout({
      label: `${name} BindGroupLayout`,
      entries: bindings.map((type, index) => ({
        binding: index,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type, hasDynamicOffset: false, minBindingSize: 0 }
      }))
    })
  }

  buildGroup (
    name: string,
    layout: GPUBindGroupLayout,
    bindings: GPUBuffer[]
  ): GPUBindGroup {
    return this.device.createBindGroup({
      label: `${name} BindGroup`,
      layout,
      entries: bindings.map((buffer, index) => ({
        binding: index,
        resource: { buffer }
      }))
    })
  }
}

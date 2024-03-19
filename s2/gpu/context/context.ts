import buildMask from './buildMask'

import type { ColorArray } from 'style/color'
import type { GPUType, Projection } from 'style/style.spec'
import type { MapOptions } from 'ui/s2mapUI'
import type { MaskSource, TileMaskSource } from 'gpu/workflows/workflow.spec'
import type { ColorMode } from 's2Map'
import type { Painter } from 'gpu/painter.spec'
import type { Tile } from 'source/tile.spec'
import type { GlyphImages } from 'workers/source/glyphSource'
import type { SpriteImageMessage } from 'workers/worker.spec'

const DEPTH_ESPILON = 1 / Math.pow(2, 20)

export default class WebGPUContext {
  ready = false
  // constants/semi-constants
  type: GPUType = 3 // specifying that we are using a WebGPUContext
  renderer = '' // ex: AMD Radeon Pro 560 OpenGL Engine (https://github.com/pmndrs/detect-gpu)
  gpu: GPUCanvasContext
  device!: GPUDevice
  presentation!: { width: number, height: number, depthOrArrayLayers: number }
  painter: Painter
  #adapter!: GPUAdapter
  devicePixelRatio: number
  interactive = false
  projection: Projection = 'S2'
  format: GPUTextureFormat = 'rgba8unorm'
  masks = new Map<number, MaskSource>()
  sampleCount = 1
  clearColorRGBA: ColorArray = [0, 0, 0, 0]
  // manage buffers, layouts, and bind groups
  nullTexture!: GPUTexture
  sharedTexture!: GPUTexture
  #interactiveReadBuffer!: GPUBuffer
  #interactiveIndexBuffer!: GPUBuffer
  #interactiveResultBuffer!: GPUBuffer
  interactiveBindGroupLayout!: GPUBindGroupLayout
  interactiveBindGroup!: GPUBindGroup
  maskPatternBindGroupLayout!: GPUBindGroupLayout
  defaultSampler!: GPUSampler
  patternSampler!: GPUSampler
  #viewUniformBuffer!: GPUBuffer
  #matrixUniformBuffer!: GPUBuffer
  frameBindGroupLayout!: GPUBindGroupLayout
  featureBindGroupLayout!: GPUBindGroupLayout
  frameBufferBindGroup!: GPUBindGroup
  #renderTarget?: GPUTexture
  #depthStencilTexture!: GPUTexture
  #renderPassDescriptor!: GPURenderPassDescriptor
  // frame specific variables
  commandEncoder!: GPUCommandEncoder
  passEncoder!: GPURenderPassEncoder
  computePass!: GPUComputePassEncoder
  #resizeNextFrame = false
  #resizeCB?: () => void
  // track current states
  colorMode: ColorMode = 0
  stencilRef = -1
  currPipeline: undefined | GPURenderPipeline | GPUComputePipeline
  findingFeature = false
  // common modes
  defaultBlend: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
  }

  constructor (context: GPUCanvasContext, options: MapOptions, painter: Painter) {
    const { canvasMultiplier } = options
    this.gpu = context
    this.devicePixelRatio = canvasMultiplier ?? 1
    this.painter = painter
  }

  async connectGPU (): Promise<void> {
    // grab physical device adapter and device
    const adapter = await navigator.gpu.requestAdapter()
    if (adapter === null) throw new Error('Failed to get GPU adapter')
    this.#adapter = adapter
    const device = this.device = await this.#adapter.requestDevice()
    // configure context
    const format = this.format = navigator.gpu.getPreferredCanvasFormat()
    this.gpu.configure({ device, format, alphaMode: 'premultiplied' })
    // prep uniform/storage buffers
    this.#buildContextStorageGroupsAndLayouts()
    // set size
    this.#resize()
    // update state
    this.ready = true
  }

  newScene (view: Float32Array, matrix: Float32Array): void {
    // reset current pipeline
    this.currPipeline = undefined
    // reset stencil ref
    this.stencilRef = -1
    // if a resize was called, let's do that first
    if (this.#resizeNextFrame) this.#resize()
    // prepare descriptor
    this.#prepareRenderpassDescriptor()
    // set encoders
    this.commandEncoder = this.device.createCommandEncoder()
    this.passEncoder = this.commandEncoder.beginRenderPass(this.#renderPassDescriptor)

    // setup view and matrix uniforms immediately
    this.device.queue.writeBuffer(this.#matrixUniformBuffer, 0, matrix)
    this.device.queue.writeBuffer(this.#viewUniformBuffer, 4, view)

    // setup bind groups
    this.passEncoder.setBindGroup(0, this.frameBufferBindGroup)
  }

  clearInteractBuffer (): void {
    this.device.queue.writeBuffer(this.#interactiveIndexBuffer, 0, new Uint32Array([0]))
  }

  finish (): void {
    this.passEncoder.end()
    this.device.queue.submit([this.commandEncoder.finish()])
  }

  setRenderPipeline (pipeline: GPURenderPipeline): void {
    if (this.currPipeline?.label === pipeline.label) return
    this.currPipeline = pipeline
    this.passEncoder.setPipeline(pipeline)
  }

  setComputePipeline (pipeline: GPUComputePipeline): void {
    if (this.currPipeline?.label === pipeline.label) return
    this.currPipeline = pipeline
    this.computePass.setPipeline(pipeline)
  }

  setClearColor (clearColor: ColorArray): void {
    this.clearColorRGBA = clearColor
  }

  setColorBlindMode (mode: ColorMode): void {
    if (this.colorMode === mode) return
    this.colorMode = mode
    this.device.queue.writeBuffer(this.#viewUniformBuffer, 0, new Float32Array([mode]))
  }

  setDevicePixelRatio (devicePixelRatio?: number): void {
    if (devicePixelRatio !== undefined) this.devicePixelRatio = devicePixelRatio
    this.device.queue.writeBuffer(this.#viewUniformBuffer, 15 * 4, new Float32Array([this.devicePixelRatio]))
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 1: Use the label attribute where it can be used
  // BEST PRACTICE 5: Buffer data upload (give priority to writeBuffer() API,
  //                  which avoids extra buffer replication operation.)
  buildGPUBuffer (
    label: string,
    inputArray: BufferSource | SharedArrayBuffer,
    inUsage: number,
    size = inputArray.byteLength
  ): GPUBuffer {
    // prep buffer
    const containsMapRead = (inUsage & GPUBufferUsage.MAP_READ) === 1
    const usage = inUsage | GPUBufferUsage.COPY_DST | (containsMapRead ? 0 : GPUBufferUsage.COPY_SRC)
    const gpuBuffer = this.device.createBuffer({ label, size, usage })
    this.device.queue.writeBuffer(gpuBuffer, 0, inputArray)

    return gpuBuffer
  }

  duplicateGPUBuffer (inputBuffer: GPUBuffer, commandEncoder: GPUCommandEncoder): GPUBuffer {
    const { label, usage, size } = inputBuffer
    const { device } = this
    // prep buffer
    const gpuBuffer = device.createBuffer({ label, size, usage })
    commandEncoder.copyBufferToBuffer(inputBuffer, 0, gpuBuffer, 0, size)

    return gpuBuffer
  }

  buildPaddedBuffer (
    input: ArrayBuffer,
    width: number,
    height: number
  ): { data: Uint8Array, width: number, height: number } {
    const alignment = this.device.limits.minUniformBufferOffsetAlignment
    const bytesPerRow = Math.ceil(width * 4 / alignment) * alignment
    const paddedBufferSize = bytesPerRow * height
    const paddedSpriteData = new Uint8Array(paddedBufferSize)
    for (let y = 0; y < height; y++) {
      paddedSpriteData.set(
        new Uint8Array(input, y * width * 4, width * 4),
        y * bytesPerRow
      )
    }

    return {
      data: paddedSpriteData,
      width: bytesPerRow,
      height
    }
  }

  async getFeatureAtMousePosition (_x: number, _y: number): Promise<number[]> {
    const { device } = this
    let result: number[] = []
    // if we are already finding a feature, return undefined
    if (this.findingFeature) return result

    // first read the index buffer and result buffer into the read buffer
    const commandEncoder = device.createCommandEncoder()
    commandEncoder.copyBufferToBuffer(this.#interactiveIndexBuffer, 0, this.#interactiveReadBuffer, 0, 4)
    commandEncoder.copyBufferToBuffer(this.#interactiveResultBuffer, 0, this.#interactiveReadBuffer, 4, 200)
    device.queue.submit([commandEncoder.finish()])

    // read the results
    this.findingFeature = true
    await this.#interactiveReadBuffer.mapAsync(GPUMapMode.READ)
    this.findingFeature = false
    const arrayBuffer = this.#interactiveReadBuffer.getMappedRange()
    const data = new Uint32Array(arrayBuffer)
    // grab the index
    const size = data[0]
    // if the size is 0, we didn't hit anything; otherwise build array filtering out dublicates
    if (size !== 0) result = Array.from(data.slice(1, size + 1))
    // filter out duplicates
    result = [...new Set(result)]

    // unmap before we return the result
    this.#interactiveReadBuffer.unmap()
    return result
  }

  resize (cb: () => void): void {
    this.#resizeNextFrame = true
    this.#resizeCB = cb
  }

  #resize (): void {
    this.#resizeNextFrame = false
    const { gpu, sampleCount } = this
    const { width, height } = gpu.canvas
    this.presentation = { width, height, depthOrArrayLayers: 1 }
    // fix the render target
    if (this.#renderTarget !== undefined) this.#renderTarget.destroy()
    if (sampleCount > 1) {
      this.#renderTarget = this.device.createTexture({
        size: this.presentation,
        sampleCount,
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      })
    }
    // fix the depth-stencil
    if (this.#depthStencilTexture !== undefined) this.#depthStencilTexture.destroy()
    this.#depthStencilTexture = this.device.createTexture({
      size: this.presentation,
      sampleCount,
      format: 'depth24plus-stencil8',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
    // if #resizeCB is defined, call it
    if (this.#resizeCB !== undefined) {
      this.#resizeCB()
      this.#resizeCB = undefined
    }
    // update the device pixel ratio
    this.setDevicePixelRatio()
  }

  setInteractive (interactive: boolean): void {
    this.interactive = interactive
  }

  setProjection (projection: Projection): void {
    this.projection = projection
  }

  // the zoom determines the number of divisions necessary to maintain a visually
  // asthetic spherical shape. As we zoom in, the tiles are practically flat,
  // so division is less useful.
  // 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
  // context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
  getMask (division: number, tile: Tile): TileMaskSource {
    const { masks, nullTexture } = this
    // check if we have a mask for this level
    let mask = masks.get(division)
    if (mask === undefined) {
      mask = buildMask(division, this)
      masks.set(division, mask)
    }

    // tile binding
    const uniformBuffer = this.buildGPUBuffer('Tile Uniform Buffer', new Float32Array(tile.uniforms), GPUBufferUsage.UNIFORM)
    const positionBuffer = this.buildGPUBuffer('Tile Position Buffer', tile.bottomTop, GPUBufferUsage.UNIFORM)
    // layer binding
    const layerBuffer = this.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([1, 0]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = this.buildGPUBuffer('Layer Code Buffer', new Float32Array([0]), GPUBufferUsage.STORAGE)
    // feature binding
    const featureCodeBuffer = this.buildGPUBuffer('Feature Code Buffer', new Float32Array([0]), GPUBufferUsage.STORAGE)
    // store the group
    const bindGroup = this.buildGroup(
      'Feature BindGroup',
      this.featureBindGroupLayout,
      [uniformBuffer, positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
    // pattern binding
    const fillTexturePositions = this.buildGPUBuffer('Fill Texture Positions', new Float32Array([0, 0, 0, 0, 0]), GPUBufferUsage.UNIFORM)

    const tileMaskSource: TileMaskSource = {
      ...mask,
      bindGroup,
      uniformBuffer,
      positionBuffer,
      fillPatternBindGroup: this.createPatternBindGroup(fillTexturePositions, nullTexture),
      draw: () => {
        this.setStencilReference(tile.tmpMaskID)
        this.painter.workflows.fill?.drawMask(tileMaskSource)
      },
      destroy: () => {
        uniformBuffer.destroy()
        positionBuffer.destroy()
        layerBuffer.destroy()
        layerCodeBuffer.destroy()
        featureCodeBuffer.destroy()
        fillTexturePositions.destroy()
      }
    }

    return tileMaskSource
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
    const [r, g, b, a] = this.clearColorRGBA
    const currentTexture = this.gpu.getCurrentTexture()
    // Create our render pass descriptor
    this.#renderPassDescriptor = {
      colorAttachments: [
        {
          view: (this.#renderTarget ?? currentTexture).createView(), // set on each render pass
          resolveTarget: this.#renderTarget !== undefined ? currentTexture.createView() : undefined,
          clearValue: { r, g, b, a },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ],
      depthStencilAttachment: {
        view: this.#depthStencilTexture.createView(),
        depthClearValue: 1.0,
        stencilClearValue: 0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        stencilLoadOp: 'clear',
        stencilStoreOp: 'store'
      }
    }
  }

  #buildContextStorageGroupsAndLayouts (): void {
    // setup a null texture
    this.nullTexture = this.buildTexture(null, 1, 1)
    // setup shared texture
    this.sharedTexture = this.buildTexture(null, 2048, 200)
    // setup interactive buffers
    this.#interactiveIndexBuffer = this.buildGPUBuffer('Interactive Index Buffer', new Uint32Array(1), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC)
    this.#interactiveResultBuffer = this.buildGPUBuffer('Interactive Result Buffer', new Uint32Array(50), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC)
    this.#interactiveReadBuffer = this.buildGPUBuffer('Interactive Read Buffer', new Uint32Array(51), GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ)
    this.interactiveBindGroupLayout = this.buildLayout('Interactive', ['storage', 'storage'], GPUShaderStage.COMPUTE)
    this.interactiveBindGroup = this.buildGroup('Interactive BindGroup', this.interactiveBindGroupLayout, [this.#interactiveIndexBuffer, this.#interactiveResultBuffer])
    // setup position uniforms
    this.#viewUniformBuffer = this.buildGPUBuffer('View Uniform Buffer', new Float32Array(16), GPUBufferUsage.UNIFORM)
    this.#matrixUniformBuffer = this.buildGPUBuffer('Matrix Uniform Buffer', new Float32Array(16), GPUBufferUsage.UNIFORM)
    this.frameBindGroupLayout = this.buildLayout('Frame', ['uniform', 'uniform'], GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE)
    this.frameBufferBindGroup = this.buildGroup('Frame BindGroup', this.frameBindGroupLayout, [this.#viewUniformBuffer, this.#matrixUniformBuffer])
    // setup per feature uniforms layout
    this.featureBindGroupLayout = this.buildLayout('Feature', ['uniform', 'uniform', 'uniform', 'read-only-storage', 'read-only-storage'], GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE)
    this.maskPatternBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Mask Interactive BindGroupLayout',
      entries: [
        { binding: 4, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // pattern x,y,w,h,movement
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } }, // pattern sampler
        { binding: 6, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } } // pattern texture
      ]
    })
    this.defaultSampler = this.buildSampler()
    this.patternSampler = this.buildSampler('linear', true, true)
  }

  buildSampler (
    filter: 'linear' | 'nearest' = 'linear',
    repeatU = false,
    repeatV = false
  ): GPUSampler {
    return this.device.createSampler({
      addressModeU: repeatU ? 'repeat' : 'clamp-to-edge',
      addressModeV: repeatV ? 'repeat' : 'clamp-to-edge',
      magFilter: filter,
      minFilter: filter
    })
  }

  buildTexture (
    imageData: null | GPUTexture | BufferSource | SharedArrayBuffer | ImageBitmap,
    width: number,
    height: number = width,
    depthOrArrayLayers = 1,
    srcOrigin = { x: 0, y: 0 },
    dstOrigin = { x: 0, y: 0, z: 0 },
    format: GPUTextureFormat = 'rgba8unorm',
    commandEncoder?: GPUCommandEncoder
  ): GPUTexture {
    const { device } = this
    const texture = device.createTexture({
      size: { width, height, depthOrArrayLayers },
      format, // Equivalent to WebGL's gl.RGBA
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    })
    // NOTE: It is assumed that the imageData's width and height are the same as the texture's width and height
    // if not, and the source is a BufferSource or SharedArrayBuffer, it will probably fail
    if (imageData !== null) this.uploadTextureData(texture, imageData, width, height, srcOrigin, dstOrigin, depthOrArrayLayers, commandEncoder)

    return texture
  }

  uploadTextureData (
    texture: GPUTexture,
    imageData: GPUTexture | BufferSource | SharedArrayBuffer | ImageBitmap,
    width: number, // width of copy size
    height: number, // height of copy size
    srcOrigin = { x: 0, y: 0 },
    dstOrigin = { x: 0, y: 0, z: 0 },
    depthOrArrayLayers = 1,
    commandEncoder?: GPUCommandEncoder
  ): void {
    const { device } = this
    if (imageData instanceof GPUTexture) {
      const cE = commandEncoder ?? device.createCommandEncoder()
      // For GPUTexture, use 'copyTextureToTexture'
      cE.copyTextureToTexture(
        { texture: imageData, origin: srcOrigin }, // flipY: true
        { texture, origin: dstOrigin },
        { width: imageData.width, height: imageData.height, depthOrArrayLayers }
      )
      if (commandEncoder === undefined) device.queue.submit([cE.finish()])
    } else if (imageData instanceof ImageBitmap) {
      // For ImageBitmap, use 'copyExternalImageToTexture'
      device.queue.copyExternalImageToTexture(
        { source: imageData, origin: srcOrigin }, // flipY: true
        { texture, origin: dstOrigin },
        { width, height, depthOrArrayLayers }
      )
    } else {
      const alignment = this.device.limits.minUniformBufferOffsetAlignment
      // For ArrayBufferView, use a buffer to upload
      const buffer = this.buildGPUBuffer('Texture Data', imageData, GPUBufferUsage.COPY_SRC)
      const cE = commandEncoder ?? device.createCommandEncoder()
      cE.copyBufferToTexture(
        { buffer, bytesPerRow: Math.max(alignment, width * 4), rowsPerImage: height },
        { texture, origin: dstOrigin },
        { width, height, depthOrArrayLayers }
      )
      if (commandEncoder === undefined) device.queue.submit([cE.finish()])
      // TODO: Find a way to cleanup the buffer if commandEncoder is outside this function
      // buffer.destroy()
    }
  }

  async getRenderData (): Promise<Uint8ClampedArray> {
    const { gpu, presentation } = this
    const target = this.#renderTarget ?? gpu.getCurrentTexture()
    return await this.downloadTextureData(target, presentation.width, presentation.height)
  }

  async downloadTextureData (texture: GPUTexture, width: number, height: number): Promise<Uint8ClampedArray> {
    const { device } = this
    // Create a buffer to store the read data
    const buffer = device.createBuffer({
      size: width * height * 4, // 4 bytes per pixel (RGBA)
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })

    // Create a command encoder
    const commandEncoder = device.createCommandEncoder()

    // Copy the texture to the buffer
    commandEncoder.copyTextureToBuffer(
      { texture },
      { buffer, bytesPerRow: width * 4 },
      { width, height, depthOrArrayLayers: 1 }
    )

    // Submit the commands to the GPU
    const gpuCommands = commandEncoder.finish()
    device.queue.submit([gpuCommands])

    // Wait for the GPU to finish executing the commands
    await buffer.mapAsync(GPUMapMode.READ)

    // Create a new Uint8ClampedArray view of the buffer's contents
    const arrayBuffer = buffer.getMappedRange()
    const data = new Uint8ClampedArray(arrayBuffer)

    // Create a copy of the data to return
    const result = new Uint8ClampedArray(data)
    // Unmap the buffer
    buffer.unmap()

    return result
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 7: shared resource binding group and binding group layout object
  buildLayout (
    name: string,
    bindings: GPUBufferBindingType[],
    visibility = GPUShaderStage.VERTEX
  ): GPUBindGroupLayout {
    return this.device.createBindGroupLayout({
      label: `${name} BindGroupLayout`,
      entries: bindings.map((type, index) => ({
        binding: index,
        visibility,
        buffer: { type }
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

  injectImages (maxHeight: number, images: GlyphImages): boolean {
    const { device } = this
    // first increase texture size if needed
    const resized = this.#increaseTextureSize(maxHeight)
    // setup a command encoder to upload images all in one go
    const cE = device.createCommandEncoder()
    // upload each image to texture
    for (const { posX, posY, width, height, data } of images) {
      // first make sure width is a multiple of 256
      const paddedData = this.buildPaddedBuffer(data, width, height)
      this.uploadTextureData(this.sharedTexture, paddedData.data, width, height, undefined, { x: posX, y: posY, z: 0 }, 1, cE)
    }
    device.queue.submit([cE.finish()])
    return resized
  }

  injectSpriteImage (message: SpriteImageMessage): boolean {
    const { image, offsetX, offsetY, width, height, maxHeight } = message
    // first increase texture size if needed
    const resized = this.#increaseTextureSize(maxHeight)
    // then update texture
    this.uploadTextureData(this.sharedTexture, image, width, height, { x: 0, y: 0 }, { x: offsetX, y: offsetY, z: 0 })
    return resized
  }

  #increaseTextureSize (newHeight: number): boolean {
    const { width, height } = this.sharedTexture
    if (newHeight <= height) return false
    const newTexture = this.buildTexture(this.sharedTexture, width, newHeight)
    this.sharedTexture.destroy()
    this.sharedTexture = newTexture
    return true
  }

  createPatternBindGroup (fillTexturePositions: GPUBuffer, texture = this.sharedTexture): GPUBindGroup {
    const { device, maskPatternBindGroupLayout, patternSampler } = this
    return device.createBindGroup({
      label: 'Fill Pattern BindGroup',
      layout: maskPatternBindGroupLayout,
      entries: [
        { binding: 4, resource: { buffer: fillTexturePositions } },
        { binding: 5, resource: patternSampler },
        { binding: 6, resource: texture.createView() }
      ]
    })
  }

  destroy (): void {
    this.sharedTexture.destroy()
    this.#viewUniformBuffer.destroy()
    this.#matrixUniformBuffer.destroy()
    this.#renderTarget?.destroy()
    this.#depthStencilTexture.destroy()
    this.#interactiveIndexBuffer.destroy()
    this.#interactiveResultBuffer.destroy()
    this.device.destroy()
  }
}

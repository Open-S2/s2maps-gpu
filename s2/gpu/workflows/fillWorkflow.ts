import shaderCode from '../shaders/fill.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type {
  FillFeature as FillFeatureSpec,
  FillSource,
  FillWorkflow as FillWorkflowSpec,
  MaskSource,
  TileMaskSource
} from './workflow.spec'
import type {
  FillDefinition,
  FillStyle,
  FillWorkflowLayerGuideGPU,
  LayerDefinitionBase
} from 'style/style.spec'
import type { FillData } from 'workers/worker.spec'
import type { TileGPU as Tile } from 'source/tile.spec'

const SHADER_BUFFER_LAYOUT: Iterable<GPUVertexBufferLayout> = [
  { // position
    arrayStride: 4 * 2,
    attributes: [{
      shaderLocation: 0,
      offset: 0,
      format: 'float32x2'
    }]
  },
  { // code
    arrayStride: 4,
    attributes: [{
      shaderLocation: 1,
      offset: 0,
      format: 'uint32'
    }]
  }
]

export class FillFeature implements FillFeatureSpec {
  type = 'fill' as const
  sourceName: string
  invert: boolean
  opaque: boolean
  interactive: boolean
  bindGroup: GPUBindGroup
  fillPatternBindGroup: GPUBindGroup
  fillInteractiveBindGroup?: GPUBindGroup | undefined
  constructor (
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
    public parent?: Tile
  ) {
    const { sourceName, invert, opaque, interactive } = layerGuide
    this.sourceName = sourceName
    this.invert = invert
    this.opaque = opaque
    this.interactive = interactive
    this.fillPatternBindGroup = tile.context.createPatternBindGroup(fillTexturePositions)
    this.bindGroup = this.#buildBindGroup()
    if (fillInteractiveBuffer !== undefined) this.fillInteractiveBindGroup = this.#buildInteractiveBindGroup()
  }

  draw (): void {
    const { maskLayer, tile, parent, workflow } = this
    const { mask } = parent ?? tile
    workflow.context.setStencilReference(tile.tmpMaskID)
    if (maskLayer) workflow.drawMask(mask, this)
    else workflow.draw(this)
  }

  updateSharedTexture (): void {
    const { context } = this.workflow
    this.fillPatternBindGroup = context.createPatternBindGroup(this.fillTexturePositions)
  }

  destroy (): void {
    this.featureCodeBuffer.destroy()
    this.fillTexturePositions.destroy()
    this.fillInteractiveBuffer?.destroy()
  }

  duplicate (tile: Tile, parent: Tile): FillFeature {
    const { workflow, layerGuide, maskLayer, source, count, offset, featureCodeBuffer, fillInteractiveBuffer, featureCode, fillTexturePositions } = this
    const { context } = this.workflow
    const cE = context.device.createCommandEncoder()
    const newFeatureCodeBuffer = context.duplicateGPUBuffer(featureCodeBuffer, cE)
    const newFillTexturePositions = context.duplicateGPUBuffer(fillTexturePositions, cE)
    const newFillInteractiveBuffer = (fillInteractiveBuffer !== undefined) ? context.duplicateGPUBuffer(fillInteractiveBuffer, cE) : undefined
    context.device.queue.submit([cE.finish()])
    return new FillFeature(
      workflow, layerGuide, maskLayer, source, count, offset, tile,
      newFeatureCodeBuffer, newFillTexturePositions, newFillInteractiveBuffer, featureCode,
      parent
    )
  }

  #buildBindGroup (): GPUBindGroup {
    const { workflow, tile, parent, layerGuide, featureCodeBuffer } = this
    const { context } = workflow
    const { mask } = parent ?? tile
    const { layerBuffer, layerCodeBuffer } = layerGuide
    return context.buildGroup(
      'Fill Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
  }

  #buildInteractiveBindGroup (): GPUBindGroup {
    const { workflow, tile, source, fillInteractiveBuffer } = this
    if (fillInteractiveBuffer === undefined) throw new Error('Fill Interactive Buffer is undefined')
    if (!('idBuffer' in source)) throw new Error('Source does not have an idBuffer')
    return tile.context.buildGroup(
      'Fill Interactive BindGroup',
      workflow.fillInteractiveBindGroupLayout,
      [fillInteractiveBuffer, source.vertexBuffer, source.indexBuffer, source.idBuffer]
    )
  }
}

export default class FillWorkflow implements FillWorkflowSpec {
  layerGuides = new Map<number, FillWorkflowLayerGuideGPU>()
  interactivePipeline!: GPUComputePipeline
  maskPipeline!: GPURenderPipeline
  fillPipeline!: GPURenderPipeline
  maskFillPipeline!: GPURenderPipeline
  invertPipeline!: GPURenderPipeline
  #shaderModule!: GPUShaderModule
  #pipelineLayout!: GPUPipelineLayout
  fillInteractiveBindGroupLayout!: GPUBindGroupLayout
  constructor (public context: WebGPUContext) {}

  async setup (): Promise<void> {
    const { device, frameBindGroupLayout, featureBindGroupLayout, maskPatternBindGroupLayout } = this.context
    this.#shaderModule = device.createShaderModule({ label: 'Fill Shader Module', code: shaderCode })
    this.#pipelineLayout = device.createPipelineLayout({
      label: 'Fill Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, maskPatternBindGroupLayout]
    })
    this.maskPipeline = await this.#getPipeline('mask')
    this.fillPipeline = await this.#getPipeline('fill')
    this.maskFillPipeline = await this.#getPipeline('mask-fill')
    this.invertPipeline = await this.#getPipeline('invert')
    this.interactivePipeline = await this.#getComputePipeline()
  }

  destroy (): void {
    for (const { layerBuffer, layerCodeBuffer } of this.layerGuides.values()) {
      layerBuffer.destroy()
      layerCodeBuffer.destroy()
    }
  }

  // programs helps design the appropriate layer parameters
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: FillStyle): FillDefinition {
    const { context } = this
    const { source, layerIndex, lch, visible } = layerBase
    // PRE) get layer base
    let { color, opacity, pattern, patternFamily, patternMovement, invert, opaque, interactive, cursor } = layer
    invert = invert ?? false
    opaque = opaque ?? false
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    // 1) build definition
    color = color ?? 'rgb(0, 0, 0)'
    opacity = opacity ?? 1
    patternFamily = patternFamily ?? '__images'
    patternMovement = patternMovement ?? false
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
      cursor
    }
    // 2) build the layerCode
    const layerCode: number[] = []
    for (const paint of [color, opacity]) {
      layerCode.push(...encodeLayerAttribute(paint, lch))
    }
    // 3) Setup layer buffers in GPU
    const layerBuffer = context.buildGPUBuffer('Layer Uniform Buffer', new Float32Array([context.getDepthPosition(layerIndex), ~~lch]), GPUBufferUsage.UNIFORM)
    const layerCodeBuffer = context.buildGPUBuffer('Layer Code Buffer', new Float32Array(layerCode), GPUBufferUsage.STORAGE)
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
      visible
    })

    return layerDefinition
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  async buildMaskFeature ({ layerIndex, minzoom, maxzoom }: FillDefinition, tile: Tile): Promise<void> {
    const { context } = this
    const { zoom, mask } = tile
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return

    const layerGuide = this.layerGuides.get(layerIndex)
    if (layerGuide === undefined) return
    const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array([0]), GPUBufferUsage.STORAGE)
    const fillTexturePositions = context.buildGPUBuffer('Fill Texture Positions', new Float32Array([0, 0, 0, 0, 0]), GPUBufferUsage.UNIFORM)
    const feature = new FillFeature(
      this, layerGuide, true, mask, mask.count, mask.offset,
      tile, featureCodeBuffer, fillTexturePositions
    )
    tile.addFeatures([feature])
  }

  buildSource (fillData: FillData, tile: Tile): void {
    const { context } = this
    const { vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer, featureGuideBuffer } = fillData
    // prep buffers
    const source: FillSource = {
      type: 'fill' as const,
      vertexBuffer: context.buildGPUBuffer('Fill Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE),
      indexBuffer: context.buildGPUBuffer('Fill Index Buffer', new Uint32Array(indexBuffer), GPUBufferUsage.INDEX | GPUBufferUsage.STORAGE),
      idBuffer: context.buildGPUBuffer('Fill ID Buffer', new Uint32Array(idBuffer), GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE),
      codeTypeBuffer: context.buildGPUBuffer('Fill Code Type Buffer', new Uint32Array(codeTypeBuffer), GPUBufferUsage.VERTEX),
      destroy: () => {
        const { vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer } = source
        vertexBuffer.destroy()
        indexBuffer.destroy()
        idBuffer.destroy()
        codeTypeBuffer.destroy()
      }
    }
    // build features
    this.#buildFeatures(source, tile, new Float32Array(featureGuideBuffer))
  }

  #buildFeatures (source: FillSource, tile: Tile, featureGuideArray: Float32Array): void {
    const { context } = this
    const features: FillFeatureSpec[] = []

    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // build featureCode
      let featureCode: number[] = [0]
      if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
      // update index
      i += encodingSize
      // get the pattern
      const [texX, texY, texW, texH, patternMovement] = featureGuideArray.slice(i, i + 5)
      i += 5

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(featureCode), GPUBufferUsage.STORAGE)
      const fillTexturePositions = context.buildGPUBuffer('Fill Texture Positions', new Float32Array([texX, texY, texW, texH, patternMovement]), GPUBufferUsage.UNIFORM)
      const fillInteractiveBuffer = context.buildGPUBuffer('Fill Interactive Buffer', new Uint32Array([offset / 3, count / 3]), GPUBufferUsage.UNIFORM)
      const feature = new FillFeature(
        this, layerGuide, false, source, count, offset, tile,
        featureCodeBuffer, fillTexturePositions, fillInteractiveBuffer, featureCode
      )
      features.push(feature)
    }

    tile.addFeatures(features)
  }

  // https://programmer.ink/think/several-best-practices-of-webgpu.html
  // BEST PRACTICE 6: it is recommended to create pipeline asynchronously
  // BEST PRACTICE 7: explicitly define pipeline layouts
  async #getPipeline (type: 'fill' | 'mask' | 'invert' | 'mask-fill'): Promise<GPURenderPipeline> {
    const { context } = this
    const { device, format, defaultBlend, sampleCount, projection } = context
    const invert = type === 'invert'
    const mask = type === 'mask'
    const maskFill = type === 'mask-fill'

    const stencilState: GPUStencilFaceState = {
      compare: (mask) ? 'always' : 'equal',
      failOp: 'keep',
      depthFailOp: 'keep',
      passOp: 'replace'
    }

    return await device.createRenderPipelineAsync({
      label: `Fill ${type} Pipeline`,
      layout: this.#pipelineLayout,
      vertex: {
        module: this.#shaderModule,
        entryPoint: 'vMain',
        buffers: SHADER_BUFFER_LAYOUT
      },
      fragment: {
        module: this.#shaderModule,
        entryPoint: 'fMain',
        targets: [{
          format,
          writeMask: (mask || invert) ? 0 : GPUColorWrite.ALL,
          blend: defaultBlend
        }]
      },
      primitive: {
        topology: (mask || maskFill) ? 'triangle-strip' : 'triangle-list',
        cullMode: projection === 'S2' ? 'back' : 'front',
        stripIndexFormat: (mask || maskFill) ? 'uint32' : undefined
      },
      multisample: { count: sampleCount },
      depthStencil: {
        depthWriteEnabled: !mask,
        depthCompare: mask ? 'always' : 'less',
        format: 'depth24plus-stencil8',
        stencilFront: stencilState,
        stencilBack: stencilState,
        stencilReadMask: 0xFFFFFFFF,
        stencilWriteMask: 0xFFFFFFFF
      }
    })
  }

  async #getComputePipeline (): Promise<GPUComputePipeline> {
    const { context } = this
    const { device, frameBindGroupLayout, featureBindGroupLayout, interactiveBindGroupLayout } = context

    this.fillInteractiveBindGroupLayout = device.createBindGroupLayout({
      label: 'Fill Interactive BindGroupLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // interactive offset & count
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // positions
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // indexes
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } } // ids
      ]
    })

    const layout = device.createPipelineLayout({
      label: 'Fill Interactive Pipeline Layout',
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.fillInteractiveBindGroupLayout, interactiveBindGroupLayout]
    })

    return await device.createComputePipelineAsync({
      label: 'Fill Interactive Pipeline',
      layout,
      compute: { module: this.#shaderModule, entryPoint: 'interactive' }
    })
  }

  draw (featureGuide: FillFeatureSpec): void {
    const { context, invertPipeline, fillPipeline } = this
    // get current source data
    const { passEncoder } = context
    const { layerGuide, tile, parent, invert, bindGroup, fillPatternBindGroup, source, count, offset } = featureGuide
    const { vertexBuffer, indexBuffer, codeTypeBuffer } = source
    const pipeline = invert ? invertPipeline : fillPipeline
    const { mask } = parent ?? tile
    // if the layer is not visible, move on
    if (!layerGuide.visible) return

    // setup pipeline, bind groups, & buffers
    context.setRenderPipeline(pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, fillPatternBindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setVertexBuffer(1, codeTypeBuffer)
    // draw
    passEncoder.drawIndexed(count, 1, offset)

    if (invert) this.drawMask(mask, featureGuide)
  }

  drawMask (
    { vertexBuffer, indexBuffer, codeTypeBuffer, bindGroup, fillPatternBindGroup, count, offset }: TileMaskSource,
    featureGuide?: FillFeatureSpec
  ): void {
    const { context, maskPipeline, maskFillPipeline } = this
    // if the layer is not visible, move on
    if (featureGuide?.layerGuide?.visible === false) return
    // get current source data
    const { passEncoder } = context
    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(featureGuide === undefined ? maskPipeline : maskFillPipeline)
    passEncoder.setBindGroup(1, featureGuide?.bindGroup ?? bindGroup)
    passEncoder.setBindGroup(2, featureGuide?.fillPatternBindGroup ?? fillPatternBindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setVertexBuffer(1, codeTypeBuffer)
    // draw
    passEncoder.drawIndexed(count, 1, offset)
  }

  computeInteractive ({ layerGuide, bindGroup, fillInteractiveBindGroup, count }: FillFeatureSpec): void {
    if (!layerGuide.visible) return
    const { computePass, interactiveBindGroup } = this.context
    this.context.setComputePipeline(this.interactivePipeline)
    // set bind group & draw
    computePass.setBindGroup(1, bindGroup)
    computePass.setBindGroup(2, interactiveBindGroup)
    if (fillInteractiveBindGroup !== undefined) computePass.setBindGroup(3, fillInteractiveBindGroup)
    computePass.dispatchWorkgroups(Math.ceil(count / 3 / 64))
  }
}

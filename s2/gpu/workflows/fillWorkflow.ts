/* eslint-env browser */
import shaderCode from '../shaders/fill.wgsl'
import encodeLayerAttribute from 'style/encodeLayerAttribute'

import type { WebGPUContext } from '../context'
import type { FillFeature, FillSource, FillWorkflow as FillWorkflowSpec, TileMaskSource } from './workflow.spec'
import type {
  FillLayerDefinition,
  FillLayerStyle,
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

export default class FillWorkflow implements FillWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, FillWorkflowLayerGuideGPU>()
  interactivePipeline!: GPUComputePipeline
  maskPipeline!: GPURenderPipeline
  fillPipeline!: GPURenderPipeline
  maskFillPipeline!: GPURenderPipeline
  invertPipeline!: GPURenderPipeline
  #shaderModule!: GPUShaderModule
  #pipelineLayout!: GPUPipelineLayout
  #fillInteractiveBindGroupLayout!: GPUBindGroupLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

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
  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: FillLayerStyle): FillLayerDefinition {
    const { context } = this
    const { source, layerIndex, lch } = layerBase
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
    const layerDefinition: FillLayerDefinition = {
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
      interactive
    })

    return layerDefinition
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  async buildMaskFeature ({ layerIndex, minzoom, maxzoom }: FillLayerDefinition, tile: Tile): Promise<void> {
    const { context } = this
    const { zoom, mask } = tile
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return

    const layer = this.layerGuides.get(layerIndex)
    if (layer === undefined) return
    const { sourceName, layerBuffer, layerCodeBuffer, lch, invert, opaque, interactive } = layer
    const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array([0]), GPUBufferUsage.STORAGE)
    const bindGroup = context.buildGroup(
      'Feature BindGroup',
      context.featureBindGroupLayout,
      [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
    )
    const fillTexturePositions = context.buildGPUBuffer('Fill Texture Positions', new Float32Array([0, 0, 0, 0, 0]), GPUBufferUsage.UNIFORM)

    const feature: FillFeature = {
      type: 'fill' as const,
      sourceName,
      maskLayer: true,
      source: mask,
      count: mask.count,
      offset: mask.offset,
      tile,
      layerIndex,
      lch,
      invert,
      opaque,
      interactive,
      featureCode: [0],
      bindGroup,
      fillPatternBindGroup: context.createPatternBindGroup(fillTexturePositions),
      draw: () => {
        context.setStencilReference(tile.tmpMaskID)
        this.drawMask(mask, feature)
      },
      updateSharedTexture: () => {
        feature.fillPatternBindGroup = context.createPatternBindGroup(fillTexturePositions)
      },
      destroy: () => {
        featureCodeBuffer.destroy()
        fillTexturePositions.destroy()
      }
    }
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
    const { mask } = tile
    const features: FillFeature[] = []

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
      const { sourceName, layerBuffer, layerCodeBuffer, lch, invert, opaque, interactive } = layerGuide

      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(featureCode), GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )
      const fillTexturePositions = context.buildGPUBuffer('Fill Texture Positions', new Float32Array([texX, texY, texW, texH, patternMovement]), GPUBufferUsage.UNIFORM)
      const fillInteractiveBuffer = context.buildGPUBuffer('Fill Interactive Buffer', new Uint32Array([offset / 3, count / 3]), GPUBufferUsage.UNIFORM)
      const fillInteractiveBindGroup = context.buildGroup(
        'Fill Interactive BindGroup',
        this.#fillInteractiveBindGroupLayout,
        [fillInteractiveBuffer, source.vertexBuffer, source.indexBuffer, source.idBuffer]
      )

      const feature: FillFeature = {
        type: 'fill' as const,
        maskLayer: false,
        source,
        tile,
        count,
        offset,
        sourceName,
        invert,
        layerIndex,
        opaque,
        featureCode,
        lch,
        interactive,
        bindGroup,
        fillPatternBindGroup: context.createPatternBindGroup(fillTexturePositions),
        fillInteractiveBindGroup,
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
          this.draw(feature)
        },
        compute: () => { this.computeInteractive(feature) },
        updateSharedTexture: () => {
          feature.fillPatternBindGroup = context.createPatternBindGroup(fillTexturePositions)
        },
        destroy: () => {
          featureCodeBuffer.destroy()
          fillInteractiveBuffer.destroy()
          fillTexturePositions.destroy()
        }
      }
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

    this.#fillInteractiveBindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout, this.#fillInteractiveBindGroupLayout, interactiveBindGroupLayout]
    })

    return await device.createComputePipelineAsync({
      label: 'Fill Interactive Pipeline',
      layout,
      compute: {
        module: this.#shaderModule,
        entryPoint: 'interactive'
      }
    })
  }

  draw (featureGuide: FillFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { tile, invert, bindGroup, fillPatternBindGroup, source, count, offset } = featureGuide
    const { vertexBuffer, indexBuffer, codeTypeBuffer } = source
    const pipeline = invert ? this.invertPipeline : this.fillPipeline

    // setup pipeline, bind groups, & buffers
    this.context.setRenderPipeline(pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setBindGroup(2, fillPatternBindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setVertexBuffer(1, codeTypeBuffer)
    // draw
    passEncoder.drawIndexed(count, 1, offset)

    if (invert) this.drawMask(tile.mask, featureGuide)
  }

  drawMask (
    { vertexBuffer, indexBuffer, codeTypeBuffer, bindGroup, fillPatternBindGroup, count, offset }: TileMaskSource,
    featureGuide?: FillFeature
  ): void {
    const { context, maskPipeline, maskFillPipeline } = this
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

  computeInteractive ({ bindGroup, fillInteractiveBindGroup, count }: FillFeature): void {
    const { computePass, interactiveBindGroup } = this.context
    this.context.setComputePipeline(this.interactivePipeline)
    // set bind group & draw
    computePass.setBindGroup(1, bindGroup)
    computePass.setBindGroup(2, interactiveBindGroup)
    if (fillInteractiveBindGroup !== undefined) computePass.setBindGroup(3, fillInteractiveBindGroup)
    computePass.dispatchWorkgroups(Math.ceil(count / 3 / 64))
  }
}

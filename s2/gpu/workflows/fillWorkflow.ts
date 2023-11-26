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
  { // id
    arrayStride: 4,
    attributes: [{
      shaderLocation: 1,
      offset: 0,
      format: 'uint32'
    }]
  },
  { // code
    arrayStride: 4,
    attributes: [{
      shaderLocation: 2,
      offset: 0,
      format: 'uint32'
    }]
  }
]

export default class FillWorkflow implements FillWorkflowSpec {
  context: WebGPUContext
  layerGuides = new Map<number, FillWorkflowLayerGuideGPU>()
  maskPipeline!: GPURenderPipeline
  fillPipeline!: GPURenderPipeline
  maskFillPipeline!: GPURenderPipeline
  invertPipeline!: GPURenderPipeline
  #shaderModule!: GPUShaderModule
  #pipelineLayout!: GPUPipelineLayout
  constructor (context: WebGPUContext) {
    this.context = context
  }

  async setup (): Promise<void> {
    const { device, frameBindGroupLayout, featureBindGroupLayout } = this.context
    this.#shaderModule = device.createShaderModule({ code: shaderCode })
    this.#pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, featureBindGroupLayout]
    })
    this.maskPipeline = await this.#getPipeline('mask')
    this.fillPipeline = await this.#getPipeline('fill')
    this.maskFillPipeline = await this.#getPipeline('mask-fill')
    this.invertPipeline = await this.#getPipeline('invert')
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
    let { color, opacity, invert, opaque, interactive, cursor } = layer
    invert = invert ?? false
    opaque = opaque ?? false
    interactive = interactive ?? false
    cursor = cursor ?? 'default'
    // 1) build definition
    color = color ?? 'rgb(0, 0, 0)'
    opacity = opacity ?? 1
    const layerDefinition: FillLayerDefinition = {
      ...layerBase,
      type: 'fill' as const,
      // paint
      color,
      opacity,
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
      draw: () => {
        context.setStencilReference(tile.tmpMaskID)
        this.drawMask(mask, feature)
      },
      destroy: () => {
        featureCodeBuffer.destroy()
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
      vertexBuffer: context.buildGPUBuffer('Fill Vertex Buffer', new Float32Array(vertexBuffer), GPUBufferUsage.VERTEX),
      indexBuffer: context.buildGPUBuffer('Fill Index Buffer', new Uint32Array(indexBuffer), GPUBufferUsage.INDEX),
      idBuffer: context.buildGPUBuffer('Fill ID Buffer', new Uint32Array(idBuffer), GPUBufferUsage.VERTEX),
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
      // If webgl1, we pull out the color and opacity otherwise build featureCode
      let featureCode: number[] = [0]
      if (encodingSize > 0) featureCode = [...featureGuideArray.slice(i, i + encodingSize)]
      // update index
      i += encodingSize

      const layerGuide = this.layerGuides.get(layerIndex)
      if (layerGuide === undefined) continue
      const { sourceName, layerBuffer, layerCodeBuffer, lch, invert, opaque, interactive } = layerGuide

      // TODO: we need to create two features if interactive is true.

      const featureCodeBuffer = context.buildGPUBuffer('Feature Code Buffer', new Float32Array(featureCode), GPUBufferUsage.STORAGE)
      const bindGroup = context.buildGroup(
        'Feature BindGroup',
        context.featureBindGroupLayout,
        [mask.uniformBuffer, mask.positionBuffer, layerBuffer, layerCodeBuffer, featureCodeBuffer]
      )

      const feature = {
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
        draw: () => {
          context.setStencilReference(tile.tmpMaskID)
          this.draw(feature)
        },
        destroy: () => {
          featureCodeBuffer.destroy()
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
    const { device, format, defaultBlend, sampleCount } = context
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
        cullMode: 'back',
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

  draw (featureGuide: FillFeature): void {
    // get current source data
    const { passEncoder } = this.context
    const { tile, invert, bindGroup, source, count, offset } = featureGuide
    const { vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer } = source
    const pipeline = invert ? this.invertPipeline : this.fillPipeline

    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(pipeline)
    passEncoder.setBindGroup(1, bindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setVertexBuffer(1, idBuffer)
    passEncoder.setVertexBuffer(2, codeTypeBuffer)
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)

    if (invert) this.drawMask(tile.mask, featureGuide)
  }

  drawMask (
    { vertexBuffer, indexBuffer, idBuffer, codeTypeBuffer, bindGroup, count, offset }: TileMaskSource,
    featureGuide?: FillFeature
  ): void {
    const { context, maskPipeline, maskFillPipeline } = this
    // get current source data
    const { passEncoder } = context
    // setup pipeline, bind groups, & buffers
    passEncoder.setPipeline(featureGuide === undefined ? maskPipeline : maskFillPipeline)
    passEncoder.setBindGroup(1, featureGuide?.bindGroup ?? bindGroup)
    passEncoder.setVertexBuffer(0, vertexBuffer)
    passEncoder.setIndexBuffer(indexBuffer, 'uint32')
    passEncoder.setVertexBuffer(1, idBuffer)
    passEncoder.setVertexBuffer(2, codeTypeBuffer)
    // draw
    passEncoder.drawIndexed(count, 1, offset, 0, 0)
  }
}
